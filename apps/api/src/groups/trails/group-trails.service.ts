import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GroupTrailResponseSchema,
  type GroupTrailResponse,
  type AssociateTrailsResponse,
  type GroupTrailsListResponse,
} from '@metanoia/types';
import type { GroupTrail } from '@prisma/client';
import { getRequestContext } from '../../common/context/request-context';
import { GroupTrailsRepository } from './group-trails.repository';

@Injectable()
export class GroupTrailsService {
  constructor(private readonly repository: GroupTrailsRepository) {}

  /**
   * Bulk-associate trails to a group.
   * Validates all trailIds exist; returns 422 with invalid IDs on failure.
   */
  async associateTrails(
    groupId: string,
    trailIds: string[],
  ): Promise<AssociateTrailsResponse> {
    const { userId } = getRequestContext();

    const invalidIds = await this.repository.findInvalidTrailIds(trailIds);
    if (invalidIds.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'One or more trail IDs do not exist in this tenant',
        invalidTrailIds: invalidIds,
      });
    }

    const inputs = trailIds.map((trailId) => ({
      groupId,
      trailId,
      assignedBy: userId ?? groupId, // fallback: caller context
    }));

    const records = await this.repository.bulkAssign(inputs);
    return {
      data: records.map((r) => this.toResponse(r)),
      meta: { created: records.length },
    };
  }

  /** Remove a single trail association from a group. */
  async unassignTrail(groupId: string, trailId: string): Promise<void> {
    const deleted = await this.repository.unassign(groupId, trailId);
    if (!deleted) {
      throw new NotFoundException('Trail association not found');
    }
  }

  /** List all trails associated with a group. */
  async listTrails(groupId: string): Promise<GroupTrailsListResponse> {
    const records = await this.repository.listByGroup(groupId);
    const data = records.map((r) => this.toResponse(r));
    return { data, meta: { total: data.length } };
  }

  private toResponse(record: GroupTrail): GroupTrailResponse {
    return GroupTrailResponseSchema.parse({
      id: record.id,
      tenantId: record.tenantId,
      groupId: record.groupId,
      trailId: record.trailId,
      assignedBy: record.assignedBy,
      assignedAt: record.assignedAt.toISOString(),
    });
  }
}
