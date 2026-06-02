export interface InferredHintProps {
  /** The caveat shown on hover/focus explaining why the figure is inferred. */
  readonly text: string;
}

/**
 * A small `ⓘ` glyph carrying an honesty caveat for inferred figures
 * (breaks, the approximate timeline). Centralises the "this is derived, not
 * recorded" message so every inferred value can point at the same wording.
 */
export function InferredHint({ text }: InferredHintProps) {
  return (
    <span
      tabIndex={0}
      role="note"
      aria-label={text}
      title={text}
      className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-soft text-[9px] font-semibold text-muted-soft align-middle cursor-help select-none"
    >
      i
    </span>
  );
}
