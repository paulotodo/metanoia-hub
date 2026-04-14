import { describe, it, expect } from 'vitest';
import {
  DemoRadarSignalSchema,
  DemoRadarParticipantSchema,
  DemoRadarResponseSchema,
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
      nameKey: 'welcome.demo.card1.name',
      signalType: 'care-urgent',
      contextPhraseKey: 'welcome.demo.card1.signal',
    });
    const failureCase = DemoRadarParticipantSchema.safeParse({
      nameKey: '',
      signalType: 'unknown',
      contextPhraseKey: '',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "contextPhraseKey": "welcome.demo.card1.signal",
          "nameKey": "welcome.demo.card1.name",
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
      groupNameKey: 'welcome.demo.groupName',
      messageKey: 'welcome.demo.message',
      participants: [
        {
          nameKey: 'welcome.demo.card1.name',
          signalType: 'care-ok',
          contextPhraseKey: 'welcome.demo.card1.signal',
        },
        {
          nameKey: 'welcome.demo.card2.name',
          signalType: 'care-attention',
          contextPhraseKey: 'welcome.demo.card2.signal',
        },
        {
          nameKey: 'welcome.demo.card3.name',
          signalType: 'care-urgent',
          contextPhraseKey: 'welcome.demo.card3.signal',
        },
      ],
      signals: ['care-attention', 'care-urgent'],
    });
    const failureCase = DemoRadarResponseSchema.safeParse({
      tenantId: 'not-a-uuid',
      generatedAt: 'not-a-date',
      isDemo: false,
      groupNameKey: '',
      messageKey: '',
      participants: [],
      signals: ['unknown'],
    });
    expect({
      success: successCase.success,
      participantCount: successCase.success
        ? successCase.data.participants.length
        : 0,
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
