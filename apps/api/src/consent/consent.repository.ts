import { Injectable } from '@nestjs/common';
import type { ConsentDocumentType } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestByUser(
    userId: string,
    documentType: ConsentDocumentType,
  ) {
    return this.prisma.client.consent.findFirst({
      where: { userId, documentType },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  async create(input: {
    id: string;
    userId: string;
    tenantId: string | null;
    documentType: ConsentDocumentType;
    version: string;
    ipAddress: string;
    userAgent: string;
  }) {
    return this.prisma.client.consent.create({
      data: {
        id: input.id,
        userId: input.userId,
        tenantId: input.tenantId,
        documentType: input.documentType,
        version: input.version,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
