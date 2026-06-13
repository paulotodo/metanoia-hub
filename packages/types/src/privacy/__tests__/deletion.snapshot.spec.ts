/**
 * Snapshot tests for privacy deletion Zod schemas (Story 9-2 / FASE 1.1.4).
 * Gate against silent breaking changes in schema shape.
 */
import { describe, expect, it } from 'vitest';
import {
  PrivacyDeletionRequestSchema,
  PrivacyDeletionResponseSchema,
  PrivacyDeletionStatusSchema,
  DeletionStatusEnum,
  LeaderBlockerSchema,
} from '../deletion';

const now = '2026-06-12T10:00:00.000Z';
const future7 = '2026-06-19T10:00:00.000Z';
const future30 = '2026-07-12T10:00:00.000Z';
const uuid = '00000000-0000-7000-8000-000000000001';
const uuid2 = '00000000-0000-7000-8000-000000000002';

describe('PrivacyDeletionRequestSchema', () => {
  it('accepts confirm=EXCLUIR', () => {
    const result = PrivacyDeletionRequestSchema.parse({ confirm: 'EXCLUIR' });
    expect(result).toMatchSnapshot();
  });

  it('rejects wrong confirm string', () => {
    expect(() => PrivacyDeletionRequestSchema.parse({ confirm: 'DELETE' })).toThrow();
    expect(() => PrivacyDeletionRequestSchema.parse({ confirm: 'excluir' })).toThrow();
    expect(() => PrivacyDeletionRequestSchema.parse({})).toThrow();
  });
});

describe('PrivacyDeletionResponseSchema', () => {
  it('parses valid response', () => {
    const result = PrivacyDeletionResponseSchema.parse({
      requestId: uuid,
      status: 'pending',
      cancellableUntil: future7,
      deletionDeadline: future30,
    });
    expect(result).toMatchSnapshot();
  });

  it('rejects invalid status', () => {
    expect(() =>
      PrivacyDeletionResponseSchema.parse({
        requestId: uuid,
        status: 'cancelled',
        cancellableUntil: future7,
        deletionDeadline: future30,
      }),
    ).toThrow();
  });
});

describe('PrivacyDeletionStatusSchema', () => {
  it('parses pending status', () => {
    const result = PrivacyDeletionStatusSchema.parse({
      requestId: uuid,
      status: 'pending',
      cancellableUntil: future7,
      deletionDeadline: future30,
      cancelledAt: null,
      completedAt: null,
      failureReason: null,
    });
    expect(result).toMatchSnapshot();
  });

  it('parses cancelled status with cancelledAt', () => {
    const result = PrivacyDeletionStatusSchema.parse({
      requestId: uuid,
      status: 'cancelled',
      cancellableUntil: future7,
      deletionDeadline: future30,
      cancelledAt: now,
      completedAt: null,
      failureReason: null,
    });
    expect(result).toMatchSnapshot();
  });

  it('parses hard_deleted status', () => {
    const result = PrivacyDeletionStatusSchema.parse({
      requestId: uuid,
      status: 'hard_deleted',
      cancellableUntil: future7,
      deletionDeadline: future30,
      cancelledAt: null,
      completedAt: now,
      failureReason: null,
    });
    expect(result).toMatchSnapshot();
  });

  it('rejects unknown status', () => {
    expect(() =>
      PrivacyDeletionStatusSchema.parse({
        requestId: uuid,
        status: 'deleted',
        cancellableUntil: future7,
        deletionDeadline: future30,
        cancelledAt: null,
        completedAt: null,
        failureReason: null,
      }),
    ).toThrow();
  });
});

describe('DeletionStatusEnum', () => {
  it('covers all valid statuses', () => {
    const statuses = ['pending', 'soft_deleted', 'hard_deleted', 'cancelled', 'failed'];
    for (const s of statuses) {
      expect(() => DeletionStatusEnum.parse(s)).not.toThrow();
    }
    expect(statuses).toMatchSnapshot();
  });
});

describe('LeaderBlockerSchema', () => {
  it('parses leader blocker with groups', () => {
    const result = LeaderBlockerSchema.parse({
      error: 'LEADER_ACTIVE_GROUPS',
      groups: [
        { id: uuid, name: 'Célula Norte' },
        { id: uuid2, name: 'Jovens Alpha' },
      ],
    });
    expect(result).toMatchSnapshot();
  });

  it('rejects wrong error code', () => {
    expect(() =>
      LeaderBlockerSchema.parse({
        error: 'OTHER_ERROR',
        groups: [],
      }),
    ).toThrow();
  });
});
