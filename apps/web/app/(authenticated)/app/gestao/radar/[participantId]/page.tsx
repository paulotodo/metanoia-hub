"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Heart } from "lucide-react";
import { mockSignalDetail } from "../../../../../../__mocks__/radar";
import { PresenceDots } from "../_components/presence-dots";

function formatRelativeDate(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  return `há ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
}

const careTypeLabels: Record<string, string> = {
  message: "Mensagem",
  call: "Ligação",
  visit: "Visita",
  prayer: "Oração",
};

export default function SignalDetailPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = use(params);

  // Prototype: use mock data (will be replaced by TanStack Query in Session 6)
  const data = mockSignalDetail;

  return (
    <div className="space-y-6 py-6">
      {/* Back navigation */}
      <Link
        href="/app/gestao/radar"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Radar
      </Link>

      {/* Signal header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary lg:text-3xl lg:font-bold">
          {data.name}
        </h1>
        <p className="text-sm text-text-muted">{data.groupName}</p>
      </div>

      {/* Observed fact — what the radar saw */}
      <section className="space-y-2" aria-labelledby="observed-fact">
        <h2
          id="observed-fact"
          className="text-sm font-semibold text-text-secondary"
        >
          O que o radar viu
        </h2>
        <div className="rounded-lg border border-border-default bg-surface-elevated p-4">
          <p className="text-base text-text-primary">{data.observedFact.text}</p>
        </div>
      </section>

      {/* System limitation — what the radar doesn't know */}
      <section className="space-y-2" aria-labelledby="system-limitation">
        <h2
          id="system-limitation"
          className="text-sm font-semibold text-text-secondary"
        >
          O que o radar não sabe
        </h2>
        <div className="rounded-lg border border-border-default bg-surface-sunken p-4">
          <p className="text-sm text-text-muted">{data.systemLimitation.text}</p>
        </div>
      </section>

      {/* Presence dots */}
      <PresenceDots dots={data.presenceDots} />

      {/* Last care record */}
      {data.lastCareRecord && (
        <section className="space-y-2" aria-labelledby="last-care">
          <h2
            id="last-care"
            className="text-sm font-semibold text-text-secondary"
          >
            Último cuidado registrado
          </h2>
          <div className="rounded-lg border border-border-default bg-surface-elevated p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                {careTypeLabels[data.lastCareRecord.type]}
              </span>
              <span className="text-xs text-text-muted">
                {formatRelativeDate(data.lastCareRecord.date)}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/app/gestao/radar/${participantId}/perfil`}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border-default bg-surface-base px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          <Eye className="size-4" aria-hidden="true" />
          Ver essa pessoa
        </Link>
        <Link
          href={`/app/gestao/radar/${participantId}/cuidado`}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-teal px-4 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          <Heart className="size-4" aria-hidden="true" />
          Registrar cuidado
        </Link>
      </div>
    </div>
  );
}
