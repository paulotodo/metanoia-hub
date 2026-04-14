import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DemoRadarResponse } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { getRequestContext } from '../common/context/request-context';

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
    };

    return { data };
  }
}
