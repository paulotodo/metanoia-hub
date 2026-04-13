"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Calendar, MessageCircle, HandHeart } from "lucide-react";
import { useParticipantProfile } from "@/lib/api/hooks/use-radar";
import { PresenceDots } from "../../_components/presence-dots";
import { ProfileSkeleton } from "../../_components/radar-skeleton";
import { RadarError } from "../../_components/radar-error";

function formatRelativeDate(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  return `há ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
}

function formatFutureDate(isoDate: string, dayOfWeek: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days < 7) return dayOfWeek;
  return `em ${days} dias`;
}

interface MemoryEntryProps {
  icon: React.ReactNode;
  label: string;
  date: string;
  note: string;
}

function MemoryEntry({ icon, label, date, note }: MemoryEntryProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-border-default bg-surface-elevated p-4">
      <div className="shrink-0 text-text-muted">{icon}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="text-xs text-text-muted">{date}</span>
        </div>
        <p className="text-sm text-text-secondary line-clamp-2">{note}</p>
      </div>
    </div>
  );
}

function EmptyMemoryState() {
  return (
    <div className="rounded-lg border border-dashed border-border-default bg-surface-sunken p-6 text-center">
      <p className="text-sm text-text-muted">
        Ainda não há registros — esta pode ser a primeira conversa
      </p>
    </div>
  );
}

export default function ParticipantProfilePage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = use(params);
  const { data, isLoading, error, refetch } = useParticipantProfile(participantId);

  if (isLoading) return <ProfileSkeleton />;
  if (error) return <RadarError error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  const { memory } = data;
  const hasAnyMemory =
    memory.lastConversation || memory.lastPrayer || memory.nextMilestone;

  return (
    <div className="space-y-6 py-6">
      {/* Back navigation */}
      <Link
        href={`/app/gestao/radar/${participantId}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Detalhe do sinal
      </Link>

      {/* Profile header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary lg:text-3xl lg:font-bold">
          {data.name}
        </h1>
        <p className="text-sm text-text-muted">{data.groupName}</p>
      </div>

      {/* Presence dots */}
      <PresenceDots dots={data.presenceDots} />

      {/* Relational memory */}
      <section className="space-y-3" aria-labelledby="relational-memory">
        <h2
          id="relational-memory"
          className="text-sm font-semibold text-text-secondary"
        >
          Memória relacional
        </h2>

        {!hasAnyMemory ? (
          <EmptyMemoryState />
        ) : (
          <div className="space-y-3">
            {memory.lastConversation && (
              <MemoryEntry
                icon={<MessageCircle className="size-4" />}
                label="Última conversa"
                date={formatRelativeDate(memory.lastConversation.date)}
                note={memory.lastConversation.note}
              />
            )}
            {memory.lastPrayer && (
              <MemoryEntry
                icon={<HandHeart className="size-4" />}
                label="Última oração"
                date={formatRelativeDate(memory.lastPrayer.date)}
                note={memory.lastPrayer.note}
              />
            )}
            {memory.nextMilestone && (
              <div className="flex gap-3 rounded-lg border border-border-default bg-surface-elevated p-4">
                <div className="shrink-0 text-text-muted">
                  <Calendar className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">
                      Próximo marco
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatFutureDate(
                        memory.nextMilestone.date,
                        memory.nextMilestone.dayOfWeek,
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {memory.nextMilestone.eventName}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* CTA */}
      <Link
        href={`/app/gestao/radar/${participantId}/cuidado`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-teal px-4 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus sm:w-auto"
      >
        <Heart className="size-4" aria-hidden="true" />
        Registrar cuidado
      </Link>
    </div>
  );
}
