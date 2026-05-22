/** Inline app logo (clock face). 22×22, accent stroke. */
export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9" stroke="var(--accent)" strokeWidth="1.6" />
      <path
        d="M11 6V11L14.5 13"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
