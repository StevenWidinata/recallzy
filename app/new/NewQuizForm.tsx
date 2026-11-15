"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UploadDropzone from "@/components/UploadDropzone";
import { createClient } from "@/lib/supabase/client";
import { extensionOf } from "@/lib/files";
import { getOwnKey } from "@/lib/own-key";
import {
  DIFFICULTIES,
  MAX_TEXT_CHARS,
  QUESTION_COUNTS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Difficulty,
  type QuestionType,
} from "@/lib/schemas";

type Props = { userId: string; remaining: number; limit: number };

const GENERATING_MESSAGES = [
  "Reading your material…",
  "Finding the key ideas…",
  "Writing questions…",
  "Explaining the answers…",
  "Almost done…",
];

const noopSubscribe = () => () => {};

export default function NewQuizForm({ userId, remaining, limit }: Props) {
  const router = useRouter();
  const ownKey = useSyncExternalStore(noopSubscribe, getOwnKey, () => null);

  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "true_false"]);
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [stage, setStage] = useState<"idle" | "uploading" | "generating">("idle");
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const busy = stage !== "idle";
  const outOfQuota = !ownKey && remaining <= 0;

  useEffect(() => {
    if (stage !== "generating") return;
    const id = setInterval(() => setMessageIndex((i) => Math.min(i + 1, GENERATING_MESSAGES.length - 1)), 6000);
    return () => clearInterval(id);
  }, [stage]);

  function toggleType(type: QuestionType) {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0 && !text.trim()) return setError("Add at least one file or paste some text.");
    if (types.length === 0) return setError("Pick at least one question type.");

    try {
      // 1. Upload files straight to Supabase Storage (avoids server upload size limits).
      setStage("uploading");
      const supabase = createClient();
      const uploaded = [];
      for (const file of files) {
        const path = `${userId}/${crypto.randomUUID()}.${extensionOf(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("materials")
          .upload(path, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(`Couldn't upload "${file.name}". Please try again.`);
        uploaded.push({ path, name: file.name, mime: file.type });
      }

      // 2. Ask the server to generate the quiz.
      setStage("generating");
      setMessageIndex(0);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ownKey ? { "x-gemini-key": ownKey } : {}) },
        body: JSON.stringify({ files: uploaded, text, settings: { types, count, difficulty } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      router.push(`/quiz/${data.quizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStage("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="mb-3 font-semibold">1. Your material</h2>
        <UploadDropzone files={files} onChange={setFiles} onError={setError} disabled={busy} />
        <label className="mt-4 block">
          <span className="text-sm text-muted">Or paste your notes</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            maxLength={MAX_TEXT_CHARS}
            rows={5}
            placeholder="Paste notes, a summary, or textbook text here…"
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-brand"
          />
        </label>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">2. Question types</h2>
        <div className="grid grid-cols-2 gap-2">
          {QUESTION_TYPES.map((type) => {
            const on = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => toggleType(type)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  on ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted hover:border-brand"
                }`}
              >
                {on ? "✓ " : ""}
                {QUESTION_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">3. How many questions</h2>
          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map((n) => (
              <Chip key={n} active={count === n} disabled={busy} onClick={() => setCount(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">4. Difficulty</h2>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <Chip key={d} active={difficulty === d} disabled={busy} onClick={() => setDifficulty(d)}>
                {d[0].toUpperCase() + d.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={busy || outOfQuota}
          className="w-full rounded-xl bg-brand py-3.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {stage === "uploading"
            ? "Uploading files…"
            : stage === "generating"
              ? GENERATING_MESSAGES[messageIndex]
              : "Create quiz"}
        </button>
        {busy && stage === "generating" && (
          <p className="text-center text-xs text-muted">This usually takes 15–60 seconds. Keep this page open.</p>
        )}
        <p className="text-center text-xs text-muted">
          {ownKey ? (
            "Using your own Gemini key — no daily limit."
          ) : outOfQuota ? (
            <>
              You&apos;ve used all {limit} free quizzes today.{" "}
              <Link href="/settings" className="text-brand underline">
                Add your own free key
              </Link>{" "}
              to keep going.
            </>
          ) : (
            `${remaining} of ${limit} free quizzes left today.`
          )}
        </p>
        <p className="text-center text-xs text-muted">
          Your material is processed by Google Gemini. On the free tier, Google may use it to improve its models — avoid
          uploading private or sensitive documents.
        </p>
      </div>
    </form>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-12 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        active ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}
