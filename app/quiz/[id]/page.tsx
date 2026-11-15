import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getQuizWithQuestions, getWrongQuestionIds } from "@/lib/quizzes";
import QuizPlayer from "./QuizPlayer";

export const metadata = { title: "Quiz · Recallzy" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retry?: string }>;
};

export default async function QuizPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { retry } = await searchParams;

  const data = await getQuizWithQuestions(id);
  if (!data) notFound();

  // Flashcards have their own study mode; the quiz uses the other question types.
  let questions = data.questions.filter((q) => q.type !== "flashcard");
  if (questions.length === 0 && data.questions.length > 0) redirect(`/flashcards/${id}`);

  if (retry) {
    const wrong = new Set(await getWrongQuestionIds(retry));
    questions = questions.filter((q) => wrong.has(q.id));
    if (questions.length === 0) {
      return (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <p className="text-4xl">🏆</p>
          <h1 className="mt-4 text-xl font-bold">No mistakes to retry!</h1>
          <Link href={`/quiz/${id}`} className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-white">
            Take the full quiz again
          </Link>
        </div>
      );
    }
  }

  return (
    <QuizPlayer
      key={retry ?? "full"}
      quizId={id}
      title={data.quiz.title}
      questions={questions}
      mode={retry ? "retry_mistakes" : "full"}
    />
  );
}
