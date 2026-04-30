import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { uuidv7 } from 'uuidv7';
import {
  GroupResponseSchema,
  type CreateGroupRequest,
  type GroupResponse,
  type GroupsListResponse,
  type UpdateGroupRequest,
} from '@metanoia/types';
import type { Group } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { GroupsRepository } from './groups.repository';

@Injectable()
export class GroupsService {
  constructor(
    private readonly repository: GroupsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(body: CreateGroupRequest): Promise<GroupResponse> {
    const { tenantId, userId } = getRequestContext();

    // Check whether this is the tenant's first group BEFORE creating — the
    // count-then-create sequence powers the tenant.activation.primary event.
    const existingCount = await this.repository.countByTenant();

    const group = await this.repository.create({
      id: uuidv7(),
      name: body.name,
      dayOfWeek: body.dayOfWeek,
      time: body.time,
      recurrence: body.recurrence ?? 'weekly',
      notes: body.notes ?? null,
    });

    if (existingCount === 0) {
      this.eventEmitter.emit('tenant.activation.primary', {
        tenantId,
        userId,
        groupId: group.id,
        timestamp: new Date().toISOString(),
      });
    }

    return this.toResponse(group);
  }

  async list(): Promise<GroupsListResponse> {
    const groups = await this.repository.listByTenant();
    return {
      data: groups.map((g) => this.toResponse(g)),
      meta: { total: groups.length },
    };
  }

  async findById(id: string): Promise<GroupResponse> {
    const group = await this.repository.findById(id);
    if (!group) throw new NotFoundException('Group not found');
    return this.toResponse(group);
  }

  async update(id: string, body: UpdateGroupRequest): Promise<GroupResponse> {
    const updated = await this.repository.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
      ...(body.time !== undefined ? { time: body.time } : {}),
      ...(body.recurrence !== undefined
        ? { recurrence: body.recurrence }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });
    if (!updated) throw new NotFoundException('Group not found');
    return this.toResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundException('Group not found');
  }

  private toResponse(group: Group): GroupResponse {
    // Parse through the shared schema so the literal-union fields
    // (dayOfWeek, recurrence) are validated against the contract —
    // the DB stores them as VARCHAR, migrations constrain valid values.
    return GroupResponseSchema.parse({
      id: group.id,
      tenantId: group.tenantId,
      name: group.name,
      dayOfWeek: group.dayOfWeek,
      time: group.time,
      recurrence: group.recurrence,
      notes: group.notes,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    });
  }
}
