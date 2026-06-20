import { describe, it, expect } from 'vitest';
import {
  RiskDetectedEventSchema,
  RiskResolvedEventSchema,
  ParticipantRiskReasonSchema,
} from './evasion-events.schema';

describe('evasion-events schemas — snapshot gate', () => {
  it('RiskDetectedEventSchema shape is stable', () => {
    expect(RiskDetectedEventSchema._def).toMatchSnapshot();
  });
  it('RiskResolvedEventSchema shape is stable', () => {
    expect(RiskResolvedEventSchema._def).toMatchSnapshot();
  });
  it('ParticipantRiskReasonSchema values are stable', () => {
    expect(ParticipantRiskReasonSchema.options).toMatchSnapshot();
  });
});
