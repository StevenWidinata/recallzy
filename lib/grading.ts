/**
 * Short-answer grading without AI: compares the student's answer with the accepted answers,
 * forgiving case, accents, punctuation, leading articles and small typos.
 */

const LEADING_ARTICLES = /^(the|a|an|el|la|los|las|le|les|der|die|das|il|lo|gli|sang|si)\s+/;

export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_ARTICLES, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

/** How many typos we forgive for an answer of this length. */
function allowedTypos(length: number) {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return Math.floor(length / 6);
}

export function isShortAnswerCorrect(userAnswer: string, accepted: string[]): boolean {
  const given = normalizeAnswer(userAnswer);
  if (!given) return false;

  return accepted.some((raw) => {
    const target = normalizeAnswer(raw);
    if (!target) return false;
    if (given === target) return true;

    // Numbers must match exactly (e.g. "6" vs "8" is not a typo).
    if (/\d/.test(target) && given.replace(/\s/g, "") !== target.replace(/\s/g, "")) return false;

    return levenshtein(given, target) <= allowedTypos(target.length);
  });
}
