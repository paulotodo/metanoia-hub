import {
  Controller,
  Param,
  ParseUUIDPipe,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, concat, defer, from } from 'rxjs';
import { map } from 'rxjs/operators';
import type { AttendanceLiveEvent } from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { getRequestContext } from '../../common/context/request-context';
import { MeetingRoleGuard } from '../guards/meeting-role.guard';
import { AttendanceLiveService } from './attendance-live.service';
import { MeetingSseService } from './meeting-sse.service';

/**
 * Story 5.5 — SSE stream of the live attendance panel restricted to
 * Líder/Admin of the meeting's group. Initial event is a full snapshot of
 * the Redis presence hash (NFR-P4: ≤ 1s after connect); subsequent events
 * are deltas piped from the same Redis channel populated by the webhook
 * pipeline (Story 5.3).
 */
@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard, MeetingRoleGuard)
// TODO: migrate 'pastor'/'admin' to canonical Role enum when defined (Epic 11)
@Roles(Role.LIDER, Role.ADMIN_TENANT, 'pastor', 'admin')
export class AttendanceLiveController {
  constructor(
    private readonly attendance: AttendanceLiveService,
    private readonly sse: MeetingSseService,
  ) {}

  @Sse(':id/attendance/live')
  stream(@Param('id', ParseUUIDPipe) meetingId: string): Observable<MessageEvent> {
    const { tenantId } = getRequestContext();

    // 1) Initial full state captured from Redis presence hash.
    const initial$ = defer(() => from(this.attendance.snapshot(meetingId))).pipe(
      map(
        (snapshot: AttendanceLiveEvent) =>
          ({ data: JSON.stringify(snapshot) } as MessageEvent),
      ),
    );

    // 2) Subsequent deltas piped from the Redis pub/sub channel.
    const deltas$ = this.sse.subscribe(tenantId, meetingId);

    return concat(initial$, deltas$);
  }
}
