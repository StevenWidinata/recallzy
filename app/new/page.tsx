import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { dailyLimit, remainingToday } from "@/lib/limits";
import NewQuizForm from "./NewQuizForm";

export const metadata = { title: "New quiz · Recallzy" };

export default async function NewQuizPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Create a quiz</h1>
      <p className="mt-1 text-sm text-muted">
        Add what&apos;s on your test. Recallzy reads it and writes questions with explanations.
      </p>
      <div className="mt-8">
        <NewQuizForm userId={user.id} remaining={await remainingToday(user.id)} limit={dailyLimit()} />
      </div>
    </div>
  );
}
