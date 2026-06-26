import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { RegisterService } from './register.service';
import { KeycloakConflictError } from './keycloak-admin.service';

function createMocks() {
  const prisma = {
    client: {
      user: { create: vi.fn().mockResolvedValue({}) },
      consent: { create: vi.fn().mockResolvedValue({}) },
    },
  };
  const keycloakAdmin = {
    createUser: vi.fn().mockResolvedValue({ keycloakId: 'kc-123' }),
  };
  const passwordChecker = {
    isLeaked: vi.fn().mockResolvedValue(false),
  };
  const emailVerification = {
    issue: vi.fn().mockResolvedValue(undefined),
  };

  const service = new RegisterService(
    prisma as any,
    keycloakAdmin as any,
    passwordChecker as any,
    emailVerification as any,
  );

  return { service, prisma, keycloakAdmin, passwordChecker, emailVerification };
}

const validInput = { email: 'user@example.com', password: 'securePass123!', name: 'John Doe' };
const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

describe('RegisterService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('should register user successfully', async () => {
    const result = await mocks.service.register(validInput, metadata);

    expect(result.email).toBe(validInput.email);
    expect(result.name).toBe(validInput.name);
    expect(result.status).toBe('pending_verification');
    expect(result.id).toBeDefined();
    expect(mocks.keycloakAdmin.createUser).toHaveBeenCalledWith(
      validInput.email,
      validInput.password,
      validInput.name,
    );
    expect(mocks.prisma.client.user.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.client.consent.create).toHaveBeenCalledTimes(1);
    expect(mocks.emailVerification.issue).toHaveBeenCalledTimes(1);
    expect(mocks.emailVerification.issue).toHaveBeenCalledWith(
      validInput.email,
      validInput.name,
    );
  });

  it('should reject leaked password', async () => {
    mocks.passwordChecker.isLeaked.mockResolvedValue(true);

    await expect(mocks.service.register(validInput, metadata)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.keycloakAdmin.createUser).not.toHaveBeenCalled();
  });

  it('should return generic error for duplicate email', async () => {
    mocks.keycloakAdmin.createUser.mockRejectedValue(
      new KeycloakConflictError('User already exists'),
    );

    await expect(mocks.service.register(validInput, metadata)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('should record consent with correct metadata', async () => {
    await mocks.service.register(validInput, metadata);

    const consentCall = mocks.prisma.client.consent.create.mock.calls[0][0];
    expect(consentCall.data.ipAddress).toBe('127.0.0.1');
    expect(consentCall.data.userAgent).toBe('test-agent');
    expect(consentCall.data.documentType).toBe('terms_of_service');
    expect(consentCall.data.tenantId).toBeNull();
  });

  it('should create user with null tenantId', async () => {
    await mocks.service.register(validInput, metadata);

    const userCall = mocks.prisma.client.user.create.mock.calls[0][0];
    expect(userCall.data.tenantId).toBeNull();
    expect(userCall.data.status).toBe('pending_verification');
  });
});
