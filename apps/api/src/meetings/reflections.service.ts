import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { uuidv7 } from 'uuidv7';
import type {
  CreateReflectionInput,
  CreateReflectionResponse,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { MeetingsRepository } from './meetings.repository';
import { ReflectionsRepository } from './reflections.repository';

@Injectable()
export class ReflectionsService {
  private readonly logger = new Logger(ReflectionsService.name);

  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly reflections: ReflectionsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    meetingId: string,
    body: CreateReflectionInput,
  ): Promise<CreateReflectionResponse> {
    const ctx = getRequestContext();
    if (!ctx.userId) {
      throw new ForbiddenException('Missing user identity');
    }

    const meeting = await this.meetings.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const created = await this.reflections.create({
      id: uuidv7(),
      meetingId,
      leaderId: ctx.userId,
      text: body.text,
    });

    this.eventEmitter.emit('reflections.captured', {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      meetingId,
      reflectionId: created.id,
      timestamp: created.recordedAt.toISOString(),
    });

    return {
      reflectionId: created.id,
      recordedAt: created.recordedAt.toISOString(),
    };
  }
}
