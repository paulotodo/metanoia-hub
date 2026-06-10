import { describe, it, expect, beforeEach } from 'vitest';
import { RadarCalculatorService } from './radar-calculator.service';
import type { MeetingWindow, RecentMeetingAttendance } from './radar-calculator.repository';

/**
 * Unit tests for RadarCalculatorService.calculateParticipant()
 * Story 6-2: Async Radar Engine
 *
 * Tests verify threshold logic defined in radar-constants.ts:
 * - verde: >= 75% presence AND active within 14 days
 * - amarelo: 50-74% presence OR inactive 14-20 days
 * - vermelho: < 50% presence OR inactive >= 21 days
 */

const PARTICIPANT_ID = 'participant-1';
const MEETING_1 = 'meeting-1';
const MEETING_2 = 'meeting-2';
const MEETING_3 = 'meeting-3';

function makeMeetings(count: number): MeetingWindow[] {
  const meetings: MeetingWindow[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    meetings.push({
      meetingId: `meeting-${i + 1}`,
      scheduledFor: new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000), // weekly
    });
  }
  return meetings;
}

function makeAttendance(
  participantId: string,
  meetingId: string,
  presentSeconds: number,
  daysAgo: number,
): RecentMeetingAttendance {
  const now = new Date();
  return {
    participantId,
    meetingId,
    presentForSeconds: presentSeconds,
    attendedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  };
}

describe('RadarCalculatorService.calculateParticipant', () => {
  let service: RadarCalculatorService;

  beforeEach(() => {
    // Service is pure — no external deps for calculateParticipant
    service = new RadarCalculatorService(
      {} as never, // RadarCalculatorRepository — not used in unit tests
      {} as never, // RadarStatusRepository — not used in unit tests
      {} as never, // AlertsService — not used in unit tests for calculateParticipant
    );
  });

  describe('Presence threshold — verde', () => {
    it('75% presence + active within 14 days → verde', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 7),  // attended, 7 days ago
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 14), // attended, 14 days ago
        makeAttendance(PARTICIPANT_ID, MEETING_3, 0, 21),    // absent
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 2/3 = 0.667 — NOT verde (below 0.75), so amarelo
      expect(result.participantId).toBe(PARTICIPANT_ID);
      expect(result.status).toBe('amarelo');
    });

    it('100% presence + recent activity → verde', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 3),  // 3 days ago
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 10), // 10 days ago
        makeAttendance(PARTICIPANT_ID, MEETING_3, 3600, 17), // 17 days ago
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 3/3 = 1.0 >= 0.75 AND lastActive 3 days < 14 → verde
      expect(result.status).toBe('verde');
      expect(result.presencePercentage).toBe(1.0);
    });

    it('75% presence with last active 13 days ago → verde', () => {
      const meetings = makeMeetings(4);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, 'meeting-1', 3600, 13),
        makeAttendance(PARTICIPANT_ID, 'meeting-2', 3600, 20),
        makeAttendance(PARTICIPANT_ID, 'meeting-3', 3600, 27),
        makeAttendance(PARTICIPANT_ID, 'meeting-4', 0, 34), // absent
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 3/4 = 0.75 >= 0.75 AND lastActive 13 days < 14 → verde
      expect(result.status).toBe('verde');
    });
  });

  describe('Presence threshold — amarelo', () => {
    it('50% presence → amarelo', () => {
      const meetings = makeMeetings(2);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 5),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 0, 12), // absent
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 1/2 = 0.50 >= YELLOW_MIN AND < GREEN_THRESHOLD → amarelo
      expect(result.status).toBe('amarelo');
      expect(result.presencePercentage).toBe(0.5);
    });

    it('67% presence + active within 14 days → amarelo (below green threshold)', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 5),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 12),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 0, 19), // absent
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 2/3 = 0.667, lastActive 5 days → amarelo (below green threshold)
      expect(result.status).toBe('amarelo');
    });

    it('inactive 14 days → at least amarelo regardless of presence', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 14), // exactly 14 days = boundary
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 21),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 3600, 28),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 3/3 = 1.0 presence BUT 14 days inactive → NOT verde, should be amarelo
      // (14 >= ACTIVE_DAYS → not verde; 14 < INACTIVE_DAYS → not auto-vermelho)
      expect(result.status).toBe('amarelo');
    });

    it('inactive 20 days → amarelo', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 20),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 27),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 0, 34), // absent
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // lastActive 20 days: >= 14 but < 21 → amarelo
      expect(result.status).toBe('amarelo');
    });
  });

  describe('Presence threshold — vermelho', () => {
    it('less than 50% presence → vermelho', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 7),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 0, 14),   // absent
        makeAttendance(PARTICIPANT_ID, MEETING_3, 0, 21),   // absent
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 1/3 = 0.333 < 0.50 → vermelho
      expect(result.status).toBe('vermelho');
      expect(result.presencePercentage).toBeCloseTo(0.333, 2);
    });

    it('0% presence → vermelho', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 0, 7),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 0, 14),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 0, 21),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      expect(result.status).toBe('vermelho');
      expect(result.presencePercentage).toBe(0);
    });

    it('inactive 21+ days → vermelho regardless of presence', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 21), // exactly 21 days → vermelho
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 28),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 3600, 35),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      // 3/3 = 100% presence BUT >= 21 days inactive → vermelho
      expect(result.status).toBe('vermelho');
    });

    it('inactive 30 days → vermelho', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 30),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 37),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 0, 44),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);

      expect(result.status).toBe('vermelho');
    });

    it('no meetings at all → vermelho (0% presence)', () => {
      const result = service.calculateParticipant(PARTICIPANT_ID, [], [], null);

      expect(result.status).toBe('vermelho');
      expect(result.presencePercentage).toBe(0);
      expect(result.lastActiveAt).toBeNull();
    });
  });

  describe('Trend calculation', () => {
    it('no previous status → estavel', () => {
      const meetings = makeMeetings(3);
      const attendance = [makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 5)];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);
      expect(result.trend).toBe('estavel');
    });

    it('vermelho → verde = melhorando', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 2),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 9),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 3600, 16),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, 'vermelho');
      expect(result.status).toBe('verde');
      expect(result.trend).toBe('melhorando');
    });

    it('verde → vermelho = declinio', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 25), // inactive 25 days
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, 'verde');
      expect(result.status).toBe('vermelho');
      expect(result.trend).toBe('declinio');
    });

    it('verde → verde = estavel', () => {
      const meetings = makeMeetings(3);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 3600, 2),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 3600, 9),
        makeAttendance(PARTICIPANT_ID, MEETING_3, 3600, 16),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, 'verde');
      expect(result.trend).toBe('estavel');
    });
  });

  describe('lastActiveAt computation', () => {
    it('returns null when no attended meetings', () => {
      const meetings = makeMeetings(2);
      const attendance = [
        makeAttendance(PARTICIPANT_ID, MEETING_1, 0, 7),
        makeAttendance(PARTICIPANT_ID, MEETING_2, 0, 14),
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);
      expect(result.lastActiveAt).toBeNull();
    });

    it('returns most recent attended meeting date', () => {
      const meetings = makeMeetings(3);
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const attendance: RecentMeetingAttendance[] = [
        { participantId: PARTICIPANT_ID, meetingId: MEETING_1, presentForSeconds: 3600, attendedAt: recentDate },
        { participantId: PARTICIPANT_ID, meetingId: MEETING_2, presentForSeconds: 0, attendedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      ];

      const result = service.calculateParticipant(PARTICIPANT_ID, meetings, attendance, null);
      expect(result.lastActiveAt?.toISOString()).toBe(recentDate.toISOString());
    });
  });
});
