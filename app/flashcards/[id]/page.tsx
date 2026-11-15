import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuizWithQuestions } from "@/lib/quizzes";
import FlashcardDeck from "./FlashcardDeck";

export const metadata = { title: "Flashcards · Recallzy" };

export default async function FlashcardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getQuizWithQuestions(id);
  if (!data) notFound();

  const cards = data.questions.filter((q) => q.type === "flashcard");
  const hasQuiz = data.questions.some((q) => q.type !== "flashcard");

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">This quiz has no flashcards</h1>
        <p className="mt-2 text-muted">Pick “Flashcards” when you create a quiz to get them.</p>
        <Link href={`/quiz/${id}`} className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-white">
          Take the quiz instead
        </Link>
      </div>
    );
  }

  return <FlashcardDeck quizId={id} title={data.quiz.title} cards={cards} hasQuiz={hasQuiz} />;
}
