import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ActivityEntry,
  CareTimelineEntry,
  ChurchOverviewResponse,
  CreateOutreachIntentRequest,
  GroupCard,
  GroupHeader,
  GroupTimelineResponse,
  LeaderViewResponse,
  MeetingTimelineEntry,
  OutreachIntent,
  OutreachIntentResponse,
  PastoralStatus,
  TimelineEntry,
} from '@metanoia/types';
import { AdminPastoralRepository } from './admin-pastoral.repository';
import { getRequestContext } from '../common/context/request-context';

const TIMELINE_WINDOW_DAYS = 90;
const NO_SIGNAL_THRESHOLD_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_PHRASES: Record<PastoralStatus, string> = {
  healthy: 'Grupo saudável',
  attention: 'Requer atenção',
  call: 'Ligar para o líder',
  'no-signal': 'Sem sinal recente',
};

@Injectable()
export class AdminPastoralService {
  constructor(private readonly repository: AdminPastoralRepository) {}

  // -------------------------------------------------------------------------
  // Church overview (03.2)
  // -------------------------------------------------------------------------

  async getChurchOverview(): Promise<ChurchOverviewResponse> {
    const groups = await this.repository.findAllGroupsWithLeader();
    const cards: GroupCard[] = [];

    for (const group of groups) {
      const leaderMembership = group.members[0];
      if (!leaderMembership) continue;

      const leader = leaderMembership.user;
      const lastMeeting = await this.repository.findLatestMeetingByGroup(
        group.id,
      );
      const alertCounts = await this.repository.countActiveAlertsByGroup(
        group.id,
      );

      const status = this.deriveStatus({
        lastMeetingAt: lastMeeting?.scheduledFor ?? null,
        attendanceRatio: lastMeeting
          ? this.attendanceRatio(lastMeeting.participants)
          : null,
        alertCounts: this.summarizeAlerts(alertCounts),
      });

      cards.push({
        groupId: group.id,
        groupName: group.name,
        leaderId: leader.id,
        leaderName: leader.name,
        status,
        statusPhrase: STATUS_PHRASES[status],
        lastMeetingAt: lastMeeting?.scheduledFor.toISOString() ?? null,
        memberCount: group._count.members,
      });
    }

    return {
      data: cards,
      meta: {
        lastCalculatedAt: new Date().toISOString(),
        groupCount: cards.length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Group timeline (03.3)
  // -------------------------------------------------------------------------

  async getGroupTimeline(groupId: string): Promise<GroupTimelineResponse> {
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const leaderMembership = group.members[0];
    if (!leaderMembership) {
      throw new NotFoundException('Group has no leader');
    }

    const now = new Date();
    const windowEnd = now;
    const windowStart = new Date(
      now.getTime() - TIMELINE_WINDOW_DAYS * MS_PER_DAY,
    );

    const lastMeeting = await this.repository.findLatestMeetingByGroup(groupId);
    const alertCounts = await this.repository.countActiveAlertsByGroup(groupId);

    const status = this.deriveStatus({
      lastMeetingAt: lastMeeting?.scheduledFor ?? null,
      attendanceRatio: lastMeeting
        ? this.attendanceRatio(lastMeeting.participants)
        : null,
      alertCounts: this.summarizeAlerts(alertCounts),
    });

    const header: GroupHeader = {
      groupId: group.id,
      groupName: group.name,
      leaderId: leaderMembership.user.id,
      leaderName: leaderMembership.user.name,
      schedule: `${group.dayOfWeek} ${group.time}`,
      location: group.notes ?? '',
      memberCount: group._count.members,
      status,
      statusPhrase: STATUS_PHRASES[status],
    };

    const meetings = await this.repository.findMeetingsForTimeline(
      groupId,
      windowStart,
      windowEnd,
    );
    const careActions = await this.repository.findCareActionsForGroup(
      groupId,
      windowStart,
      windowEnd,
    );

    const meetingEntries: MeetingTimelineEntry[] = meetings.map((meeting) => ({
      entryId: meeting.id,
      occurredAt: meeting.scheduledFor.toISOString(),
      type: 'meeting',
      presentCount: meeting.participants.filter(
        (p) => p.joinedAt !== null || p.response === 'yes',
      ).length,
      totalCount: meeting.participants.length,
      reflectionText: meeting.reflections[0]?.text ?? null,
    }));

    const careEntries: CareTimelineEntry[] = careActions.map((action) => ({
      entryId: action.id,
      occurredAt: action.recordedAt.toISOString(),
      type: 'care',
      participantName: action.participant.name,
      signalStatus: this.normalizeCareSignal(action.signalType),
      careNote: action.note ?? '',
    }));

    const entries: TimelineEntry[] = [...meetingEntries, ...careEntries].sort(
      (a, b) => b.occurredAt.localeCompare(a.occurredAt),
    );

    return {
      data: { group: header, entries },
      meta: {
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Leader view (03.4)
  // -------------------------------------------------------------------------

  async getLeaderView(leaderId: string): Promise<LeaderViewResponse> {
    const membership = await this.repository.findLeaderProfile(leaderId);
    if (!membership) {
      throw new NotFoundException('Leader not found');
    }

    const ctx = getRequestContext();
    if (!ctx.userId) {
      throw new UnauthorizedException('User context is missing');
    }

    const { weekStart, weekEnd } = this.currentIsoWeekRange();

    const [lastConversation, recentActions, currentWeekIntent] =
      await Promise.all([
        this.repository.findLastConversation(leaderId),
        this.repository.findRecentActivity(leaderId, 10),
        this.repository.findCurrentWeekIntent(
          leaderId,
          ctx.userId,
          weekStart,
          weekEnd,
        ),
      ]);

    const fullName = membership.user.name;
    const firstName = fullName.split(' ')[0] ?? fullName;

    const recentActivity: ActivityEntry[] = recentActions.map((action) => ({
      entryId: action.id,
      occurredAt: action.recordedAt.toISOString(),
      description: this.describeAction(action.actionType, action.note),
    }));

    return {
      data: {
        leader: {
          leaderId: membership.user.id,
          firstName,
          fullName,
          groupName: membership.group.name,
          tenure: this.formatTenure(membership.createdAt),
        },
        lastConversation: lastConversation
          ? {
              conversationId: lastConversation.id,
              occurredAt: lastConversation.occurredAt.toISOString(),
              note: lastConversation.content,
            }
          : null,
        recentActivity,
        currentWeekIntent: currentWeekIntent
          ? this.mapIntent(currentWeekIntent)
          : null,
      },
    };
  }

  // -------------------------------------------------------------------------
  // OutreachIntent CRUD
  // -------------------------------------------------------------------------

  async createOutreachIntent(
    dto: CreateOutreachIntentRequest,
  ): Promise<OutreachIntentResponse> {
    const ctx = getRequestContext();
    if (!ctx.userId) {
      throw new UnauthorizedException('User context is missing');
    }

    const intent = await this.repository.createOutreachIntent({
      tenantId: ctx.tenantId,
      createdByUserId: ctx.userId,
      targetLeaderId: dto.targetLeaderId,
      weekOf: new Date(dto.weekOf),
      note: dto.note,
    });

    return { data: this.mapIntent(intent) };
  }

  async updateOutreachIntent(
    intentId: string,
    note: string,
  ): Promise<OutreachIntentResponse> {
    const existing = await this.repository.findOutreachIntentById(intentId);
    if (!existing) {
      throw new NotFoundException('Outreach intent not found');
    }

    const updated = await this.repository.updateOutreachIntent(intentId, note);
    return { data: this.mapIntent(updated) };
  }

  async deleteOutreachIntent(intentId: string): Promise<void> {
    const existing = await this.repository.findOutreachIntentById(intentId);
    if (!existing) {
      throw new NotFoundException('Outreach intent not found');
    }
    await this.repository.deleteOutreachIntent(intentId);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private deriveStatus(input: {
    lastMeetingAt: Date | null;
    attendanceRatio: number | null;
    alertCounts: { urgent: number; attention: number };
  }): PastoralStatus {
    const { lastMeetingAt, attendanceRatio, alertCounts } = input;

    if (!lastMeetingAt) return 'no-signal';

    const daysSince =
      (Date.now() - lastMeetingAt.getTime()) / MS_PER_DAY;
    if (daysSince > NO_SIGNAL_THRESHOLD_DAYS) return 'no-signal';

    if (alertCounts.urgent > 0) return 'call';
    if (attendanceRatio !== null && attendanceRatio < 0.5) return 'call';

    if (alertCounts.attention > 0) return 'attention';
    if (attendanceRatio !== null && attendanceRatio < 0.75) return 'attention';

    return 'healthy';
  }

  private attendanceRatio(
    participants: Array<{ response: string; joinedAt: Date | null }>,
  ): number | null {
    if (participants.length === 0) return null;
    const present = participants.filter(
      (p) => p.joinedAt !== null || p.response === 'yes',
    ).length;
    return present / participants.length;
  }

  private summarizeAlerts(
    counts: Array<{ signalType: string; _count: { _all: number } }>,
  ): { urgent: number; attention: number } {
    let urgent = 0;
    let attention = 0;
    for (const row of counts) {
      if (row.signalType === 'care-urgent') urgent += row._count._all;
      if (row.signalType === 'care-attention') attention += row._count._all;
    }
    return { urgent, attention };
  }

  private normalizeCareSignal(
    signalType: string,
  ): 'care-urgent' | 'care-attention' | 'care-ok' {
    if (signalType === 'care-urgent') return 'care-urgent';
    if (signalType === 'care-attention') return 'care-attention';
    return 'care-ok';
  }

  private describeAction(actionType: string, note: string | null): string {
    const prefix =
      actionType === 'message'
        ? 'Mensagem enviada'
        : actionType === 'call'
          ? 'Ligação registada'
          : actionType === 'visit'
            ? 'Visita registada'
            : 'Ação registada';
    return note ? `${prefix}: ${note}` : prefix;
  }

  private currentIsoWeekRange(): { weekStart: Date; weekEnd: Date } {
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + diffToMonday,
      ),
    );
    const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);
    return { weekStart, weekEnd };
  }

  private formatTenure(since: Date): string {
    const now = new Date();
    const months =
      (now.getFullYear() - since.getFullYear()) * 12 +
      (now.getMonth() - since.getMonth());
    if (months < 1) return 'menos de 1 mês';
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    const yearPart = `${years} ${years === 1 ? 'ano' : 'anos'}`;
    if (remainder === 0) return yearPart;
    return `${yearPart} e ${remainder} ${remainder === 1 ? 'mês' : 'meses'}`;
  }

  private mapIntent(intent: {
    id: string;
    targetLeaderId: string;
    weekOf: Date;
    note: string;
    createdAt: Date;
    updatedAt: Date;
  }): OutreachIntent {
    return {
      intentId: intent.id,
      targetLeaderId: intent.targetLeaderId,
      weekOf: intent.weekOf.toISOString(),
      note: intent.note,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }
}
