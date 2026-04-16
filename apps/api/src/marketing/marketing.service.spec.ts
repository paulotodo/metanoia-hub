import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContactMessageInput, DemoRequestInput } from '@metanoia/types';
import { MarketingService } from './marketing.service';

function createMocks() {
  const fixedDate = new Date('2026-04-16T18:00:00Z');
  const prisma = {
    client: {
      demoRequest: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...data, createdAt: fixedDate }),
        ),
      },
      contactMessage: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...data, createdAt: fixedDate }),
        ),
      },
    },
  };
  const service = new MarketingService(prisma as never);
  return { service, prisma, fixedDate };
}

const metadata = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

const validDemo: DemoRequestInput = {
  fullName: 'Pastor Lucas',
  email: 'pastor@example.com',
  churchName: 'Igreja da Vila',
  churchSize: '50-to-200',
  role: 'Pastor titular',
};

const validContact: ContactMessageInput = {
  fullName: 'Ana Souza',
  email: 'ana@example.com',
  message: 'Gostaria de entender melhor a proposta pastoral.',
};

describe('MarketingService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  describe('createDemoRequest', () => {
    it('persists the request and returns the record with ISO timestamp', async () => {
      const result = await mocks.service.createDemoRequest(validDemo, metadata);

      expect(mocks.prisma.client.demoRequest.create).toHaveBeenCalledTimes(1);
      const call = mocks.prisma.client.demoRequest.create.mock.calls[0][0];
      expect(call.data.fullName).toBe(validDemo.fullName);
      expect(call.data.email).toBe(validDemo.email);
      expect(call.data.churchSize).toBe(validDemo.churchSize);
      expect(call.data.ipAddress).toBe(metadata.ipAddress);
      expect(call.data.userAgent).toBe(metadata.userAgent);
      expect(typeof call.data.id).toBe('string');
      expect(call.data.id).toMatch(/^[0-9a-f-]{36}$/i);

      expect(result.demoRequestId).toBe(call.data.id);
      expect(result.createdAt).toBe('2026-04-16T18:00:00.000Z');
      expect(result.role).toBe(validDemo.role);
    });

    it('preserves null role when not provided', async () => {
      const result = await mocks.service.createDemoRequest(
        { ...validDemo, role: null },
        metadata,
      );
      expect(result.role).toBeNull();
    });
  });

  describe('createContactMessage', () => {
    it('persists the message and returns the record', async () => {
      const result = await mocks.service.createContactMessage(
        validContact,
        metadata,
      );

      expect(mocks.prisma.client.contactMessage.create).toHaveBeenCalledTimes(
        1,
      );
      const call = mocks.prisma.client.contactMessage.create.mock.calls[0][0];
      expect(call.data.message).toBe(validContact.message);

      expect(result.contactMessageId).toBe(call.data.id);
      expect(result.createdAt).toBe('2026-04-16T18:00:00.000Z');
      expect(result.message).toBe(validContact.message);
    });
  });
});
