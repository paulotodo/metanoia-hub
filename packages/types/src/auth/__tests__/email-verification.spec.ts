import { describe, it, expect } from 'vitest';
import {
  VerifyEmailSchema,
  ResendVerificationSchema,
} from '../email-verification';

describe('VerifyEmailSchema', () => {
  it('should parse a non-empty token', () => {
    const result = VerifyEmailSchema.safeParse({ token: 'abc-123' });
    expect(result.success).toBe(true);
  });

  it('should reject an empty token', () => {
    const result = VerifyEmailSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('should match schema shape snapshot', () => {
    expect(VerifyEmailSchema.shape).toMatchSnapshot();
  });
});

describe('ResendVerificationSchema', () => {
  it('should parse a valid email', () => {
    const result = ResendVerificationSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject an invalid email', () => {
    const result = ResendVerificationSchema.safeParse({ email: 'nope' });
    expect(result.success).toBe(false);
  });

  it('should match schema shape snapshot', () => {
    expect(ResendVerificationSchema.shape).toMatchSnapshot();
  });
});
