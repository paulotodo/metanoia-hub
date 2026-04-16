import { describe, it, expect } from 'vitest';
import {
  DemoRequestInputSchema,
  DemoRequestResponseSchema,
  ContactMessageInputSchema,
  ContactMessageResponseSchema,
  PricingPlanIdSchema,
} from '../index';

describe('DemoRequestInputSchema snapshot', () => {
  it('freezes a valid demo request payload', () => {
    const result = DemoRequestInputSchema.safeParse({
      fullName: 'Júlia Mendes',
      email: 'julia@igrejaexemplo.org',
      churchName: 'Igreja Batista Central',
      churchSize: '50-to-200',
      role: 'Líder de grupo pequeno',
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "churchName": "Igreja Batista Central",
          "churchSize": "50-to-200",
          "email": "julia@igrejaexemplo.org",
          "fullName": "Júlia Mendes",
          "role": "Líder de grupo pequeno",
        },
        "success": true,
      }
    `);
  });

  it('accepts a null role (champion without formal title)', () => {
    const result = DemoRequestInputSchema.safeParse({
      fullName: 'Júlia Mendes',
      email: 'julia@igrejaexemplo.org',
      churchName: 'Igreja Batista Central',
      churchSize: 'up-to-50',
      role: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = DemoRequestInputSchema.safeParse({
      fullName: 'Júlia',
      email: 'not-an-email',
      churchName: 'Igreja',
      churchSize: 'up-to-50',
      role: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown churchSize bucket', () => {
    const result = DemoRequestInputSchema.safeParse({
      fullName: 'Júlia',
      email: 'julia@example.org',
      churchName: 'Igreja',
      churchSize: 'huge',
      role: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty fullName', () => {
    const result = DemoRequestInputSchema.safeParse({
      fullName: '',
      email: 'julia@example.org',
      churchName: 'Igreja',
      churchSize: 'up-to-50',
      role: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('DemoRequestResponseSchema snapshot', () => {
  it('freezes the response shape', () => {
    const result = DemoRequestResponseSchema.safeParse({
      data: {
        demoRequestId: '019756c0-0030-7000-8000-000000000001',
        fullName: 'Júlia Mendes',
        email: 'julia@igrejaexemplo.org',
        churchName: 'Igreja Batista Central',
        churchSize: '50-to-200',
        role: 'Líder de grupo pequeno',
        createdAt: '2026-04-16T18:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('ContactMessageInputSchema snapshot', () => {
  it('freezes a valid contact message payload', () => {
    const result = ContactMessageInputSchema.safeParse({
      fullName: 'Pastor Ricardo',
      email: 'ricardo@igrejaexemplo.org',
      message: 'Gostaria de entender melhor o manifesto pastoral.',
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "email": "ricardo@igrejaexemplo.org",
          "fullName": "Pastor Ricardo",
          "message": "Gostaria de entender melhor o manifesto pastoral.",
        },
        "success": true,
      }
    `);
  });

  it('rejects empty message', () => {
    const result = ContactMessageInputSchema.safeParse({
      fullName: 'Ricardo',
      email: 'ricardo@example.org',
      message: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects message over 2000 chars', () => {
    const result = ContactMessageInputSchema.safeParse({
      fullName: 'Ricardo',
      email: 'ricardo@example.org',
      message: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('ContactMessageResponseSchema snapshot', () => {
  it('freezes the response shape', () => {
    const result = ContactMessageResponseSchema.safeParse({
      data: {
        contactMessageId: '019756c0-0031-7000-8000-000000000001',
        fullName: 'Pastor Ricardo',
        email: 'ricardo@igrejaexemplo.org',
        message: 'Gostaria de entender melhor o manifesto.',
        createdAt: '2026-04-16T18:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('PricingPlanIdSchema snapshot', () => {
  it('accepts the three known plans', () => {
    expect(PricingPlanIdSchema.safeParse('free').success).toBe(true);
    expect(PricingPlanIdSchema.safeParse('pro').success).toBe(true);
    expect(PricingPlanIdSchema.safeParse('enterprise').success).toBe(true);
  });

  it('rejects unknown plans', () => {
    expect(PricingPlanIdSchema.safeParse('premium').success).toBe(false);
    expect(PricingPlanIdSchema.safeParse('').success).toBe(false);
  });
});
