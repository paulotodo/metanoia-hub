import Link from "next/link";

interface TermsNoticeProps {
  token: string;
}

/**
 * Spec 06.2-T1 — LGPD consent as notice (not gate). Continuing implies acceptance
 * (Art. 7º, I LGPD); the link allows reading first.
 */
export function TermsNotice({ token }: TermsNoticeProps) {
  return (
    <p className="text-center text-xs text-[var(--color-text-muted)]">
      Ao continuar, você aceita os{" "}
      <Link
        href={`/convite/${encodeURIComponent(token)}/termos`}
        className="underline underline-offset-2 hover:text-[var(--color-text-primary)]"
      >
        termos de uso
      </Link>
      .
    </p>
  );
}
