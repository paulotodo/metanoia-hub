import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

/**
 * Story 5.5 — restricts an endpoint to users who are *Líder or Admin of the
 * meeting's group* (not just any tenant member). Used by the live attendance
 * SSE endpoint where Participantes must not see the live presence list.
 *
 * Authorization rules:
 * - User with `admin_tenant` realm role → allowed for any meeting in the tenant
 * - User who is a GroupMember with role in {lider, admin} for the meeting's
 *   group → allowed
 * - Anyone else → 403
 */
@Injectable()
export class MeetingRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const meetingId = (request.params?.id ?? request.params?.meetingId) as
      | string
      | undefined;
    if (!meetingId) {
      throw new ForbiddenException('Meeting id missing in route');
    }

    // Admin tenant short-circuit
    if (user.roles.includes('admin_tenant')) {
      return true;
    }

    const meeting = await withTenantTx(this.prisma, (tx) =>
      tx.meeting.findUnique({
        where: { id: meetingId },
        select: { groupId: true },
      }),
    );
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const membership = await withTenantTx(this.prisma, (tx) =>
      tx.groupMember.findFirst({
        where: { groupId: meeting.groupId, userId: user.userId },
        select: { role: true },
      }),
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of this group');
    }
    if (membership.role !== 'lider' && membership.role !== 'admin') {
      throw new ForbiddenException('Only lider or admin of this group can view live attendance');
    }

    return true;
  }
}
