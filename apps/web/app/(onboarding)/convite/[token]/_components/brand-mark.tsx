/**
 * Text-only brand mark for the onboarding flow (spec 05.1-L1).
 * Kept local to this feature — when a real SVG/PNG logo arrives,
 * swap this component and every onboarding screen updates.
 */
export function BrandMark() {
  return (
    <span
      role="img"
      aria-label="metanoia-hub"
      className="text-2xl font-bold tracking-tight text-[var(--color-brand-teal)]"
    >
      metanoia<span className="text-[var(--color-text-primary)]">-hub</span>
    </span>
  );
}
