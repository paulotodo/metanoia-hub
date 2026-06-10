import { z } from 'zod';

/** Response for POST /api/v1/content/.../upload */
export const UploadResponseSchema = z.object({
  lessonId: z.string().uuid(),
  objectKey: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** Response for GET /api/v1/content/signed-url/:lessonId */
export const SignedUrlResponseSchema = z.object({
  lessonId: z.string().uuid(),
  signedUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});
export type SignedUrlResponse = z.infer<typeof SignedUrlResponseSchema>;
