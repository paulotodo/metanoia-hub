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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateTemplateRequestSchema,
  TemplateListQuerySchema,
  UpdateTemplateRequestSchema,
  type CreateTemplateRequest,
  type TemplateListQuery,
  type UpdateTemplateRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TemplateService } from './template.service';

@Controller('api/v1/templates')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN_TENANT)
  async createTemplate(
    @Body(new ZodValidationPipe(CreateTemplateRequestSchema)) body: CreateTemplateRequest,
  ) {
    const data = await this.service.createTemplate(body);
    return { data };
  }

  @Get()
  async listTemplates(
    @Query(new ZodValidationPipe(TemplateListQuerySchema)) query: TemplateListQuery,
  ) {
    return this.service.listTemplates(query);
  }

  @Get(':id')
  async getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getTemplateById(id);
    return { data };
  }

  @Get(':id/versions')
  async getTemplateVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTemplateVersions(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_TENANT)
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTemplateRequestSchema)) body: UpdateTemplateRequest,
  ) {
    const data = await this.service.updateTemplate(id, body);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN_TENANT)
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.deleteTemplate(id);
  }
}
