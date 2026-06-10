import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { getRequestContext } from '../../common/context/request-context';
import { StorageService } from '../../storage/storage.service';
import { ContentRepository } from '../content.repository';

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export interface UploadResult {
  lessonId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

@Injectable()
export class UploadService {
  constructor(
    private readonly storage: StorageService,
    private readonly repository: ContentRepository,
  ) {}

  async uploadLessonContent(opts: {
    lessonId: string;
    moduleId: string;
    trailId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<UploadResult> {
    const { lessonId, moduleId, trailId, buffer, originalName, mimeType } = opts;

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new UnsupportedMediaTypeException(
        `Tipo de arquivo não suportado: ${mimeType}. Use vídeo (mp4, webm, ogg) ou documento (pdf, doc, docx).`,
      );
    }

    if (buffer.length > MAX_SIZE_BYTES) {
      throw new PayloadTooLargeException('Arquivo excede o limite de 500 MB.');
    }

    const { tenantId, userId } = getRequestContext();

    // Verify lesson exists within tenant scope
    const lesson = await this.repository.findLessonById(lessonId, moduleId);
    if (!lesson) throw new NotFoundException('Aula não encontrada');

    const safeFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `content/${tenantId}/${trailId}/${lessonId}/${safeFilename}`;

    await this.storage.upload(objectKey, buffer, mimeType);

    const uploadedAt = new Date();

    // Update lesson with object key + upload metadata
    await this.repository.updateLesson(lessonId, moduleId, {
      contentUrl: objectKey,
      originalName,
      mimeType,
      sizeBytes: buffer.length,
      uploadedBy: userId ?? undefined,
      uploadedAt,
    });

    return {
      lessonId,
      objectKey,
      originalName,
      mimeType,
      sizeBytes: buffer.length,
      uploadedAt: uploadedAt.toISOString(),
    };
  }
}
