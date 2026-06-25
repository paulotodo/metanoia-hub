"use client";

import { useEffect, useRef } from "react";
import type { RadarParticipant, SignalType } from "@metanoia/types";
import { SIGNAL_STATUS_LABELS } from "@metanoia/types";

interface UseParticipantStatusAnnouncerOptions {
  /** Current list of participants (updated on each SSE-triggered re-render) */
  participants: RadarParticipant[];
  /** When true, suppress all announcements (aria-live="off" handled by caller) */
  silenced: boolean;
  /** Callback to emit announcement text into the aria-live region */
  announce: (message: string) => void;
}

/**
 * useParticipantStatusAnnouncer — AC-5 (RF-04, RF-05)
 *
 * Tracks signalType deltas between renders (proxy for SSE updates).
 * Accumulates deltas within a 3-second debounce window, then emits:
 *   - 1 change:  "{name} — {status}"
 *   - 2+ changes: "{n} participantes atualizados"
 * When silenced, all announces are suppressed (no-op).
 */
export function useParticipantStatusAnnouncer({
  participants,
  silenced,
  announce,
}: UseParticipantStatusAnnouncerOptions): void {
  // Snapshot of previous signalType per participant
  const prevSnapshotRef = useRef<Map<string, SignalType>>(new Map());
  // Accumulated delta items within the current debounce window
  const pendingDeltasRef = useRef<Array<{ name: string; signalType: SignalType }>>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevSnapshotRef.current;
    const newSnapshot = new Map<string, SignalType>();

    for (const p of participants) {
      newSnapshot.set(p.participantId, p.signalType);
      const prevSignal = prev.get(p.participantId);
      if (prevSignal !== undefined && prevSignal !== p.signalType) {
        // Delta detected: accumulate for batch announcement
        pendingDeltasRef.current.push({ name: p.name, signalType: p.signalType });
      }
    }

    // Update snapshot for next render
    prevSnapshotRef.current = newSnapshot;

    if (pendingDeltasRef.current.length === 0) return;

    // Debounce: reset timer on each new delta within the window
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (silenced) {
        // Silenced: discard pending deltas without announcing
        pendingDeltasRef.current = [];
        return;
      }

      const deltas = pendingDeltasRef.current;
      pendingDeltasRef.current = [];

      if (deltas.length === 1) {
        announce(`${deltas[0].name} — ${SIGNAL_STATUS_LABELS[deltas[0].signalType]}`);
      } else {
        announce(`${deltas.length} participantes atualizados`);
      }
    }, 3000);

    return () => {
      // Do NOT clear on unmount — prevents race where component re-renders
      // before debounce fires (participants prop update mid-window).
      // Timer will fire naturally; the component will be gone but announce
      // is a stable ref from parent.
    };
  }, [participants, silenced, announce]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
}
