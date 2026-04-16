import { Injectable, Logger } from '@nestjs/common';
import {
  generateId,
  type ContactMessageInput,
  type ContactMessageRecord,
  type DemoRequestInput,
  type DemoRequestRecord,
} from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';

interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDemoRequest(
    input: DemoRequestInput,
    metadata: RequestMetadata,
  ): Promise<DemoRequestRecord> {
    const id = generateId();
    const created = await this.prisma.client.demoRequest.create({
      data: {
        id,
        fullName: input.fullName,
        email: input.email,
        churchName: input.churchName,
        churchSize: input.churchSize,
        role: input.role,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    this.logger.log(
      { demoRequestId: id, email: created.email },
      'demo request received',
    );

    return {
      demoRequestId: created.id,
      fullName: created.fullName,
      email: created.email,
      churchName: created.churchName,
      churchSize: created.churchSize as DemoRequestRecord['churchSize'],
      role: created.role,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async createContactMessage(
    input: ContactMessageInput,
    metadata: RequestMetadata,
  ): Promise<ContactMessageRecord> {
    const id = generateId();
    const created = await this.prisma.client.contactMessage.create({
      data: {
        id,
        fullName: input.fullName,
        email: input.email,
        message: input.message,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    this.logger.log(
      { contactMessageId: id, email: created.email },
      'contact message received',
    );

    return {
      contactMessageId: created.id,
      fullName: created.fullName,
      email: created.email,
      message: created.message,
      createdAt: created.createdAt.toISOString(),
    };
  }
}
