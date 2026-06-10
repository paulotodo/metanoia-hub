import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { StorageService } from '../../storage/storage.service';
import { ContentRepository } from '../content.repository';

const SIGNED_URL_EXPIRATION_SECONDS = 14400; // 4 hours

@Controller('api/v1/content')
@UseGuards(KeycloakAuthGuard)
export class SignedUrlController {
  constructor(
    private readonly storage: StorageService,
    private readonly repository: ContentRepository,
  ) {}

  /**
   * GET /api/v1/content/signed-url/:lessonId
   * Generates a presigned URL (4h) for the lesson's stored content.
   * Never stores the signed URL — only the object key is persisted.
   */
  @Get('signed-url/:lessonId')
  async getSignedUrl(@Param('lessonId') lessonId: string) {
    // Find lesson without requiring moduleId — search by lesson id only (read-path)
    const lesson = await this.repository.findLessonByIdOnly(lessonId);
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    if (!lesson.contentUrl) {
      throw new NotFoundException('Aula não possui conteúdo carregado');
    }

    const url = await this.storage.getSignedUrl(lesson.contentUrl, SIGNED_URL_EXPIRATION_SECONDS);
    return {
      data: {
        lessonId,
        signedUrl: url,
        expiresInSeconds: SIGNED_URL_EXPIRATION_SECONDS,
      },
    };
  }
}
