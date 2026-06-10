"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseUndoableActionOptions {
  /** Countdown duration in seconds. Defaults to 5. */
  countdownSeconds?: number;
  /** Called when the countdown expires without undo. */
  onCommit?: () => void;
}

export interface UseUndoableActionReturn {
  /** Current countdown value (countdownSeconds → 0). */
  countdown: number;
  /** Whether the countdown is active. */
  isActive: boolean;
  /** Start the countdown. Call after a successful action. */
  start: () => void;
  /** Cancel (undo) — stops the countdown and resets state. */
  cancel: () => void;
}

/**
 * Reusable undo-with-countdown hook.
 *
 * Usage pattern:
 *   const undo = useUndoableAction({ onCommit: () => router.push('/next') });
 *   // after success: undo.start();
 *   // on undo click: undo.cancel();
 *
 * Story 6-5 — extracted from cuidado/page.tsx inline implementation.
 */
export function useUndoableAction({
  countdownSeconds = 5,
  onCommit,
}: UseUndoableActionOptions = {}): UseUndoableActionReturn {
  const [countdown, setCountdown] = useState(countdownSeconds);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCommitRef = useRef(onCommit);

  // Keep callback ref current without re-triggering effect
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setIsActive(true);
    let count = countdownSeconds;
    setCountdown(count);

    timerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearTimer();
        setIsActive(false);
        onCommitRef.current?.();
      }
    }, 1000);
  }, [countdownSeconds, clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    setIsActive(false);
    setCountdown(countdownSeconds);
  }, [countdownSeconds, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return { countdown, isActive, start, cancel };
}
