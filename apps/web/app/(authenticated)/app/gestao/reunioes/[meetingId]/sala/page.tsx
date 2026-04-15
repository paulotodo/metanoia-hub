"use client";

import { useRouter } from "next/navigation";
import { useState, use } from "react";
import { EndConfirmDialog } from "@/components/meetings/end-confirm-dialog";
import { useEndRoom, useMeetingDetail } from "@/lib/api/hooks";
import { LivekitSala } from "./_components/livekit-sala";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default function SalaAoVivoPage({ params }: PageProps) {
  const { meetingId } = use(params);
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: meeting } = useMeetingDetail(meetingId);
  const endRoom = useEndRoom(meetingId);

  function handleEndConfirm() {
    endRoom.mutate(undefined, {
      onSuccess: () => {
        setDialogOpen(false);
        router.push(`/app/gestao/reunioes/${meetingId}/reflexao`);
      },
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">
          {meeting?.groupName ?? "Reunião"}
        </h1>
      </header>

      <LivekitSala meetingId={meetingId} />

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={endRoom.isPending}
        className="h-14 w-full rounded-lg bg-care-alert text-base font-semibold text-text-inverse transition-colors hover:bg-care-alert/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
      >
        {endRoom.isPending ? "Encerrando..." : "Encerrar sala"}
      </button>

      <EndConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleEndConfirm}
        title="Encerrar a sala?"
        body="Todos serão desconectados e você vai para a reflexão."
        confirmLabel="Encerrar"
        cancelLabel="Cancelar"
        pending={endRoom.isPending}
        pendingLabel="Encerrando..."
      />
    </div>
  );
}
