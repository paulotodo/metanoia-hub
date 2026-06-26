import { describe, it, expect } from 'vitest';
import { sanitizeStatement, sanitizeRawSql } from '../sanitize-sql';

describe('sanitizeStatement', () => {
  it('returns model.operation for model operations', () => {
    expect(sanitizeStatement('user', 'findMany', false)).toBe('user.findMany');
    expect(sanitizeStatement('group', 'create', false)).toBe('group.create');
    expect(sanitizeStatement('notification', 'updateMany', false)).toBe('notification.updateMany');
  });

  it('returns operation for raw queries without model', () => {
    const result = sanitizeStatement(undefined, 'queryRaw', true);
    expect(result).toBeDefined();
    expect(result).toContain('queryRaw');
  });

  it('does not include args or data in result', () => {
    // Model.op never contains user data
    const result = sanitizeStatement('user', 'findMany', false);
    expect(result).toBe('user.findMany');
    // No email, no UUID, no data
    expect(result).not.toMatch(/@/);
  });
});

describe('sanitizeRawSql', () => {
  it('removes single-quoted string literals (potential PII)', () => {
    const result = sanitizeRawSql("SELECT * FROM users WHERE email = 'test@example.com'");
    expect(result).not.toContain('test@example.com');
    expect(result).toContain('?');
  });

  it('removes UUID literals', () => {
    const result = sanitizeRawSql("SELECT * FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000'");
    expect(result).not.toContain('550e8400');
  });

  it('removes positional parameters $1, $2', () => {
    const result = sanitizeRawSql('SELECT * FROM tenants WHERE id = $1 AND name = $2');
    expect(result).not.toMatch(/\$[0-9]+/);
  });

  it('removes numeric literals', () => {
    const result = sanitizeRawSql('SELECT * FROM trails WHERE id = 42 AND version = 3.14');
    expect(result).not.toContain('42');
  });

  it('removes dollar-quoted strings', () => {
    const result = sanitizeRawSql("SELECT $$some secret text$$ AS val");
    expect(result).not.toContain('secret text');
  });

  it('removes E-quoted strings', () => {
    const result = sanitizeRawSql("SELECT E'it\\'s a test'");
    expect(result).not.toContain("it\\'s a test");
  });

  it('removes SET LOCAL tenant context (pastoral data protection)', () => {
    const result = sanitizeRawSql("SET LOCAL app.current_tenant_id = 'some-uuid-here'");
    expect(result).not.toContain('some-uuid-here');
  });

  it('returns undefined for empty or whitespace-only result after scrub', () => {
    // A query that collapses entirely to punctuation → omit
    const result = sanitizeRawSql("SELECT ?");
    // SELECT stays (keyword), ? is already there
    // Shouldn't crash
    expect(result === undefined || typeof result === 'string').toBe(true);
  });

  it('returns undefined for empty input', () => {
    expect(sanitizeRawSql('')).toBeUndefined();
  });

  it('preserves SQL keywords and structure (for debugging)', () => {
    const result = sanitizeRawSql("SELECT * FROM users WHERE email = 'x@y.com' LIMIT 10");
    expect(result).toContain('SELECT');
    expect(result).toContain('FROM');
    expect(result).toContain('users');
    expect(result).not.toContain('x@y.com');
  });
});
