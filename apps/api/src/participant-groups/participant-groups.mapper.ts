import {
  ParticipantGroupSummarySchema,
  ParticipantGroupDetailSchema,
  type ParticipantGroupSummary,
  type ParticipantGroupDetail,
  type ParticipantGroupNextMeeting,
} from '@metanoia/types';

/**
 * Returns the first whitespace-delimited token of `fullName`. Used to enforce
 * the privacy rule from spec 06.5 — peers and leaders are surfaced by first
 * name only.
 */
export function toFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fullName;
  return trimmed.split(/\s+/)[0];
}

interface GroupRow {
  id: string;
  name: string;
  dayOfWeek: string;
  time: string;
  recurrence: string;
  notes: string | null;
  members: Array<{
    role: string;
    user: { id: string; name: string };
  }>;
}

interface MeetingRow {
  scheduledFor: Date;
}

function buildNextMeeting(
  group: { dayOfWeek: string; time: string },
  meeting: MeetingRow | null,
): ParticipantGroupNextMeeting | null {
  if (!meeting) return null;
  return {
    startsAt: meeting.scheduledFor.toISOString(),
    // dayOfWeek/time on the group are validated by Zod literal enums on parse.
    dayOfWeek: group.dayOfWeek as ParticipantGroupNextMeeting['dayOfWeek'],
    time: group.time,
    location: null,
    meetingUrl: null,
  };
}

function pickLeader(group: GroupRow): { firstName: string; avatarUrl: null } {
  const leader = group.members.find((m) => m.role === 'lider');
  // If no leader is associated yet, surface a placeholder; the spec assumes
  // every group has one but we must not crash if seed/state lags.
  const fullName = leader?.user.name ?? 'Líder';
  return {
    firstName: toFirstName(fullName),
    avatarUrl: null,
  };
}

export function mapToSummary(
  group: GroupRow,
  nextMeeting: MeetingRow | null,
): ParticipantGroupSummary {
  return ParticipantGroupSummarySchema.parse({
    id: group.id,
    name: group.name,
    leader: pickLeader(group),
    nextMeeting: buildNextMeeting(group, nextMeeting),
  });
}

export function mapToDetail(
  group: GroupRow,
  nextMeeting: MeetingRow | null,
  currentUserId: string,
): ParticipantGroupDetail {
  // Privacy rule (06.5): peers list = members with role='membro', excluding
  // the requesting user, surfaced by first name only.
  const peers = group.members
    .filter((m) => m.role === 'membro' && m.user.id !== currentUserId)
    .map((m) => ({ firstName: toFirstName(m.user.name) }));

  return ParticipantGroupDetailSchema.parse({
    id: group.id,
    name: group.name,
    description: group.notes,
    leader: pickLeader(group),
    recurrence: group.recurrence,
    nextMeeting: buildNextMeeting(group, nextMeeting),
    format: null,
    duration: null,
    peers,
  });
}
