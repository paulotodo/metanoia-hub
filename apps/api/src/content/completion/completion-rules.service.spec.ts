import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { CompletionRulesService } from './completion-rules.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Unit tests — no DB required for pure logic tests
// ---------------------------------------------------------------------------

describe('CompletionRulesService', () => {
  let service: CompletionRulesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CompletionRulesService,
        {
          provide: PrismaService,
          useValue: { client: { tenantContentConfig: { findUnique: async () => null } } },
        },
      ],
    }).compile();

    service = module.get(CompletionRulesService);
  });

  // -------------------------------------------------------------------------
  // mergeIntervals
  // -------------------------------------------------------------------------
  describe('mergeIntervals', () => {
    it('returns empty array for empty input', () => {
      expect(service.mergeIntervals([])).toEqual([]);
    });

    it('merges two overlapping intervals', () => {
      const result = service.mergeIntervals([
        { start: 0, end: 30 },
        { start: 20, end: 60 },
      ]);
      expect(result).toEqual([{ start: 0, end: 60 }]);
    });

    it('keeps non-overlapping intervals separate', () => {
      const result = service.mergeIntervals([
        { start: 0, end: 30 },
        { start: 45, end: 90 },
      ]);
      expect(result).toEqual([
        { start: 0, end: 30 },
        { start: 45, end: 90 },
      ]);
    });

    it('merges three overlapping intervals into one', () => {
      const result = service.mergeIntervals([
        { start: 0, end: 20 },
        { start: 15, end: 40 },
        { start: 35, end: 60 },
      ]);
      expect(result).toEqual([{ start: 0, end: 60 }]);
    });

    it('handles unsorted input', () => {
      const result = service.mergeIntervals([
        { start: 45, end: 90 },
        { start: 0, end: 30 },
      ]);
      expect(result).toEqual([
        { start: 0, end: 30 },
        { start: 45, end: 90 },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // computeUniqueWatchedSeconds
  // -------------------------------------------------------------------------
  describe('computeUniqueWatchedSeconds', () => {
    it('returns 0 for empty intervals', () => {
      expect(service.computeUniqueWatchedSeconds([])).toBe(0);
    });

    it('sums non-overlapping intervals', () => {
      expect(
        service.computeUniqueWatchedSeconds([
          { start: 0, end: 30 },
          { start: 45, end: 90 },
        ]),
      ).toBe(75);
    });

    it('deduplicates overlapping intervals', () => {
      expect(
        service.computeUniqueWatchedSeconds([
          { start: 0, end: 30 },
          { start: 20, end: 60 },
        ]),
      ).toBe(60); // merged [0,60]
    });
  });

  // -------------------------------------------------------------------------
  // evaluateVideoCompletion — boundary tests (AC #1)
  // -------------------------------------------------------------------------
  describe('evaluateVideoCompletion', () => {
    const totalDuration = 100; // 100s video, threshold 90%

    it('89% → NOT completed (floor 89 < 90)', () => {
      // 89s watched out of 100s = 89% → NOT completed
      const { isCompleted, progressPercent } = service.evaluateVideoCompletion(
        [{ start: 0, end: 89 }],
        totalDuration,
        90,
      );
      expect(isCompleted).toBe(false);
      expect(progressPercent).toBe(89);
    });

    it('90% → completed (floor 90 >= 90)', () => {
      const { isCompleted, progressPercent } = service.evaluateVideoCompletion(
        [{ start: 0, end: 90 }],
        totalDuration,
        90,
      );
      expect(isCompleted).toBe(true);
      expect(progressPercent).toBe(90);
    });

    it('89.5% floors to 89 → NOT completed', () => {
      // 89.5s watched out of 100s
      const { isCompleted, progressPercent } = service.evaluateVideoCompletion(
        [{ start: 0, end: 89.5 }],
        totalDuration,
        90,
      );
      // floor(89.5/100*100) = floor(89.5) = 89
      expect(isCompleted).toBe(false);
      expect(progressPercent).toBe(89);
    });

    it('100% watched → completed', () => {
      const { isCompleted, progressPercent } = service.evaluateVideoCompletion(
        [{ start: 0, end: 100 }],
        totalDuration,
        90,
      );
      expect(isCompleted).toBe(true);
      expect(progressPercent).toBe(100);
    });

    it('returns 0 progress for totalDurationSeconds = 0', () => {
      const { isCompleted, progressPercent } = service.evaluateVideoCompletion(
        [{ start: 0, end: 60 }],
        0,
        90,
      );
      expect(isCompleted).toBe(false);
      expect(progressPercent).toBe(0);
    });

    it('custom threshold 50%: 50s of 100s → completed', () => {
      const { isCompleted } = service.evaluateVideoCompletion(
        [{ start: 0, end: 50 }],
        totalDuration,
        50,
      );
      expect(isCompleted).toBe(true);
    });

    it('custom threshold 50%: 49s of 100s → NOT completed', () => {
      const { isCompleted } = service.evaluateVideoCompletion(
        [{ start: 0, end: 49 }],
        totalDuration,
        50,
      );
      expect(isCompleted).toBe(false);
    });

    it('merges overlapping intervals before calculating percent', () => {
      // Two intervals [0,50] + [40,80] = merged [0,80] = 80% of 100s video
      const { isCompleted, progressPercent } = service.evaluateVideoCompletion(
        [
          { start: 0, end: 50 },
          { start: 40, end: 80 },
        ],
        totalDuration,
        90,
      );
      expect(isCompleted).toBe(false);
      expect(progressPercent).toBe(80);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateDocCompletion (AC #2)
  // -------------------------------------------------------------------------
  describe('evaluateDocCompletion', () => {
    it('scroll ≥ 80% AND time ≥ estimatedDuration → completed', () => {
      const { isCompleted, progressPercent } = service.evaluateDocCompletion(
        80, // 80% scroll
        300, // 5 min time spent in seconds
        5,   // estimatedDurationMinutes = 5
        80,  // threshold
      );
      expect(isCompleted).toBe(true);
      expect(progressPercent).toBe(80);
    });

    it('scroll ≥ 80% but time < estimatedDuration → NOT completed', () => {
      const { isCompleted } = service.evaluateDocCompletion(
        80,
        60, // only 1 min, need 5
        5,
        80,
      );
      expect(isCompleted).toBe(false);
    });

    it('scroll < 80% even with time OK → NOT completed', () => {
      const { isCompleted } = service.evaluateDocCompletion(
        70, // not enough scroll
        300,
        5,
        80,
      );
      expect(isCompleted).toBe(false);
    });

    it('estimatedDurationMinutes null: only scroll ≥ threshold needed', () => {
      const { isCompleted } = service.evaluateDocCompletion(
        80,
        0, // no time tracked
        null, // no estimated duration
        80,
      );
      expect(isCompleted).toBe(true);
    });

    it('estimatedDurationMinutes null + scroll < threshold → NOT completed', () => {
      const { isCompleted } = service.evaluateDocCompletion(
        70,
        0,
        null,
        80,
      );
      expect(isCompleted).toBe(false);
    });

    it('100% scroll + estimatedDuration null → completed', () => {
      const { isCompleted, progressPercent } = service.evaluateDocCompletion(
        100,
        0,
        null,
        80,
      );
      expect(isCompleted).toBe(true);
      expect(progressPercent).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // shouldSkipRecalculation — immutability guard (AC #5)
  // -------------------------------------------------------------------------
  describe('shouldSkipRecalculation', () => {
    it('returns true for completed lesson (completion immutable)', () => {
      expect(service.shouldSkipRecalculation('completed')).toBe(true);
    });

    it('returns false for in_progress', () => {
      expect(service.shouldSkipRecalculation('in_progress')).toBe(false);
    });

    it('returns false for not_started', () => {
      expect(service.shouldSkipRecalculation('not_started')).toBe(false);
    });
  });
});
