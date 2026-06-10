import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { RadarDashboardService } from './radar-dashboard.service';

/**
 * GET /api/v1/radar/dashboard
 *
 * Accessible to admin_tenant AND lider.
 * Server-side privacy guardrail (Story 6-6 AC#2):
 *   - admin_tenant: sees ALL groups in the tenant
 *   - lider: sees ONLY groups where userId is 'lider' in group_members
 *
 * Role distinction resolved server-side from request.user.roles (Keycloak
 * realm_roles claim). Never relies on client-supplied data.
 */
@Controller('api/v1/radar/dashboard')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class RadarDashboardController {
  constructor(private readonly service: RadarDashboardService) {}

  @Get()
  async getDashboard(
    @Req() req: Request & { user?: AuthenticatedUser },
  ) {
    const roles = req.user?.roles ?? [];
    // Lider gets filtered view; admin_tenant and super_admin get full view
    const isLider =
      roles.includes(Role.LIDER) &&
      !roles.includes(Role.ADMIN_TENANT) &&
      !roles.includes(Role.SUPER_ADMIN);

    return this.service.getDashboard(isLider);
  }
}
