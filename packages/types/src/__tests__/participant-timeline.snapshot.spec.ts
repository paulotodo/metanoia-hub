/**
 * Snapshot tests for ParticipantTimeline schemas (Story 6-4).
 * Gates against silent breaking changes in the Zod contract.
 */

import { describe, it, expect } from 'vitest';
import {
  TimelineEventTypeSchema,
  ParticipantTimelineEventSchema,
  ParticipantTimelineSchema,
} from '../radar';

describe('TimelineEventTypeSchema', () => {
  it('accepts valid event types', () => {
    expect(TimelineEventTypeSchema.parse('signal')).toBe('signal');
    expect(TimelineEventTypeSchema.parse('action')).toBe('action');
  });

  it('rejects invalid event type', () => {
    expect(() => TimelineEventTypeSchema.parse('presence')).toThrow();
    expect(() => TimelineEventTypeSchema.parse('')).toThrow();
  });
});

describe('ParticipantTimelineEventSchema', () => {
  it('parses a valid signal event', () => {
    const event = {
      id: '019756a1-0001-7000-8000-000000000001',
      eventType: 'signal',
      occurredAt: '2026-03-18T19:30:00Z',
      presenceType: 'absent',
      actionType: null,
      note: null,
      label: 'Reunião',
    };
    const parsed = ParticipantTimelineEventSchema.parse(event);
    expect(parsed.eventType).toBe('signal');
    expect(parsed.presenceType).toBe('absent');
    expect(parsed.actionType).toBeNull();
  });

  it('parses a valid action event', () => {
    const event = {
      id: '019756a1-0002-7000-8000-000000000002',
      eventType: 'action',
      occurredAt: '2026-03-20T10:30:00Z',
      presenceType: null,
      actionType: 'message',
      note: 'Mandei mensagem perguntando se tava tudo bem.',
      label: 'Ação pastoral',
    };
    const parsed = ParticipantTimelineEventSchema.parse(event);
    expect(parsed.eventType).toBe('action');
    expect(parsed.actionType).toBe('message');
    expect(parsed.note).toBe('Mandei mensagem perguntando se tava tudo bem.');
  });

  it('rejects missing required fields', () => {
    expect(() =>
      ParticipantTimelineEventSchema.parse({ eventType: 'action' }),
    ).toThrow();
  });
});

describe('ParticipantTimelineSchema', () => {
  it('parses a valid timeline with multiple events', () => {
    const timeline = {
      participantId: '019756a1-1001-7000-8000-000000000001',
      events: [
        {
          id: '019756a1-0001-7000-8000-000000000001',
          eventType: 'action',
          occurredAt: '2026-03-20T10:30:00Z',
          presenceType: null,
          actionType: 'message',
          note: 'Nota de cuidado',
          label: 'Ação pastoral',
        },
        {
          id: '019756a1-0002-7000-8000-000000000002',
          eventType: 'signal',
          occurredAt: '2026-03-18T19:30:00Z',
          presenceType: 'absent',
          actionType: null,
          note: null,
          label: 'Reunião',
        },
      ],
    };
    const parsed = ParticipantTimelineSchema.parse(timeline);
    expect(parsed.participantId).toBe('019756a1-1001-7000-8000-000000000001');
    expect(parsed.events).toHaveLength(2);
  });

  it('parses a timeline with empty events array (no care actions yet)', () => {
    const timeline = {
      participantId: '019756a1-1002-7000-8000-000000000002',
      events: [],
    };
    const parsed = ParticipantTimelineSchema.parse(timeline);
    expect(parsed.events).toHaveLength(0);
  });

  it('schema shape snapshot — gates against silent contract changes', () => {
    const validEvent = {
      id: '019756a1-0001-7000-8000-000000000001',
      eventType: 'signal' as const,
      occurredAt: '2026-03-18T19:30:00Z',
      presenceType: 'present',
      actionType: null,
      note: null,
      label: 'Reunião',
    };
    expect(ParticipantTimelineEventSchema.parse(validEvent)).toMatchInlineSnapshot(`
      {
        "actionType": null,
        "eventType": "signal",
        "id": "019756a1-0001-7000-8000-000000000001",
        "label": "Reunião",
        "note": null,
        "occurredAt": "2026-03-18T19:30:00Z",
        "presenceType": "present",
      }
    `);
  });
});
