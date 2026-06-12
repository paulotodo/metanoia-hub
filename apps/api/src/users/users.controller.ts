import { Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import type { CurrentUser, OnboardingCompleteResponse } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { UsersService } from './users.service';

@Controller('api/v1/users')
@UseGuards(KeycloakAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users/me
   * Returns the current user's profile including status.
   * AVS-02: useAuth() does not expose user.status — this endpoint provides it.
   * Used by useCurrentUser() hook for the deletion_pending banner.
   */
  @Get('me')
  async getCurrentUser(): Promise<{ data: CurrentUser }> {
    const data = await this.usersService.getCurrentUser();
    return { data };
  }

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
