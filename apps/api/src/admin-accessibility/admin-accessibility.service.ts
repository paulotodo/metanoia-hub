import { Injectable } from '@nestjs/common';
import { type AccessibilityGapsResponse } from '@metanoia/types';
import { AdminAccessibilityRepository } from './admin-accessibility.repository';

@Injectable()
export class AdminAccessibilityService {
  constructor(private readonly repository: AdminAccessibilityRepository) {}

  async listGaps(page: number, pageSize: number): Promise<AccessibilityGapsResponse> {
    const { items, total } = await this.repository.findLessonsWithMissingAlt(page, pageSize);

    return {
      data: items,
      meta: { total, page, pageSize },
    };
  }
}
