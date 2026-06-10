import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  CreateAdminInviteInputSchema,
  type CreateAdminInviteInput,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminInvitesService } from './admin-invites.service';

@Controller('api/v1/admin/invites')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT)
export class AdminInvitesController {
  constructor(private readonly service: AdminInvitesService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateAdminInviteInputSchema))
  async create(@Body() body: CreateAdminInviteInput) {
    return this.service.create(body);
  }

  @Delete(':id')
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.revoke(id);
  }
}
