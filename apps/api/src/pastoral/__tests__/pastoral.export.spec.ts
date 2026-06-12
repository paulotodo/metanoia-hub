import { describe, it, expect, vi } from 'vitest';
import { PastoralService } from '../pastoral.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const ALERT_ID = '01912345-6789-7000-8000-000000000040';
const NOTE_ID = '01912345-6789-7000-8000-000000000041';

function makePrisma(alerts: unknown[], notes: unknown[]) {
  return {
    client: {
      pastoralAlert: { findMany: vi.fn().mockResolvedValue(alerts) },
      pastoralNote: { findMany: vi.fn().mockResolvedValue(notes) },
    },
  };
}

function makeService(prisma: unknown) {
  return new PastoralService(
    {} as never, // repository
    {} as never, // radarStatusRepo
    {} as never, // radarJobService
    {} as never, // alertsService
    prisma as never,
  );
}

describe('PastoralService.exportUserData', () => {
  it('returns alerts and notes with ISO 8601 dates', async () => {
    const alerts = [
      {
        id: ALERT_ID,
        signalType: 'ausencia',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ];
    const notes = [
      {
        id: NOTE_ID,
        noteType: 'observacao',
        occurredAt: new Date('2026-04-02T00:00:00.000Z'),
        content: 'Nota de cuidado pastoral',
      },
    ];

    const prisma = makePrisma(alerts, notes);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.alertsAboutMe).toHaveLength(1);
    expect(result.alertsAboutMe[0].id).toBe(ALERT_ID);
    expect(result.alertsAboutMe[0].signalType).toBe('ausencia');
    expect(result.alertsAboutMe[0].createdAt).toBe('2026-04-01T00:00:00.000Z');

    expect(result.notesAboutMe).toHaveLength(1);
    expect(result.notesAboutMe[0].id).toBe(NOTE_ID);
    expect(result.notesAboutMe[0].noteType).toBe('observacao');
    expect(result.notesAboutMe[0].occurredAt).toBe('2026-04-02T00:00:00.000Z');
    expect(result.notesAboutMe[0].content).toBe('Nota de cuidado pastoral');
  });

  it('uses participantId (not userId) in where clause', async () => {
    const prisma = makePrisma([], []);
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    expect(prisma.client.pastoralAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participantId: USER_ID, tenantId: TENANT_ID },
      }),
    );
    expect(prisma.client.pastoralNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participantId: USER_ID, tenantId: TENANT_ID },
      }),
    );
  });

  it('returns empty arrays when user has no pastoral data', async () => {
    const prisma = makePrisma([], []);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.alertsAboutMe).toHaveLength(0);
    expect(result.notesAboutMe).toHaveLength(0);
  });

  it('does not include PastoralAction (CL-04/dec-021)', async () => {
    const prisma = makePrisma([], []);
    // No pastoralAction query should be made
    (prisma.client as Record<string, unknown>).pastoralAction = { findMany: vi.fn() };
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    const pa = (prisma.client as Record<string, { findMany: ReturnType<typeof vi.fn> }>).pastoralAction;
    expect(pa.findMany).not.toHaveBeenCalled();
  });
});
