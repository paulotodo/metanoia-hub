"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { MeetingContextCard } from "@/components/meetings/meeting-context-card";
import { ConfirmedInlineList } from "@/components/meetings/confirmed-inline-list";
import { MilestoneList } from "@/components/meetings/milestone-list";
import { useMeetingDetail } from "@/lib/api/hooks";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default function AgendaDoGrupoPage({ params }: PageProps) {
  const { meetingId } = use(params);
  const router = useRouter();
  const { data: meeting, isLoading, isError } = useMeetingDetail(meetingId);

  function handleOpenRoom() {
    router.push(`/app/gestao/reunioes/${meetingId}/sala`);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <p className="text-sm text-text-muted">Carregando agenda...</p>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <p className="text-sm text-care-alert">
          Não foi possível carregar esta reunião.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-brand-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          <span aria-hidden="true">←</span> Voltar
        </button>
        <h1 className="text-xl font-semibold text-text-primary">
          Agenda do grupo
        </h1>
      </header>

      <MeetingContextCard
        groupName={meeting.groupName}
        scheduledFor={meeting.scheduledFor}
      />

      <section aria-labelledby="agenda-topic-label" className="space-y-2">
        <h3
          id="agenda-topic-label"
          className="text-sm font-medium text-text-secondary"
        >
          O que vamos conversar
        </h3>
        {meeting.topic ? (
          <p className="text-base text-text-primary">{meeting.topic}</p>
        ) : (
          <p className="text-sm text-text-muted">
            Sem tópico definido para esta semana.
          </p>
        )}
      </section>

      <ConfirmedInlineList
        confirmed={meeting.confirmed}
        label="Quem confirmou"
        emptyText="Ninguém respondeu ainda."
      />

      <MilestoneList milestones={meeting.milestones} label="Marcos da semana" />

      <button
        type="button"
        onClick={handleOpenRoom}
        className="h-14 w-full rounded-lg bg-brand-teal text-base font-semibold text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
      >
        Abrir sala
      </button>
    </div>
  );
}
