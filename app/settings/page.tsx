import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { dailyLimit, remainingToday } from "@/lib/limits";
import OwnKeyForm from "./OwnKeyForm";

export const metadata = { title: "Settings · Recallzy" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  const remaining = await remainingToday(user.id);
  const limit = dailyLimit();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-semibold">Daily free quizzes</h2>
        <p className="mt-1 text-sm text-muted">
          Everyone gets {limit} new quizzes per day for free. Retaking quizzes, retrying mistakes and flashcards are
          always unlimited.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${limit ? (remaining / limit) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium">
            {remaining} / {limit} left today
          </span>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-semibold">Use your own Gemini key (optional)</h2>
        <p className="mt-1 text-sm text-muted">
          Add your own free Google Gemini key to make as many quizzes as you want. It&apos;s stored only in this browser
          — never on our servers.
        </p>
        <div className="mt-4">
          <OwnKeyForm />
        </div>
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-medium text-brand">How do I get a free key? (1 minute)</summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
            <li>
              Go to{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-brand underline">
                aistudio.google.com/apikey
              </a>{" "}
              and sign in with your Google account.
            </li>
            <li>Click “Create API key”.</li>
            <li>Copy the key, paste it above and click Save.</li>
          </ol>
          <p className="mt-3 text-xs text-muted">
            Google&apos;s free tier has its own daily limits. On the free tier, Google may use what you send to improve
            its models.
          </p>
        </details>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-danger hover:text-danger">
            Log out
          </button>
        </form>
      </section>
    </div>
  );
}
