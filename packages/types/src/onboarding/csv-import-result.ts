import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants (declared before schemas to avoid hoisting issues)
// ---------------------------------------------------------------------------

export const IMPORT_SYNC_THRESHOLD = 100;
export const IMPORT_MAX_ROWS = 5000;
export const CSV_IMPORT_QUEUE_NAME = 'csv-import';
export const CSV_IMPORT_JOB_TTL_SECONDS = 86400;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const ImportRowInputSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().optional(),
  papel: z.string().min(1),
  grupo: z.string().optional(),
  rowIndex: z.number().int(),
});
export type ImportRowInput = z.infer<typeof ImportRowInputSchema>;

export const ImportRequestSchema = z.object({
  defaultGroupId: z.string().uuid(),
  rows: z.array(ImportRowInputSchema).min(1).max(IMPORT_MAX_ROWS),
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

// ---------------------------------------------------------------------------
// Result schemas
// ---------------------------------------------------------------------------

export const importActionSchema = z.enum(['created', 'existing', 'invited', 'failed']);
export type ImportAction = z.infer<typeof importActionSchema>;

export const ImportResultLineSchema = z.object({
  rowIndex: z.number().int(),
  email: z.string(),
  nome: z.string(),
  groupName: z.string(),
  action: importActionSchema,
  reason: z.string().optional(),
});
export type ImportResultLine = z.infer<typeof ImportResultLineSchema>;

export const ImportResultSummarySchema = z.object({
  total: z.number().int().min(0),
  imported: z.number().int().min(0),
  existing: z.number().int().min(0),
  invited: z.number().int().min(0),
  failed: z.number().int().min(0),
  lines: z.array(ImportResultLineSchema),
  reportUrl: z.string().url().nullable(),
  jobId: z.string().uuid().nullable(),
});
export type ImportResultSummary = z.infer<typeof ImportResultSummarySchema>;

// ---------------------------------------------------------------------------
// Job status schemas
// ---------------------------------------------------------------------------

export const importJobStatusSchema = z.enum(['processing', 'completed', 'failed']);
export type ImportJobStatusEnum = z.infer<typeof importJobStatusSchema>;

export const ImportJobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: importJobStatusSchema,
  progress: z.number().min(0).max(100),
  result: ImportResultSummarySchema.nullable(),
  failureReason: z.string().nullable(),
});
export type ImportJobStatus = z.infer<typeof ImportJobStatusSchema>;
