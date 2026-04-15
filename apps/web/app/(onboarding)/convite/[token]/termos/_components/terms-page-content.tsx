"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, cn } from "@metanoia/ui";
import { TermsCheckbox } from "@/components/forms";
import { LegalCopy } from "./legal-copy";

interface TermsPageContentProps {
  /** Resolved token — preserved when navigating to 05.3. */
  token: string;
}

/**
 * Client half of 05.2. Owns the accept-checkbox state and the continue
 * handler. Server `page.tsx` only composes layout + brand mark around it.
 *
 * Behavior (per spec 05.2):
 * - Checkbox starts unchecked (LGPD: never pre-checked).
 * - Clicking "Continuar" without checking triggers a shake + destructive
 *   border on the checkbox — the button is clickable for feedback, not
 *   disabled.
 * - If arriving via `#legal` hash ("Ver os termos primeiro" on 05.1),
 *   scroll the legal region into view on mount.
 */
export function TermsPageContent({ token }: TermsPageContentProps) {
  const router = useRouter();
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [shaking, setShaking] = React.useState(false);
  const legalRef = React.useRef<HTMLDivElement>(null);

  const createAccountHref = `/convite/${encodeURIComponent(token)}/criar-conta`;

  // Scroll the legal area into view when the user arrived via `#legal`.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#legal") return;
    // `requestAnimationFrame` lets the layout settle before scrolling.
    requestAnimationFrame(() => {
      legalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // Clear the error state as soon as the user checks the box.
  React.useEffect(() => {
    if (accepted && error) setError(false);
  }, [accepted, error]);

  function handleContinue() {
    if (!accepted) {
      setError(true);
      setShaking(true);
      // Stop shaking after the animation would finish — matches the CSS
      // class duration below.
      window.setTimeout(() => setShaking(false), 450);
      return;
    }
    // Session 5 will POST /invites/{token}/accept-terms before routing;
    // for now we just navigate so the caminho feliz is clickable end-to-end.
    router.push(createAccountHref);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-center text-2xl font-bold text-[var(--color-text-primary)] sm:text-2xl">
        Termos de uso e privacidade
      </h1>

      <section
        aria-labelledby="terms-summary-heading"
        className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] p-5"
      >
        <h2
          id="terms-summary-heading"
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          Em resumo:
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-[var(--color-text-primary)]">
          <li>Seus dados pertencem à sua igreja — não a nós.</li>
          <li>Não vendemos nem compartilhamos informações pessoais.</li>
          <li>Você pode exportar todos os seus dados a qualquer momento.</li>
          <li>Cancelou? Seus dados são apagados em até 30 dias.</li>
        </ul>
      </section>

      <div
        id="legal"
        ref={legalRef}
        role="region"
        aria-label="Texto legal completo"
        tabIndex={0}
        className="max-h-[400px] overflow-y-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:max-h-[400px]"
      >
        <LegalCopy />
      </div>

      <div
        className={cn(
          "rounded-md border border-transparent p-2 transition-colors",
          error && "border-[var(--color-care-urgent)]",
          shaking && "animate-[onboarding-shake_420ms_ease-in-out]",
        )}
      >
        <TermsCheckbox
          id="terms-accept"
          checked={accepted}
          onCheckedChange={setAccepted}
          required
          label="Li e aceito os termos de uso e a política de privacidade"
        />
      </div>

      <div className="flex flex-col items-center">
        <Button
          type="button"
          onClick={handleContinue}
          aria-disabled={!accepted}
          className={cn(
            "h-12 w-full max-w-[320px] text-base",
            !accepted && "opacity-60",
          )}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
