import "server-only";
import { createClient } from "./supabase/server";
import type { QuestionType } from "./schemas";

export type QuizSummary = {
  id: string;
  title: string;
  createdAt: string;
  questionCount: number;
  flashcardCount: number;
  types: QuestionType[];
  attempts: number;
  bestPct: number | null;
  lastPct: number | null;
  lastAttemptId: string | null;
  lastHadMistakes: boolean;
};

export type TopicStat = { topic: string; right: number; total: number; pct: number };

type QuizRow = { id: string; title: string; created_at: string; questions: { type: QuestionType }[] };
type AttemptRow = { id: string; quiz_id: string; score: number; total: number; finished_at: string | null };
type AnswerRow = { is_correct: boolean; questions: { topic: string | null } | null };

/** Everything the dashboard needs for the logged-in user. */
export async function getDashboard() {
  const supabase = await createClient();

  const [{ data: quizzes }, { data: attempts }, { data: answers }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, created_at, questions(type)")
      .order("created_at", { ascending: false })
      .returns<QuizRow[]>(),
    supabase
      .from("attempts")
      .select("id, quiz_id, score, total, finished_at")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .returns<AttemptRow[]>(),
    supabase
      .from("answers")
      .select("is_correct, questions(topic)")
      .order("created_at", { ascending: false })
      .limit(2000)
      .returns<AnswerRow[]>(),
  ]);

  const attemptsByQuiz = new Map<string, AttemptRow[]>();
  for (const a of attempts ?? []) {
    attemptsByQuiz.set(a.quiz_id, [...(attemptsByQuiz.get(a.quiz_id) ?? []), a]);
  }

  const summaries: QuizSummary[] = (quizzes ?? []).map((q) => {
    const list = attemptsByQuiz.get(q.id) ?? []; // newest first
    const pct = (a: AttemptRow) => (a.total ? Math.round((a.score / a.total) * 100) : 0);
    const last = list[0];
    return {
      id: q.id,
      title: q.title,
      createdAt: q.created_at,
      questionCount: q.questions.filter((x) => x.type !== "flashcard").length,
      flashcardCount: q.questions.filter((x) => x.type === "flashcard").length,
      types: [...new Set(q.questions.map((x) => x.type))],
      attempts: list.length,
      bestPct: list.length ? Math.max(...list.map(pct)) : null,
      lastPct: last ? pct(last) : null,
      lastAttemptId: last?.id ?? null,
      lastHadMistakes: last ? last.score < last.total : false,
    };
  });

  // Accuracy per topic across all answers.
  const topicMap = new Map<string, { right: number; total: number }>();
  for (const a of answers ?? []) {
    const topic = a.questions?.topic?.trim();
    if (!topic) continue;
    const t = topicMap.get(topic) ?? { right: 0, total: 0 };
    t.total++;
    if (a.is_correct) t.right++;
    topicMap.set(topic, t);
  }
  const topics: TopicStat[] = [...topicMap.entries()].map(([topic, t]) => ({
    topic,
    ...t,
    pct: Math.round((t.right / t.total) * 100),
  }));
  const weakTopics = topics
    .filter((t) => t.total >= 2 && t.pct < 80)
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, 6);

  const totalAnswered = (answers ?? []).length;
  const totalRight = (answers ?? []).filter((a) => a.is_correct).length;

  return {
    quizzes: summaries,
    weakTopics,
    stats: {
      quizzes: summaries.length,
      answered: totalAnswered,
      accuracy: totalAnswered ? Math.round((totalRight / totalAnswered) * 100) : null,
    },
  };
}
