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
} from '@nestjs/common';
import {
  CreateLessonRequestSchema,
  ReorderLessonsRequestSchema,
  UpdateLessonRequestSchema,
  type CreateLessonRequest,
  type ReorderLessonsRequest,
  type UpdateLessonRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContentService } from '../content.service';

@Controller('api/v1/trails/:trailId/modules/:moduleId/lessons')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class LessonController {
  constructor(private readonly service: ContentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN_TENANT)
  async createLesson(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body(new ZodValidationPipe(CreateLessonRequestSchema)) body: CreateLessonRequest,
  ) {
    const data = await this.service.createLesson(trailId, moduleId, body);
    return { data };
  }

  @Get()
  async listLessons(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.service.listLessons(trailId, moduleId);
  }

  @Patch('reorder')
  @Roles(Role.ADMIN_TENANT)
  async reorderLessons(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body(new ZodValidationPipe(ReorderLessonsRequestSchema)) body: ReorderLessonsRequest,
  ) {
    return this.service.reorderLessons(trailId, moduleId, body);
  }

  @Get(':lessonId')
  @Roles(Role.ADMIN_TENANT, Role.LIDER, Role.PARTICIPANTE)
  async getLesson(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    const data = await this.service.getLesson(trailId, moduleId, lessonId);
    return { data };
  }

  @Patch(':lessonId')
  @Roles(Role.ADMIN_TENANT)
  async updateLesson(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body(new ZodValidationPipe(UpdateLessonRequestSchema)) body: UpdateLessonRequest,
  ) {
    const data = await this.service.updateLesson(trailId, moduleId, lessonId, body);
    return { data };
  }

  @Delete(':lessonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN_TENANT)
  async deleteLesson(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    await this.service.deleteLesson(trailId, moduleId, lessonId);
  }
}
