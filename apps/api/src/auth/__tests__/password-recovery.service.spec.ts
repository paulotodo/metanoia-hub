import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, GoneException } from '@nestjs/common';
import { PasswordRecoveryService } from '../password-recovery.service';

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

const mockPrisma = {
  client: {
    user: {
      findUnique: vi.fn(),
    },
  },
};

const mockKeycloakAdmin = {
  findUserByEmail: vi.fn(),
  resetUserPassword: vi.fn(),
  authenticateUser: vi.fn(),
};

const mockSessionService = {
  create: vi.fn(),
};

const mockRecoveryEmailProducer = {
  enqueue: vi.fn(),
};

const mockConfig = {
  get: vi.fn(() => 'http://localhost:3000'),
};

function createService() {
  return new PasswordRecoveryService(
    mockRedis as never,
    mockPrisma as never,
    mockKeycloakAdmin as never,
    mockSessionService as never,
    mockRecoveryEmailProducer as never,
    mockConfig as never,
  );
}

describe('PasswordRecoveryService', () => {
  let service: PasswordRecoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  describe('requestRecovery', () => {
    it('should create token and enqueue email when user exists', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockKeycloakAdmin.findUserByEmail.mockResolvedValue({
        id: 'kc-123',
        email: 'marcos@igreja.com',
        firstName: 'Marcos',
        enabled: true,
      });
      mockRedis.set.mockResolvedValue('OK');
      mockRecoveryEmailProducer.enqueue.mockResolvedValue(undefined);

      await service.requestRecovery('marcos@igreja.com');

      expect(mockRedis.incr).toHaveBeenCalledWith('rate:recovery:marcos@igreja.com');
      expect(mockRedis.expire).toHaveBeenCalledWith('rate:recovery:marcos@igreja.com', 3600);
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRecoveryEmailProducer.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'marcos@igreja.com',
          firstName: 'Marcos',
        }),
      );
    });

    it('should silently return when user does not exist (anti-enumeration)', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockKeycloakAdmin.findUserByEmail.mockResolvedValue(null);

      await service.requestRecovery('unknown@test.com');

      expect(mockRecoveryEmailProducer.enqueue).not.toHaveBeenCalled();
    });

    it('should silently return when rate limit exceeded', async () => {
      mockRedis.incr.mockResolvedValue(4);

      await service.requestRecovery('marcos@igreja.com');

      expect(mockKeycloakAdmin.findUserByEmail).not.toHaveBeenCalled();
      expect(mockRecoveryEmailProducer.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should return masked email for valid token', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ email: 'marcos@igreja.com', createdAt: new Date().toISOString() }),
      );

      const result = await service.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('m***@i***.com');
    });

    it('should throw NotFoundException for expired/missing token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.validateToken('expired-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetPassword', () => {
    const input = {
      token: '019756d0-0001-7000-8000-000000000099',
      newPassword: 'novaSenha123',
      confirmPassword: 'novaSenha123',
    };
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test' };

    it('should reset password, auto-login, and return LoginResponse', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ email: 'marcos@igreja.com', createdAt: new Date().toISOString() }),
      );
      mockKeycloakAdmin.findUserByEmail.mockResolvedValue({
        id: 'kc-123',
        email: 'marcos@igreja.com',
      });
      mockKeycloakAdmin.resetUserPassword.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);
      mockKeycloakAdmin.authenticateUser.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 300,
      });
      mockPrisma.client.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'marcos@igreja.com',
        name: 'Marcos Silva',
        consents: [{ documentType: 'terms_of_service' }],
        userTenants: [{ tenantId: 'tenant-1', role: 'leader' }],
      });
      mockSessionService.create.mockResolvedValue('session-1');

      const result = await service.resetPassword(input, metadata);

      expect(mockKeycloakAdmin.resetUserPassword).toHaveBeenCalledWith('kc-123', 'novaSenha123');
      expect(mockRedis.del).toHaveBeenCalledWith('recovery:019756d0-0001-7000-8000-000000000099');
      expect(result.accessToken).toBe('at');
      expect(result.sessionId).toBe('session-1');
      expect(result.user.email).toBe('marcos@igreja.com');
    });

    it('should throw GoneException for expired token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.resetPassword(input, metadata)).rejects.toThrow(
        GoneException,
      );
    });
  });
});
