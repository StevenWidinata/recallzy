"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressBar from "@/components/ProgressBar";
import OptionButton from "@/components/OptionButton";
import ExplanationPanel from "@/components/ExplanationPanel";
import { isShortAnswerCorrect } from "@/lib/grading";
import { QUESTION_TYPE_LABELS, type Question } from "@/lib/schemas";

type Answer = { questionId: string; userAnswer: string; isCorrect: boolean };
type Props = {
  quizId: string;
  title: string;
  questions: Question[];
  mode: "full" | "retry_mistakes";
};

const LETTERS = "ABCDEFGH";

export default function QuizPlayer({ quizId, title, questions, mode }: Props) {
  const router = useRouter();
  const [startedAt] = useState(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const question = questions[index];
  const current = answers.find((a) => a.questionId === question.id);
  const answered = Boolean(current);
  const isLast = index === questions.length - 1;
  const score = answers.filter((a) => a.isCorrect).length;

  // Focus the right control: the text box for short answers, "Next" after answering.
  useEffect(() => {
    if (answered) nextRef.current?.focus();
    else if (question.type === "short") inputRef.current?.focus();
  }, [answered, question]);

  function answer(userAnswer: string, isCorrect: boolean) {
    if (answered) return;
    setAnswers((prev) => [...prev, { questionId: question.id, userAnswer, isCorrect }]);
  }

  function markCorrect() {
    setAnswers((prev) => prev.map((a) => (a.questionId === question.id ? { ...a, isCorrect: true } : a)));
  }

  async function next() {
    if (!isLast) {
      setIndex((i) => i + 1);
      setTyped("");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, mode, startedAt, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your results.");
      router.push(`/quiz/${quizId}/results?attempt=${data.attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your results.");
      setSaving(false);
    }
  }

  // Keyboard shortcuts: 1–4 / A–D pick an option.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (answered || question.type === "short" || e.target instanceof HTMLInputElement) return;
      const key = e.key.toUpperCase();
      const i = /^[1-9]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key);
      const option = question.options[i];
      if (i >= 0 && option !== undefined) {
        setAnswers((prev) => [
          ...prev,
          { questionId: question.id, userAnswer: option, isCorrect: option === question.correct_answer },
        ]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, question]);

  function optionState(option: string) {
    if (!answered) return "idle" as const;
    if (option === question.correct_answer) return "correct" as const;
    if (option === current?.userAnswer) return "wrong" as const;
    return "dimmed" as const;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
          <span className="truncate font-medium">
            {mode === "retry_mistakes" && <span className="text-brand">Retry · </span>}
            {title}
          </span>
          <span className="shrink-0 text-muted">
            {index + 1} / {questions.length} · {score} ✓
          </span>
        </div>
        <ProgressBar value={index + (answered ? 1 : 0)} max={questions.length} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand">
            {QUESTION_TYPE_LABELS[question.type]}
          </span>
          {question.topic && <span className="rounded-full bg-background px-2.5 py-1 text-muted">{question.topic}</span>}
        </div>
        <h1 className="text-lg font-semibold leading-relaxed sm:text-xl">{question.prompt}</h1>

        <div className="mt-5 space-y-2.5">
          {question.type === "short" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) answer(typed.trim(), isShortAnswerCorrect(typed, question.accepted_answers));
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={answered ? (current?.userAnswer ?? "") : typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={answered}
                placeholder="Type your answer…"
                className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 outline-none focus:border-brand"
              />
              {!answered && (
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-50"
                >
                  Check
                </button>
              )}
            </form>
          ) : (
            question.options.map((option, i) => (
              <OptionButton
                key={option}
                label={LETTERS[i]}
                text={option}
                state={optionState(option)}
                disabled={answered}
                onClick={() => answer(option, option === question.correct_answer)}
              />
            ))
          )}
        </div>
      </div>

      {answered && current && (
        <div className="mt-4 space-y-3">
          <ExplanationPanel
            correct={current.isCorrect}
            correctAnswer={question.correct_answer}
            explanation={question.explanation}
            userAnswer={current.userAnswer}
            whyWrong={question.option_explanations?.[current.userAnswer] ?? null}
            sourceHint={question.source_hint}
          />
          {question.type === "short" && !current.isCorrect && (
            <button type="button" onClick={markCorrect} className="text-sm text-muted underline hover:text-foreground">
              My answer means the same thing — count it as correct
            </button>
          )}
          {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            disabled={saving}
            className="w-full rounded-xl bg-brand py-3.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : isLast ? "See results" : "Next question →"}
          </button>
        </div>
      )}
    </div>
  );
}
