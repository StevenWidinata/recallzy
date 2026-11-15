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

// ---------------------------------------------------------------------------
// Automatic fallback: each Gemini model has its own free quota, and each key
// (from a different Google project) has its own too. When one runs out, is
// overloaded or is too slow, we move on to the next model/key automatically.
// ---------------------------------------------------------------------------

/** Tried in this order. All support structured JSON and low thinking. */
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

/** Total time the AI may take, kept under the route's maxDuration. */
export const GENERATION_BUDGET_MS = 80_000;
/** One slow model shouldn't eat the whole budget — move on after this. */
const PER_ATTEMPT_MS = 35_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Models to try: GEMINI_MODELS (comma list) if set, else defaults with GEMINI_MODEL first. */
function modelList(): string[] {
  const custom = splitList(process.env.GEMINI_MODELS);
  if (custom.length) return custom;
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [...new Set([preferred, ...DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];
}

/** The site's shared keys: GEMINI_API_KEYS (comma list) and/or GEMINI_API_KEY. */
export function sharedKeys(): string[] {
  return [...new Set([...splitList(process.env.GEMINI_API_KEYS), ...splitList(process.env.GEMINI_API_KEY)])];
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Model+key combos that recently ran out of quota or failed, so the next request
 * skips straight past them. Lives per server instance — a best-effort shortcut.
 */
const cooldowns = new Map<string, number>();

type Candidate = { model: string; key: string; id: string; label: string };

/**
 * Sends the material to Gemini and returns a validated quiz.
 * `materialParts` are the files (PDF/images inline) and extracted text, already labelled.
 * `keys` is either the user's own key or the site's shared keys.
 */
export async function generateQuiz(
  materialParts: Part[],
  settings: QuizSettings,
  keys: string[],
  { ownKey }: { ownKey: boolean },
): Promise<AiQuiz> {
  const deadline = Date.now() + GENERATION_BUDGET_MS;
  const all: Candidate[] = modelList().flatMap((model) =>
    keys.map((key, i) => ({ model, key, id: `${key.slice(-8)}|${model}`, label: `${model} / key ${i + 1}` })),
  );
  // Skip combos that are cooling down — unless that's all of them, then try anyway.
  const ready = all.filter((c) => (cooldowns.get(c.id) ?? 0) <= Date.now());
  const queue = ready.length ? ready : all;

  let sawQuota = false;
  let sawTimeout = false;

  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const timeLeft = deadline - Date.now();
    if (timeLeft < 8_000) break;
    const isLast = i === queue.length - 1;
    const started = Date.now();
    const seconds = () => ((Date.now() - started) / 1000).toFixed(1);

    try {
      const quiz = await callGemini(c, materialParts, settings, isLast ? timeLeft : Math.min(timeLeft, PER_ATTEMPT_MS));
      console.info(`Gemini ${c.label} made the quiz in ${seconds()}s`);
      return quiz;
    } catch (err) {
      if (err instanceof ApiError) {
        console.warn(`Gemini ${c.label} failed (${err.status}) after ${seconds()}s: ${err.message.slice(0, 160)}`);

        if (err.status === 429) {
          // Out of quota. Daily limits wait longer than per-minute ones.
          sawQuota = true;
          cooldowns.set(c.id, Date.now() + (/day|daily/i.test(err.message) ? HOUR : MINUTE));
          continue;
        }
        if ([404, 500, 502, 503, 504].includes(err.status)) {
          // Model missing or Google overloaded — try the next one.
          cooldowns.set(c.id, Date.now() + MINUTE);
          continue;
        }
        const badKey = err.status === 401 || err.status === 403 || /api key/i.test(err.message);
        if (badKey && !ownKey) {
          // A shared key is broken: skip every model on that key.
          console.error(`Shared Gemini key ${keys.indexOf(c.key) + 1} is invalid — skipping it.`);
          for (const other of all) if (other.key === c.key) cooldowns.set(other.id, Date.now() + HOUR);
          queue.splice(i + 1, queue.length, ...queue.slice(i + 1).filter((q) => q.key !== c.key));
          continue;
        }
        // Problem with the request itself (e.g. unreadable file) — another model won't help.
        throw toGenerationError(err);
      }

      if (isTimeout(err)) {
        console.warn(`Gemini ${c.label} timed out after ${seconds()}s — trying the next one`);
        sawTimeout = true;
        continue;
      }

      console.warn(`Gemini ${c.label} returned an unusable quiz — trying the next one`, err);
    }
  }

  if (sawQuota && !sawTimeout) {
    throw new GenerationError(
      ownKey
        ? "Your Gemini key has reached its free limit for now. Try again later, or remove it in Settings to use Recallzy's free quizzes."
        : "Recallzy's free AI quota is used up for now. Please try again later, or add your own free Gemini key in Settings.",
      429,
    );
  }
  if (sawTimeout) {
    throw new GenerationError("The AI took too long to answer. Try fewer questions or fewer files, then try again.", 504);
  }
  throw new GenerationError("The AI couldn't make a quiz from this material. Try clearer files or fewer questions.", 502);
}

/** One Gemini request. Throws on API errors, timeouts or unusable output. */
async function callGemini(c: Candidate, materialParts: Part[], settings: QuizSettings, timeoutMs: number) {
  const ai = new GoogleGenAI({ apiKey: c.key });
  const response = await ai.models.generateContent({
    model: c.model,
    contents: [{ role: "user", parts: [...materialParts, { text: buildRequest(settings) }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      temperature: 0.5,
      // Writing quiz questions doesn't need deep reasoning; low thinking is much faster.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      httpOptions: { timeout: timeoutMs },
    },
  });

  const quiz = cleanQuiz(AiQuizSchema.parse(JSON.parse(response.text ?? "")));
  if (quiz.questions.length === 0) throw new Error("No usable questions");
  return quiz;
}

function isTimeout(err: unknown) {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || err.name === "TimeoutError" || /abort|timed? ?out/i.test(err.message);
}

function toGenerationError(err: ApiError): GenerationError {
  console.error("Gemini API error", err.status, err.message);
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
