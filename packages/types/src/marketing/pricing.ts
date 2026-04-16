import { z } from 'zod';

export const PricingPlanIdSchema = z.enum(['free', 'pro', 'enterprise']);
export type PricingPlanId = z.infer<typeof PricingPlanIdSchema>;
