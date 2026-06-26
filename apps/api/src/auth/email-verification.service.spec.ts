import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoneException, NotFoundException } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';

function createMocks() {
  const redis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
  const prisma = {
    client: {
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    },
  };
  const keycloakAdmin = {
    findUserByEmail: vi.fn(),
    markEmailVerified: vi.fn().mockResolvedValue(undefined),
  };
  const producer = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  };

  const service = new EmailVerificationService(
    redis as any,
    prisma as any,
    keycloakAdmin as any,
    producer as any,
  );

  return { service, redis, prisma, keycloakAdmin, producer };
}

describe('EmailVerificationService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  describe('issue', () => {
    it('stores a token in Redis with TTL and enqueues the email', async () => {
      await mocks.service.issue('user@example.com', 'John Doe');

      expect(mocks.redis.set).toHaveBeenCalledTimes(1);
      const [key, , mode, ttl] = mocks.redis.set.mock.calls[0];
      expect(key).toMatch(/^verify-email:/);
      expect(mode).toBe('EX');
      expect(ttl).toBe(86_400);

      expect(mocks.producer.enqueue).toHaveBeenCalledTimes(1);
      const job = mocks.producer.enqueue.mock.calls[0][0];
      expect(job.email).toBe('user@example.com');
      expect(job.firstName).toBe('John'); // only the first name
      expect(typeof job.token).toBe('string');
    });

    it('falls back to the email local-part when name is blank', async () => {
      await mocks.service.issue('jane@example.com', '   ');
      expect(mocks.producer.enqueue.mock.calls[0][0].firstName).toBe('jane');
    });
  });

  describe('confirm', () => {
    it('throws Gone when the token is missing/expired', async () => {
      mocks.redis.get.mockResolvedValue(null);
      await expect(mocks.service.confirm('bad-token')).rejects.toThrow(
        GoneException,
      );
    });

    it('marks Keycloak verified and activates the user on success', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({ email: 'user@example.com' }),
      );
      mocks.keycloakAdmin.findUserByEmail.mockResolvedValue({
        id: 'kc-1',
        email: 'user@example.com',
        emailVerified: false,
      });

      const result = await mocks.service.confirm('good-token');

      expect(result).toEqual({ verified: true, email: 'user@example.com' });
      expect(mocks.keycloakAdmin.markEmailVerified).toHaveBeenCalledWith('kc-1');
      expect(mocks.prisma.client.user.updateMany).toHaveBeenCalledWith({
        where: { email: 'user@example.com', status: 'pending_verification' },
        data: { status: 'active' },
      });
      expect(mocks.redis.del).toHaveBeenCalledTimes(1);
    });

    it('throws NotFound and burns the token when the identity is gone', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({ email: 'ghost@example.com' }),
      );
      mocks.keycloakAdmin.findUserByEmail.mockResolvedValue(null);

      await expect(mocks.service.confirm('orphan-token')).rejects.toThrow(
        NotFoundException,
      );
      expect(mocks.redis.del).toHaveBeenCalledTimes(1);
      expect(mocks.keycloakAdmin.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('resend', () => {
    it('is a silent no-op past the rate limit', async () => {
      mocks.redis.incr.mockResolvedValue(4); // > RATE_LIMIT_MAX (3)
      await mocks.service.resend('user@example.com');
      expect(mocks.keycloakAdmin.findUserByEmail).not.toHaveBeenCalled();
      expect(mocks.producer.enqueue).not.toHaveBeenCalled();
    });

    it('does not re-send when the user is already verified', async () => {
      mocks.redis.incr.mockResolvedValue(1);
      mocks.keycloakAdmin.findUserByEmail.mockResolvedValue({
        id: 'kc-1',
        email: 'user@example.com',
        emailVerified: true,
      });
      await mocks.service.resend('user@example.com');
      expect(mocks.producer.enqueue).not.toHaveBeenCalled();
    });

    it('issues a fresh token for a pending user', async () => {
      mocks.redis.incr.mockResolvedValue(1);
      mocks.keycloakAdmin.findUserByEmail.mockResolvedValue({
        id: 'kc-1',
        email: 'user@example.com',
        firstName: 'Maria',
        emailVerified: false,
      });
      await mocks.service.resend('user@example.com');
      expect(mocks.producer.enqueue).toHaveBeenCalledTimes(1);
      expect(mocks.producer.enqueue.mock.calls[0][0].firstName).toBe('Maria');
    });
  });
});
