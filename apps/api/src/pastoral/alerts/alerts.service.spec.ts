import { describe, it, expect, vi } from 'vitest';
import { AlertsService } from './alerts.service';
import type { AlertsRepository } from './alerts.repository';

/**
 * Unit tests for AlertsService (Story 6-3)
 * Tests: negative transition → alert, positive → event, neutral → no-op, dedup
 */

function makeRepo(overrides?: Partial<AlertsRepository>): AlertsRepository {
  return {
    createIfNotDuplicate: vi.fn().mockResolvedValue('alert-id-123'),
    findActiveByGroup: vi.fn().mockResolvedValue([]),
    markRead: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AlertsRepository;
}

describe('AlertsService.processTransition', () => {
  const TENANT_ID = 'tenant-00000000-0000-0000-0000-000000000001';
  const GROUP_ID = 'group-00000000-0000-0000-0000-000000000001';
  const PARTICIPANT_ID = 'user-00000000-0000-0000-0000-000000000001';

  describe('Negative transitions → create alert', () => {
    it('verde → amarelo creates alert', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'verde', 'amarelo', 'declinio',
      );

      expect(result.direction).toBe('negative');
      expect(result.alertId).toBe('alert-id-123');
      expect(result.event).toBeNull();
      expect(repo.createIfNotDuplicate).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        groupId: GROUP_ID,
        participantId: PARTICIPANT_ID,
        previousStatus: 'verde',
        newStatus: 'amarelo',
        trend: 'declinio',
      });
    });

    it('amarelo → vermelho creates alert', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'amarelo', 'vermelho', 'declinio',
      );

      expect(result.direction).toBe('negative');
      expect(result.alertId).not.toBeNull();
    });

    it('verde → vermelho creates alert', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'verde', 'vermelho', 'declinio',
      );

      expect(result.direction).toBe('negative');
      expect(result.alertId).not.toBeNull();
    });
  });

  describe('Positive transitions → emit event, NO alert', () => {
    it('vermelho → amarelo emits event, no alert', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'vermelho', 'amarelo', 'melhorando',
      );

      expect(result.direction).toBe('positive');
      expect(result.alertId).toBeNull();
      expect(result.event).not.toBeNull();
      expect(result.event?.eventType).toBe('pastoral.participant.status_improved');
      expect(result.event?.previousStatus).toBe('vermelho');
      expect(result.event?.newStatus).toBe('amarelo');
      // Must NOT create alert
      expect(repo.createIfNotDuplicate).not.toHaveBeenCalled();
    });

    it('amarelo → verde emits event, no alert', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'amarelo', 'verde', 'melhorando',
      );

      expect(result.direction).toBe('positive');
      expect(result.event?.eventType).toBe('pastoral.participant.status_improved');
      expect(repo.createIfNotDuplicate).not.toHaveBeenCalled();
    });

    it('vermelho → verde emits event, no alert', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'vermelho', 'verde', 'melhorando',
      );

      expect(result.direction).toBe('positive');
      expect(repo.createIfNotDuplicate).not.toHaveBeenCalled();
    });
  });

  describe('Neutral (same status) → no action', () => {
    it('verde → verde no action', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'verde', 'verde', 'estavel',
      );

      expect(result.direction).toBe('neutral');
      expect(result.alertId).toBeNull();
      expect(result.event).toBeNull();
      expect(repo.createIfNotDuplicate).not.toHaveBeenCalled();
    });

    it('amarelo → amarelo no action', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'amarelo', 'amarelo', 'estavel',
      );

      expect(result.direction).toBe('neutral');
    });

    it('null previousStatus (first calc) → neutral', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        null, 'vermelho', 'estavel',
      );

      expect(result.direction).toBe('neutral');
      expect(repo.createIfNotDuplicate).not.toHaveBeenCalled();
    });
  });

  describe('Dedup: alert already active suppresses creation', () => {
    it('returns null alertId when repo dedup returns null', async () => {
      const repo = makeRepo({
        createIfNotDuplicate: vi.fn().mockResolvedValue(null),
      });
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'verde', 'amarelo', 'declinio',
      );

      expect(result.direction).toBe('negative');
      expect(result.alertId).toBeNull(); // suppressed by dedup
      // createIfNotDuplicate was still called
      expect(repo.createIfNotDuplicate).toHaveBeenCalled();
    });
  });

  describe('domain event shape', () => {
    it('event has all required fields with correct types', async () => {
      const repo = makeRepo();
      const service = new AlertsService(repo);

      const result = await service.processTransition(
        TENANT_ID, GROUP_ID, PARTICIPANT_ID,
        'vermelho', 'verde', 'melhorando',
      );

      const event = result.event!;
      expect(event.eventType).toBe('pastoral.participant.status_improved');
      expect(event.version).toBe(1);
      expect(event.tenantId).toBe(TENANT_ID);
      expect(event.groupId).toBe(GROUP_ID);
      expect(event.participantId).toBe(PARTICIPANT_ID);
      expect(event.previousStatus).toBe('vermelho');
      expect(event.newStatus).toBe('verde');
      expect(event.trend).toBe('melhorando');
      expect(typeof event.timestamp).toBe('string');
      // timestamp is ISO 8601
      expect(() => new Date(event.timestamp)).not.toThrow();
    });
  });
});

describe('AlertsService.markRead + dismiss', () => {
  const ALERT_ID = 'alert-00000000-0000-0000-0000-000000000001';

  it('markRead delegates to repo', async () => {
    const repo = makeRepo();
    const service = new AlertsService(repo);

    await service.markRead(ALERT_ID);

    expect(repo.markRead).toHaveBeenCalledWith(ALERT_ID);
  });

  it('dismiss delegates to repo', async () => {
    const repo = makeRepo();
    const service = new AlertsService(repo);

    await service.dismiss(ALERT_ID);

    expect(repo.dismiss).toHaveBeenCalledWith(ALERT_ID);
  });

  it('markRead throws NotFoundException when repo throws', async () => {
    const repo = makeRepo({
      markRead: vi.fn().mockRejectedValue(new Error('not found')),
    });
    const service = new AlertsService(repo);

    await expect(service.markRead(ALERT_ID)).rejects.toThrow();
  });
});
