import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";
import {
  AiQuizSchema,
  QUESTION_TYPE_LABELS,
  type AiQuestion,
  type AiQuiz,
  type QuestionType,
  type QuizSettings,
} from "./schemas";

export class GenerationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Gemini accepts a subset of JSON Schema; drop the "$schema" meta key it doesn't need.
const RESPONSE_SCHEMA: Record<string, unknown> = z.toJSONSchema(AiQuizSchema, { target: "draft-7" });
delete RESPONSE_SCHEMA.$schema;

const SYSTEM_INSTRUCTION = `You are Recallzy, a study assistant that writes practice questions from a student's own study material.

Rules:
- Use ONLY information found in the provided material. Never invent facts that are not in it.
- Detect the main language of the material and write EVERYTHING (title, questions, options, answers, explanations, topics, hints) in that language. Put the language's English name in "language" (e.g. "English", "Indonesian").
- Cover the material broadly. Do not repeat questions. Skip trivia about the document itself (file name, author, page numbers) unless it is part of what is being studied.
- "title": a short name for this quiz based on the material's subject (max 8 words).

Per question type:
- "mcq": exactly 4 options. Exactly one is correct, and "correct_answer" must be copied EXACTLY from "options". Wrong options must be plausible, not silly. Vary the position of the correct option.
- "true_false": "options" is exactly the words for True and False in the material's language, in that order (e.g. ["True", "False"] or ["Benar", "Salah"]). "correct_answer" is copied exactly from "options". Mix true and false statements.
- "short": the answer is a short word or phrase (1-5 words). "accepted_answers" lists 2-6 acceptable variants (synonyms, abbreviations, with/without articles, common spellings). "options" is [].
- "flashcard": "prompt" is the front (a term, concept, or question) and "correct_answer" is the back (a concise answer, 1-2 sentences). "options" is [].

For every question:
- "explanation": 1-3 sentences on WHY the correct answer is correct, based on the material. Write it so it teaches the idea.
- "option_explanations": for "mcq" and "true_false", one entry for EACH WRONG option with "why_wrong" explaining in one sentence why it is wrong. For "short" and "flashcard", use [].
- "accepted_answers": for types other than "short", use [].
- "topic": a short topic label (2-4 words). Reuse the same label for questions on the same topic so they can be grouped.
- "difficulty": "easy", "medium" or "hard".
- "source_hint": where in the material the answer comes from (e.g. "Page 3 — Photosynthesis", "Slide 5", "Notes photo, top section").`;

/** Splits the total question count evenly across the selected types. */
export function distributeCounts(types: QuestionType[], count: number): Record<QuestionType, number> {
  const result = {} as Record<QuestionType, number>;
  types.forEach((type, i) => {
    result[type] = Math.floor(count / types.length) + (i < count % types.length ? 1 : 0);
  });
  return result;
}

function buildRequest(settings: QuizSettings) {
  const counts = distributeCounts(settings.types, settings.count);
  const lines = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `- ${n} × "${type}" (${QUESTION_TYPE_LABELS[type as QuestionType]})`);
  const difficulty =
    settings.difficulty === "mixed"
      ? "a mix of easy, medium and hard"
      : `mostly ${settings.difficulty}`;

  return `Create a practice quiz from the study material above.

Generate exactly ${settings.count} questions:
${lines.join("\n")}

Difficulty: ${difficulty}.
If the material is too short for that many good questions, write as many good ones as it supports.`;
}

/**
 * Sends the material to Gemini and returns a validated quiz.
 * `materialParts` are the files (PDF/images inline) and extracted text, already labelled.
 */
export async function generateQuiz(
  materialParts: Part[],
  settings: QuizSettings,
  apiKey: string,
): Promise<AiQuiz> {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  // Hosting cuts requests off at 60 s, so the AI gets a total budget a bit below that.
  const deadline = Date.now() + GENERATION_BUDGET_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeLeft = deadline - Date.now();
    if (attempt > 0 && timeLeft < 15_000) break; // not enough time for a retry
    const started = Date.now();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [...materialParts, { text: buildRequest(settings) }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0.5,
          // Writing quiz questions doesn't need deep reasoning; low thinking is much faster.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          httpOptions: { timeout: timeLeft },
        },
      });
      console.info(`Gemini ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s (attempt ${attempt + 1})`);

      const parsed = AiQuizSchema.safeParse(JSON.parse(response.text ?? ""));
      if (!parsed.success) {
        lastError = parsed.error;
        continue; // retry once on malformed output
      }
      const quiz = cleanQuiz(parsed.data);
      if (quiz.questions.length === 0) {
        lastError = new Error("No usable questions");
        continue;
      }
      return quiz;
    } catch (err) {
      if (err instanceof ApiError) throw toGenerationError(err);
      if (isTimeout(err)) {
        console.error(`Gemini ${model} timed out after ${((Date.now() - started) / 1000).toFixed(1)}s`);
        throw new GenerationError(
          "The AI took too long to answer. Try fewer questions or fewer files, then try again.",
          504,
        );
      }
      lastError = err; // e.g. JSON.parse failure — retry once
    }
  }

  console.error("Quiz generation failed", lastError);
  throw new GenerationError(
    "The AI couldn't make a quiz from this material. Try clearer files or fewer questions.",
    502,
  );
}

const GENERATION_BUDGET_MS = 50_000;

function isTimeout(err: unknown) {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || err.name === "TimeoutError" || /abort|timed? ?out/i.test(err.message);
}

function toGenerationError(err: ApiError): GenerationError {
  console.error("Gemini API error", err.status, err.message);
  if (err.status === 429) {
    return new GenerationError(
      "Recallzy is busy right now (the free AI limit was reached). Please try again later, or add your own free Gemini key in Settings.",
      429,
    );
  }
  if (err.status === 400 && /api key/i.test(err.message)) {
    return new GenerationError("That Gemini API key isn't valid. Check it in Settings.", 400);
  }
  if (err.status === 401 || err.status === 403) {
    return new GenerationError("That Gemini API key isn't allowed to do this. Check it in Settings.", 400);
  }
  if (err.status === 400) {
    return new GenerationError(
      "The AI couldn't read these files. Try a different file, or fewer/smaller files.",
      400,
    );
  }
  return new GenerationError("The AI service had a problem. Please try again in a minute.", 502);
}

/** Fixes small AI slip-ups and drops questions that can't be graded correctly. */
function cleanQuiz(quiz: AiQuiz): AiQuiz {
  const questions = quiz.questions.flatMap((q): AiQuestion[] => {
    const options = q.options.map((o) => o.trim()).filter(Boolean);
    let correct = q.correct_answer.trim();

    if (q.type === "mcq" || q.type === "true_false") {
      const unique = [...new Set(options)];
      const expected = q.type === "mcq" ? unique.length >= 3 : unique.length === 2;
      if (!expected) return [];
      // Accept a case/space-insensitive match, then use the option's exact text.
      const match = unique.find((o) => o.toLowerCase() === correct.toLowerCase());
      if (!match) return [];
      correct = match;
      return [{ ...q, options: unique, correct_answer: correct, accepted_answers: [] }];
    }

    if (q.type === "short") {
      const accepted = [...new Set([correct, ...q.accepted_answers.map((a) => a.trim()).filter(Boolean)])];
      return [{ ...q, options: [], correct_answer: correct, accepted_answers: accepted, option_explanations: [] }];
    }

    return [{ ...q, options: [], correct_answer: correct, accepted_answers: [], option_explanations: [] }];
  });

  return { ...quiz, title: quiz.title.trim(), questions };
}
