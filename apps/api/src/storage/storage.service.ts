import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/context/request-context';

export const CONTENT_BUCKET = 'metanoia-storage';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const endpointRaw = this.config.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    // Parse endpoint: remove protocol prefix
    const url = new URL(endpointRaw);
    const useSSL = url.protocol === 'https:';
    const endpointHost = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : useSSL ? 443 : 9000;

    this.client = new Minio.Client({
      endPoint: endpointHost,
      port,
      useSSL,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucket = this.config.get<string>('MINIO_BUCKET', CONTENT_BUCKET);
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket '${this.bucket}' created`);
      }
    } catch (err) {
      // Non-fatal: bucket may already exist in a race, or MinIO may be unreachable in test
      this.logger.warn(`Storage init: ${(err as Error).message}`);
    }
  }

  /**
   * Upload a file buffer to the storage bucket.
   * Storage policy is permanent — no lifecycle expiration is set.
   * SEC-03: Hook de UPSERT em tenant_storage_usage após upload bem-sucedido.
   * @returns the object key (never a signed URL)
   */
  async upload(objectKey: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    // SEC-03: Atualiza contagem de bytes usados por tenant.
    // Usa requestContext.getStore() diretamente (sem throw) — pode não ter contexto
    // em jobs/workers onde o upload é feito fora de um request HTTP.
    const tenantId = requestContext.getStore()?.tenantId ?? null;
    if (!tenantId) {
      this.logger.warn('storage-hook: skipping upsert, no tenant context');
    } else {
      try {
        await this.prisma.client.$executeRaw`
          INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
          VALUES (${tenantId}::uuid, ${BigInt(buffer.length)}, now())
          ON CONFLICT (tenant_id)
          DO UPDATE SET
            bytes_used = tenant_storage_usage.bytes_used + ${BigInt(buffer.length)},
            updated_at = now()
        `;
      } catch (err) {
        // Non-fatal: log and continue (upload already succeeded)
        this.logger.error(
          { tenantId, objectKey, error: (err as Error).message },
          'storage-hook: failed to upsert tenant_storage_usage',
        );
      }
    }

    return objectKey;
  }

  /**
   * Generate a presigned GET URL valid for `expirationSeconds`.
   * Default: 4 hours (14400s).
   */
  async getSignedUrl(objectKey: string, expirationSeconds = 14400): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectKey, expirationSeconds);
  }
}
