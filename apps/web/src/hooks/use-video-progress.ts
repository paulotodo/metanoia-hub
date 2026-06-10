'use client';

import { useRef, useCallback, useEffect } from 'react';

export interface VideoInterval {
  start: number;
  end: number;
}

export interface UseVideoProgressOptions {
  /** Total video duration in seconds */
  totalDurationSeconds: number;
  /** Called when progress changes; progressPercent is floor(unique/total*100) */
  onProgress: (progressPercent: number, watchedIntervals: VideoInterval[]) => void;
  /** How often to record the current position (milliseconds). Default: 5000 */
  updateIntervalMs?: number;
}

export interface UseVideoProgressReturn {
  /** Attach to HTMLVideoElement via ref */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Computed floor percentage of unique watched time (0–100) */
  uniqueWatchedPercent: number;
  /** Current merged (non-overlapping) intervals */
  watchedIntervals: VideoInterval[];
  /** Reset all tracking state */
  reset: () => void;
}

/**
 * useVideoProgress — rastreia progresso de vídeo por intervalos únicos assistidos.
 *
 * Regras:
 * - Eventos `timeupdate` são amostrados a cada `updateIntervalMs` (padrão 5s)
 * - Seeking reseta o início do intervalo atual
 * - Intervalos sobrepostos são mesclados antes do cálculo
 * - Percentual = floor(segundos únicos / duração total * 100)
 */
export function useVideoProgress({
  totalDurationSeconds,
  onProgress,
  updateIntervalMs = 5000,
}: UseVideoProgressOptions): UseVideoProgressReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // All watched intervals (may overlap; merged on read)
  const intervalsRef = useRef<VideoInterval[]>([]);
  // Start of the current continuous play segment
  const currentStartRef = useRef<number | null>(null);
  // Last time the periodic callback fired
  const lastUpdateRef = useRef<number>(0);
  // Cached merged intervals and percent (avoid recomputing on every timeupdate)
  const mergedRef = useRef<VideoInterval[]>([]);
  const percentRef = useRef<number>(0);

  // ---------------------------------------------------------------------------
  // Interval merge helper
  // ---------------------------------------------------------------------------
  const mergeIntervals = useCallback((intervals: VideoInterval[]): VideoInterval[] => {
    if (intervals.length === 0) return [];
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const first = sorted[0];
    if (!first) return [];
    const result: VideoInterval[] = [first];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const last = result[result.length - 1];
      if (!cur || !last) continue;
      if (cur.start <= last.end) {
        last.end = Math.max(last.end, cur.end);
      } else {
        result.push({ start: cur.start, end: cur.end });
      }
    }
    return result;
  }, []);

  const computePercent = useCallback(
    (merged: VideoInterval[]): number => {
      if (totalDurationSeconds <= 0) return 0;
      const unique = merged.reduce((s, iv) => s + Math.max(0, iv.end - iv.start), 0);
      return Math.min(Math.floor((unique / totalDurationSeconds) * 100), 100);
    },
    [totalDurationSeconds],
  );

  // ---------------------------------------------------------------------------
  // Record progress snapshot (called periodically)
  // ---------------------------------------------------------------------------
  const recordSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentPos = video.currentTime;
    const start = currentStartRef.current;

    // Extend the current interval if playing
    if (start !== null && currentPos > start) {
      intervalsRef.current = [...intervalsRef.current, { start, end: currentPos }];
      currentStartRef.current = currentPos; // advance start to avoid double-counting
    }

    const merged = mergeIntervals(intervalsRef.current);
    const percent = computePercent(merged);

    mergedRef.current = merged;
    percentRef.current = percent;

    onProgress(percent, merged);
  }, [mergeIntervals, computePercent, onProgress]);

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const now = performance.now();
    if (now - lastUpdateRef.current < updateIntervalMs) return;
    lastUpdateRef.current = now;

    recordSnapshot();
  }, [recordSnapshot, updateIntervalMs]);

  const handlePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    currentStartRef.current = video.currentTime;
  }, []);

  const handleSeeking = useCallback(() => {
    // Seeking resets the start of the current interval
    const video = videoRef.current;
    if (!video) return;
    currentStartRef.current = video.currentTime;
  }, []);

  const handlePause = useCallback(() => {
    recordSnapshot();
    currentStartRef.current = null;
  }, [recordSnapshot]);

  const handleEnded = useCallback(() => {
    recordSnapshot();
    currentStartRef.current = null;
  }, [recordSnapshot]);

  // ---------------------------------------------------------------------------
  // Wire up event listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [handleTimeUpdate, handlePlay, handleSeeking, handlePause, handleEnded]);

  const reset = useCallback(() => {
    intervalsRef.current = [];
    currentStartRef.current = null;
    lastUpdateRef.current = 0;
    mergedRef.current = [];
    percentRef.current = 0;
  }, []);

  return {
    videoRef,
    get uniqueWatchedPercent() {
      return percentRef.current;
    },
    get watchedIntervals() {
      return mergedRef.current;
    },
    reset,
  };
}
