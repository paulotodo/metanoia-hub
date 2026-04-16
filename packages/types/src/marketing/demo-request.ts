import { z } from 'zod';

export const ChurchSizeSchema = z.enum([
  'up-to-50',
  '50-to-200',
  '200-to-1000',
  'over-1000',
]);
export type ChurchSize = z.infer<typeof ChurchSizeSchema>;

export const DemoRequestInputSchema = z.object({
  fullName: z.string().min(1).max(120).trim(),
  email: z.string().email().max(255),
  churchName: z.string().min(1).max(160).trim(),
  churchSize: ChurchSizeSchema,
  role: z.string().min(1).max(120).trim().nullable(),
});
export type DemoRequestInput = z.infer<typeof DemoRequestInputSchema>;

export const DemoRequestRecordSchema = DemoRequestInputSchema.extend({
  demoRequestId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type DemoRequestRecord = z.infer<typeof DemoRequestRecordSchema>;

export const DemoRequestResponseSchema = z.object({
  data: DemoRequestRecordSchema,
});
export type DemoRequestResponse = z.infer<typeof DemoRequestResponseSchema>;
