import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DemoRadarResponse } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { getRequestContext } from '../common/context/request-context';

/**
 * OnboardingController — aggregator for the admin onboarding flow. Currently
 * serves a deterministic demo radar payload so the last onboarding step can
 * render a realistic Pastoral Radar preview before any real data exists.
 */
@Controller('api/v1/onboarding')
@UseGuards(KeycloakAuthGuard)
export class OnboardingController {
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
}
