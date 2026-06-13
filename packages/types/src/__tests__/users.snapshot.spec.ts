/**
 * Snapshot tests for CurrentUser Zod schemas (Story 9-2, AVS-02).
 * Gate against silent breaking changes in schema shape.
 */
import { describe, expect, it } from 'vitest';
import {
  UserStatusSchema,
  CurrentUserSchema,
  CurrentUserEnvelopeSchema,
} from '../users';

const uuid = '00000000-0000-7000-8000-000000000001';

describe('UserStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = ['pending_verification', 'active', 'deletion_pending', 'deleted'];
    for (const s of statuses) {
      expect(() => UserStatusSchema.parse(s)).not.toThrow();
    }
    expect(statuses).toMatchSnapshot();
  });

  it('rejects unknown status', () => {
    expect(() => UserStatusSchema.parse('banned')).toThrow();
    expect(() => UserStatusSchema.parse('')).toThrow();
  });
});

describe('CurrentUserSchema', () => {
  it('parses a valid active user', () => {
    const result = CurrentUserSchema.parse({
      id: uuid,
      email: 'joao@igrejabetania.com.br',
      name: 'João Silva',
      status: 'active',
    });
    expect(result).toMatchSnapshot();
  });

  it('parses a deletion_pending user', () => {
    const result = CurrentUserSchema.parse({
      id: uuid,
      email: 'joao@igrejabetania.com.br',
      name: 'João Silva',
      status: 'deletion_pending',
    });
    expect(result).toMatchSnapshot();
  });

  it('rejects missing required fields', () => {
    expect(() => CurrentUserSchema.parse({ id: uuid, email: 'x@y.com' })).toThrow();
    expect(() => CurrentUserSchema.parse({ id: uuid, name: 'João', status: 'active' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      CurrentUserSchema.parse({
        id: uuid,
        email: 'not-an-email',
        name: 'João',
        status: 'active',
      }),
    ).toThrow();
  });
});

describe('CurrentUserEnvelopeSchema', () => {
  it('parses an envelope-wrapped user', () => {
    const result = CurrentUserEnvelopeSchema.parse({
      data: {
        id: uuid,
        email: 'joao@igrejabetania.com.br',
        name: 'João Silva',
        status: 'active',
      },
    });
    expect(result).toMatchSnapshot();
  });
});
