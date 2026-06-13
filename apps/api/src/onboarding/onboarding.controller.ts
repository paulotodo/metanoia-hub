import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import type { DemoRadarResponse } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { getRequestContext } from '../common/context/request-context';
import { DemoDataService } from './demo-data.service';
import type { DemoStatusResult } from './demo-data.service';

/**
 * OnboardingController — aggregator for the admin onboarding flow.
 *
 * Endpoints:
 *   GET  /api/v1/onboarding/demo-radar       — deterministic demo radar preview
 *   DELETE /api/v1/onboarding/demo-data      — delete all isDemoData=true rows (204)
 *   GET    /api/v1/onboarding/demo-status    — hasDemoData / hasRealData / nudgeDismissed
 *   PATCH  /api/v1/onboarding/demo-nudge-dismiss — persist nudge dismissal (204)
 */
@Controller('api/v1/onboarding')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly demoDataService: DemoDataService) {}

  @Get('demo-radar')
  async demoRadar(): Promise<{ data: DemoRadarResponse }> {
    const { tenantId } = getRequestContext();

    const data: DemoRadarResponse = {
      tenantId,
      generatedAt: new Date().toISOString(),
      isDemo: true,
      groupName: 'Grupo de Demonstração',
      message:
        'Este é um radar de exemplo para você conhecer o cuidado pastoral em ação. Assim que seu grupo começar, você verá os sinais reais aqui.',
      participants: [
        {
          name: 'Ana Costa',
          signalType: 'care-ok',
          contextPhrase: 'Presente nos últimos 4 encontros. Tudo em paz.',
        },
        {
          name: 'Pedro Almeida',
          signalType: 'care-attention',
          contextPhrase: 'Faltou no último encontro — vale uma mensagem.',
        },
        {
          name: 'Mariana Santos',
          signalType: 'care-urgent',
          contextPhrase: 'Ausente há 3 encontros. Pode precisar de cuidado.',
        },
      ],
      signals: ['care-attention', 'care-urgent'],
    };

    return { data };
  }

  /**
   * DELETE /api/v1/onboarding/demo-data
   *
   * Deletes all rows flagged isDemoData=true for the current tenant.
   * Transactional (withTenantTx inside DemoDataService.deleteDemoData).
   * Idempotent — returns 204 even if there are no demo records.
   * Scoped to the tenant from RequestContext (AsyncLocalStorage) — SEC003.
   */
  @Delete('demo-data')
  @Roles(Role.ADMIN_TENANT)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDemoData(): Promise<void> {
    const { tenantId } = getRequestContext();
    await this.demoDataService.deleteDemoData(tenantId);
  }

  /**
   * GET /api/v1/onboarding/demo-status
   *
   * Returns demo presence status for the current tenant:
   *   hasDemoData, hasRealData, demoRecordCount, nudgeDismissed.
   */
  @Get('demo-status')
  @Roles(Role.ADMIN_TENANT)
  async getDemoStatus(): Promise<{ data: DemoStatusResult }> {
    const { tenantId } = getRequestContext();
    const result = await this.demoDataService.getDemoStatus(tenantId);
    return { data: result };
  }

  /**
   * PATCH /api/v1/onboarding/demo-nudge-dismiss
   *
   * Persists demoDismissedAt in Tenant.metadata — the nudge will not
   * show again for this tenant. Idempotent (overwrites with newer timestamp).
   */
  @Patch('demo-nudge-dismiss')
  @Roles(Role.ADMIN_TENANT)
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismissDemoNudge(): Promise<void> {
    const { tenantId } = getRequestContext();
    await this.demoDataService.dismissNudge(tenantId);
  }
}
