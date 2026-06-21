import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../format-relative-time';

const NOW = new Date('2026-06-21T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe('formatRelativeTime', () => {
  it('1 minute ago', () => {
    const result = formatRelativeTime(ago(60_000), NOW);
    expect(result).toContain('min');
  });

  it('5 minutes ago', () => {
    const result = formatRelativeTime(ago(5 * 60_000), NOW);
    expect(result).toContain('min');
  });

  it('59 minutes ago (still minutes)', () => {
    const result = formatRelativeTime(ago(59 * 60_000), NOW);
    expect(result).toContain('min');
  });

  it('1 hour ago', () => {
    const result = formatRelativeTime(ago(60 * 60_000), NOW);
    expect(result).toMatch(/hora/);
  });

  it('2 hours ago', () => {
    const result = formatRelativeTime(ago(2 * 60 * 60_000), NOW);
    expect(result).toMatch(/hora/);
  });

  it('23 hours ago (still hours)', () => {
    const result = formatRelativeTime(ago(23 * 60 * 60_000), NOW);
    expect(result).toMatch(/hora/);
  });

  it('1 day ago (yesterday)', () => {
    const result = formatRelativeTime(ago(24 * 60 * 60_000), NOW);
    // Intl 'auto' returns "ontem" for -1 day in pt-BR
    expect(result).toMatch(/ontem|dia/);
  });

  it('3 days ago', () => {
    const result = formatRelativeTime(ago(3 * 24 * 60 * 60_000), NOW);
    expect(result).toContain('dia');
  });

  it('result is in PT-BR (contains common portuguese words)', () => {
    const result = formatRelativeTime(ago(5 * 60_000), NOW);
    // pt-BR format typically: "há 5 minutos"
    expect(result).toMatch(/há|min|atrás/i);
  });
});
