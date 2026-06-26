import { describe, it, expect } from 'vitest';
import { validateTraceparent } from '../validate-traceparent';

describe('validateTraceparent', () => {
  const validTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  it('accepts a valid traceparent', () => {
    expect(validateTraceparent(validTraceparent)).toBe(true);
  });

  it('rejects non-string values', () => {
    expect(validateTraceparent(null)).toBe(false);
    expect(validateTraceparent(undefined)).toBe(false);
    expect(validateTraceparent(123)).toBe(false);
    expect(validateTraceparent({})).toBe(false);
  });

  it('rejects traceparent with wrong length traceId', () => {
    expect(validateTraceparent('00-4bf92f3577b34da6-00f067aa0ba902b7-01')).toBe(false);
  });

  it('rejects traceparent with wrong length parentId', () => {
    expect(validateTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa-01')).toBe(false);
  });

  it('rejects traceparent with invalid hex chars', () => {
    expect(validateTraceparent('00-ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ-00f067aa0ba902b7-01')).toBe(false);
    expect(validateTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-ZZZZZZZZZZZZZZZZ-01')).toBe(false);
  });

  it('rejects traceparent with wrong version', () => {
    expect(validateTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBe(false);
    expect(validateTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBe(false);
  });

  it('rejects all-zero traceId (invalid per W3C spec)', () => {
    expect(validateTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBe(false);
  });

  it('rejects all-zero parentId (invalid per W3C spec)', () => {
    expect(validateTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBe(false);
  });

  it('rejects adversarial traceparent (wrong segment count)', () => {
    expect(validateTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7')).toBe(false);
    expect(validateTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateTraceparent('')).toBe(false);
  });
});
