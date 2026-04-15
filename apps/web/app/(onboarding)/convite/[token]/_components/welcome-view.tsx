import Link from "next/link";
import { Button } from "@metanoia/ui";

interface WelcomeViewProps {
  /** Resolved token string — preserved when moving to /termos. */
  token: string;
}

/**
 * Happy-path content for 05.1. Zero form fields — the page only invites.
 * "Aceitar e começar" and "Ver os termos primeiro" both navigate to 05.2;
 * the second jumps with the `#legal` hash so the legal section scrolls
 * into view (handled by the terms page client).
 */
export function WelcomeView({ token }: WelcomeViewProps) {
  const termsHref = `/convite/${encodeURIComponent(token)}/termos`;

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <h1 className="text-3xl font-bold text-[var(--color-text-primary)] sm:text-3xl">
        Bem-vindo ao metanoia-hub
      </h1>
      <div className="flex flex-col gap-3 text-lg text-[var(--color-text-muted)] sm:text-lg">
        <p>
          Você foi convidado para criar o espaço da sua igreja na plataforma.
        </p>
        <p>
          Em poucos minutos, sua comunidade terá um lugar para cuidar de quem
          importa.
        </p>
      </div>
      <div className="mt-2 flex w-full max-w-[320px] flex-col items-center gap-2">
        <Button asChild className="h-12 w-full text-base">
          <Link href={termsHref}>Aceitar e começar</Link>
        </Button>
        <Link
          href={`${termsHref}#legal`}
          className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:underline"
        >
          Ver os termos primeiro
        </Link>
      </div>
    </div>
  );
}
