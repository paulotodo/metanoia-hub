import { describe, it, expect } from 'vitest';
import {
  DemoRadarSignalSchema,
  DemoRadarParticipantSchema,
  DemoRadarResponseSchema,
  OnboardingCompleteResponseSchema,
} from '../onboarding';

describe('DemoRadarSignalSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = DemoRadarSignalSchema.safeParse('care-urgent');
    const failureCase = DemoRadarSignalSchema.safeParse('critical');
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "care-urgent",
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('DemoRadarParticipantSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = DemoRadarParticipantSchema.safeParse({
      name: 'Pedro (exemplo)',
      signalType: 'care-urgent',
      contextPhrase: 'Faltou nas últimas 3 reuniões',
    });
    const failureCase = DemoRadarParticipantSchema.safeParse({
      name: 'Pedro',
      signalType: 'unknown',
      contextPhrase: 'x',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "contextPhrase": "Faltou nas últimas 3 reuniões",
          "name": "Pedro (exemplo)",
          "signalType": "care-urgent",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('DemoRadarResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = DemoRadarResponseSchema.safeParse({
      tenantId: '019756c0-0001-7000-8000-000000000001',
      generatedAt: '2026-04-13T12:00:00.000Z',
      isDemo: true,
      groupName: 'Grupo Exemplo — Quinta à noite',
      message:
        'Assim vai ficar quando você tiver seu primeiro grupo com participantes ativos.',
      participants: [
        {
          name: 'Pedro (exemplo)',
          signalType: 'care-urgent',
          contextPhrase: 'Faltou nas últimas 3 reuniões',
        },
        {
          name: 'Ana (exemplo)',
          signalType: 'care-attention',
          contextPhrase: 'Saiu cedo na última reunião',
        },
        {
          name: 'Marcos (exemplo)',
          signalType: 'care-ok',
          contextPhrase: 'Participação estável',
        },
      ],
      signals: ['care-urgent', 'care-attention', 'care-ok'],
    });
    const failureCase = DemoRadarResponseSchema.safeParse({
      tenantId: 'not-a-uuid',
      generatedAt: 'not-a-date',
      isDemo: false,
      groupName: 'x',
      message: 'y',
      participants: [],
      signals: ['unknown'],
    });
    expect({
      success: successCase.success,
      participantCount: successCase.success ? successCase.data.participants.length : 0,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "participantCount": 3,
        "success": true,
      }
    `);
  });
});

describe('OnboardingCompleteResponseSchema snapshot', () => {
  it('accepts valid onboarding-complete response', () => {
    const result = OnboardingCompleteResponseSchema.safeParse({
      userId: '019756c0-0001-7000-8000-000000000001',
      onboardingCompletedAt: '2026-06-10T12:00:00.000Z',
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "onboardingCompletedAt": "2026-06-10T12:00:00.000Z",
          "userId": "019756c0-0001-7000-8000-000000000001",
        },
        "success": true,
      }
    `);
  });

  it('rejects invalid uuid and non-datetime string', () => {
    const result = OnboardingCompleteResponseSchema.safeParse({
      userId: 'not-a-uuid',
      onboardingCompletedAt: 'not-a-datetime',
    });
    expect(result.success).toBe(false);
  });
});
