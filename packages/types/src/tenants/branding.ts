import { z } from 'zod';
import { TenantPlanSchema } from '../super-admin-tenant';

// ---------------------------------------------------------------------------
// Branding — Zod contracts for Story 11-2 (Branding Customizado do Tenant)
//
// Rules:
//   - logo_url in DB stores object key (NOT signed URL) — CHK023
//   - UpdateBrandingSchema.strict() prevents mass-assignment
//   - BrandingResponseSchema.logoUrl is string|null (never undefined)
// ---------------------------------------------------------------------------

/** Matches a CSS hex color: #RGB, #RRGGBB, or #RRGGBBAA (3, 6, or 8 hex chars after #). */
export const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/** A single brand hex color value (max 9 chars including the # prefix). */
export const BrandingColorSchema = z
  .string()
  .max(9)
  .regex(HEX_COLOR_REGEX, 'invalid_hex_color');
export type BrandingColor = z.infer<typeof BrandingColorSchema>;

/**
 * PATCH /api/v1/tenants/me/branding body.
 * .strict() — rejects unknown keys (anti-mass-assignment, dec-018).
 */
export const UpdateBrandingSchema = z
  .object({
    primaryColor: BrandingColorSchema.optional(),
    secondaryColor: BrandingColorSchema.optional(),
    displayName: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>;

/**
 * Response shape for GET and PATCH /api/v1/tenants/me/branding.
 * logoUrl is string | null — never undefined (Constitution II).
 */
export const BrandingResponseSchema = z.object({
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
  displayName: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  plan: TenantPlanSchema,
  canCustomizeBranding: z.boolean(),
});
export type BrandingResponse = z.infer<typeof BrandingResponseSchema>;
