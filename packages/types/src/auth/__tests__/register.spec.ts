import { describe, it, expect } from 'vitest';
import { RegisterUserSchema } from '../register';

describe('RegisterUserSchema', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'securePassword123!',
    name: 'John Doe',
  };

  it('should parse valid input', () => {
    const result = RegisterUserSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });

  it('should reject invalid email', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 12 characters', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, password: 'short' });
    expect(result.success).toBe(false);
  });

  it('should reject password longer than 64 characters', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, password: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('should accept password with exactly 12 characters', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, password: 'a'.repeat(12) });
    expect(result.success).toBe(true);
  });

  it('should accept password with exactly 64 characters', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, password: 'a'.repeat(64) });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('should trim name whitespace', () => {
    const result = RegisterUserSchema.safeParse({ ...validInput, name: '  John Doe  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('John Doe');
    }
  });

  it('should match schema shape snapshot', () => {
    expect(RegisterUserSchema.shape).toMatchSnapshot();
  });
});
