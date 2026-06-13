import type { UpdateUserProfile } from '@metanoia/types';

/**
 * DTO for PATCH /api/v1/users/me.
 *
 * Validated upstream by ZodValidationPipe(UpdateUserProfileSchema) — Zod
 * strict() schema guarantees anti-mass-assignment (dec-018 MUST). This alias
 * type exists only to give NestJS DI a concrete class name for Swagger and
 * to keep the import path consistent across the users module.
 */
export type UpdateUserProfileDto = UpdateUserProfile;
