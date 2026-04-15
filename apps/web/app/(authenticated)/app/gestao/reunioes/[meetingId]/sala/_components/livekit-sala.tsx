"use client";

import { useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
} from "@livekit/components-react";
import type { MeetingParticipant } from "@metanoia/types";
import { LiveStatusBar } from "@/components/meetings/live-status-bar";
import { ParticipantPresenceList } from "@/components/meetings/participant-presence-list";
import { useOpenRoom } from "@/lib/api/hooks";

interface LivekitSalaProps {
  meetingId: string;
}

export function LivekitSala({ meetingId }: LivekitSalaProps) {
  const openRoom = useOpenRoom(meetingId);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    openRoom.mutate();
  }, [openRoom]);

  if (openRoom.isError) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-care-alert/40 bg-care-alert/5 p-4 text-sm text-care-alert"
      >
        Não foi possível abrir a sala. Tente novamente.
      </div>
    );
  }

  if (!openRoom.data) {
    return (
      <LiveStatusBar
        startedAt=""
        label="Reunião em andamento"
        detailsTemplate="Há {duration}"
        connectingLabel="Conectando..."
      />
    );
  }

  const { joinToken, livekitUrl, startedAt } = openRoom.data;

  return (
    <LiveKitRoom
      token={joinToken}
      serverUrl={livekitUrl}
      connect
      audio
      video={false}
      className="space-y-6"
    >
      <RoomAudioRenderer />
      <LiveStatusBar
        startedAt={startedAt}
        label="Reunião em andamento"
        detailsTemplate="Há {duration}"
        connectingLabel="Conectando..."
      />
      <LivePresence />
    </LiveKitRoom>
  );
}

function LivePresence() {
  const participants = useParticipants();

  const mapped: MeetingParticipant[] = participants.map((p) => ({
    participantId: p.identity,
    name: p.name && p.name.length > 0 ? p.name : p.identity,
    joinedAt: p.joinedAt
      ? p.joinedAt.toISOString()
      : new Date().toISOString(),
    leftAt: null,
  }));

  return (
    <ParticipantPresenceList
      participants={mapped}
      label="Na sala agora"
      connectedLabel="Entrou"
      notJoinedLabel="Ainda não entrou"
      leftLabel="Saiu"
      waitingLabel="Aguardando participantes entrarem..."
    />
  );
}
