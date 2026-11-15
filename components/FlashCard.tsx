type Props = {
  front: string;
  back: string;
  explanation?: string | null;
  flipped: boolean;
  onFlip: () => void;
};

/** A card that flips over (3D) when tapped. */
export default function FlashCard({ front, back, explanation, flipped, onFlip }: Props) {
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={flipped ? "Show front" : "Show answer"}
      className="group block h-80 w-full [perspective:1200px] sm:h-96"
    >
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-surface p-8 [backface-visibility:hidden] group-hover:border-brand">
          <p className="text-xl font-semibold leading-relaxed sm:text-2xl">{front}</p>
          <p className="absolute bottom-5 text-xs text-muted">Tap to flip</p>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-3xl border-2 border-brand bg-brand-soft p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-lg font-semibold leading-relaxed sm:text-xl">{back}</p>
          {explanation && explanation !== back && <p className="mt-4 text-sm text-muted">{explanation}</p>}
        </div>
      </div>
    </button>
  );
}
