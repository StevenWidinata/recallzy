import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Recallzy" };

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Your dashboard</h1>
      <p className="mt-1 text-sm text-muted">Signed in as {user?.email}</p>
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-muted">No quizzes yet.</p>
        <Link
          href="/new"
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90"
        >
          Create your first quiz
        </Link>
      </div>
    </div>
  );
}
