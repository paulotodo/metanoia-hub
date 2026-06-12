import { describe, it, expect, vi } from 'vitest';
import { PrivacyService } from '../privacy.service';

// Fixed UUIDs (v7 format) for deterministic snapshots
const RECORD_ID_1 = '0197b600-0001-7000-8000-000000000001';
const RECORD_ID_2 = '0197b600-0002-7000-8000-000000000002';
const NOW = new Date('2026-06-18T00:00:00.000Z');

function makePrisma(data: unknown[]) {
  return {
    client: {
      dataProcessingRegistry: {
        findMany: vi.fn().mockResolvedValue(data),
      },
    },
  };
}

describe('PrivacyService.listDataProcessingRegistry', () => {
  it('returns empty data array when registry is empty', async () => {
    const prisma = makePrisma([]);
    const service = new PrivacyService(prisma as never);

    const result = await service.listDataProcessingRegistry();

    expect(result).toEqual({ data: [] });
    expect(prisma.client.dataProcessingRegistry.findMany).toHaveBeenCalledWith({
      orderBy: { operationName: 'asc' },
    });
  });

  it('maps Date fields to ISO strings in DTO', async () => {
    const raw = {
      id: RECORD_ID_1,
      operationName: 'Autenticação e Controle de Acesso',
      legalBasis: 'contract',
      purpose: 'Verificar identidade.',
      dataCategories: ['email', 'session_token'],
      retentionPeriod: '90 dias',
      thirdPartySharing: 'Keycloak',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const prisma = makePrisma([raw]);
    const service = new PrivacyService(prisma as never);

    const result = await service.listDataProcessingRegistry();

    expect(result.data).toHaveLength(1);
    const dto = result.data[0];
    expect(typeof dto!.createdAt).toBe('string');
    expect(typeof dto!.updatedAt).toBe('string');
    expect(dto!.createdAt).toBe('2026-06-18T00:00:00.000Z');
    expect(dto!.updatedAt).toBe('2026-06-18T00:00:00.000Z');
  });

  it('maps null thirdPartySharing correctly', async () => {
    const raw = {
      id: RECORD_ID_2,
      operationName: 'Notas Pastorais',
      legalBasis: 'legitimate_interest',
      purpose: 'Acompanhamento pastoral.',
      dataCategories: ['pastoral_notes'],
      retentionPeriod: '5 anos',
      thirdPartySharing: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const prisma = makePrisma([raw]);
    const service = new PrivacyService(prisma as never);

    const result = await service.listDataProcessingRegistry();

    expect(result.data[0]!.thirdPartySharing).toBeNull();
  });

  it('returns full DTO shape with all required fields', async () => {
    const raw = {
      id: RECORD_ID_1,
      operationName: 'Test Operation',
      legalBasis: 'consent',
      purpose: 'Test purpose.',
      dataCategories: ['field_a', 'field_b'],
      retentionPeriod: '12 meses',
      thirdPartySharing: 'Service X',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const prisma = makePrisma([raw]);
    const service = new PrivacyService(prisma as never);

    const result = await service.listDataProcessingRegistry();
    const dto = result.data[0]!;

    expect(dto).toMatchObject({
      id: RECORD_ID_1,
      operationName: 'Test Operation',
      legalBasis: 'consent',
      purpose: 'Test purpose.',
      dataCategories: ['field_a', 'field_b'],
      retentionPeriod: '12 meses',
      thirdPartySharing: 'Service X',
    });
    // No raw Prisma object leak
    expect('_count' in dto).toBe(false);
  });
});

describe('PrivacyController integration: service call path', () => {
  // The controller simply delegates to the service and returns the result.
  // This verifies the response pass-through without additional transformation.
  it('controller returns service result directly', async () => {
    const { PrivacyController } = await import('../privacy.controller');
    const fakeResult = { data: [{ id: RECORD_ID_1 }] };
    const fakeService = {
      listDataProcessingRegistry: vi.fn().mockResolvedValue(fakeResult),
    };
    const controller = new PrivacyController(fakeService as never, {} as never);

    const result = await controller.getDataProcessing();

    expect(result).toBe(fakeResult);
    expect(fakeService.listDataProcessingRegistry).toHaveBeenCalledTimes(1);
  });
});
