import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeaderSummaryQuerySchema } from '@metanoia/types';

const mockLeaderSummaryResponse = {
  data: {
    groups: [],
    summary: {
      totalGroups: 0,
      totalParticipants: 0,
      overallAttendancePercent: null,
      overallTrailCompletionPercent: 0,
    },
  },
  meta: {
    period: '30d',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
};

const mockReportsService = {
  getLeaderSummary: jest.fn().mockResolvedValue(mockLeaderSummaryResponse),
};

const liderUser: AuthenticatedUser = {
  userId: 'lider-001',
  tenantId: 'tenant-001',
  email: 'lider@test.com',
  roles: [Role.LIDER],
  name: 'Lider',
};

describe('ReportsController.getLeaderSummary', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();
    controller = module.get<ReportsController>(ReportsController);
  });

  it('200 com payload válido (period=30d)', async () => {
    const query = { period: '30d' as const };
    const req = { user: liderUser };

    const result = await controller.getLeaderSummary(query, req);

    expect(mockReportsService.getLeaderSummary).toHaveBeenCalledWith(query, liderUser);
    expect(result).toEqual(mockLeaderSummaryResponse);
  });

  it('ZodValidationPipe rejeita period=custom sem startDate (400)', () => {
    const pipe = new ZodValidationPipe(LeaderSummaryQuerySchema);
    expect(() => pipe.transform({ period: 'custom' }, { type: 'query' })).toThrow();
  });

  it('ZodValidationPipe aceita period=7d', () => {
    const pipe = new ZodValidationPipe(LeaderSummaryQuerySchema);
    const result = pipe.transform({ period: '7d' }, { type: 'query' });
    expect(result).toMatchObject({ period: '7d' });
  });
});
