import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import type { VideoInterval, CompletedBy } from '@metanoia/types';

/** Defaults applied when TenantContentConfig does not exist */
const DEFAULTS = {
  videoThresholdPercent: 90,
  docScrollThresholdPercent: 80,
  allowManualVideoCompletion: false,
  allowManualDocCompletion: false,
} as const;

export interface CompletionResult {
  isCompleted: boolean;
  completedBy?: CompletedBy;
  progressPercent: number;
}

@Injectable()
export class CompletionRulesService {
  private readonly logger = new Logger(CompletionRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns tenant config or defaults (convention over configuration).
   * Never throws — falls back to DEFAULTS if config absent.
   */
  async getTenantConfig(tenantId: string) {
    const config = await withTenantTx(this.prisma, (tx) =>
      tx.tenantContentConfig.findUnique({ where: { tenantId } }),
    );
    return {
      videoThresholdPercent: config?.videoThresholdPercent ?? DEFAULTS.videoThresholdPercent,
      docScrollThresholdPercent: config?.docScrollThresholdPercent ?? DEFAULTS.docScrollThresholdPercent,
      allowManualVideoCompletion: config?.allowManualVideoCompletion ?? DEFAULTS.allowManualVideoCompletion,
      allowManualDocCompletion: config?.allowManualDocCompletion ?? DEFAULTS.allowManualDocCompletion,
    };
  }

  // ---------------------------------------------------------------------------
  // Interval helpers
  // ---------------------------------------------------------------------------

  /**
   * Merges overlapping/adjacent intervals and returns non-overlapping sorted array.
   * E.g. [{0,30},{20,60}] → [{0,60}]
   */
  mergeIntervals(intervals: VideoInterval[]): VideoInterval[] {
    if (intervals.length === 0) return [];

    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const first = sorted[0];
    if (!first) return [];
    const merged: VideoInterval[] = [{ start: first.start, end: first.end }];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];
      if (!current || !last) continue;
      if (current.start <= last.end) {
        // Overlapping or adjacent — extend
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ start: current.start, end: current.end });
      }
    }

    return merged;
  }

  /**
   * Computes unique watched seconds from an array of (possibly overlapping) intervals.
   */
  computeUniqueWatchedSeconds(intervals: VideoInterval[]): number {
    return this.mergeIntervals(intervals).reduce(
      (sum, iv) => sum + Math.max(0, iv.end - iv.start),
      0,
    );
  }

  /**
   * Determines if video is completed based on unique watched percent.
   * floor(uniqueWatched / total * 100) >= threshold
   * Boundary: 89.5% floors to 89 → NOT completed at 90% threshold
   */
  evaluateVideoCompletion(
    watchedIntervals: VideoInterval[],
    totalDurationSeconds: number,
    threshold: number,
  ): { isCompleted: boolean; progressPercent: number } {
    if (totalDurationSeconds <= 0) {
      return { isCompleted: false, progressPercent: 0 };
    }

    const uniqueWatched = this.computeUniqueWatchedSeconds(watchedIntervals);
    const progressPercent = Math.floor((uniqueWatched / totalDurationSeconds) * 100);
    const clamped = Math.min(progressPercent, 100);

    return {
      isCompleted: clamped >= threshold,
      progressPercent: clamped,
    };
  }

  /**
   * Determines if a document/rich_text lesson is completed.
   * scrollPercent >= threshold AND (timeSpentSeconds >= estimatedDurationMinutes*60 OR estimatedDurationMinutes is null)
   */
  evaluateDocCompletion(
    scrollPercent: number,
    timeSpentSeconds: number,
    estimatedDurationMinutes: number | null,
    threshold: number,
  ): { isCompleted: boolean; progressPercent: number } {
    const progressPercent = Math.min(Math.floor(scrollPercent), 100);
    const scrollOk = scrollPercent >= threshold;

    let timeOk = true;
    if (estimatedDurationMinutes !== null) {
      timeOk = timeSpentSeconds >= estimatedDurationMinutes * 60;
    }

    return {
      isCompleted: scrollOk && timeOk,
      progressPercent,
    };
  }

  /**
   * Determines if a lesson that is already "completed" should be recalculated.
   * Completion is immutable — once completed, never reverted by rule changes.
   */
  shouldSkipRecalculation(currentStatus: string): boolean {
    return currentStatus === 'completed';
  }

  /**
   * Logs a completion skip (immutability guard) for audit trail.
   */
  logCompletionImmutableSkip(
    tenantId: string,
    lessonId: string,
    userId: string,
  ): void {
    this.logger.log(
      { tenantId, lessonId, userId },
      'completion-rules: lesson already completed — skipping recalculation (immutability guard)',
    );
  }
}
