import { cn } from "@metanoia/ui";

interface OnboardingPageLayoutProps {
  /**
   * Brand mark or any element rendered at the top of the card.
   * Kept flexible so welcome vs. legal screens can show different headers.
   */
  header?: React.ReactNode;
  /** Accessible landmark — defaults to `main`. Use `section` when nested. */
  as?: "main" | "section";
  /** Optional tighter widths for dense forms (e.g. 05.3 create account). */
  width?: "narrow" | "wide";
  children: React.ReactNode;
  className?: string;
}

/**
 * Centered card layout used by the onboarding flow (spec 05.1–05.3).
 * - Desktop-first: max-width 480 (narrow) / 560 (wide).
 * - Vertical rhythm via spacing tokens: pt `space-12`, pb `space-6`.
 * - No auth shell: this is public and pre-authentication.
 */
export function OnboardingPageLayout({
  header,
  as: Tag = "main",
  width = "narrow",
  children,
  className,
}: OnboardingPageLayoutProps) {
  return (
    <Tag
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col items-center px-4 pb-6 pt-12 sm:pt-16",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-6",
          width === "narrow" ? "max-w-[480px]" : "max-w-[560px]",
        )}
      >
        {header ? (
          <div className="flex flex-col items-center">{header}</div>
        ) : null}
        {children}
      </div>
    </Tag>
  );
}
