import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ReportsController } from './reports.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

/**
 * Regression: the "Relatórios → Trilhas" screen is exposed to leaders in the
 * web navigation, and the per-trail report/export/job endpoints already allow
 * LIDER. The trails summary endpoint must therefore allow LIDER too — otherwise
 * leaders hit a 403 the moment they open the screen.
 */
describe('ReportsController — trails summary roles', () => {
  const reflector = new Reflector();

  it('getTrailsSummary allows ADMIN_TENANT and LIDER', () => {
    const roles = reflector.get<(Role | string)[]>(
      ROLES_KEY,
      ReportsController.prototype.getTrailsSummary,
    );

    expect(roles).toContain(Role.ADMIN_TENANT);
    expect(roles).toContain(Role.LIDER);
  });

  it('stays consistent with the per-trail report endpoint roles', () => {
    const summaryRoles = reflector.get<(Role | string)[]>(
      ROLES_KEY,
      ReportsController.prototype.getTrailsSummary,
    );
    const reportRoles = reflector.get<(Role | string)[]>(
      ROLES_KEY,
      ReportsController.prototype.getTrailReport,
    );

    // Both expose the same trails universe to leaders.
    expect([...summaryRoles].sort()).toEqual([...reportRoles].sort());
  });
});
