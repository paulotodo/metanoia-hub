import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import type { CurrentUser, OnboardingCompleteResponse } from '@metanoia/types';
import { UpdateUserProfileSchema } from '@metanoia/types';
import type { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ScrubPiiInterceptor } from '../common/interceptors/scrub-pii.interceptor';
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
   * PATCH /api/v1/users/me
   *
   * Update authenticated user's display name, photo and role title (Etapa 1).
   * Anti-mass-assignment: ZodValidationPipe(UpdateUserProfileSchema.strict()).
   * userId resolved from AsyncLocalStorage (never from body/param — API5/BFLA).
   *
   * Route is registered BEFORE me/onboarding-complete so NestJS does not
   * accidentally shadow it — prefix 'me' is a shorter prefix than
   * 'me/onboarding-complete'.
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(UpdateUserProfileSchema))
  @UseInterceptors(ScrubPiiInterceptor)
  async updateProfile(@Body() dto: UpdateUserProfileDto) {
    return this.usersService.updateProfile(dto);
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
