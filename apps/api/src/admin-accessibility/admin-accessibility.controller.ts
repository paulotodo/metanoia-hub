import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AccessibilityGapsQuerySchema,
  type AccessibilityGapsQuery,
  type AccessibilityGapsResponse,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminAccessibilityService } from './admin-accessibility.service';

@ApiTags('admin')
@Controller('api/v1/admin/accessibility-gaps')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT)
export class AdminAccessibilityController {
  constructor(private readonly service: AdminAccessibilityService) {}

  @Get()
  @ApiOperation({ summary: 'List lessons with missing alt-text for accessibility audit' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  async listGaps(
    @Query(new ZodValidationPipe(AccessibilityGapsQuerySchema)) query: AccessibilityGapsQuery,
  ): Promise<AccessibilityGapsResponse> {
    return this.service.listGaps(query.page, query.pageSize);
  }
}
