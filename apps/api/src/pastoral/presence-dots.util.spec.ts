import { describe, it, expect } from 'vitest';
import { normalizePresenceDots } from './presence-dots.util';

describe('normalizePresenceDots', () => {
  it('maps legacy compact codes (y/n/p) to the contract', () => {
    expect(normalizePresenceDots(['y', 'n', 'p'])).toEqual([
      'present',
      'absent',
      'present',
    ]);
  });

  it('passes canonical values through unchanged', () => {
    expect(
      normalizePresenceDots(['present', 'absent', 'no-meeting']),
    ).toEqual(['present', 'absent', 'no-meeting']);
  });

  it('drops unknown values instead of throwing (one bad row never breaks the radar)', () => {
    expect(normalizePresenceDots(['y', 'x', 'n', ''])).toEqual([
      'present',
      'absent',
    ]);
  });

  it('returns [] for non-array input', () => {
    expect(normalizePresenceDots(null)).toEqual([]);
    expect(normalizePresenceDots(undefined)).toEqual([]);
    expect(normalizePresenceDots('present')).toEqual([]);
  });
});
