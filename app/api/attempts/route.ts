import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const AttemptSchema = z.object({
  quizId: z.uuid(),
  mode: z.enum(["full", "retry_mistakes"]),
  startedAt: z.iso.datetime(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        userAnswer: z.string().max(2000),
        isCorrect: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
});

/** Saves a finished quiz attempt and its answers. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const parsed = AttemptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attempt." }, { status: 400 });
  const { quizId, mode, startedAt, answers } = parsed.data;

  const supabase = await createClient();

  // Make sure every question belongs to this quiz (and the quiz to this user, via RLS).
  const { data: questions } = await supabase.from("questions").select("id").eq("quiz_id", quizId);
  const validIds = new Set((questions ?? []).map((q) => q.id as string));
  if (validIds.size === 0 || answers.some((a) => !validIds.has(a.questionId))) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const score = answers.filter((a) => a.isCorrect).length;
  const { data: attempt, error } = await supabase
    .from("attempts")
    .insert({
      quiz_id: quizId,
      user_id: user.id,
      mode,
      score,
      total: answers.length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !attempt) {
    console.error(error);
    return NextResponse.json({ error: "Couldn't save your results." }, { status: 500 });
  }

  const { error: answersError } = await supabase.from("answers").insert(
    answers.map((a) => ({
      attempt_id: attempt.id,
      question_id: a.questionId,
      user_answer: a.userAnswer,
      is_correct: a.isCorrect,
    })),
  );
  if (answersError) {
    console.error(answersError);
    return NextResponse.json({ error: "Couldn't save your answers." }, { status: 500 });
  }

  return NextResponse.json({ attemptId: attempt.id, score, total: answers.length });
}
