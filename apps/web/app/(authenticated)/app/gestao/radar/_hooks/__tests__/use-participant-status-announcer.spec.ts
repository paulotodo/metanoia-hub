/**
 * Tests for useParticipantStatusAnnouncer — AC-5 (RF-04, RF-05)
 *
 * Covers:
 *  - 5 status changes within 3s → debounced to 1 announcement (batched)
 *  - 1 status change → individual announcement with name + status
 *  - silenced=true → no announcements (0 calls to announce)
 *  - New arrivals (no previous snapshot) → not announced
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useParticipantStatusAnnouncer } from "../use-participant-status-announcer";
import type { RadarParticipant } from "@metanoia/types";

// Helper to build a minimal RadarParticipant
function makeParticipant(
  id: string,
  name: string,
  signalType: RadarParticipant["signalType"],
): RadarParticipant {
  return {
    participantId: id,
    name,
    signalType,
    contextPhrase: null,
    groupId: "group-1",
    groupName: "Grupo Alpha",
    presenceDots: [],
    lastCareRecord: null,
    riskReason: null,
  };
}

const BASE_PARTICIPANTS: RadarParticipant[] = [
  makeParticipant("p1", "João", "care-ok"),
  makeParticipant("p2", "Maria", "care-ok"),
  makeParticipant("p3", "Pedro", "care-attention"),
];

describe("useParticipantStatusAnnouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not announce on first render (no previous snapshot)", () => {
    const announce = vi.fn();
    renderHook(() =>
      useParticipantStatusAnnouncer({
        participants: BASE_PARTICIPANTS,
        silenced: false,
        announce,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(announce).not.toHaveBeenCalled();
  });

  it("announces a single change with name and status after debounce", () => {
    const announce = vi.fn();
    const { rerender } = renderHook(
      ({ participants }: { participants: RadarParticipant[] }) =>
        useParticipantStatusAnnouncer({ participants, silenced: false, announce }),
      { initialProps: { participants: BASE_PARTICIPANTS } },
    );

    // Simulate João changing from care-ok → care-urgent
    const updated = [
      makeParticipant("p1", "João", "care-urgent"),
      makeParticipant("p2", "Maria", "care-ok"),
      makeParticipant("p3", "Pedro", "care-attention"),
    ];

    act(() => {
      rerender({ participants: updated });
    });

    // Before debounce fires → no announcement yet
    expect(announce).not.toHaveBeenCalled();

    // Advance past 3s debounce window
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(announce).toHaveBeenCalledOnce();
    expect(announce).toHaveBeenCalledWith("João — Urgente");
  });

  it("batches 5 changes within 3s into one announcement '{n} participantes atualizados'", () => {
    const announce = vi.fn();
    // Start with 5 participants all at care-ok
    const participants5 = Array.from({ length: 5 }, (_, i) =>
      makeParticipant(`p${i + 10}`, `Participante ${i + 1}`, "care-ok"),
    );

    const { rerender } = renderHook(
      ({ participants }: { participants: RadarParticipant[] }) =>
        useParticipantStatusAnnouncer({ participants, silenced: false, announce }),
      { initialProps: { participants: participants5 } },
    );

    // Simulate a single rerender where all 5 changed at once (e.g., SSE batch update)
    // This is the canonical case: one re-render from an SSE payload updating multiple participants
    act(() => {
      rerender({
        participants: participants5.map((p) => ({
          ...p,
          signalType: "care-attention" as const,
        })),
      });
    });

    // Before debounce fires → no announcement yet
    expect(announce).not.toHaveBeenCalled();

    // Advance past 3s debounce window
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(announce).toHaveBeenCalledOnce();
    const callArg = (announce.mock.calls[0] as [string])[0];
    // Batched: 5 changes → "5 participantes atualizados"
    expect(callArg).toMatch(/^5 participantes atualizados$/);
  });

  it("silenced=true: suppresses all announcements (0 calls to announce)", () => {
    const announce = vi.fn();
    const { rerender } = renderHook(
      ({ participants, silenced }: { participants: RadarParticipant[]; silenced: boolean }) =>
        useParticipantStatusAnnouncer({ participants, silenced, announce }),
      { initialProps: { participants: BASE_PARTICIPANTS, silenced: true } },
    );

    // Simulate a status change
    act(() => {
      rerender({
        participants: [
          makeParticipant("p1", "João", "care-urgent"),
          makeParticipant("p2", "Maria", "care-ok"),
          makeParticipant("p3", "Pedro", "care-attention"),
        ],
        silenced: true,
      });
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // silenced: no announce should fire
    expect(announce).not.toHaveBeenCalled();
  });

  it("resets debounce timer when a new change arrives within the window", () => {
    const announce = vi.fn();
    const { rerender } = renderHook(
      ({ participants }: { participants: RadarParticipant[] }) =>
        useParticipantStatusAnnouncer({ participants, silenced: false, announce }),
      { initialProps: { participants: BASE_PARTICIPANTS } },
    );

    // First change at t=0
    act(() => {
      rerender({
        participants: [
          makeParticipant("p1", "João", "care-urgent"),
          ...BASE_PARTICIPANTS.slice(1),
        ],
      });
    });

    // Second change at t=2900ms (within the 3s window — should reset timer)
    act(() => {
      vi.advanceTimersByTime(2900);
      rerender({
        participants: [
          makeParticipant("p1", "João", "care-urgent"),
          makeParticipant("p2", "Maria", "care-attention"),
          BASE_PARTICIPANTS[2],
        ],
      });
    });

    // At t=3000ms from first change (but only 100ms from last) → no fire yet
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(announce).not.toHaveBeenCalled();

    // Advance to t=6100ms from start → 3100ms from last change → should fire
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(announce).toHaveBeenCalledOnce();
    expect(announce).toHaveBeenCalledWith("2 participantes atualizados");
  });
});
