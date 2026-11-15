import { NextResponse, type NextRequest } from "next/server";
import type { Part } from "@google/genai";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { GenerateRequestSchema, MAX_FILE_BYTES, MAX_TEXT_CHARS, MAX_TOTAL_BYTES } from "@/lib/schemas";
import { geminiMimeOf, kindOf } from "@/lib/files";
import { extractDocxText, extractPptxText } from "@/lib/extract";
import { GenerationError, generateQuiz, sharedKeys } from "@/lib/gemini";
import { dailyLimit, recordUsage, usedToday } from "@/lib/limits";

export const runtime = "nodejs";
// Seconds. Leaves room for file reading + the AI's budget (GENERATION_BUDGET_MS = 80 s),
// including switching to backup models when one is slow or out of quota.
export const maxDuration = 120;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first.", 401);

  const parsed = GenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Something was wrong with the request. Please try again.", 400);
  const { files, text, settings } = parsed.data;

  if (files.length === 0 && !text.trim()) return fail("Add at least one file or paste some text.", 400);

  // Own key (from the user's browser) skips the shared daily limit.
  const ownKey = request.headers.get("x-gemini-key")?.trim() || null;
  const keys = ownKey ? [ownKey] : sharedKeys();
  if (keys.length === 0) return fail("The AI isn't set up yet (missing GEMINI_API_KEY).", 500);

  if (!ownKey && (await usedToday(user.id)) >= dailyLimit()) {
    return fail(
      `You've used all ${dailyLimit()} free quizzes for today. Come back tomorrow, or add your own free Gemini key in Settings.`,
      429,
    );
  }

  const supabase = await createClient();

  // ---- Read each uploaded file from Storage and turn it into something Gemini understands.
  const parts: Part[] = [];
  const materials: { title: string; file_type: string; storage_path: string | null }[] = [];
  let totalBytes = 0;

  for (const file of files) {
    // Files must live in the user's own folder (Storage rules enforce this too).
    if (!file.path.startsWith(`${user.id}/`)) return fail("Invalid file.", 403);
    const kind = kindOf(file.name);
    if (!kind) return fail(`Recallzy can't read "${file.name}" yet.`, 400);

    const { data: blob, error } = await supabase.storage.from("materials").download(file.path);
    if (error || !blob) return fail(`Couldn't read "${file.name}". Please upload it again.`, 400);
    if (blob.size > MAX_FILE_BYTES) return fail(`"${file.name}" is larger than 10 MB.`, 400);
    totalBytes += blob.size;

    const buffer = Buffer.from(await blob.arrayBuffer());
    materials.push({ title: file.name, file_type: kind, storage_path: file.path });

    try {
      if (kind === "pdf" || kind === "image") {
        if (totalBytes > MAX_TOTAL_BYTES) return fail("Files are too large together. Keep the total under 15 MB.", 400);
        parts.push({ text: `--- Material: ${file.name} ---` });
        parts.push({ inlineData: { mimeType: geminiMimeOf(file.name)!, data: buffer.toString("base64") } });
      } else {
        const extracted = kind === "docx" ? await extractDocxText(buffer) : await extractPptxText(buffer);
        if (!extracted) return fail(`"${file.name}" doesn't seem to contain any text.`, 400);
        parts.push({ text: `--- Material: ${file.name} ---\n${extracted.slice(0, MAX_TEXT_CHARS)}` });
      }
    } catch (err) {
      console.error("Extraction failed", file.name, err);
      return fail(`Couldn't open "${file.name}". Is it a valid ${kind.toUpperCase()} file?`, 400);
    }
  }

  if (text.trim()) {
    parts.push({ text: `--- Material: pasted notes ---\n${text.trim()}` });
    materials.push({ title: "Pasted notes", file_type: "text", storage_path: null });
  }

  // ---- Ask the AI.
  let quiz;
  try {
    quiz = await generateQuiz(parts, settings, keys, { ownKey: Boolean(ownKey) });
  } catch (err) {
    if (err instanceof GenerationError) return fail(err.message, err.status);
    console.error(err);
    return fail("Something went wrong while making your quiz. Please try again.", 500);
  }

  // ---- Save everything (as the user, so Row Level Security applies).
  const { data: quizRow, error: quizError } = await supabase
    .from("quizzes")
    .insert({ user_id: user.id, title: quiz.title, language: quiz.language, settings })
    .select("id")
    .single();
  if (quizError || !quizRow) {
    console.error(quizError);
    return fail("Couldn't save your quiz. Please try again.", 500);
  }

  const { error: questionsError } = await supabase.from("questions").insert(
    quiz.questions.map((q, i) => ({
      quiz_id: quizRow.id,
      position: i,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      accepted_answers: q.accepted_answers,
      explanation: q.explanation,
      option_explanations: Object.fromEntries(q.option_explanations.map((o) => [o.option, o.why_wrong])),
      topic: q.topic || null,
      difficulty: q.difficulty,
      source_hint: q.source_hint || null,
    })),
  );
  if (questionsError) {
    console.error(questionsError);
    await supabase.from("quizzes").delete().eq("id", quizRow.id);
    return fail("Couldn't save your quiz. Please try again.", 500);
  }

  const { data: materialRows } = await supabase
    .from("materials")
    .insert(materials.map((m) => ({ ...m, user_id: user.id })))
    .select("id");
  if (materialRows?.length) {
    await supabase
      .from("quiz_materials")
      .insert(materialRows.map((m) => ({ quiz_id: quizRow.id, material_id: m.id })));
  }

  if (!ownKey) await recordUsage(user.id);

  return NextResponse.json({ quizId: quizRow.id, questionCount: quiz.questions.length });
}
