/**
 * Snapshot tests for the discriminated union ReportExportJobPayload.
 * Verifies that both `kind:'trail'` and `kind:'meeting'` shapes are stable
 * and that the union discriminates correctly (CHK035).
 */
import { describe, it, expect } from 'vitest';

// ReportExportJobPayload is a plain TypeScript type (not a Zod schema),
// so we test shape via object assignment compatibility.
import type { ReportExportJobPayload } from '../reports';

describe("ReportExportJobPayload — discriminated union", () => {
  it("kind:'trail' fixture matches expected shape", () => {
    const trailPayload: ReportExportJobPayload = {
      kind: 'trail',
      jobId: '019756c0-0001-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      trailId: '019756c0-0003-7000-8000-000000000bbb',
      trailName: 'Discipulado Básico',
      requestedBy: '019756c0-0004-7000-8000-000000000ccc',
      userIds: ['019756c0-0005-7000-8000-000000000ddd'],
    };
    expect(trailPayload.kind).toBe('trail');
    expect(trailPayload).toMatchSnapshot();
  });

  it("kind:'meeting' fixture matches expected shape", () => {
    const meetingPayload: ReportExportJobPayload = {
      kind: 'meeting',
      jobId: '019756c0-0001-7000-8000-000000000002',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      meetingId: '019756c0-0006-7000-8000-000000000eee',
      requesterUserId: '019756c0-0004-7000-8000-000000000ccc',
      canSeeFull: true,
    };
    expect(meetingPayload.kind).toBe('meeting');
    expect(meetingPayload).toMatchSnapshot();
  });

  it("trail payload has no meetingId field (type-level check via omit)", () => {
    const trailPayload: ReportExportJobPayload = {
      kind: 'trail',
      jobId: '019756c0-0001-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      trailId: '019756c0-0003-7000-8000-000000000bbb',
      trailName: 'Discipulado',
      requestedBy: '019756c0-0004-7000-8000-000000000ccc',
      userIds: [],
    };
    // Runtime check: 'meetingId' is not a key on trail variant
    expect('meetingId' in trailPayload).toBe(false);
  });

  it("meeting payload has no trailId field (type-level check via omit)", () => {
    const meetingPayload: ReportExportJobPayload = {
      kind: 'meeting',
      jobId: '019756c0-0001-7000-8000-000000000002',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      meetingId: '019756c0-0006-7000-8000-000000000eee',
      requesterUserId: '019756c0-0004-7000-8000-000000000ccc',
      canSeeFull: false,
    };
    expect('trailId' in meetingPayload).toBe(false);
  });

  it("discriminates kind with switch", () => {
    const payload: ReportExportJobPayload = {
      kind: 'trail',
      jobId: '01',
      tenantId: 'ten',
      trailId: 'tr',
      trailName: 'T',
      requestedBy: 'u',
      userIds: [],
    };
    let discriminated: string | undefined;
    switch (payload.kind) {
      case 'trail':
        discriminated = 'trail-branch';
        break;
      case 'meeting':
        discriminated = 'meeting-branch';
        break;
    }
    expect(discriminated).toBe('trail-branch');
  });
});
