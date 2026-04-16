import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type {
  ContactMessageInput,
  DemoRequestInput,
} from '@metanoia/types';
import { MarketingService } from '../../src/marketing/marketing.service';

const validDemo: DemoRequestInput = {
  fullName: 'Pastor Lucas',
  email: 'pastor@integration-spec.test',
  churchName: 'Igreja da Vila (integration)',
  churchSize: '50-to-200',
  role: 'Pastor titular',
};

const validContact: ContactMessageInput = {
  fullName: 'Ana Souza',
  email: 'ana@integration-spec.test',
  message: 'Mensagem de teste de integração do funil marketing.',
};

const metadata = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

describe('Marketing integration (real Prisma, no RLS)', () => {
  let prisma: PrismaClient;
  let service: MarketingService;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL;
    if (!connectionString) {
      throw new Error('DATABASE_APP_URL missing — start docker-compose first');
    }
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    service = new MarketingService({ client: prisma } as never);
  });

  beforeEach(async () => {
    await prisma.demoRequest.deleteMany({
      where: { email: { endsWith: '@integration-spec.test' } },
    });
    await prisma.contactMessage.deleteMany({
      where: { email: { endsWith: '@integration-spec.test' } },
    });
  });

  afterAll(async () => {
    await prisma.demoRequest.deleteMany({
      where: { email: { endsWith: '@integration-spec.test' } },
    });
    await prisma.contactMessage.deleteMany({
      where: { email: { endsWith: '@integration-spec.test' } },
    });
    await prisma.$disconnect();
  });

  it('persists a demo request and returns the record with ISO timestamp', async () => {
    const result = await service.createDemoRequest(validDemo, metadata);

    expect(result.demoRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const row = await prisma.demoRequest.findUnique({
      where: { id: result.demoRequestId },
    });
    expect(row).not.toBeNull();
    expect(row?.email).toBe(validDemo.email);
    expect(row?.churchSize).toBe(validDemo.churchSize);
    expect(row?.ipAddress).toBe(metadata.ipAddress);
    expect(row?.userAgent).toBe(metadata.userAgent);
  });

  it('persists a demo request with null role', async () => {
    const result = await service.createDemoRequest(
      { ...validDemo, role: null },
      metadata,
    );

    const row = await prisma.demoRequest.findUnique({
      where: { id: result.demoRequestId },
    });
    expect(row?.role).toBeNull();
  });

  it('persists a contact message and returns the record', async () => {
    const result = await service.createContactMessage(validContact, metadata);

    const row = await prisma.contactMessage.findUnique({
      where: { id: result.contactMessageId },
    });
    expect(row).not.toBeNull();
    expect(row?.message).toBe(validContact.message);
    expect(row?.email).toBe(validContact.email);
  });

  it('allows multiple submissions from the same email (no dedup)', async () => {
    const first = await service.createDemoRequest(validDemo, metadata);
    const second = await service.createDemoRequest(validDemo, metadata);

    expect(first.demoRequestId).not.toBe(second.demoRequestId);

    const rows = await prisma.demoRequest.findMany({
      where: { email: validDemo.email },
    });
    expect(rows.length).toBe(2);
  });
});
