"use client";

import { useRouter } from "next/navigation";
import { useState, use } from "react";
import { LiveStatusBar } from "@/components/meetings/live-status-bar";
import { ParticipantPresenceList } from "@/components/meetings/participant-presence-list";
import { EndConfirmDialog } from "@/components/meetings/end-confirm-dialog";
import {
  mockLiveParticipants,
  mockLiveParticipantsEmpty,
  mockRoomStartedAt,
  mockMeetingAgenda,
} from "../../../../../../../__mocks__/meetings";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default function SalaAoVivoPage({ params }: PageProps) {
  const { meetingId } = use(params);
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  const participants =
    meetingId === "empty" ? mockLiveParticipantsEmpty : mockLiveParticipants;

  function handleEndConfirm() {
    setEnding(true);
    setDialogOpen(false);
    router.push(`/app/gestao/reunioes/${meetingId}/reflexao`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">
          {mockMeetingAgenda.groupName}
        </h1>
      </header>

      <LiveStatusBar
        startedAt={mockRoomStartedAt}
        label="Reunião em andamento"
        detailsTemplate="Há {duration}"
        connectingLabel="Conectando..."
      />

      <ParticipantPresenceList
        participants={participants}
        label="Na sala agora"
        connectedLabel="Entrou"
        notJoinedLabel="Ainda não entrou"
        leftLabel="Saiu"
        waitingLabel="Aguardando participantes entrarem..."
      />

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={ending}
        className="h-14 w-full rounded-lg bg-care-alert text-base font-semibold text-text-inverse transition-colors hover:bg-care-alert/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
      >
        {ending ? "Encerrando..." : "Encerrar sala"}
      </button>

      <EndConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleEndConfirm}
        title="Encerrar a sala?"
        body="Todos serão desconectados e você vai para a reflexão."
        confirmLabel="Encerrar"
        cancelLabel="Cancelar"
        pending={ending}
        pendingLabel="Encerrando..."
      />
    </div>
  );
}
