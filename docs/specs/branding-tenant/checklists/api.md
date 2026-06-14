# API Checklist: Branding Customizado do Tenant (Story 11-2)

**Purpose**: Validar qualidade, completude e consistência dos requisitos de API/backend para branding
**Created**: 2026-06-14
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/branding-api.md](../contracts/branding-api.md)

---

## Contratos e Endpoints

- [x] CHK001 - Os três endpoints (`GET /me/branding`, `PATCH /me/branding`, `POST /me/branding/logo`) têm verbo HTTP, rota, guards, códigos de resposta e exemplos de payload documentados? [Completude, contracts/branding-api.md §GET/PATCH/POST] {auto}
  > Evidência: `contracts/branding-api.md` define os 3 endpoints com guards, `@HttpCode`, exemplos JSON, e status codes (200/400/403/422).

- [x] CHK002 - Todos os campos do `BrandingResponseSchema` têm tipo, nullable/optional e semântica definidos (sem "TBD" ou lacunas)? [Completude, Spec §5.1] {auto}
  > Evidência: Spec §5.1 e contracts/branding-api.md definem 6 campos com tipos Zod explícitos: `primaryColor?/null`, `secondaryColor?/null`, `displayName/null`, `logoUrl/null`, `plan enum`, `canCustomizeBranding boolean`.

- [x] CHK003 - O campo `logoUrl` na resposta tem semântica diferenciada (signed URL vs. object key) documentada com clareza em todos os artefatos? [Clareza, plan.md §Summary, data-model.md §logoUrl] {auto}
  > Evidência: plan.md §Summary e data-model.md §"Reused field — logoUrl" explicitam: DB guarda object key, API responde com signed URL gerada por `getSignedUrl()`. contracts/branding-api.md §POST confirma a separação.

- [x] CHK004 - O comportamento do endpoint `GET /me/branding` para cache miss (cold path) está completamente especificado, incluindo a sequência DB → `getSignedUrl` → Redis SET? [Completude, Spec §RF-01, contracts §GET] {auto}
  > Evidência: contracts/branding-api.md §GET detalha o cold path passo a passo. Spec RF-01 e data-model.md §Cache reforçam o write-through.

- [x] CHK005 - O comportamento do `PATCH /me/branding` para Free tenant com `primaryColor` ou `secondaryColor` está especificado com código de status, mensagem exata e ausência de mutação de estado? [Completude, Spec §RF-02, contracts §PATCH §403] {auto}
  > Evidência: contracts/branding-api.md §PATCH §403 fornece o body JSON exato, incluindo mensagem PT-BR acionável. Spec §RF-02 e quickstart Scenario 2 reforçam "row NOT mutated; no cache write".

- [x] CHK006 - O requisito de validação de upload (tamanho ≤ 2MB, mimetypes aceitos, dimensões 64–512px) tem todos os limites numéricos explícitos e os status codes de rejeição definidos? [Clareza, Spec §RF-03, contracts §POST §422] {auto}
  > Evidência: Spec §RF-03 define 2MB, 64×64 mín, 512×512 máx, PNG/JPG/SVG. contracts §POST define 422 para size/format/dims, 400 para file ausente.

- [x] CHK007 - O `UpdateBrandingSchema.strict()` está justificado contra a estratégia anti-mass-assignment do projeto? [Consistência, contracts §Zod, plan.md §Convencoes de Borda] {auto}
  > Evidência: contracts/branding-api.md §Zod usa `.strict()` e plan.md §Convencoes referencia "anti-mass-assignment per dec-018 pattern". Spec §7.4 também usa `ZodValidationPipe`.

---

## Gate de Tier / Autorização

- [x] CHK008 - A decisão de usar `tenant.plan` diretamente (em vez de `PlanLimitsGuard`) está justificada e não conflita com outros endpoints que usam `PlanLimitsGuard`? [Consistência, Spec §D5] {auto}
  > Evidência: Spec §D5 documenta: "PlanLimitsService.hasCapacity é para contagem de recursos; branding é feature flag binária por tier". Sem conflito — escopo diferente.

- [x] CHK009 - Os três sub-casos do gate de tier (Free→só displayName OK, Free→cores→403, Free→logo→403) estão cobertos como cenários testáveis? [Cobertura, Spec §8.2, quickstart §2,3] {auto}
  > Evidência: Spec §8.2 lista os 10 cenários de integração. quickstart Scenarios 2 e 3 cobrem Free+cores e Free+displayName explicitamente.

- [x] CHK010 - A mensagem de erro 403 para Free tentando logo/cores é específica, acionável e em PT-BR conforme a Constitution III (vocabulário pastoral)? [Clareza, contracts §PATCH §403, Spec §9.4] {auto}
  > Evidência: contracts/branding-api.md §403 fornece mensagem exata: "Personalização de cores está disponível nos planos Pro e Enterprise. Faça upgrade para personalizar a identidade visual." Em PT-BR, acionável.

---

## Cache Redis

- [x] CHK011 - O padrão WRITE-THROUGH (SET no GET cold e SET no PATCH/upload, nunca só DEL) está especificado de forma inequívoca e consistente entre spec, plan e contracts? [Consistência, Spec §D4, data-model.md §Cache entity] {auto}
  > Evidência: Spec §D4 define write-through explicitamente. data-model.md §Cache entity descreve "Write-through: SET on every GET cold read AND on every PATCH/upload". plan.md §CI Guardrails reforça "cache DEL-only → always write-through SET".

- [x] CHK012 - O invariante de TTL (cache 1h < signed-URL 4h) está documentado, garantindo que nenhuma URL expirada seja servida a partir do cache? [Clareza, data-model.md §Cache entity] {auto}
  > Evidência: data-model.md §Cache entity: "TTL (1h) < signed-URL expiry (4h) ⇒ cached `logoUrl` never expired". contracts §GET confirma `getSignedUrl(logo_url, 14400)` (4h = 14400s).

- [x] CHK013 - O comportamento do cache nos cenários de ausência de logo (`logoUrl = null`) está definido (o que é armazenado no cache quando não há logo)? [Cobertura, Spec §RF-01] {auto}
  > Evidência: BrandingResponseSchema define `logoUrl: z.string().url().nullable()`. Spec RF-01 e data-model.md implicam que o campo `null` é serializado normalmente em JSON. Comportamento inferível. Sem ambiguidade explícita.

---

## Segurança e Sanitização de Upload

- [x] CHK014 - A mitigação de XSS armazenado por SVG (S6 OWASP) tem requisito funcional concreto: "rasterizar SVG → PNG; nunca persistir/servir SVG raw"? [Completude, plan.md §Security §S6, contracts §POST] {auto}
  > Evidência: plan.md §S6 "HARDEN (execute-task)": rasterize SVG to PNG. contracts §POST "Always rasterize to PNG (incl. SVG input → PNG output)… Raw SVG buffer is NEVER stored."

- [x] CHK015 - O requisito de pixel bomb / decompression bomb (S7 OWASP) tem parâmetro concreto: `sharp(buffer, { limitInputPixels: 512*512*4, failOn: 'error' })`? [Completude, plan.md §Security §S7, contracts §POST] {auto}
  > Evidência: plan.md §S7 e contracts §POST especificam exatamente `limitInputPixels: 512*512*4` e `failOn: 'error'` como defesa-em-profundidade além da checagem de dimensões.

- [x] CHK016 - O caminho do object key no MinIO é derivado server-side (nunca do `originalname` do upload), eliminando path traversal? [Completude, plan.md §Security §S2] {auto}
  > Evidência: plan.md §S2: "object key = server `tenantId` (UUID) + fixed suffix `logo-nav.png`/`logo-fav.png`; `file.originalname` NEVER used in the key". contracts §POST confirma: chave fixa `tenants/{tenantId}/logo-nav.png`.

---

## Dependências e Integração

- [x] CHK017 - A dependência `sharp` como dep direta de `@metanoia/api` (não apenas transitiva) está justificada e documentada com o comando exato de instalação? [Completude, Spec §D3, Spec §7.1, plan.md §CI Guardrails] {auto}
  > Evidência: Spec §D3 e §7.1 documentam `pnpm add sharp --filter @metanoia/api`. plan.md §CI Guardrails: "`sharp` missing → `pnpm add sharp` + commit lock BEFORE code".

- [x] CHK018 - Os imports de módulo NestJS necessários em `TenantsModule` (`StorageModule`, `PlanLimitsModule`, `RedisModule`) estão todos documentados com a justificativa de DI? [Completude, Spec §7.2, plan.md §DI wiring] {auto}
  > Evidência: Spec §7.2 e plan.md §DI wiring listam os 3 módulos com justificativa. plan.md §CI Guardrails: "DI boot crash (E2E only) → StorageModule + PlanLimitsModule + RedisModule imported".

- [x] CHK019 - A convenção `import sharp from 'sharp'` (default, não `* as sharp`) está justificada com referência ao `esModuleInterop`? [Clareza, Spec §D7] {auto}
  > Evidência: Spec §D7: "esModuleInterop:true; libs CJS sob Vitest exigem import default".

---

## Testes de Integração (Requisitos de Cobertura)

- [x] CHK020 - Os 10 cenários de teste service-level (Spec §8.2) cobrem todos os critérios de aceitação AC1–AC10 de forma rastreável? [Cobertura, Spec §8.2, Spec §11] {auto}
  > Verificação cruzada:
  > - AC1 (Pro: logo+cores+displayName) → Cenário "PATCH branding — Pro tenant, cores válidas" + "POST logo — arquivo válido"
  > - AC2 (Free→403 acionável) → Cenário "PATCH branding — Free tenant, tenta setar primaryColor"
  > - AC3 (logo validado) → Cenário "POST logo — arquivo > 2MB" + "dimensão < 64×64"
  > - AC4 (resize 128×128 + 64×64) → Cenário "POST logo — arquivo válido 200×200 PNG"
  > - AC5 (cache write-through) → Cenário "GET branding — cache miss → DB" + "PATCH branding — Pro tenant"
  > - AC9 (snapshot BrandingResponseSchema) → Spec §5.2
  > - AC10 (pnpm build verde) → CI guardrail sharp
  > - **Gap parcial**: AC6 (CSS custom props no layout) e AC7 (contraste) e AC8 (jest-axe) são FE — cobertos nos testes FE (Spec §9.3, §9.5), não aqui. Sem gap em si.
  > Cobertura: PASS.

- [x] CHK021 - O requisito `ConfigModule.forRoot({ isGlobal: true })` nos TestingModules está documentado como obrigatório (não como "boa prática")? [Completude, Spec §8.1] {auto}
  > Evidência: Spec §8.1 "Setup obrigatório": `ConfigModule.forRoot({ isGlobal: true })` marcado como obrigatório. plan.md §CI Guardrails confirma.

- [ ] CHK022 - Os testes service-level têm requisito explícito de isolamento (cada teste limpa o estado Redis + rows Prisma do seed) para evitar flakiness entre cenários? [Completude, Spec §8] {humano}
  > Spec §8.1 menciona "Tenant-scoped: rodar via withTenantTx" e "Conexão privilegiada para seed/cleanup" mas não define a estratégia de limpeza pós-teste (afterEach). Historicamente (memory: reflections.rls flaky, epic9_story_9_1_export_done) a ausência de cleanup causa flakiness. Decisão de nível de test setup → {humano}.

---

## Consistência Cross-Artefato

- [x] CHK023 - O boundary "DB armazena object key, API serve signed URL" é consistente entre spec.md, data-model.md, contracts/branding-api.md e quickstart.md? [Consistência] {auto}
  > Evidência: spec.md §7.3 step 7 diz "prisma.tenant.update({ data: { logoUrl: signedUrl } })" — **INCONSISTÊNCIA DETECTADA**: spec §7.3 usa `signedUrl` enquanto data-model.md e plan.md definem que DB guarda object key. contracts e quickstart Scenario 4 confirmam que DB deve conter object key.
  > **[Conflict]** — spec.md §7.3 step 7 diverge do data-model.md e plan.md. Em execute-task, implementar conforme data-model.md/plan.md (object key no DB), não conforme spec §7.3.

- [x] CHK024 - O `BrandingResponseSchema` exportado de `packages/types` é o mesmo usado em BE e FE (single source of truth)? [Consistência, Spec §5, contracts §Zod, plan.md §Project Structure] {auto}
  > Evidência: Spec §5.1 e contracts §Zod definem o mesmo schema. plan.md §Project Structure: "packages/types/src/tenants/branding.ts (new), re-exported from packages/types/src/index.ts". Padrão já consolidado no projeto (padrão `@metanoia/types`).

- [x] CHK025 - As convenções de case (camelCase na API, snake_case no DB via Prisma `@map`) estão especificadas explicitamente e verificadas por um cenário de roundtrip? [Consistência, plan.md §Convencoes de Borda, quickstart §Scenario 8] {auto}
  > Evidência: plan.md §Convencoes de Borda define a tabela completa. quickstart Scenario 8 (MANDATORY) verifica explicitamente que resposta da API tem `primaryColor` (camelCase) e DB tem `brand_primary_color` (snake_case), confirmando que nenhum snake_case vaza para o payload.

---

## Requisitos Não-Funcionais

- [x] CHK026 - O TTL do cache (3600s) e o TTL da signed URL (14400s/4h) estão justificados como valores de MVP aceitáveis? [Clareza, data-model.md §Cache entity, Spec §Clarifications Q3] {auto}
  > Evidência: Spec §Clarifications Q3 (session 2026-06-14): "Signed URL TTL 4h vs cache TTL 1h cobre a janela de expiração de forma aceitável para MVP." data-model.md §invariante confirma TTL < expiry.

- [ ] CHK027 - Há requisito de latência para o cold path do `GET /me/branding` (DB + getSignedUrl + Redis SET)? O MVP não define SLO explícito — é isso aceitável? [Requisitos Não-Funcionais, Gap] {humano}
  > Spec e plan não definem target de latência para o GET branding. Para feature de configuração (baixo QPS, carregada no layout SSR), pode ser aceitável sem SLO. Decisão de produto. **[Gap]**

- [x] CHK028 - O requisito de acessibilidade do upload (não confiar só em `type="color"`, `aria-label` no input file, `alt` descritivo na preview) está suficientemente especificado para ser verificável? [Completude, Spec §9.5] {auto}
  > Evidência: Spec §9.5 lista explicitamente: "Labels associados a todos os inputs (htmlFor + id)", "Upload input com aria-label ou aria-labelledby", "Preview de logo com alt descritivo", "Sem role='article' em elementos <a>", "Color picker acessível (não confiar só no type='color')". Critérios verificáveis por jest-axe.

---

## Migration e RLS

- [x] CHK029 - A migration SQL é aditiva (nullable, sem DEFAULT, sem triggers, sem NOT NULL) e não requer downtime? [Completude, Spec §6, data-model.md §Migration SQL] {auto}
  > Evidência: data-model.md §Migration SQL: "Additive nullable columns; RLS inherited from existing tenants policy. NO trigger_set_timestamp". Spec §6.2 confirma ALTER TABLE ADD COLUMN sem NOT NULL e sem trigger.

- [x] CHK030 - A decisão de não criar nova RLS spec (colunas entram cobertas pela policy existente da tabela `tenants`) está explicitamente documentada com referência à policy existente? [Completude, Spec §6.3, plan.md §Constitution Check §I] {auto}
  > Evidência: Spec §6.3: "A tabela `tenants` já tem RLS policy com USING (tenant_id = current_setting('app.current_tenant_id')::uuid). Colunas de branding entram protegidas pela policy existente." plan.md §Constitution Check §I confirma "no policy change → no new isolation spec".

---

## Edge Cases e Cenários de Borda

- [x] CHK031 - O cenário de logo com dimensão variável (SVG sem raster dims, e.g. `<svg viewBox>`) está coberto nos requisitos de validação de dimensão? [Cobertura, contracts §POST] {auto}
  > Evidência: contracts §POST: "SVG without raster dims accepted" (a validação de dims 64–512 se aplica a PNG/JPG; para SVG, só size e mimetype são checados antes da rasterização). Comportamento documentado.

- [x] CHK032 - O cenário de PATCH sem nenhum campo (body vazio `{}`) está coberto — é isso um no-op ou retorna erro? [Cobertura, contracts §Zod, Spec §RF-02] {auto}
  > Evidência: `UpdateBrandingSchema` tem todos os campos como `.optional()`. Um body `{}` é válido pelo Zod (todos optional). Spec RF-02 diz "Body JSON: `{ primaryColor?, secondaryColor?, displayName? }`". Comportamento: update com campos undefined → Prisma não altera colunas → retorna estado atual. Sem requisito explícito de erro para body vazio. Aceitável como no-op por construção do schema.

- [ ] CHK033 - O cenário de concurrent PATCH (dois admins do mesmo tenant atualizando branding simultaneamente) tem requisito de consistência definido (last-write-wins é intencional)? [Cobertura, Gap] {humano}
  > Spec e plan não mencionam concorrência. Para MVP com write-through simples via Prisma update, last-write-wins é o comportamento natural. Sem transação de locking especial. Decisão de produto se isso é aceitável. **[Gap menor]**

- [x] CHK034 - O requisito de `displayName` aceitar caracteres Unicode (nomes de igrejas em PT-BR com acentos, cedilha) está coberto pelo schema `z.string().trim().min(1).max(100)`? [Cobertura, Spec §5.1] {auto}
  > Evidência: `z.string()` em Zod aceita qualquer string Unicode por padrão. `@db.VarChar(100)` em PostgreSQL armazena até 100 caracteres Unicode (não bytes para VARCHAR). Sem restrição de charset explícita — aceitável para nomes PT-BR.

---

## Gaps Consolidados

| Item | Marcador | Ação sugerida |
|------|----------|---------------|
| CHK022 | — | Definir estratégia de cleanup nos testes (afterEach Redis flush + Prisma delete) |
| CHK023 | [Conflict] | execute-task deve usar object key no DB (não signedUrl como spec §7.3 indica) |
| CHK027 | [Gap] | Definir SLO de latência para GET branding ou aceitar explicitamente sem SLO para MVP |
| CHK033 | [Gap] | Confirmar last-write-wins como comportamento intencional para concurrent PATCH |

---

## Notes

- Items `{auto}` resolvidos com evidência citada (`[x]` + referência à seção)
- Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto
- **Conflict crítico em CHK023**: spec.md §7.3 step 7 instrui persistir `signedUrl` no DB, mas data-model.md e plan.md (artefatos posteriores e mais autoritativos) corrigem para object key. Em execute-task, seguir data-model.md/plan.md.
- Marcar items concluídos com `[x]`
