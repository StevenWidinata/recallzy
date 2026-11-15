type Props = {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  /** Why the student's chosen (wrong) option is wrong, if known. */
  whyWrong?: string | null;
  userAnswer?: string | null;
  sourceHint?: string | null;
};

export default function ExplanationPanel({ correct, correctAnswer, explanation, whyWrong, userAnswer, sourceHint }: Props) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 ${correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft"}`}
      role="status"
    >
      <p className={`text-lg font-bold ${correct ? "text-success" : "text-danger"}`}>
        {correct ? "Correct! 🎉" : "Not quite"}
      </p>

      {!correct && userAnswer && whyWrong && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Why “{userAnswer}” is wrong</p>
          <p className="mt-1 text-sm">{whyWrong}</p>
        </div>
      )}

      <div className="mt-3">
        <p className="text-sm font-semibold">{correct ? "Why it's right" : <>The answer is “{correctAnswer}”</>}</p>
        <p className="mt-1 text-sm">{explanation}</p>
      </div>

      {sourceHint && <p className="mt-3 text-xs text-muted">📖 {sourceHint}</p>}
    </div>
  );
}
