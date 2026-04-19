import { describe, it, expect } from 'vitest';
import { formatRelativeMeeting } from '../relative-meeting';

describe('formatRelativeMeeting', () => {
  it('returns today when same UTC day', () => {
    const now = new Date('2026-04-21T10:00:00.000Z');
    const res = formatRelativeMeeting('2026-04-21T22:00:00.000Z', now);
    expect(res).toEqual({ type: 'today' });
  });

  it('returns tomorrow when next UTC day', () => {
    const now = new Date('2026-04-20T10:00:00.000Z');
    const res = formatRelativeMeeting('2026-04-21T22:00:00.000Z', now);
    expect(res).toEqual({ type: 'tomorrow' });
  });

  it('returns inDays with count when future', () => {
    const now = new Date('2026-04-18T10:00:00.000Z');
    const res = formatRelativeMeeting('2026-04-25T22:00:00.000Z', now);
    expect(res).toEqual({ type: 'inDays', days: 7 });
  });

  it('treats past meetings as today (no negative days)', () => {
    const now = new Date('2026-04-25T10:00:00.000Z');
    const res = formatRelativeMeeting('2026-04-21T22:00:00.000Z', now);
    expect(res).toEqual({ type: 'today' });
  });
});
