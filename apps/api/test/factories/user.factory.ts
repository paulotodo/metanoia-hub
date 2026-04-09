import { generateId } from '@metanoia/types';

interface UserFactoryParams {
  tenantId?: string;
  email?: string;
  name?: string;
  status?: string;
}

export function createUser(params: UserFactoryParams = {}) {
  return {
    id: generateId(),
    email: params.email ?? `user-${generateId()}@example.com`,
    name: params.name ?? 'Test User',
    status: params.status ?? 'pending_verification',
    tenantId: params.tenantId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface UserTenantFactoryParams {
  userId: string;
  tenantId: string;
  role?: string;
}

export function createUserTenant(params: UserTenantFactoryParams) {
  return {
    id: generateId(),
    userId: params.userId,
    tenantId: params.tenantId,
    role: params.role ?? 'participante',
    createdAt: new Date(),
  };
}

interface ConsentFactoryParams {
  userId: string;
  tenantId?: string;
  documentType?: string;
  version?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function createConsent(params: ConsentFactoryParams) {
  return {
    id: generateId(),
    userId: params.userId,
    tenantId: params.tenantId ?? null,
    documentType: params.documentType ?? 'terms_of_service',
    version: params.version ?? '1.0',
    ipAddress: params.ipAddress ?? '127.0.0.1',
    userAgent: params.userAgent ?? 'test-agent',
    acceptedAt: new Date(),
  };
}
