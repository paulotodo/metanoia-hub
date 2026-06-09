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
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  UpdateTenantUserRoleInputSchema,
  type UpdateTenantUserRoleInput,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';

@Controller('api/v1/admin/users')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  async list() {
    return this.service.listMembers();
  }

  @Get(':userId')
  async detail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.getMember(userId);
  }

  @Patch(':userId')
  @UsePipes(new ZodValidationPipe(UpdateTenantUserRoleInputSchema))
  async updateRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateTenantUserRoleInput,
  ) {
    return this.service.updateRole(userId, body);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('userId', ParseUUIDPipe) userId: string) {
    await this.service.removeFromTenant(userId);
  }
}
