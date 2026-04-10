import { describe, it, expect } from 'vitest';
import { LoginSchema } from '../login';

describe('LoginSchema', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'myPassword123!',
  };

  it('should parse valid input', () => {
    const result = LoginSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });

  it('should reject invalid email', () => {
    const result = LoginSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = LoginSchema.safeParse({ ...validInput, password: '' });
    expect(result.success).toBe(false);
  });

  it('should reject password longer than 64 characters', () => {
    const result = LoginSchema.safeParse({ ...validInput, password: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('should accept password with exactly 1 character', () => {
    const result = LoginSchema.safeParse({ ...validInput, password: 'a' });
    expect(result.success).toBe(true);
  });

  it('should accept password with exactly 64 characters', () => {
    const result = LoginSchema.safeParse({ ...validInput, password: 'a'.repeat(64) });
    expect(result.success).toBe(true);
  });

  it('should reject email longer than 255 characters', () => {
    const result = LoginSchema.safeParse({
      ...validInput,
      email: `${'a'.repeat(250)}@b.com`,
    });
    expect(result.success).toBe(false);
  });

  it('should match schema shape snapshot', () => {
    expect(LoginSchema.shape).toMatchSnapshot();
  });
});
