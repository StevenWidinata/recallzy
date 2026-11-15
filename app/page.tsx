import Link from "next/link";

const steps = [
  {
    title: "Upload your material",
    text: "PDF, photos of your notes, Word, PowerPoint — or just paste text.",
  },
  {
    title: "AI builds your quiz",
    text: "Multiple choice, true/false, short answer and flashcards, made only from your material.",
  },
  {
    title: "Learn from every answer",
    text: "Right or wrong, you get a clear explanation of why — so it actually sticks.",
  },
];

const features = [
  { title: "Explains wrong answers", text: "See why your choice was wrong, not just what was right." },
  { title: "Weak topic tracking", text: "Recallzy shows which topics you miss most." },
  { title: "Retry mistakes", text: "One click to practice only the questions you got wrong." },
  { title: "Any language", text: "Questions come out in the same language as your material." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-20 text-center sm:py-28">
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          AI study partner
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Turn your notes into a quiz that <span className="text-brand">teaches you</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Upload what&apos;s on your test. Recallzy asks the questions, checks your answers, and explains
          every one.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/new" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white hover:opacity-90">
            Create a quiz — free
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold hover:border-brand"
          >
            My quizzes
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.title} className="rounded-2xl border border-border bg-surface p-6">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">
              {i + 1}
            </div>
            <h3 className="mt-4 font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="pb-24">
        <h2 className="text-center text-2xl font-bold">Built for remembering, not just testing</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
