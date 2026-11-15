import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white">R</span>
          Recallzy
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-muted hover:text-foreground">
            Dashboard
          </Link>
          <Link
            href="/new"
            className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:opacity-90"
          >
            New quiz
          </Link>
        </nav>
      </div>
    </header>
  );
}
