import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { UploadService } from './upload.service';

/** Multer file shape (subset used by this handler) */
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller('api/v1/content')
@UseGuards(KeycloakAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/v1/content/trails/:trailId/modules/:moduleId/lessons/:lessonId/upload
   * Multipart upload of lesson content (video, PDF/DOC).
   * Returns 201 with upload metadata on success.
   */
  @Post('trails/:trailId/modules/:moduleId/lessons/:lessonId/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadContent(
    @Param('trailId') trailId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo recebido. Envie o arquivo no campo "file".');
    }
    const result = await this.uploadService.uploadLessonContent({
      lessonId,
      moduleId,
      trailId,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    return { data: result };
  }
}
