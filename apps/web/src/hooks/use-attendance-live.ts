"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttendanceLiveEventSchema,
  type AttendanceLiveEvent,
  type LiveParticipant,
} from "@metanoia/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export type AttendanceLiveState =
  | { status: "connecting"; participants: LiveParticipant[] }
  | { status: "live"; participants: LiveParticipant[] }
  | { status: "error"; participants: LiveParticipant[] };

/**
 * Story 5.5 — subscribes to `/api/v1/meetings/:id/attendance/live` SSE
 * stream. The first event is a `snapshot` with full state; subsequent
 * events are deltas (`participant.joined` / `participant.left`).
 *
 * EventSource handles reconnection natively; on every fresh connect the
 * server re-sends a full snapshot, so reconnect-with-state is a free
 * by-product of the contract (no client-side gap-fill needed).
 */
export function useAttendanceLive(meetingId: string): AttendanceLiveState {
  const [state, setState] = useState<AttendanceLiveState>({
    status: "connecting",
    participants: [],
  });
  const lastSnapshot = useRef<LiveParticipant[]>([]);

  useEffect(() => {
    if (!meetingId) return;

    const url = `${API_BASE_URL}/meetings/${meetingId}/attendance/live`;
    const source = new EventSource(url, { withCredentials: false });

    source.onmessage = (e) => {
      const parsed = AttendanceLiveEventSchema.safeParse(JSON.parse(e.data));
      if (!parsed.success) return;
      apply(parsed.data);
    };

    source.onerror = () => {
      setState((prev) => ({ status: "error", participants: prev.participants }));
    };

    function apply(event: AttendanceLiveEvent) {
      if (event.type === "snapshot") {
        lastSnapshot.current = event.participants;
        setState({ status: "live", participants: event.participants });
        return;
      }
      // delta — merge into local cache by userId
      const next = lastSnapshot.current.map((p) => ({ ...p }));
      const idx = next.findIndex((p) => p.userId === event.userId);
      if (event.type === "participant.joined") {
        if (idx === -1) {
          next.push({
            userId: event.userId,
            name: null,
            status: "na-sala",
            currentDurationSeconds: 0,
            cameraOn: false,
            joinedAt: event.timestamp,
            leftAt: null,
          });
        } else {
          const existing = next[idx];
          if (existing) {
            next[idx] = { ...existing, status: "na-sala", leftAt: null };
          }
        }
      } else if (event.type === "participant.left" && idx !== -1) {
        const existing = next[idx];
        if (existing) {
          next[idx] = { ...existing, status: "saiu", leftAt: event.timestamp };
        }
      }
      lastSnapshot.current = next;
      setState({ status: "live", participants: next });
    }

    return () => {
      source.close();
    };
  }, [meetingId]);

  return state;
}
