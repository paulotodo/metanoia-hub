"use client";

import { useRouter } from "next/navigation";
import { useState, use } from "react";
import { MeetingContextCard } from "@/components/meetings/meeting-context-card";
import { ConfirmedInlineList } from "@/components/meetings/confirmed-inline-list";
import { MilestoneList } from "@/components/meetings/milestone-list";
import { mockMeetingAgenda, mockMeetingAgendaEmpty } from "@mocks/meetings";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default function AgendaDoGrupoPage({ params }: PageProps) {
  const { meetingId } = use(params);
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  // Session 1: fixture-driven. Pick an empty variant for a specific id so we
  // can eyeball empty states; default otherwise.
  const meeting =
    meetingId === "empty" ? mockMeetingAgendaEmpty : mockMeetingAgenda;

  function handleOpenRoom() {
    setOpening(true);
    router.push(`/app/gestao/reunioes/${meetingId}/sala`);
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
        disabled={opening}
        className="h-14 w-full rounded-lg bg-brand-teal text-base font-semibold text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
      >
        {opening ? "Abrindo sala..." : "Abrir sala"}
      </button>
    </div>
  );
}
