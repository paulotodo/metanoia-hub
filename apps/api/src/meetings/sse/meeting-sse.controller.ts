import { Controller, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getRequestContext } from '../../common/context/request-context';
import { MeetingSseService } from './meeting-sse.service';

@Controller('api/v1/sse/meetings')
export class MeetingSseController {
  constructor(private readonly meetingSseService: MeetingSseService) {}

  @Sse(':id')
  stream(@Param('id') meetingId: string): Observable<MessageEvent> {
    const { tenantId } = getRequestContext();
    return this.meetingSseService.subscribe(tenantId, meetingId);
  }
}
