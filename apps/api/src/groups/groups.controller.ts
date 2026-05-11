import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  CreateGroupRequestSchema,
  UpdateGroupRequestSchema,
  type CreateGroupRequest,
  type UpdateGroupRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PlanLimit } from '../common/plan-limits/plan-limit.decorator';
import { PlanLimitsGuard } from '../common/plan-limits/plan-limits.guard';
import { GroupsService } from './groups.service';

@Controller('api/v1/groups')
@UseGuards(KeycloakAuthGuard, RolesGuard, PlanLimitsGuard)
@Roles('admin_tenant')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Get(':id')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.findById(id);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @PlanLimit('groups')
  async create(
    @Body(new ZodValidationPipe(CreateGroupRequestSchema)) body: CreateGroupRequest,
  ) {
    const data = await this.service.create(body);
    return { data };
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateGroupRequestSchema))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGroupRequest,
  ) {
    const data = await this.service.update(id, body);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.delete(id);
  }
}
