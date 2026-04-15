import { describe, it, expect } from 'vitest';
import {
  CreateReflectionInputSchema,
  CreateReflectionResponseSchema,
} from '../reflection';

describe('CreateReflectionInputSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = CreateReflectionInputSchema.safeParse({
      text: 'Ana compartilhou pela primeira vez. Acompanhar na proxima semana.',
    });
    const failureCase = CreateReflectionInputSchema.safeParse({
      text: '',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "text": "Ana compartilhou pela primeira vez. Acompanhar na proxima semana.",
        },
        "failure": true,
        "success": true,
      }
    `);
  });

  it('rejects text longer than 280 characters', () => {
    const tooLong = 'x'.repeat(281);
    const result = CreateReflectionInputSchema.safeParse({ text: tooLong });
    expect(result.success).toBe(false);
  });

  it('accepts text of exactly 280 characters', () => {
    const exactly280 = 'x'.repeat(280);
    const result = CreateReflectionInputSchema.safeParse({ text: exactly280 });
    expect(result.success).toBe(true);
  });
});

describe('CreateReflectionResponseSchema snapshot', () => {
  it('freezes success shape', () => {
    const successCase = CreateReflectionResponseSchema.safeParse({
      reflectionId: '019756c0-0003-7000-8000-000000000001',
      recordedAt: '2026-04-16T23:35:00.000Z',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "recordedAt": "2026-04-16T23:35:00.000Z",
          "reflectionId": "019756c0-0003-7000-8000-000000000001",
        },
        "success": true,
      }
    `);
  });
});
