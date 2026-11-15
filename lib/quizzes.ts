import "server-only";
import { createClient } from "./supabase/server";
import type { Question } from "./schemas";

export type Quiz = {
  id: string;
  title: string;
  language: string | null;
  created_at: string;
};

/** Loads a quiz and its questions for the logged-in user (RLS hides other users' quizzes). */
export async function getQuizWithQuestions(quizId: string) {
  const supabase = await createClient();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, language, created_at")
    .eq("id", quizId)
    .maybeSingle<Quiz>();
  if (!quiz) return null;

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("position")
    .returns<Question[]>();

  return { quiz, questions: questions ?? [] };
}

/** Question ids answered wrong in a given attempt (for "Retry mistakes"). */
export async function getWrongQuestionIds(attemptId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("answers")
    .select("question_id")
    .eq("attempt_id", attemptId)
    .eq("is_correct", false);
  return (data ?? []).map((a) => a.question_id as string);
}
