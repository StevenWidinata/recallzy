import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white">R</span>
          Recallzy
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-lg px-2 py-1.5 text-muted hover:text-foreground sm:px-3">
                Dashboard
              </Link>
              <Link href="/settings" className="rounded-lg px-2 py-1.5 text-muted hover:text-foreground sm:px-3">
                Settings
              </Link>
              <form action="/auth/signout" method="post">
                <button className="rounded-lg px-2 py-1.5 text-muted hover:text-foreground sm:px-3">Log out</button>
              </form>
              <Link href="/new" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:opacity-90">
                New quiz
              </Link>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:opacity-90">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
