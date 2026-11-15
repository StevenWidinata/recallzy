type State = "idle" | "correct" | "wrong" | "dimmed";

const STYLES: Record<State, string> = {
  idle: "border-border bg-surface hover:border-brand hover:bg-brand-soft",
  correct: "border-success bg-success-soft",
  wrong: "border-danger bg-danger-soft",
  dimmed: "border-border bg-surface opacity-60",
};

type Props = {
  label: string; // "A", "B", …
  text: string;
  state: State;
  disabled: boolean;
  onClick: () => void;
};

export default function OptionButton({ label, text, state, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${STYLES[state]} disabled:cursor-default`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold ${
          state === "correct"
            ? "bg-success text-white"
            : state === "wrong"
              ? "bg-danger text-white"
              : "bg-background text-muted"
        }`}
      >
        {state === "correct" ? "✓" : state === "wrong" ? "✗" : label}
      </span>
      <span className="pt-0.5">{text}</span>
    </button>
  );
}
