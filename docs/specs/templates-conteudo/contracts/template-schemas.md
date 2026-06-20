# Zod Contracts — packages/types/src/content/template.schema.ts

> Contratos compartilhados FE+BE. Snapshot tests obrigatórios (gate breaking-change).
> Padrão de query segue `TrailsListQuerySchema` (`z.coerce.number()`).

```ts
import { z } from 'zod';
import { LessonContentTypeSchema } from './content-type.enum';
import { LessonAccessModeSchema } from './access-mode.enum';

export const TemplateScopeSchema = z.enum(['platform', 'tenant']);
export type TemplateScope = z.infer<typeof TemplateScopeSchema>;

// ---- structure (sem conteúdo) ----
export const TemplateLessonSchema = z.object({
  name: z.string().min(1).max(255),
  order: z.number().int().nonnegative(),
  contentType: LessonContentTypeSchema,
  estimatedDurationMinutes: z.number().int().positive().nullable(),
});
export const TemplateModuleSchema = z.object({
  name: z.string().min(1).max(255),
  order: z.number().int().nonnegative(),
  lessonAccessMode: LessonAccessModeSchema,
  lessons: z.array(TemplateLessonSchema),
});
export const TemplateStructureSchema = z.object({
  modules: z.array(TemplateModuleSchema),
});
export type TemplateStructure = z.infer<typeof TemplateStructureSchema>;

// ---- response ----
export const ContentTemplateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),     // null = platform
  scope: TemplateScopeSchema,
  sourceTrailId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number().int().positive(),
  structure: TemplateStructureSchema,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ContentTemplate = z.infer<typeof ContentTemplateSchema>;

// ---- requests ----
export const CreateTemplateRequestSchema = z.object({
  sourceTrailId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

// ---- list query (segue TrailsListQuerySchema) ----
export const TemplateListQuerySchema = z.object({
  scope: z.enum(['all', 'platform', 'tenant']).optional().default('all'),
  search: z.string().max(255).optional(),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt']).optional().default('-createdAt'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type TemplateListQuery = z.infer<typeof TemplateListQuerySchema>;

// ---- versions ----
export const TemplateVersionItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  name: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});
export type TemplateVersionItem = z.infer<typeof TemplateVersionItemSchema>;
```

## Extensão de CreateTrailRequestSchema (content/trail.schema.ts)

Adicionar (opcionais, retrocompatíveis):
```ts
  templateId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
```

## Re-exports (packages/types/src/index.ts)

Adicionar bloco exportando: `TemplateScopeSchema/Type`, `TemplateStructureSchema/Type`,
`ContentTemplateSchema/Type`, `CreateTemplateRequestSchema/Type`,
`UpdateTemplateRequestSchema/Type`, `TemplateListQuerySchema/Type`,
`TemplateVersionItemSchema/Type` de `./content/template.schema`.
