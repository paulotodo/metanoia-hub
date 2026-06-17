import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsProcessor } from './reports.processor';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../bullmq/bullmq.service', () => ({
  BullMqService: vi.fn().mockImplementation(() => ({ createWorker: vi.fn() })),
}));

vi.mock('./reports.service', () => ({
  ReportsService: vi.fn().mockImplementation(() => ({
    processExportJob: vi.fn().mockResolvedValue(undefined),
    processMeetingExportJob: vi.fn().mockResolvedValue(undefined),
  })),
}));

function buildMocks() {
  const processExportJob = vi.fn().mockResolvedValue(undefined);
  const processMeetingExportJob = vi.fn().mockResolvedValue(undefined);
  const reportsService = { processExportJob, processMeetingExportJob } as never;

  let workerCallback: (job: unknown) => Promise<void>;
  const createWorker = vi.fn((_queue: string, cb: typeof workerCallback) => {
    workerCallback = cb;
  });
  const bullMqService = { createWorker } as never;

  const processor = new ReportsProcessor(bullMqService, reportsService);
  processor.onModuleInit();

  return { processor, workerCallback: workerCallback!, processExportJob, processMeetingExportJob };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportsProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes export-trail-csv jobs to processExportJob', async () => {
    const { workerCallback, processExportJob } = buildMocks();
    const job = {
      id: 'job-1',
      name: 'export-trail-csv',
      data: {
        kind: 'trail',
        jobId: 'job-1',
        tenantId: 'tenant-a',
        trailId: 'trail-x',
        trailName: 'Discipleship Trail',
        requestedBy: 'user-1',
        userIds: ['u1', 'u2'],
      },
    };

    await workerCallback(job);

    expect(processExportJob).toHaveBeenCalledWith(job.data);
  });

  it('routes export-meeting-csv jobs to processMeetingExportJob (FR63)', async () => {
    const { workerCallback, processMeetingExportJob } = buildMocks();
    const job = {
      id: 'job-2',
      name: 'export-meeting-csv',
      data: {
        kind: 'meeting',
        jobId: 'job-2',
        tenantId: 'tenant-b',
        meetingId: 'meeting-1',
        requesterUserId: 'leader-1',
        canSeeFull: true,
      },
    };

    await workerCallback(job);

    expect(processMeetingExportJob).toHaveBeenCalledWith(job.data);
  });

  it('does not call processExportJob for meeting jobs (no cross-routing)', async () => {
    const { workerCallback, processExportJob } = buildMocks();
    const job = {
      id: 'job-3',
      name: 'export-meeting-csv',
      data: { kind: 'meeting', jobId: 'job-3', tenantId: 't', meetingId: 'm', requesterUserId: 'u', canSeeFull: true },
    };

    await workerCallback(job);

    expect(processExportJob).not.toHaveBeenCalled();
  });

  it('does not call processMeetingExportJob for trail jobs (no cross-routing)', async () => {
    const { workerCallback, processMeetingExportJob } = buildMocks();
    const job = {
      id: 'job-4',
      name: 'export-trail-csv',
      data: { kind: 'trail', jobId: 'job-4', tenantId: 't', trailId: 'tr', trailName: 'T', requestedBy: 'u', userIds: [] },
    };

    await workerCallback(job);

    expect(processMeetingExportJob).not.toHaveBeenCalled();
  });

  it('ignores unknown job names gracefully', async () => {
    const { workerCallback, processExportJob, processMeetingExportJob } = buildMocks();
    const job = { id: 'job-5', name: 'unknown-job', data: {} };

    await expect(workerCallback(job)).resolves.not.toThrow();
    expect(processExportJob).not.toHaveBeenCalled();
    expect(processMeetingExportJob).not.toHaveBeenCalled();
  });
});
