import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------
export const TemplateScopeSchema = z.enum(['platform', 'tenant']);
export type TemplateScope = z.infer<typeof TemplateScopeSchema>;

// ---------------------------------------------------------------------------
// Lesson structure item (dentro de um módulo no JSONB)
// ---------------------------------------------------------------------------
export const TemplateLessonItemSchema = z.object({
  name: z.string().min(1).max(255),
  contentType: z.enum(['video', 'rich_text', 'pdf_doc', 'external_link']),
  order: z.number().int().min(0),
  estimatedDurationMinutes: z.number().int().min(1).nullable().optional(),
});
export type TemplateLessonItem = z.infer<typeof TemplateLessonItemSchema>;

// ---------------------------------------------------------------------------
// Module structure item (no JSONB)
// ---------------------------------------------------------------------------
export const TemplateModuleItemSchema = z.object({
  name: z.string().min(1).max(255),
  order: z.number().int().min(0),
  lessonAccessMode: z.enum(['sequential', 'free']).default('free'),
  lessons: z.array(TemplateLessonItemSchema),
});
export type TemplateModuleItem = z.infer<typeof TemplateModuleItemSchema>;

// ---------------------------------------------------------------------------
// Structure JSONB root
// ---------------------------------------------------------------------------
export const TemplateStructureSchema = z.object({
  modules: z.array(TemplateModuleItemSchema),
});
export type TemplateStructure = z.infer<typeof TemplateStructureSchema>;

// ---------------------------------------------------------------------------
// ContentTemplate full response
// ---------------------------------------------------------------------------
export const ContentTemplateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  scope: TemplateScopeSchema,
  sourceTrailId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number().int(),
  structure: TemplateStructureSchema,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ContentTemplate = z.infer<typeof ContentTemplateSchema>;

// ---------------------------------------------------------------------------
// TemplateVersionItem (para GET /:id/versions)
// ---------------------------------------------------------------------------
export const TemplateVersionItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});
export type TemplateVersionItem = z.infer<typeof TemplateVersionItemSchema>;

// ---------------------------------------------------------------------------
// Create template request (POST /api/v1/templates)
// ---------------------------------------------------------------------------
export const CreateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(1000).nullable().optional(),
  sourceTrailId: z.string().uuid().optional(),
  structure: TemplateStructureSchema.optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

// ---------------------------------------------------------------------------
// Update template request (PATCH /api/v1/templates/:id)
// ---------------------------------------------------------------------------
export const UpdateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

// ---------------------------------------------------------------------------
// Use template request (para criação de trail com templateId)
// ---------------------------------------------------------------------------
export const UseTemplateRequestSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  groupId: z.string().uuid().optional(),
});
export type UseTemplateRequest = z.infer<typeof UseTemplateRequestSchema>;

// ---------------------------------------------------------------------------
// List query (GET /api/v1/templates)
// ---------------------------------------------------------------------------
export const TemplateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  scope: TemplateScopeSchema.optional(),
  search: z.string().max(255).optional(),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt']).default('name'),
});
export type TemplateListQuery = z.infer<typeof TemplateListQuerySchema>;

// ---------------------------------------------------------------------------
// List response
// ---------------------------------------------------------------------------
export const TemplateListResponseSchema = z.object({
  data: z.array(ContentTemplateSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
});
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;
