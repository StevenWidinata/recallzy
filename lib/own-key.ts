/** The user's own Gemini key lives only in their browser (never in our database). */
const STORAGE_KEY = "recallzy:gemini-key";

export function getOwnKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setOwnKey(key: string | null) {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode) — the key just won't be remembered.
  }
}
