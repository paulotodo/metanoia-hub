import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const csvRowRoleSchema = z.enum(['participante', 'lider']);
export type CSVRowRole = z.infer<typeof csvRowRoleSchema>;

export const csvRowStatusSchema = z.enum(['critico', 'aviso', 'ok']);
export type CSVRowStatus = z.infer<typeof csvRowStatusSchema>;

// ---------------------------------------------------------------------------
// CSVRowSchema — linha validada (client-side)
// nome/email são strings cruas; classificação de negócio fica no csv-validator
// ---------------------------------------------------------------------------

export const CSVRowSchema = z.object({
  nome: z.string(),
  email: z.string(),
  telefone: z.string().nullable(),
  papel: csvRowRoleSchema,
  status: csvRowStatusSchema,
  messages: z.array(z.string()),
  rowIndex: z.number().int().nonnegative(),
});
export type CSVRow = z.infer<typeof CSVRowSchema>;

// ---------------------------------------------------------------------------
// CSVValidationResultSchema — resultado completo do parse+validação
// ---------------------------------------------------------------------------

export const CSVValidationResultSchema = z.object({
  rows: z.array(CSVRowSchema),
  totalRows: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  okCount: z.number().int().nonnegative(),
  sampleSize: z.number().int().nonnegative(), // ≤ 10 (FR-16)
  canProceed: z.boolean(), // criticalCount === 0 (FR-15)
  encoding: z.enum(['utf-8', 'iso-8859-1', 'windows-1252']),
  multiSheetWarning: z.boolean(), // FR-07
  missingRequiredColumns: z.array(z.string()), // FR-10
});
export type CSVValidationResult = z.infer<typeof CSVValidationResultSchema>;

// ---------------------------------------------------------------------------
// checkEmailsQuerySchema — validação da query do endpoint GET /users/check-emails
// ---------------------------------------------------------------------------

export const checkEmailsQuerySchema = z.object({
  emails: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().email()).min(1).max(500)), // FR-20
});
export type CheckEmailsQuery = z.infer<typeof checkEmailsQuerySchema>;

// ---------------------------------------------------------------------------
// checkEmailsResponseSchema — validação da resposta (frontend valida)
// ---------------------------------------------------------------------------

export const checkEmailsResponseSchema = z.object({
  data: z.object({
    results: z.array(
      z.object({
        email: z.string().email(),
        exists: z.boolean(),
      }),
    ),
  }),
  meta: z.object({
    checkedCount: z.number().int().nonnegative(),
    tenantScoped: z.literal(true),
  }),
});
export type CheckEmailsResponse = z.infer<typeof checkEmailsResponseSchema>;
