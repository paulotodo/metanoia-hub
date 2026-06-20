# Research — Templates de Conteúdo Reutilizáveis (FR42 / Story 13.5)

Sondas empíricas sobre o código real (read-back PRE-DECISÃO, etapa plan). Cada decisão
abaixo está aterrada em arquivo:linha verificados na base atual.

## R1 — Padrão de criação no domínio content (repository + withTenantTx)

**Evidência:** `apps/api/src/content/content.repository.ts:79-94`
```ts
async createTrail(input: CreateTrailInput): Promise<Trail> {
  const { tenantId } = getRequestContext();
  return withTenantTx(this.prisma, (tx) =>
    tx.trail.create({ data: { id: input.id, tenantId, ... } }));
}
```
`apps/api/src/content/content.service.ts:36-48`: `createTrail` lê `ctx = getRequestContext()`
e usa `ctx.userId` como `createdBy`.

**Decisão:** `TemplateRepository` segue o mesmo molde: `getRequestContext()` para
`tenantId`/`userId`, todas as ops em `withTenantTx`. Materialização reusa esse caminho —
um único `withTenantTx` cria Trail+Modules+Lessons.

## R2 — RLS platform (tenant_id NULL) — padrão canônico já em produção

**Evidência:** migration `20260625000000_13-2b-add-mv-tenant-report` (`mv_refresh_log`):
```sql
CREATE POLICY tenant_isolation ON mv_refresh_log
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```
Também `20260510210000_consolidate_rls_nullif`. Padrão "closed-by-default" (`NULLIF(...,'')`
evita erro quando o setting é vazio) é o vocabulário RLS do projeto.

**Decisão:** `content_templates` usa exatamente essa policy (FR-03). Sem variação. O
`true` no 2º arg de `current_setting` evita exceção quando o GUC não está definido.

## R3 — Models Trail / Module / Lesson exatos (campos a espelhar e a NULAR)

**Evidência:** `schema.prisma`:
- `Trail` (615): `version Int?` é o campo de **publicação** (Story 8-6), NÃO o de template.
  Tem `accessMode TrailAccessMode @default(free)`, `createdBy`, soft-delete `deletedAt`.
- `Module` (680): `order Int`, `lessonAccessMode LessonAccessMode @default(free)`.
- `Lesson` (720): `contentType LessonContentType`, `order Int`,
  `estimatedDurationMinutes Int?`, e os campos de **conteúdo** a NULAR:
  `contentUrl`, `contentBody`, `tags String[] @default([])`, `originalName`, `mimeType`,
  `sizeBytes BigInt?`, `uploadedBy`, `uploadedAt`.

**Decisão:** `structure` JSONB captura apenas: módulo `{ name, order, lessonAccessMode }`,
lição `{ name, order, contentType, estimatedDurationMinutes }`. Materialização cria
lições com TODOS os campos de conteúdo NULL. `sizeBytes` BigInt nunca aparece (evita
problema de serialização JSON de BigInt).

## R4 — CreateTrailRequestSchema e split de schemas em packages/types

**Evidência:** o diretório `packages/types/src/content/` é split por arquivo
(`trail.schema.ts`, `module.schema.ts`, `lesson.schema.ts`, ...). `CreateTrailRequestSchema`
e `TrailsListQuerySchema` vivem em `content/trail.schema.ts:56-61`:
```ts
export const TrailsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  status: TrailStatusSchema.optional(),
});
```
Re-exportados em `index.ts:740-754`.

**Decisão:** novo `content/template.schema.ts`; `TemplateListQuerySchema` segue o padrão
`z.coerce.number()` para page/pageSize. Estender `CreateTrailRequestSchema` (mesmo arquivo)
com `templateId?` e `groupId?` opcionais. Re-export em `index.ts`. Snapshot tests novos.

## R5 — Controller / Guards / ZodValidationPipe

**Evidência:** `content.controller.ts`:
```ts
@Controller('api/v1/trails')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
...
  @Post() @HttpCode(HttpStatus.CREATED) @Roles(Role.ADMIN_TENANT)
  async createTrail(@Body(new ZodValidationPipe(CreateTrailRequestSchema)) body) { ... }
```
`KeycloakAuthGuard` em `../auth/keycloak.guard`. `@Roles` por-rota sobrepõe o de classe.

**Decisão:** novo `TemplateController` com `@Roles(Role.ADMIN_TENANT)` no nível da classe
(sem LIDER), `KeycloakAuthGuard + RolesGuard`, `ZodValidationPipe` por endpoint,
`ParseUUIDPipe` em params `:id`. POST→201, DELETE→204.

## R6 — Seed idempotente

**Evidência:** `apps/api/prisma/seeds/subscription-plans-seed.ts` usa `PrismaClient` +
`PrismaPg` adapter + `uuidv7()`, upsert por chave natural (`tier`), "safe to run multiple
times". Diretório `prisma/seeds/` já tem `group-trails-seed.ts`, `demo-seed.ts`.

**Decisão:** `content-templates-seed.ts` no mesmo padrão. Idempotência por upsert. Para
platform (`tenant_id NULL`) o seed roda fora do RequestContext → usar client cru com a
policy aceitando `IS NULL` (ou `SET LOCAL` não necessário pois NULL passa a policy).
**Sondar no execute-task:** se o adapter/RLS exige um GUC mesmo para NULL — a policy A2
aceita `tenant_id IS NULL` independente do GUC, então o insert de platform passa.

## R7 — Padrão de RLS spec idempotente

**Evidência:** `apps/api/test/rls/group-trails.rls-spec.ts` usa `TENANT_A_ID/TENANT_B_ID`
de `rls-test.helper`, `SET LOCAL app.current_tenant_id` por transação, `ON CONFLICT DO
NOTHING` para fixtures. Diretório `test/rls/` tem ~10 specs (audit-events, consent-records,
group-trails, demo-seed, ...).

**Decisão:** `content-templates.rls-spec.ts` segue o helper. Casos: (a) seed platform NULL
lido por A e B; (b) template de A invisível a B; (c) re-run idempotente. Roda 2× no CI.

## R8 — Migration timestamp

**Evidência:** último migration em árvore: `20260627000000_13-4-add-mv-platform-metrics`.
**Decisão:** `20260628000000_13-5-content-templates` (≥ 20260628, FR-18, sem regressão).

## Itens residuais (resolver no execute-task, não bloqueantes)

- Enum `template_scope`: confirmar se Prisma gera tipo PG nativo (como `LessonContentType`)
  ou se o projeto prefere VARCHAR+CHECK. Seguir a convenção dominante do schema.
- Relação inversa `Trail.contentTemplates`: incluir só se algum query precisar navegar
  trail→templates; FK `SET NULL` não exige a relação inversa declarada.
- `updated_at`: a spec lista só `created_at` para `content_templates`. Se PATCH precisar
  refletir mudança, avaliar adicionar `updated_at` — decisão de data-model (ver lição 13-2b
  sobre seeds raw em tabelas com `@updatedAt`).
