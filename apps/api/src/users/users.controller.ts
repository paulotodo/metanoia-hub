import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Query, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import type { CurrentUser, OnboardingCompleteResponse } from '@metanoia/types';
import { checkEmailsQuerySchema, UpdateUserProfileSchema } from '@metanoia/types';
import type { CheckEmailsQuery } from '@metanoia/types';
import type { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ScrubPiiInterceptor } from '../common/interceptors/scrub-pii.interceptor';
import { UsersService } from './users.service';
import { CheckEmailsRateLimitGuard } from './check-emails-rate-limit.guard';

@Controller('api/v1/users')
@UseGuards(KeycloakAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users/check-emails
   *
   * Checks which emails in the provided CSV list already exist within the
   * current tenant. Returns a result per email preserving input order.
   *
   * Auth: Keycloak JWT + admin_tenant role required (security dec-009 / API3).
   * Rate-limit: 30 req/min/tenant (API-08) via CheckEmailsRateLimitGuard.
   * Validation: ZodValidationPipe(checkEmailsQuerySchema) — splits CSV, trims,
   *   lowercases, validates emails, enforces ≤ 500 cap (FR-20).
   *
   * IMPORTANT: this route MUST be declared BEFORE 'me' routes so NestJS
   * path-matching does not accidentally shadow 'check-emails' with 'me/:sub'.
   * (The controller-level @UseGuards already wraps all routes in KeycloakAuthGuard.)
   */
  @Get('check-emails')
  @UseGuards(RolesGuard, CheckEmailsRateLimitGuard)
  @Roles(Role.ADMIN_TENANT)
  async checkEmails(
    @Query(new ZodValidationPipe(checkEmailsQuerySchema)) query: CheckEmailsQuery,
  ): Promise<{
    data: { results: { email: string; exists: boolean }[] };
    meta: { checkedCount: number; tenantScoped: true };
  }> {
    const results = await this.usersService.checkEmailsInTenant(query.emails);
    return {
      data: { results },
      meta: { checkedCount: query.emails.length, tenantScoped: true },
    };
  }

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
