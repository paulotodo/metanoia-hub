# Contract: Schemas Zod — packages/types/src/onboarding/csv-import.ts

Contratos compartilhados FE+BE (Princípio IV). Zod 4.x. **Snapshot test
obrigatório** (gate contra breaking change silencioso). Exportar no
`packages/types/src/index.ts`.

> O diretório `packages/types/src/onboarding/` **não existe ainda** — criar.

---

## Schemas

### `csvRowRoleSchema`
```
z.enum(['participante', 'lider'])   // default aplicado fora do enum (FR-09)
```

### `csvRowStatusSchema`
```
z.enum(['critico', 'aviso', 'ok'])  // FR-11
```

### `CSVRowSchema` (linha validada — client-side)
```
z.object({
  nome:     z.string(),
  email:    z.string(),
  telefone: z.string().nullable(),
  papel:    csvRowRoleSchema,          // default 'participante' na transform de parse
  status:   csvRowStatusSchema,
  messages: z.array(z.string()),       // descrições PT-BR (FR-14)
  rowIndex: z.number().int().nonnegative(),
})
```
> `nome`/`email` aqui são strings cruas; a **classificação** (min 2 chars,
> formato e-mail) é responsabilidade do `csv-validator` que preenche `status`
> + `messages`. O schema descreve a forma, não re-valida regra de negócio de
> linha (que precisa produzir `aviso`/`critico`, não rejeitar o parse).

### `CSVValidationResultSchema` (resultado completo do parse+validação)
```
z.object({
  rows:           z.array(CSVRowSchema),
  totalRows:      z.number().int().nonnegative(),
  criticalCount:  z.number().int().nonnegative(),
  warningCount:   z.number().int().nonnegative(),
  okCount:        z.number().int().nonnegative(),
  sampleSize:     z.number().int().nonnegative(),   // ≤ 10 (FR-16)
  canProceed:     z.boolean(),                       // criticalCount === 0 (FR-15)
  encoding:       z.enum(['utf-8', 'iso-8859-1', 'windows-1252']),
  multiSheetWarning: z.boolean(),                    // FR-07
  missingRequiredColumns: z.array(z.string()),       // FR-10
})
```

### `checkEmailsQuerySchema` (request — backend valida)
```
z.object({
  emails: z.string()
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string().email()).min(1).max(500)),   // FR-20
})
```

### `checkEmailsResponseSchema` (response — frontend valida)
```
z.object({
  data: z.object({
    results: z.array(z.object({
      email:  z.string().email(),
      exists: z.boolean(),
    })),
  }),
  meta: z.object({
    checkedCount: z.number().int().nonnegative(),
    tenantScoped: z.literal(true),
  }),
})
```

---

## Tipos exportados (inferidos)

```
export type CSVRow              = z.infer<typeof CSVRowSchema>;
export type CSVValidationResult = z.infer<typeof CSVValidationResultSchema>;
export type CheckEmailsQuery    = z.infer<typeof checkEmailsQuerySchema>;
export type CheckEmailsResponse = z.infer<typeof checkEmailsResponseSchema>;
```

---

## Snapshot test (obrigatório)

`packages/types/src/onboarding/__tests__/csv-import.snapshot.spec.ts`:
- Serializar a forma de cada schema (ex: `z.toJSONSchema` ou parse de fixtures
  representativas) e comparar com snapshot.
- Falha de snapshot = mudança de contrato → exige revisão consciente
  (gate Princípio IV).

---

## Identificação de colunas (FR-08)

Mapa case-insensitive header → campo canônico, aplicado no parser **antes** de
montar `CSVRow`:

| Header reconhecido (case-insensitive) | Campo |
|---------------------------------------|-------|
| `nome`, `name` | `nome` |
| `email`, `e-mail` | `email` |
| `telefone`, `phone`, `celular` | `telefone` |
| `papel`, `role`, `função` | `papel` |

- Colunas obrigatórias ausentes (`nome`, `email`) → `missingRequiredColumns`
  preenchido + erro crítico global (FR-10).
- Colunas extras desconhecidas → ignoradas silenciosamente (edge case).
