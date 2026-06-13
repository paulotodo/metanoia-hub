import messages from '../../../messages/pt-BR.json';

interface DemoOverlayProps {
  children: React.ReactNode;
}

const t = messages.onboarding.demo;

/**
 * DemoOverlay — wraps any content with a dashed border and reduced opacity
 * to signal that the data shown is synthetic (demo), not real congregation data.
 *
 * Also renders a "Dados de exemplo" badge positioned at the top-right corner.
 * CHK038: aria-label on the badge communicates the demo nature to screen readers.
 * Contrast: secondary badge uses text-text-secondary on surface-default — WCAG AA.
 */
export function DemoOverlay({ children }: DemoOverlayProps) {

  return (
    <div className="relative">
      {/* Demo badge — top-right, aria-labelled for screen readers */}
      <span
        aria-label={t.overlayAriaLabel}
        className="absolute right-2 top-2 z-10 inline-flex items-center rounded-full border border-surface-muted bg-surface-default px-2.5 py-0.5 text-xs font-medium text-text-secondary"
      >
        {t.overlayBadge}
      </span>

      {/* Content wrapper: dashed border + reduced opacity signal demo state */}
      <div
        className="rounded-lg border-2 border-dashed border-surface-muted opacity-80"
        aria-describedby={undefined}
      >
        {children}
      </div>
    </div>
  );
}
