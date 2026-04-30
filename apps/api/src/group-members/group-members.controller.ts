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
  AddGroupMemberInputSchema,
  UpdateGroupMemberRoleInputSchema,
  type AddGroupMemberInput,
  type UpdateGroupMemberRoleInput,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GroupMembersService } from './group-members.service';

@Controller('api/v1/groups/:groupId/members')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('admin_tenant')
export class GroupMembersController {
  constructor(private readonly service: GroupMembersService) {}

  @Get()
  async list(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.service.list(groupId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(AddGroupMemberInputSchema))
  async add(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: AddGroupMemberInput,
  ) {
    return this.service.add(groupId, body);
  }

  @Patch(':userId')
  @UsePipes(new ZodValidationPipe(UpdateGroupMemberRoleInputSchema))
  async updateRole(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateGroupMemberRoleInput,
  ) {
    return this.service.updateRole(groupId, userId, body);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.service.remove(groupId, userId);
  }
}
