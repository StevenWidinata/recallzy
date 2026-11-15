import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuizWithQuestions } from "@/lib/quizzes";

export const metadata = { title: "Results · Recallzy" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
};

type AnswerRow = { question_id: string; user_answer: string | null; is_correct: boolean };

export default async function ResultsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { attempt: attemptId } = await searchParams;
  if (!attemptId) notFound();

  const supabase = await createClient();
  const [data, { data: attempt }, { data: answers }] = await Promise.all([
    getQuizWithQuestions(id),
    supabase.from("attempts").select("id, score, total, mode").eq("id", attemptId).eq("quiz_id", id).maybeSingle(),
    supabase.from("answers").select("question_id, user_answer, is_correct").eq("attempt_id", attemptId).returns<AnswerRow[]>(),
  ]);
  if (!data || !attempt) notFound();

  const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));
  const reviewed = data.questions.filter((q) => answerByQuestion.has(q.id));
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const wrongCount = attempt.total - attempt.score;
  const hasFlashcards = data.questions.some((q) => q.type === "flashcard");

  // Accuracy per topic, weakest first.
  const topics = new Map<string, { right: number; total: number }>();
  for (const q of reviewed) {
    const t = topics.get(q.topic ?? "General") ?? { right: 0, total: 0 };
    t.total++;
    if (answerByQuestion.get(q.id)?.is_correct) t.right++;
    topics.set(q.topic ?? "General", t);
  }
  const topicList = [...topics.entries()].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);

  const message =
    pct === 100 ? "Perfect score! 🏆" : pct >= 80 ? "Great job! 🎉" : pct >= 50 ? "Good effort — keep going! 💪" : "Keep practicing — you've got this! 📚";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">{data.quiz.title}</p>
        <p className="mt-3 text-6xl font-bold text-brand">{pct}%</p>
        <p className="mt-2 text-muted">
          {attempt.score} of {attempt.total} correct
        </p>
        <p className="mt-3 text-lg font-semibold">{message}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {wrongCount > 0 && (
            <Link
              href={`/quiz/${id}?retry=${attempt.id}`}
              className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90"
            >
              Retry {wrongCount} mistake{wrongCount === 1 ? "" : "s"}
            </Link>
          )}
          <Link
            href={`/quiz/${id}`}
            className="rounded-xl border border-border bg-background px-5 py-2.5 font-semibold hover:border-brand"
          >
            Retake full quiz
          </Link>
          {hasFlashcards && (
            <Link
              href={`/flashcards/${id}`}
              className="rounded-xl border border-border bg-background px-5 py-2.5 font-semibold hover:border-brand"
            >
              Study flashcards
            </Link>
          )}
        </div>
      </div>

      {topicList.length > 1 && (
        <section className="mt-8">
          <h2 className="font-semibold">By topic</h2>
          <ul className="mt-3 space-y-2">
            {topicList.map(([topic, t]) => {
              const p = Math.round((t.right / t.total) * 100);
              return (
                <li key={topic} className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{topic}</span>
                    <span className={p < 50 ? "text-danger" : p < 80 ? "text-muted" : "text-success"}>
                      {t.right}/{t.total}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full ${p < 50 ? "bg-danger" : p < 80 ? "bg-brand" : "bg-success"}`}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Review your answers</h2>
        <ol className="mt-3 space-y-3">
          {reviewed.map((q, i) => {
            const a = answerByQuestion.get(q.id)!;
            const whyWrong = !a.is_correct && a.user_answer ? q.option_explanations?.[a.user_answer] : null;
            return (
              <li
                key={q.id}
                className={`rounded-xl border-l-4 bg-surface p-4 ${a.is_correct ? "border-success" : "border-danger"}`}
              >
                <p className="text-sm font-medium">
                  {i + 1}. {q.prompt}
                </p>
                <p className="mt-2 text-sm">
                  <span className="text-muted">Your answer: </span>
                  <span className={a.is_correct ? "text-success" : "text-danger"}>
                    {a.user_answer || "—"} {a.is_correct ? "✓" : "✗"}
                  </span>
                </p>
                {!a.is_correct && (
                  <p className="text-sm">
                    <span className="text-muted">Correct answer: </span>
                    <span className="font-medium text-success">{q.correct_answer}</span>
                  </p>
                )}
                {whyWrong && <p className="mt-2 text-sm text-muted">✗ {whyWrong}</p>}
                <p className="mt-2 text-sm text-muted">💡 {q.explanation}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-8 text-center">
        <Link href="/dashboard" className="text-sm text-muted underline hover:text-foreground">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
