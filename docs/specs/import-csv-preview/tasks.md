# Tasks: import-csv-preview (Story 10-3)

**Feature**: `import-csv-preview`
**Epic**: 10 — Onboarding Avançado
**Story**: 10-3
**Status**: Backlog

> Legenda de criticidade:
> - `[C]` Crítico — bloqueia outros tasks ou é gate de CI/PR
> - `[A]` Alto — entrega de valor direta; deve ir na mesma PR
> - `[M]` Médio — qualidade/observabilidade; pode ir junto ou em follow-up imediato

> Legenda de status:
> - `- [ ]` Pendente
> - `- [x]` Concluído
> - `- [~]` Em andamento
> - `- [!]` Bloqueado

---

## FASE 0 — Dependências e Contratos Zod

### 0.1 Adicionar dependências novas ao frontend `[C]`

- [x] Adicionar `papaparse` e `@types/papaparse` ao `apps/web/package.json`
  - Ref: plan.md §Technical Context; checklist RQ-08-G1
  - Fixar versão mínima: `papaparse@5.4.1`
- [x] Adicionar `xlsx` (SheetJS) ao `apps/web/package.json`
  - Fixar versão mínima: `xlsx@0.18.5` (last OSS release)
  - Decisão padrão (API-12): usar `xlsx@0.18.5` (última versão OSS) com `pnpm audit` no CI; avaliar `read-excel-file` como alternativa se audit reprovar
  - **EXECUTADO**: xlsx@0.18.5 rejeitado por audit high (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9, patched: <0.0.0 = sem fix OSS); substituído por `read-excel-file` conforme decisão API-12
  - Ref: checklist API-12; plan.md §Notas de Segurança item 1
- [x] Commitar `pnpm-lock.yaml` atualizado junto ao PR
  - Ref: plan.md §Gotchas CI
- [x] Rodar `pnpm audit` e garantir 0 vulnerabilidades críticas/high nas novas deps
  - Ref: checklist RQ-08-G1; plan.md §Notas de Segurança item 1

### 0.2 Criar schemas Zod compartilhados (packages/types) `[C]`

- [x] Criar diretório `packages/types/src/onboarding/` se não existir
- [x] Criar `packages/types/src/onboarding/csv-import.ts` com:
  - `CSVRowSchema` (nome, email, telefone?, papel?)
  - `CSVValidationStatusSchema` (enum: `critico` | `aviso` | `ok`)
  - `CSVValidationResultSchema` (rows, summary, multiSheetWarning)
  - `checkEmailsQuerySchema` (z.string().transform split + z.array email ≤500)
  - `checkEmailsResponseSchema` (data: array { email, exists })
  - Todos os tipos exportados (re-export em `packages/types/src/index.ts`)
  - Ref: contracts/csv-import.types.md; plan.md §Project Structure
- [x] Editar `packages/types/src/index.ts` para exportar o novo módulo
- [x] Criar `packages/types/src/__tests__/csv-import.snapshot.spec.ts`
  - Snapshot test obrigatório contra breaking change nos schemas Zod
  - 17 testes passando, 13 snapshots gerados
  - Ref: plan.md §Plano de Testes §Gotchas CI; checklist TST-02

---

## FASE 1 — Backend: Endpoint check-emails

### 1.1 Implementar CheckEmailsRateLimitGuard `[A]`

- [ ] Criar `apps/api/src/users/check-emails-rate-limit.guard.ts`
  - Guard in-memory por tenant; janela: 60s; limite: 30 req/min/tenant
  - Decisão padrão (API-08): 30 req/min/tenant (margem para ceil(totalLinhas/500) calls de batching em arquivos ~15.000 linhas)
  - Ref: checklist API-08; contracts/check-emails.api.md §Endpoint
- [ ] Criar `apps/api/src/users/check-emails-rate-limit.guard.spec.ts`
  - Cenários: dentro do limite (passa), ultrapassado (429), tenant isolado (tenant A não afeta tenant B)

### 1.2 Implementar checkEmailsInTenant no UsersService `[C]`

- [ ] Editar `apps/api/src/users/users.service.ts`
  - Método `checkEmailsInTenant(emails: string[]): Promise<{ email: string; exists: boolean }[]>`
  - Usar `withTenantTx` + `prisma.user.findMany({ where: { email: { in: emails } } })`
  - Mapear resultado preservando a ORDEM da entrada — resolver conflito API-10-C1:
    ```typescript
    const found = new Set(dbRows.map(u => u.email));
    return emails.map(email => ({ email, exists: found.has(email) }));
    ```
  - PII em logs: logar apenas `{ checkedCount, tenantId }` — NUNCA a lista de e-mails
  - Ref: checklist API-10-C1 (conflito de ordem); checklist RQ-06-G1; plan.md §Notas de Segurança item 2/3
- [ ] Editar `apps/api/src/users/users.service.spec.ts`
  - Cenário de ordem: `emails = ['b@x.com', 'a@x.com']` → response na MESMA ordem
  - Cenário PII: nenhuma chamada ao logger com lista de e-mails
  - Ref: checklist API-10-C1

### 1.3 Implementar endpoint GET /api/v1/users/check-emails `[C]`

- [ ] Editar `apps/api/src/users/users.controller.ts`
  - `@Get('check-emails')` com guards: `KeycloakAuthGuard`, `RolesGuard`, `CheckEmailsRateLimitGuard`
  - `@Roles(Role.ADMIN_TENANT)` obrigatório
  - `@UsePipes(new ZodValidationPipe(checkEmailsQuerySchema))` na query
  - Resposta: `{ data: [{ email, exists }] }` (padrão §Contratos de API)
  - Ref: contracts/check-emails.api.md §Endpoint
- [ ] Editar `apps/api/src/users/users.controller.spec.ts`
  - Cenários: 200 (batch válido), 400 (>500 e-mails ou e-mail inválido), 401 (sem auth), 403 (role errado), 429 (rate-limit)

### 1.4 Integration spec: tenant-scope e ordem `[A]`

- [ ] Criar `apps/api/src/users/check-emails.integration-spec.ts`
  - Usar `withTenantTx` e dois tenants distintos (fixtures RLS)
  - Assertion tenant-scope: e-mail do tenant A com `exists: true` deve ser `false` para tenant B
  - Assertion de ordem (API-10-C1): input `['b@x.com', 'a@x.com']` → response preserva ordem
  - Timer SC-006: batch de 500 e-mails fixture deve retornar em < 2000ms
  - Ref: checklist API-10-C1; checklist RQ-02-G3; plan.md §Plano de Testes

---

## FASE 2 — Frontend: Utilitários de Parse e Validação

### 2.1 Implementar csv-template.ts `[M]`

- [ ] Criar `apps/web/src/lib/onboarding/csv-template.ts`
  - Função `downloadTemplate()`: gera CSV client-side com colunas `nome,email,telefone,papel`
  - Incluir uma linha de exemplo: `João Silva,joao@exemplo.com,11999990000,participante`
  - Nome do arquivo: `template-importacao-participantes.csv`
  - Sem requisição de rede (FR-04)
  - Decisões padrão (UX-05-G1, UX-05-G2): nome e linha de exemplo conforme acima
  - Ref: checklist UX-05-G1; checklist UX-05-G2; spec.md FR-04

### 2.2 Implementar csv-parser.ts `[C]`

- [ ] Criar `apps/web/src/lib/onboarding/csv-parser.ts`
  - Auto-detect encoding: UTF-8 → ISO-8859-1 → Windows-1252 (BOM + byte scan)
  - Parse CSV via papaparse (colunas por nome, case-insensitive — FR-08)
  - Parse XLSX via `import('xlsx')` dynamic — NÃO carregar no bundle inicial (FR-06)
  - Para XLSX: usar só a 1ª aba; emitir `multiSheetWarning: true` se >1 aba (FR-07)
  - Arquivo vazio (0 linhas de dados) → erro com mensagem "Arquivo sem participantes"
  - Células extras silenciosamente ignoradas; células opcionais ausentes → undefined
  - Ref: spec.md FR-05/06/07/08/09; checklist UX-02-G1
- [ ] Criar `apps/web/src/lib/onboarding/csv-parser.spec.ts`
  - Fixtures: UTF-8, ISO-8859-1, Windows-1252 (nomes: "Natália", "João", "José")
  - XLSX 1 aba; XLSX múltiplas abas (multiSheetWarning: true)
  - CSV sem cabeçalho / colunas fora de ordem (por nome)
  - Arquivo vazio → erro correto
  - Dynamic import xlsx: mock para confirmar que branch CSV não instancia SheetJS
  - Ref: plan.md §Plano de Testes; checklist RQ-02-G2 (bundle)

### 2.3 Implementar csv-validator.ts `[C]`

- [ ] Criar `apps/web/src/lib/onboarding/csv-validator.ts`
  - Classificar cada linha em `critico | aviso | ok`
  - Crítico: email ausente, email inválido (RFC), nome < 2 chars, coluna obrigatória ausente no header
  - Aviso: `papel` com valor não reconhecido (usa default `participante`); `email exists: true` da API
  - Mensagens de erro em PT-BR pastoral (ref: pt-BR.json `import.*`)
  - `canProceed: false` se ≥1 crítico (FR-15)
  - Ref: spec.md FR-11/12/13/14/15; checklist UX-06-G1
- [ ] Criar `apps/web/src/lib/onboarding/csv-validator.spec.ts`
  - Linha crítica (email vazio, email inválido, nome curto)
  - Linha aviso (papel inválido, email exists)
  - Linha ok
  - Coluna obrigatória ausente → crítico de header
  - canProceed: false quando ≥1 crítico

### 2.4 Implementar use-check-emails.ts (TanStack Query hook) `[A]`

- [ ] Criar `apps/web/src/lib/api/hooks/use-check-emails.ts`
  - TanStack Query: `GET /api/v1/users/check-emails`
  - Batching automático: `ceil(totalEmails / 500)` chamadas (FR-20)
  - Falha parcial no batching (API-09-G1): se batch N falha, marcar e-mails do batch N como `exists: false` e emitir `partialCheckWarning: true`; demais batches usam resultados reais
  - Degradação graciosa (FR-21): timeout/5xx → array vazio + `apiUnavailable: true`
  - Validar resposta com `checkEmailsResponseSchema.parse()` (Princípio IV)
  - Ref: spec.md FR-18/19/20/21; checklist API-09-G1; contracts/check-emails.api.md
- [ ] Criar `apps/web/src/lib/api/hooks/__tests__/use-check-emails.spec.ts`
  - Batching ≤500 (1 request)
  - Batching >500 (2 requests, ordem preservada)
  - Falha parcial: batch 2 de 3 falha → batches 1+3 ok, batch 2 = não verificado
  - Degradação graciosa (API down → apiUnavailable: true)
  - Validação de schema (shape incorreta → erro capturado)

---

## FASE 3 — Frontend: Componentes UI

### 3.1 Criar strings i18n PT-BR (import.*) `[C]`

- [ ] Editar `apps/web/messages/pt-BR.json`
  - Keys de upload: `import.dropzone.idle`, `import.dropzone.dragover`, `import.dropzone.accepted`, `import.dropzone.errorSize`, `import.dropzone.errorType`, `import.dropzone.parsing`
  - Keys de erros validação pastoral: `import.error.emailInvalid`, `import.error.emailMissing`, `import.error.nameTooShort`, `import.error.columnMissing`, `import.error.roleInvalid`
  - Keys de avisos: `import.warning.duplicate`, `import.warning.multipleSheets`, `import.warning.apiUnavailable`, `import.warning.partialCheck`
  - Keys de preview: `import.preview.summary`, `import.preview.showing`, `import.preview.empty`, `import.preview.proceed`, `import.preview.blockedByCritical`
  - Keys gerais: `import.template.downloadLabel`, `import.template.filename`
  - Ref: checklist UX-06-G1; spec.md FR-14/24; plan.md §Project Structure

### 3.2 Implementar FileUploadZone `[A]`

- [ ] Criar `apps/web/src/components/onboarding/file-upload-zone.tsx`
  - Estados visuais: idle, drag-over (highlight), accepted (nome+tamanho+ícone), error-size, error-type, parsing (spinner durante parse)
  - Drag & drop + clique no seletor nativo (FR-01)
  - Rejeitar >5MB com mensagem PT-BR (FR-02); rejeitar extensão != .csv/.xlsx (FR-03)
  - Botão "Baixar template" chama `downloadTemplate()` sem requisição de rede (FR-04)
  - Operável por teclado: Tab, Enter/Space abre seletor; labels ARIA (FR-22)
  - Decisão padrão (UX-01-G1): spinner no estado `parsing`
  - Ref: spec.md FR-01/02/03/04/22; checklist UX-01-G1
- [ ] Criar `apps/web/src/components/onboarding/file-upload-zone.spec.tsx`
  - Drag & drop CSV aceito → estado accepted
  - Drag & drop XLSX aceito → estado accepted
  - >5MB → error-size + mensagem PT-BR
  - Extensão inválida → error-type + mensagem PT-BR
  - Click "Baixar template" → download sem fetch de rede
  - Teclado: Tab foca zona, Enter abre seletor
  - Estado parsing → spinner visível
  - **jest-axe**: `expect(await axe(container)).toHaveNoViolations()` em todos os estados
  - Ref: plan.md §Plano de Testes; checklist UX-03; spec.md FR-22

### 3.3 Implementar CSVPreviewTable `[A]`

- [ ] Criar `apps/web/src/components/onboarding/csv-preview-table.tsx`
  - Exibir primeiras 10 linhas (FR-16): colunas Nome, E-mail, Telefone, Papel
  - Status por linha: ícone + `aria-label` textual em PT-BR (FR-23)
  - Resumo: "N linhas lidas — X válidas, Y críticas, Z avisos" (FR-16)
  - "Mostrando 10 de N linhas" quando N > 10 (US2 AC4)
  - Estado arquivo vazio: mensagem em vez de tabela vazia (checklist UX-02-G1)
  - Estado intermediário parse→check-emails: skeleton nas células de status (checklist UX-02-G2)
  - Aviso múltiplas abas: banner não-bloqueante `role="status"` abaixo do resumo (checklist UX-07-G1)
  - Cabeçalhos acessíveis `<th scope="col">` (FR-23)
  - Botão avançar desabilitado se `canProceed: false` + explicação (FR-15)
  - Decisões padrão: UX-02-G2 → skeleton; UX-07-G1 → banner `role="status"`
  - Ref: spec.md FR-15/16/17/23; checklist UX-02-G1/G2; checklist UX-07-G1
- [ ] Criar `apps/web/src/components/onboarding/csv-preview-table.spec.tsx`
  - Tabela 10 linhas com resumo correto
  - Linha crítica: indicador + texto alternativo visíveis
  - Linha aviso: indicador + texto visíveis
  - "Mostrando 10 de N" com N > 10
  - Estado arquivo vazio → mensagem (não tabela)
  - Estado intermediário → skeleton visível
  - Aviso múltiplas abas → banner exibido
  - Botão avançar desabilitado com ≥1 crítico
  - **jest-axe**: sem violações em todos os estados
  - Ref: plan.md §Plano de Testes; spec.md FR-15/16/23

---

## FASE 4 — Frontend: Página e Orquestrador

### 4.1 Criar página Server Component shell `[A]`

- [ ] Criar `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/importar/page.tsx`
  - Server Component: metadata title PT-BR pastoral + `<Suspense>` wrapper
  - Importar `ImportClient` como Client Component
  - Decisão padrão (UX-04-G1): layout scroll único dentro do step do wizard de onboarding (não criar novo step)
  - Ref: plan.md §Project Structure; checklist UX-04-G1

### 4.2 Criar import-client.tsx (orquestrador Client Component) `[A]`

- [ ] Criar `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/importar/import-client.tsx`
  - Estado local: `file | null`, `parseResult | null`, `checkResult | null`
  - Fluxo: arquivo selecionado → `csvParser.parse(file)` → `csvValidator.validate(rows)` → `useCheckEmails(emails)` → atualizar preview
  - Compor `FileUploadZone` + `CSVPreviewTable`
  - Exibir warning `partialCheckWarning` da degradação parcial de batching (API-09-G1)
  - Ref: plan.md §Project Structure; checklist API-09-G1

### 4.3 MSW handler para check-emails `[M]`

- [ ] Criar/editar handler MSW em `apps/web/src/mocks/handlers/`
  - `GET /api/v1/users/check-emails` → resposta mockada com shape correta
  - Validar shape via `checkEmailsResponseSchema`
  - Ref: plan.md §Project Structure; padrão MSW Cenários 01-09

---

## FASE 5 — Testes de Performance e Bundle

### 5.1 Smoke test de latência parse SC-001 `[M]`

- [ ] Criar fixture `apps/web/src/lib/onboarding/__fixtures__/200-linhas.csv` (200 linhas CSV UTF-8)
- [ ] Adicionar timer assertion ao `csv-parser.spec.ts`
  - Parse de 200 linhas deve completar < 3000ms (SC-001)
  - Decisão padrão (RQ-05): automação via timer Vitest
  - Ref: checklist RQ-02-G1; spec.md SC-001

### 5.2 Verificação de bundle size XLSX SC-004 `[M]`

- [ ] Adicionar verificação pós-build:
  - Após `pnpm turbo build`, grep no manifest do Next.js confirma que `xlsx` NÃO está no bundle inicial
  - Script: `grep -r '"xlsx"' apps/web/.next/static/chunks/main*.js` deve retornar vazio
  - Documentar resultado no PR description
  - Ref: checklist RQ-02-G2; spec.md SC-004

### 5.3 Timer 500 e-mails no integration spec SC-006 `[M]`

- [ ] Adicionar fixture de 500 e-mails ao `check-emails.integration-spec.ts`
  - Timer: `Date.now()` antes/depois da chamada; assert resultado < 2000ms
  - Decisão padrão (RQ-05): automação via timer no integration spec
  - Ref: checklist RQ-02-G3; spec.md SC-006

---

## FASE 6 — E2E e Gate Final

### 6.1 E2E Playwright: roundtrip real `[A]`

- [ ] Criar `apps/web/e2e/import-csv-preview.e2e-spec.ts`
  - Upload de CSV fixture → preview exibido → check-emails shape validada vs `checkEmailsResponseSchema`
  - Cenário: arquivo com linha crítica → botão avançar desabilitado
  - Cenário: arquivo com 0 linhas → mensagem "sem participantes"
  - Ref: plan.md §Plano de Testes; quickstart.md

### 6.2 Validação local obrigatória pré-PR `[C]`

- [ ] Rodar `pnpm prisma generate` (sem migration, mas garante client atualizado)
- [ ] Rodar `pnpm turbo build` (zero erros TypeScript)
- [ ] Rodar `pnpm turbo lint -- --max-warnings 0`
- [ ] Rodar `pnpm turbo test` (todos os specs verdes, incluindo snapshot Zod)
- [ ] Rodar `pnpm audit` (0 vulnerabilidades críticas/high)
- [ ] Confirmar `pnpm-lock.yaml` incluso no commit
- [ ] Confirmar bundle check (FASE 5.2) passou
- [ ] Ref: plan.md §Plano de Testes §Validação local

---

## Matriz de Dependências

```
FASE 0.1 (deps) ──────────────────────┐
                                       ▼
FASE 0.2 (schemas Zod) ───────────────┬──────────┐
         │                             │          │
         ▼                             ▼          ▼
FASE 1.1 (guard)               FASE 2.2      FASE 2.4
         │                   (csv-parser)  (hook check)
         ▼                         │            │
FASE 1.2 (service) ──────────────── │            │
         │                         ▼            ▼
         ▼                   FASE 2.3        FASE 3.2
FASE 1.3 (controller)       (csv-validator) (FileUpload)
         │                         │            │
         ▼                         └────────────┘
FASE 1.4 (integration)                   │
                                         ▼
                                   FASE 3.1 (i18n)
                                         │
                                         ▼
                                   FASE 3.3 (CSVPreview)
                                         │
                                         ▼
                                   FASE 4.1 (page)
                                   FASE 4.2 (client)
                                         │
                                         ▼
                              FASE 4.3 (MSW)
                                         │
                                         ▼
                              FASE 5.x (perf/bundle)
                                         │
                                         ▼
                              FASE 6.1 (E2E) → FASE 6.2 (gate)
```

**Nota**: FASE 3.1 (i18n) pode ser desenvolvida junto às FASEs 3.2/3.3 — as keys são necessárias para os testes de componente.

---

## Resumo Quantitativo

| FASE | Tasks | Subtarefas | Criticidade dominante |
|------|-------|-----------|----------------------|
| 0 — Contratos/Deps | 2 | 8 | `[C]` |
| 1 — Backend | 4 | 13 | `[C]`/`[A]` |
| 2 — FE Utilitários | 4 | 16 | `[C]`/`[A]` |
| 3 — FE Componentes | 3 | 14 | `[A]`/`[C]` |
| 4 — FE Página | 3 | 8 | `[A]`/`[M]` |
| 5 — Performance/Bundle | 3 | 6 | `[M]` |
| 6 — E2E/Gate | 2 | 10 | `[A]`/`[C]` |
| **Total** | **21** | **75** | — |

---

## Escopo Coberto

- Upload drag&drop + clique CSV/XLSX ≤5MB (FR-01/02/03)
- Template client-side: nome `template-importacao-participantes.csv` com linha de exemplo (FR-04; UX-05-G1/G2)
- Auto-detect encoding UTF-8/ISO-8859-1/Win-1252 (FR-05)
- XLSX dynamic import — fora do bundle inicial (FR-06/SC-004)
- Múltiplas abas XLSX: banner não-bloqueante abaixo do resumo (FR-07; UX-07-G1)
- Identificação de colunas por nome (FR-08/09/10)
- Validação inline crítico/aviso/ok com mensagens PT-BR pastoral e keys `import.*` em pt-BR.json (FR-11..15; UX-06-G1)
- Preview 10 linhas + resumo + "Mostrando N de M" (FR-16/17)
- check-emails endpoint: 30 req/min/tenant, resposta ordenada por input (FR-18..21; API-08; API-10-C1)
- Ordem de resposta garantida por mapeamento Set no service — resolve conflito API-10-C1
- Batching ≤500 + falha parcial → `partialCheckWarning` (FR-20; API-09-G1)
- Log restrito a contagem/tenantId — sem PII (RQ-06-G1)
- Estado loading/parsing na FileUploadZone (UX-01-G1)
- Estado vazio + estado intermediário na CSVPreviewTable (UX-02-G1/G2)
- Integração wizard Epic 10: scroll único dentro do step existente (UX-04-G1)
- Versões mínimas fixadas + `pnpm audit` no CI (RQ-08-G1; API-12)
- a11y WCAG AA: jest-axe em ambos os componentes (FR-22/23; SC-005)
- Vocabulário pastoral PT-BR (FR-24)
- Smoke test 200 linhas <3s (SC-001/RQ-02-G1); bundle check XLSX (SC-004/RQ-02-G2); timer 500 e-mails <2s (SC-006/RQ-02-G3)
- `pnpm-lock.yaml` commitado no PR

## Escopo Excluído

- Confirmação/processamento real da importação → Story 10-4 (`import-csv-confirm`)
- Persistência de participantes no banco → Story 10-4
- Cross-tenant deduplication → Story 10-4
- Migração de banco de dados (sem migration nesta story)
