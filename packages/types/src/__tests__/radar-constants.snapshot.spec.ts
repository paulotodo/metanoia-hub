import { describe, it, expect } from 'vitest';
import {
  RADAR_GREEN_THRESHOLD,
  RADAR_YELLOW_MIN,
  RADAR_RED_THRESHOLD,
  RADAR_ACTIVE_DAYS,
  RADAR_INACTIVE_DAYS,
  RADAR_MEETINGS_WINDOW,
  RADAR_CACHE_TTL_SECONDS,
  RADAR_CACHE_KEY_PREFIX,
  RADAR_QUEUE_NAME,
  RADAR_CONSTANTS,
} from '../pastoral/radar-constants';

describe('RADAR_CONSTANTS snapshot', () => {
  it('freezes the full radar constants map — silent breaking changes detected', () => {
    expect(RADAR_CONSTANTS).toMatchInlineSnapshot(`
      {
        "activeDays": 14,
        "cacheKeyPrefix": "cache:radar",
        "cacheTtlSeconds": 300,
        "greenThreshold": 0.75,
        "inactiveDays": 21,
        "meetingsWindow": 3,
        "queueName": "radar-calculation",
        "redThreshold": 0.5,
        "yellowMin": 0.5,
      }
    `);
  });
});

describe('individual radar threshold constants', () => {
  it('presence thresholds form a valid partition', () => {
    // verde: >= 0.75
    // amarelo: 0.50 <= x < 0.75
    // vermelho: < 0.50
    expect(RADAR_GREEN_THRESHOLD).toBe(0.75);
    expect(RADAR_YELLOW_MIN).toBe(0.50);
    expect(RADAR_RED_THRESHOLD).toBe(0.50);

    // Logical consistency: yellow min === red threshold (boundary)
    expect(RADAR_YELLOW_MIN).toBe(RADAR_RED_THRESHOLD);
    // Green threshold > yellow min
    expect(RADAR_GREEN_THRESHOLD).toBeGreaterThan(RADAR_YELLOW_MIN);
  });

  it('inactivity thresholds are ordered correctly', () => {
    expect(RADAR_ACTIVE_DAYS).toBe(14);
    expect(RADAR_INACTIVE_DAYS).toBe(21);
    expect(RADAR_INACTIVE_DAYS).toBeGreaterThan(RADAR_ACTIVE_DAYS);
  });

  it('cache and queue constants are correct', () => {
    expect(RADAR_CACHE_TTL_SECONDS).toBe(300); // 5 minutes
    expect(RADAR_CACHE_KEY_PREFIX).toBe('cache:radar');
    expect(RADAR_QUEUE_NAME).toBe('radar-calculation');
    expect(RADAR_MEETINGS_WINDOW).toBe(3);
  });
});
