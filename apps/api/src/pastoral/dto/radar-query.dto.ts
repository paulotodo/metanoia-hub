import { z } from 'zod';

export const RadarQuerySchema = z.object({
  groupId: z.string().uuid().optional(),
});

export type RadarQuery = z.infer<typeof RadarQuerySchema>;
