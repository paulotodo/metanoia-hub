import { Injectable } from '@nestjs/common';
import type { DataProcessingRegistryItem, DataProcessingRegistryResponse } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async listDataProcessingRegistry(): Promise<DataProcessingRegistryResponse> {
    const records = await this.prisma.client.dataProcessingRegistry.findMany({
      orderBy: { operationName: 'asc' },
    });

    return {
      data: records.map((r): DataProcessingRegistryItem => this.toDto(r)),
    };
  }

  private toDto(r: {
    id: string;
    operationName: string;
    legalBasis: string;
    purpose: string;
    dataCategories: string[];
    retentionPeriod: string;
    thirdPartySharing: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DataProcessingRegistryItem {
    return {
      id: r.id,
      operationName: r.operationName,
      // Cast: DB constraint guarantees value matches LegalBasis enum
      legalBasis: r.legalBasis as DataProcessingRegistryItem['legalBasis'],
      purpose: r.purpose,
      dataCategories: r.dataCategories,
      retentionPeriod: r.retentionPeriod,
      thirdPartySharing: r.thirdPartySharing,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
