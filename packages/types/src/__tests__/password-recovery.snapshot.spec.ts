import { describe, it, expect } from 'vitest';
import {
  ForgotPasswordSchema,
  ForgotPasswordResponseSchema,
  ResetTokenValidateResponseSchema,
  ResetPasswordSchema,
  ResetPasswordResponseSchema,
} from '../index';

describe('ForgotPasswordSchema snapshot', () => {
  it('accepts a valid email', () => {
    const result = ForgotPasswordSchema.safeParse({
      email: 'marcos@igreja.com',
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "email": "marcos@igreja.com",
        },
        "success": true,
      }
    `);
  });

  it('rejects invalid email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects empty email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('rejects email exceeding 255 chars', () => {
    const longEmail = `${'a'.repeat(250)}@b.com`;
    expect(ForgotPasswordSchema.safeParse({ email: longEmail }).success).toBe(false);
  });
});

describe('ForgotPasswordResponseSchema snapshot', () => {
  it('freezes the response shape', () => {
    const result = ForgotPasswordResponseSchema.safeParse({
      data: {
        message: 'Se esse email existir na nossa base, você vai receber um link.',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('ResetTokenValidateResponseSchema snapshot', () => {
  it('freezes a valid token response', () => {
    const result = ResetTokenValidateResponseSchema.safeParse({
      data: { valid: true, email: 'm***@i***.com' },
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "data": {
            "email": "m***@i***.com",
            "valid": true,
          },
        },
        "success": true,
      }
    `);
  });

  it('rejects valid: false', () => {
    expect(
      ResetTokenValidateResponseSchema.safeParse({
        data: { valid: false, email: 'x@y.com' },
      }).success,
    ).toBe(false);
  });
});

describe('ResetPasswordSchema snapshot', () => {
  it('accepts matching passwords with valid token', () => {
    const result = ResetPasswordSchema.safeParse({
      token: '019756d0-0001-7000-8000-000000000099',
      newPassword: 'novaSenha123',
      confirmPassword: 'novaSenha123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      token: '019756d0-0001-7000-8000-000000000099',
      newPassword: 'novaSenha123',
      confirmPassword: 'outraSenha456',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = ResetPasswordSchema.safeParse({
      token: '019756d0-0001-7000-8000-000000000099',
      newPassword: 'abc1234',
      confirmPassword: 'abc1234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID token', () => {
    const result = ResetPasswordSchema.safeParse({
      token: 'not-a-uuid',
      newPassword: 'novaSenha123',
      confirmPassword: 'novaSenha123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password exceeding 64 chars', () => {
    const longPass = 'a'.repeat(65);
    const result = ResetPasswordSchema.safeParse({
      token: '019756d0-0001-7000-8000-000000000099',
      newPassword: longPass,
      confirmPassword: longPass,
    });
    expect(result.success).toBe(false);
  });
});

describe('ResetPasswordResponseSchema snapshot', () => {
  it('freezes the response shape (wraps LoginResponse)', () => {
    const result = ResetPasswordResponseSchema.safeParse({
      data: {
        accessToken: 'eyJ...',
        refreshToken: 'eyR...',
        expiresIn: 300,
        sessionId: '019756d0-0001-7000-8000-000000000001',
        user: {
          id: '019756d0-0001-7000-8000-000000000002',
          email: 'marcos@igreja.com',
          name: 'Marcos Silva',
          hasConsent: true,
          tenants: [
            {
              id: '019756d0-0001-7000-8000-000000000003',
              name: 'Igreja Batista Central',
              role: 'leader',
            },
          ],
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
