"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Two-step delete: first click asks, second click deletes. */
export default function DeleteQuizButton({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const { error } = await createClient().from("quizzes").delete().eq("id", quizId);
    if (error) {
      setDeleting(false);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-xs text-muted hover:text-danger">
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <button onClick={remove} disabled={deleting} className="font-semibold text-danger">
        {deleting ? "Deleting…" : "Yes, delete"}
      </button>
      <button onClick={() => setConfirming(false)} disabled={deleting} className="text-muted">
        Cancel
      </button>
    </span>
  );
}
