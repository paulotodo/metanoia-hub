'use client';

import { useRef, useCallback, useEffect } from 'react';

export interface UseDocumentProgressOptions {
  /** Estimated reading time in minutes (null = only scroll threshold needed) */
  estimatedDurationMinutes: number | null;
  /**
   * Called when scroll or time changes.
   * @param scrollPercent  0–100 (floor percentage of document scrolled)
   * @param timeSpentSeconds  total seconds the user has spent on this page
   */
  onProgress: (scrollPercent: number, timeSpentSeconds: number) => void;
  /** Element to observe for scroll; defaults to `document.documentElement` */
  scrollElement?: HTMLElement | null;
}

export interface UseDocumentProgressReturn {
  /** Current scroll percentage (0–100, floor) */
  scrollPercent: number;
  /** Seconds spent on the page since mount (or since last reset) */
  timeSpentSeconds: number;
  /** Whether the document is considered completed per current values */
  isCompleted: boolean;
  /** Reset all tracking */
  reset: () => void;
}

/**
 * useDocumentProgress — rastreia progresso de leitura de documentos.
 *
 * Regras (AC #2):
 * - scrollPercent = floor((scrollTop + clientHeight) / scrollHeight * 100)
 * - timeSpentSeconds = seconds since hook mount (page-visible time)
 * - Concluído quando: scroll >= threshold AND (timeSpent >= estimatedDuration OR estimatedDuration = null)
 * - threshold default: 80% (convention over configuration, injetado pelo backend)
 *
 * Nota: threshold default de 80% é aplicado no frontend como fallback.
 * O valor real vem da config do tenant via GET /api/v1/tenant-config/content.
 */
const DEFAULT_SCROLL_THRESHOLD = 80;

export function useDocumentProgress({
  estimatedDurationMinutes,
  onProgress,
  scrollElement,
}: UseDocumentProgressOptions): UseDocumentProgressReturn {
  const scrollPercentRef = useRef(0);
  const timeSpentRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());
  const isCompletedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Evaluate completion
  // ---------------------------------------------------------------------------
  const evaluateCompletion = useCallback(
    (scrollPct: number, timeSecs: number): boolean => {
      const scrollOk = scrollPct >= DEFAULT_SCROLL_THRESHOLD;
      const timeOk =
        estimatedDurationMinutes === null
          ? true
          : timeSecs >= estimatedDurationMinutes * 60;
      return scrollOk && timeOk;
    },
    [estimatedDurationMinutes],
  );

  // ---------------------------------------------------------------------------
  // Scroll tracking
  // ---------------------------------------------------------------------------
  const handleScroll = useCallback(() => {
    const el =
      scrollElement ??
      (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el) return;

    const scrollTop = el.scrollTop;
    const clientHeight = el.clientHeight;
    const scrollHeight = el.scrollHeight;

    if (scrollHeight <= clientHeight) {
      // Document fits in viewport — treat as fully scrolled
      scrollPercentRef.current = 100;
    } else {
      scrollPercentRef.current = Math.min(
        Math.floor(((scrollTop + clientHeight) / scrollHeight) * 100),
        100,
      );
    }

    const timeSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
    timeSpentRef.current = timeSecs;

    isCompletedRef.current = evaluateCompletion(scrollPercentRef.current, timeSecs);
    onProgress(scrollPercentRef.current, timeSecs);
  }, [scrollElement, evaluateCompletion, onProgress]);

  // ---------------------------------------------------------------------------
  // Wire scroll listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const target =
      scrollElement ??
      (typeof window !== 'undefined' ? window : null);

    if (!target) return;

    target.addEventListener('scroll', handleScroll, { passive: true });
    // Fire once on mount to capture initial state
    handleScroll();

    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, [scrollElement, handleScroll]);

  // ---------------------------------------------------------------------------
  // Time tracking (update every 10s to avoid over-reporting)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const timeSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      timeSpentRef.current = timeSecs;
      isCompletedRef.current = evaluateCompletion(scrollPercentRef.current, timeSecs);
      onProgress(scrollPercentRef.current, timeSecs);
    }, 10_000);

    return () => {
      clearInterval(interval);
    };
  }, [evaluateCompletion, onProgress]);

  const reset = useCallback(() => {
    scrollPercentRef.current = 0;
    timeSpentRef.current = 0;
    startTimeRef.current = Date.now();
    isCompletedRef.current = false;
  }, []);

  return {
    get scrollPercent() {
      return scrollPercentRef.current;
    },
    get timeSpentSeconds() {
      return timeSpentRef.current;
    },
    get isCompleted() {
      return isCompletedRef.current;
    },
    reset,
  };
}
