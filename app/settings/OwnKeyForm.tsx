"use client";

import { useState, useSyncExternalStore } from "react";
import { getOwnKey, setOwnKey } from "@/lib/own-key";

// Re-render when the saved key changes (in this tab or another).
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function saveKey(key: string | null) {
  setOwnKey(key);
  listeners.forEach((cb) => cb());
}

export default function OwnKeyForm() {
  const savedKey = useSyncExternalStore(subscribe, getOwnKey, () => null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const key = input.trim();
    if (!key) return;
    setChecking(true);
    setStatus(null);
    try {
      const res = await fetch("/api/check-key", { method: "POST", headers: { "x-gemini-key": key } });
      const data = await res.json();
      if (!data.ok) {
        setStatus({ kind: "error", text: data.error ?? "This key doesn't work." });
        return;
      }
      saveKey(key);
      setInput("");
      setStatus({ kind: "ok", text: "Key saved! You now have no daily limit." });
    } catch {
      setStatus({ kind: "error", text: "Couldn't check the key. Try again." });
    } finally {
      setChecking(false);
    }
  }

  if (savedKey) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-success bg-success-soft px-4 py-3">
          <span className="text-success">✓</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Your own key is active</p>
            <p className="truncate font-mono text-xs text-muted">
              {savedKey.slice(0, 6)}••••••••{savedKey.slice(-4)}
            </p>
          </div>
          <button
            onClick={() => {
              saveKey(null);
              setStatus(null);
            }}
            className="text-sm text-danger hover:underline"
          >
            Remove
          </button>
        </div>
        {status?.kind === "ok" && <p className="text-sm text-success">{status.text}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your Gemini API key"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={checking || !input.trim()}
          className="rounded-xl bg-brand px-4 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {checking ? "Checking…" : "Save"}
        </button>
      </div>
      {status && (
        <p className={`text-sm ${status.kind === "ok" ? "text-success" : "text-danger"}`}>{status.text}</p>
      )}
    </form>
  );
}
