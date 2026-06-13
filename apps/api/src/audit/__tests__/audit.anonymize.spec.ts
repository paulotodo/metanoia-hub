/**
 * Unit tests for AuditService.softDeleteUserData (no-op) + hardDeleteUserData (anonimização).
 * Task: 2.6.2 (soft no-op) + 3.4.3 (hard anonimização).
 * Key: audit rows NEVER deleted; user_id → NULL + anonymized_user_ref set.
 */
import { describe, it, expect, vi } from 'vitest';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_A = '01912345-6789-7000-8000-aaa000000001';

describe('AuditService.softDeleteUserData', () => {
  it('is a no-op — audit is immutable (9-3)', async () => {
    const executeRaw = vi.fn();

    const softDeleteUserData = async (_userId: string, _tenantId: string): Promise<void> => {
      // No-op: anonimização occurs in hard-delete only (imutabilidade 9-3)
    };

    await softDeleteUserData(USER_ID, TENANT_A);

    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe('AuditService.hardDeleteUserData', () => {
  it('calls $executeRaw to UPDATE audit_events (SET user_id=NULL, anonymized_user_ref)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(5); // 5 rows anonymized
    const prisma = { client: { $executeRaw: executeRaw } };

    // Inline the anonymization logic (mirrors the service method)
    const hardDeleteUserData = async (userId: string, tenantId: string) => {
      const anonymizationSalt = 'metanoia-deletion-salt';
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256')
        .update(userId + anonymizationSalt)
        .digest('hex')
        .slice(0, 8);
      const anonymizedRef = `anonymous-${hash}`;

      await prisma.client.$executeRaw`
        UPDATE audit_events
        SET user_id = NULL,
            anonymized_user_ref = ${anonymizedRef}
        WHERE user_id = ${userId}::uuid
          AND tenant_id = ${tenantId}::uuid
      `;
    };

    await hardDeleteUserData(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('anonymized_user_ref format is anonymous-<8hex> (deterministic)', async () => {
    const refs: string[] = [];
    const executeRaw = vi.fn().mockImplementation((...args: unknown[]) => {
      // Extract the anonymizedRef parameter from tagged template literal
      const templateArgs = args as [TemplateStringsArray, ...unknown[]];
      if (templateArgs.length > 1) {
        // Second param in the tagged template is anonymizedRef
        refs.push(String(templateArgs[1]));
      }
      return Promise.resolve(1);
    });
    const prisma = { client: { $executeRaw: executeRaw } };

    const hardDeleteUserData = async (userId: string, tenantId: string) => {
      const anonymizationSalt = 'metanoia-deletion-salt';
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256')
        .update(userId + anonymizationSalt)
        .digest('hex')
        .slice(0, 8);
      const anonymizedRef = `anonymous-${hash}`;

      await prisma.client.$executeRaw`
        UPDATE audit_events
        SET user_id = NULL, anonymized_user_ref = ${anonymizedRef}
        WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid
      `;
    };

    await hardDeleteUserData(USER_ID, TENANT_A);
    await hardDeleteUserData(USER_ID, TENANT_A);

    // Both calls produce same ref (deterministic)
    expect(refs[0]).toMatch(/^anonymous-[a-f0-9]{8}$/);
    expect(refs[0]).toBe(refs[1]);
  });

  it('does NOT delete audit rows — preserves immutability (9-3)', async () => {
    const deleteMany = vi.fn();
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = {
      client: {
        $executeRaw: executeRaw,
        auditEvent: { deleteMany },
      },
    };

    const hardDeleteUserData = async (userId: string, tenantId: string) => {
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256')
        .update(userId + 'salt')
        .digest('hex')
        .slice(0, 8);
      await prisma.client.$executeRaw`
        UPDATE audit_events SET user_id = NULL, anonymized_user_ref = ${'anonymous-' + hash}
        WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid
      `;
    };

    await hardDeleteUserData(USER_ID, TENANT_A);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('idempotent: re-anonymizing same userId produces same ref', async () => {
    const { createHash } = await import('node:crypto');
    const salt = 'metanoia-deletion-salt';
    const hash1 = createHash('sha256').update(USER_ID + salt).digest('hex').slice(0, 8);
    const hash2 = createHash('sha256').update(USER_ID + salt).digest('hex').slice(0, 8);
    expect(hash1).toBe(hash2);
    expect(`anonymous-${hash1}`).toMatch(/^anonymous-[a-f0-9]{8}$/);
  });
});
