import { describe, it, expect } from 'vitest';
import { resolveError } from '../error-messages';
import { ApiError } from '../../api/client';

describe('resolveError', () => {
  it('uses details.errorKey when present', () => {
    const err = new ApiError(403, 'Forbidden', 'irrelevant', {
      errorKey: 'plan.limitReached',
      current: 3,
      max: 3,
      resource: 'grupos',
    });

    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limitReached');
    expect(r.message).toContain('3/3');
    expect(r.message).toContain('grupos');
    expect(r.message).toContain('upgrade');
  });

  it('maps known error names to keys', () => {
    expect(resolveError(new ApiError(403, 'Forbidden', 'no')).errorKey).toBe(
      'permission.denied',
    );
    expect(resolveError(new ApiError(404, 'NotFound', 'no')).errorKey).toBe(
      'notFound.generic',
    );
    expect(
      resolveError(new ApiError(403, 'ConsentRequired', 'no')).errorKey,
    ).toBe('conflict.consentRequired');
  });

  it('produces actionable permission message', () => {
    const r = resolveError(new ApiError(403, 'Forbidden', 'denied'));
    expect(r.message).toMatch(/permissão/i);
    expect(r.message).toMatch(/administrador/i);
  });

  it('produces actionable not-found message', () => {
    const r = resolveError(new ApiError(404, 'NotFound', 'gone'));
    expect(r.message).toMatch(/não encontrado/i);
    expect(r.message).toMatch(/volte ao início/i);
  });

  it('falls back to network for TypeError (fetch failures)', () => {
    const r = resolveError(new TypeError('Failed to fetch'));
    expect(r.errorKey).toBe('network.failed');
    expect(r.message).toMatch(/conexão/i);
  });

  it('falls back to unknown for arbitrary errors', () => {
    const r = resolveError(new Error('something else'));
    expect(r.errorKey).toBe('unknown.generic');
    expect(r.message).toMatch(/imprevisto/i);
  });

  it('falls back to unknown for unmapped ApiError name', () => {
    const r = resolveError(new ApiError(418, 'Teapot', 'rfc 2324'));
    expect(r.errorKey).toBe('unknown.generic');
  });

  it('preserves statusCode in the result', () => {
    const r = resolveError(new ApiError(429, 'TooManyRequests', 'slow down'));
    expect(r.statusCode).toBe(429);
  });

  it('never echoes the raw backend message (no stack/technical leak)', () => {
    const err = new ApiError(500, 'InternalServerError', 'TypeError at line 42');
    const r = resolveError(err);
    expect(r.message).not.toContain('TypeError');
    expect(r.message).not.toContain('line 42');
  });
});
