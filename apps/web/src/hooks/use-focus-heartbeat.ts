"use client";

import { useEffect, useRef } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const HEARTBEAT_INTERVAL_MS = 30_000;

export interface UseFocusHeartbeatOptions {
  meetingId: string;
  /** Tenant-level toggle. When false, the hook is a no-op (NFR-L4). */
  enabled: boolean;
  /** Banner-shown gate — AC2: focus data only collected after banner displayed. */
  bannerShown: boolean;
}

/**
 * Story 5.4 — emits one POST `/meetings/:id/focus-heartbeat` every 30s with
 * `{ visible: boolean, timestamp: ISO }` while the meeting tab is open AND
 * the tenant toggle is enabled AND the transparency banner has been shown.
 *
 * Uses Page Visibility API to derive `visible`. The endpoint accumulates
 * the counter on the server side (Redis hash) — caller only needs to fire.
 */
export function useFocusHeartbeat({
  meetingId,
  enabled,
  bannerShown,
}: UseFocusHeartbeatOptions): void {
  const visibleRef = useRef<boolean>(
    typeof document !== "undefined" && document.visibilityState === "visible",
  );

  useEffect(() => {
    if (!enabled || !bannerShown || !meetingId) return;
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    async function fire() {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("accessToken")
          : null;
      try {
        await fetch(`${API_BASE_URL}/meetings/${meetingId}/focus-heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            visible: visibleRef.current,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        // Best-effort — drop heartbeats on transient failures.
      }
    }

    // Fire one heartbeat immediately, then on interval.
    void fire();
    const id = setInterval(fire, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [meetingId, enabled, bannerShown]);
}
