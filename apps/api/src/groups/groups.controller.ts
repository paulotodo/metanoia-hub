import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CreateGroupRequestSchema, type CreateGroupRequest } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PlanLimit } from '../common/plan-limits/plan-limit.decorator';
import { PlanLimitsGuard } from '../common/plan-limits/plan-limits.guard';
import { GroupsService } from './groups.service';

@Controller('api/v1/groups')
@UseGuards(KeycloakAuthGuard, RolesGuard, PlanLimitsGuard)
@Roles('admin')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @PlanLimit('groups')
  async create(
    @Body(new ZodValidationPipe(CreateGroupRequestSchema)) body: CreateGroupRequest,
  ) {
    const data = await this.service.create(body);
    return { data };
  }
}
