/**
 * Radar Pastoral — Threshold Constants (Story 6-2)
 *
 * Named constants for the async radar calculation engine.
 * All thresholds MUST be referenced from this file — no magic numbers allowed.
 *
 * Semáforo MVP calculates ONLY from presence signals + activity trend.
 * Trail/content progress calculation belongs to Epic 8.
 */

/** Minimum presence percentage for verde status (≥75% of last 3 meetings). */
export const RADAR_GREEN_THRESHOLD = 0.75 as const;

/**
 * Minimum presence percentage for amarelo status (≥50%).
 * Range: 0.50 ≤ presence < 0.75.
 */
export const RADAR_YELLOW_MIN = 0.50 as const;

/**
 * Maximum presence percentage before status becomes vermelho (<50%).
 * Below this threshold = vermelho status.
 */
export const RADAR_RED_THRESHOLD = 0.50 as const;

/**
 * Days of inactivity before status degrades to amarelo.
 * Participant not seen in ≥ 14 days → at least amarelo.
 */
export const RADAR_ACTIVE_DAYS = 14 as const;

/**
 * Days of inactivity before status degrades to vermelho.
 * Participant not seen in ≥ 21 days → vermelho regardless of presence %.
 */
export const RADAR_INACTIVE_DAYS = 21 as const;

/** Number of past meetings used for presence calculation. */
export const RADAR_MEETINGS_WINDOW = 3 as const;

/** Redis TTL for radar cache in seconds (5 minutes). */
export const RADAR_CACHE_TTL_SECONDS = 300 as const;

/** Redis cache key prefix for radar status per group. */
export const RADAR_CACHE_KEY_PREFIX = 'cache:radar' as const;

/** BullMQ queue name for radar recalculation jobs. */
export const RADAR_QUEUE_NAME = 'radar-calculation' as const;

/** Frozen map of all radar constants for snapshot testing. */
export const RADAR_CONSTANTS = {
  greenThreshold: RADAR_GREEN_THRESHOLD,
  yellowMin: RADAR_YELLOW_MIN,
  redThreshold: RADAR_RED_THRESHOLD,
  activeDays: RADAR_ACTIVE_DAYS,
  inactiveDays: RADAR_INACTIVE_DAYS,
  meetingsWindow: RADAR_MEETINGS_WINDOW,
  cacheTtlSeconds: RADAR_CACHE_TTL_SECONDS,
  cacheKeyPrefix: RADAR_CACHE_KEY_PREFIX,
  queueName: RADAR_QUEUE_NAME,
} as const;

export type RadarConstants = typeof RADAR_CONSTANTS;
