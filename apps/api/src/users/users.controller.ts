import { Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import type { OnboardingCompleteResponse } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { UsersService } from './users.service';

@Controller('api/v1/users')
@UseGuards(KeycloakAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * PATCH /api/v1/users/me/onboarding-complete
   * Mark onboarding complete for the authenticated user. Idempotent.
   */
  @Patch('me/onboarding-complete')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(): Promise<{ data: OnboardingCompleteResponse }> {
    const data = await this.usersService.completeOnboarding();
    return { data };
  }

  /**
   * GET /api/v1/users/me/onboarding-status
   * Returns the onboarding_completed_at timestamp (or null) for the FE
   * redirect guard to check on first load.
   */
  @Get('me/onboarding-status')
  async getOnboardingStatus(): Promise<{
    data: { onboardingCompletedAt: string | null };
  }> {
    const data = await this.usersService.getOnboardingStatus();
    return { data };
  }
}
