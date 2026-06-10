import { Controller, Post, Get, Param, Body, HttpCode, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import {
  ReportProgressRequestSchema,
  type ReportProgressRequest,
  type TrailProgressDetailResponse,
  type ResumeProgressResponse,
} from '@metanoia/types';
import { ProgressService } from './progress.service';

@UseGuards(KeycloakAuthGuard, RolesGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * POST /api/v1/progress/lessons/:lessonId
   * Enqueues a lesson progress event for async processing.
   * Returns 202 Accepted immediately — never persists synchronously.
   */
  @Post('lessons/:lessonId')
  @HttpCode(202)
  async reportProgress(
    @Param('lessonId') lessonId: string,
    @Body(new ZodValidationPipe(ReportProgressRequestSchema)) body: ReportProgressRequest,
  ): Promise<{ data: { accepted: true } }> {
    await this.progressService.enqueueProgressEvent(
      lessonId,
      body.progressPercent,
      body.eventType,
      body.completedBy,
    );
    return { data: { accepted: true } };
  }

  /**
   * GET /api/v1/progress/trails/:trailId
   * Returns aggregated progress for the authenticated user on a trail.
   */
  @Get('trails/:trailId')
  async getTrailProgress(
    @Param('trailId') trailId: string,
  ): Promise<TrailProgressDetailResponse> {
    return this.progressService.getTrailProgress(trailId);
  }

  /**
   * GET /api/v1/progress/trails/:trailId/resume
   * Returns the last accessed incomplete lesson (for "Continuar de onde parei").
   */
  @Get('trails/:trailId/resume')
  async getResumeLesson(
    @Param('trailId') trailId: string,
  ): Promise<ResumeProgressResponse> {
    return this.progressService.getResumeLesson(trailId);
  }
}
