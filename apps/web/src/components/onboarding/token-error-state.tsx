import { Button } from "@metanoia/ui";

export type TokenErrorVariant = "expired" | "used" | "invalid" | "network";

interface TokenErrorStateProps {
  variant: TokenErrorVariant;
  heading: string;
  body: string;
  /**
   * Primary action. Label + handler chosen by the caller because each
   * variant resolves to a different destination:
   *   expired / invalid → "Falar com o suporte"
   *   used              → "Ir para o login"
   *   network           → "Tentar novamente"
   */
  action: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

/**
 * Shared illustration-less error state for the four non-happy paths of
 * invite token validation (spec 05.1). Copy is passed in to keep the
 * component i18n-agnostic; translation keys live in pt-BR.json.
 */
export function TokenErrorState({
  variant,
  heading,
  body,
  action,
}: TokenErrorStateProps) {
  return (
    <section
      role="alert"
      aria-live="polite"
      data-variant={variant}
      className="flex w-full flex-col items-center gap-4 text-center"
    >
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
        {heading}
      </h2>
      <p className="text-base text-[var(--color-text-muted)]">{body}</p>
      {action.href ? (
        <Button asChild className="mt-2">
          <a href={action.href}>{action.label}</a>
        </Button>
      ) : (
        <Button type="button" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </section>
  );
}
