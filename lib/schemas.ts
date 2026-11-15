import { z } from "zod";

export const QUESTION_TYPES = ["mcq", "true_false", "short", "flashcard"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  true_false: "True / False",
  short: "Short answer",
  flashcard: "Flashcards",
};

export const DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_COUNTS = [5, 10, 15, 20, 30] as const;

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB each
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // Gemini inline request limit is ~20 MB
export const MAX_TEXT_CHARS = 200_000;

/** What the user picks on the "New quiz" page. */
export const QuizSettingsSchema = z.object({
  types: z.array(z.enum(QUESTION_TYPES)).min(1),
  count: z.number().int().min(1).max(30),
  difficulty: z.enum(DIFFICULTIES),
});
export type QuizSettings = z.infer<typeof QuizSettingsSchema>;

/** Body of POST /api/generate. Files are already uploaded to Supabase Storage. */
export const GenerateRequestSchema = z.object({
  files: z
    .array(z.object({ path: z.string().min(1), name: z.string().min(1), mime: z.string() }))
    .max(MAX_FILES),
  text: z.string().max(MAX_TEXT_CHARS).optional().default(""),
  settings: QuizSettingsSchema,
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** Shape the AI must return. Kept simple so Gemini's JSON schema support handles it. */
export const AiQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1),
  options: z.array(z.string()),
  correct_answer: z.string().min(1),
  accepted_answers: z.array(z.string()),
  explanation: z.string().min(1),
  option_explanations: z.array(z.object({ option: z.string(), why_wrong: z.string() })),
  topic: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  source_hint: z.string(),
});
export type AiQuestion = z.infer<typeof AiQuestionSchema>;

export const AiQuizSchema = z.object({
  title: z.string().min(1),
  language: z.string(),
  questions: z.array(AiQuestionSchema).min(1),
});
export type AiQuiz = z.infer<typeof AiQuizSchema>;

/** A question as stored in the database. */
export type Question = {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: string[];
  correct_answer: string;
  accepted_answers: string[];
  explanation: string;
  option_explanations: Record<string, string>;
  topic: string | null;
  difficulty: string | null;
  source_hint: string | null;
};
