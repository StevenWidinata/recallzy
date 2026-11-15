import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getDashboard, type QuizSummary } from "@/lib/dashboard";
import { dailyLimit, remainingToday } from "@/lib/limits";
import { QUESTION_TYPE_LABELS } from "@/lib/schemas";
import DeleteQuizButton from "@/components/DeleteQuizButton";

export const metadata = { title: "Dashboard · Recallzy" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const [{ quizzes, weakTopics, stats }, remaining] = await Promise.all([getDashboard(), remainingToday(user.id)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your dashboard</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <Link href="/new" className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90">
          + New quiz
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Quizzes" value={stats.quizzes} />
        <Stat label="Questions answered" value={stats.answered} />
        <Stat label="Accuracy" value={stats.accuracy === null ? "—" : `${stats.accuracy}%`} />
        <Stat label="Free quizzes left today" value={`${remaining} / ${dailyLimit()}`} />
      </div>

      {weakTopics.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Topics to practice</h2>
          <p className="text-sm text-muted">Where you&apos;ve missed the most questions.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weakTopics.map((t) => (
              <div key={t.topic} className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{t.topic}</span>
                  <span className={t.pct < 50 ? "text-danger" : "text-muted"}>{t.pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full ${t.pct < 50 ? "bg-danger" : "bg-brand"}`} style={{ width: `${t.pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {t.right} of {t.total} correct
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Your quizzes</h2>
        {quizzes.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-muted">No quizzes yet. Upload your notes and Recallzy will quiz you on them.</p>
            <Link href="/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90">
              Create your first quiz
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {quizzes.map((q) => (
              <QuizCard key={q.id} quiz={q} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const date = new Date(quiz.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{quiz.title}</h3>
        {quiz.bestPct !== null && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              quiz.bestPct >= 80 ? "bg-success-soft text-success" : quiz.bestPct >= 50 ? "bg-brand-soft text-brand" : "bg-danger-soft text-danger"
            }`}
            title="Best score"
          >
            Best {quiz.bestPct}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        {date} · {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
        {quiz.flashcardCount > 0 && ` · ${quiz.flashcardCount} flashcards`}
        {quiz.attempts > 0 && ` · taken ${quiz.attempts}×, last ${quiz.lastPct}%`}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {quiz.types.map((t) => (
          <span key={t} className="rounded-md bg-background px-2 py-0.5 text-[11px] text-muted">
            {QUESTION_TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {quiz.questionCount > 0 && (
          <Link href={`/quiz/${quiz.id}`} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:opacity-90">
            {quiz.attempts > 0 ? "Retake" : "Start quiz"}
          </Link>
        )}
        {quiz.lastHadMistakes && quiz.lastAttemptId && (
          <Link
            href={`/quiz/${quiz.id}?retry=${quiz.lastAttemptId}`}
            className="rounded-lg border border-border px-3 py-1.5 font-medium hover:border-brand"
          >
            Retry mistakes
          </Link>
        )}
        {quiz.flashcardCount > 0 && (
          <Link href={`/flashcards/${quiz.id}`} className="rounded-lg border border-border px-3 py-1.5 font-medium hover:border-brand">
            Flashcards
          </Link>
        )}
        {quiz.lastAttemptId && (
          <Link href={`/quiz/${quiz.id}/results?attempt=${quiz.lastAttemptId}`} className="px-1 text-muted hover:text-foreground">
            Last results
          </Link>
        )}
        <span className="ml-auto">
          <DeleteQuizButton quizId={quiz.id} />
        </span>
      </div>
    </li>
  );
}
