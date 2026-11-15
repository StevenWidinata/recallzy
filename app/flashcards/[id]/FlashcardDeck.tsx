"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FlashCard from "@/components/FlashCard";
import ProgressBar from "@/components/ProgressBar";
import type { Question } from "@/lib/schemas";

type Props = { quizId: string; title: string; cards: Question[]; hasQuiz: boolean };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardDeck({ quizId, title, cards, hasQuiz }: Props) {
  // Cards marked "Still learning" go back to the end of the queue until you know them.
  const [queue, setQueue] = useState<Question[]>(cards);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [reviews, setReviews] = useState(0);

  const card = queue[0];
  const done = !card;

  function grade(knewIt: boolean) {
    if (!card) return;
    setReviews((n) => n + 1);
    setFlipped(false);
    if (knewIt) {
      setKnown((prev) => new Set(prev).add(card.id));
      setQueue((q) => q.slice(1));
    } else {
      setQueue((q) => [...q.slice(1), card]);
    }
  }

  function restart(shuffled: boolean) {
    setQueue(shuffled ? shuffle(cards) : cards);
    setKnown(new Set());
    setFlipped(false);
    setReviews(0);
  }

  // Keyboard: Space flips, → / K = knew it, ← / L = still learning.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "ArrowRight" || e.key.toLowerCase() === "k")) grade(true);
      else if (flipped && (e.key === "ArrowLeft" || e.key.toLowerCase() === "l")) grade(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl">🧠</p>
        <h1 className="mt-4 text-2xl font-bold">You know all {cards.length} cards!</h1>
        <p className="mt-2 text-muted">
          It took {reviews} review{reviews === 1 ? "" : "s"}. Come back tomorrow to keep them fresh.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <button onClick={() => restart(true)} className="rounded-xl bg-brand py-3 font-semibold text-white hover:opacity-90">
            Study again (shuffled)
          </button>
          {hasQuiz && (
            <Link href={`/quiz/${quizId}`} className="rounded-xl border border-border bg-surface py-3 font-semibold hover:border-brand">
              Take the quiz
            </Link>
          )}
          <Link href="/dashboard" className="py-2 text-sm text-muted underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
          <span className="truncate font-medium">{title}</span>
          <span className="shrink-0 text-muted">
            {known.size} / {cards.length} known
          </span>
        </div>
        <ProgressBar value={known.size} max={cards.length} />
      </div>

      <FlashCard
        key={`${card.id}-${reviews}`}
        front={card.prompt}
        back={card.correct_answer}
        explanation={card.explanation}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
      />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => grade(false)}
          disabled={!flipped}
          className="rounded-xl border-2 border-danger bg-danger-soft py-3 font-semibold text-danger disabled:opacity-40"
        >
          Still learning
        </button>
        <button
          onClick={() => grade(true)}
          disabled={!flipped}
          className="rounded-xl border-2 border-success bg-success-soft py-3 font-semibold text-success disabled:opacity-40"
        >
          Knew it ✓
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        {flipped ? "Be honest — cards you're still learning come back later." : "Think of the answer, then tap the card."}
      </p>
      <div className="mt-6 text-center">
        <button onClick={() => restart(true)} className="text-sm text-muted underline hover:text-foreground">
          Shuffle &amp; restart
        </button>
      </div>
    </div>
  );
}
