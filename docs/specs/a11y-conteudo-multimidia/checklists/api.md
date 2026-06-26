# API Checklist: a11y-conteudo-multimidia (Story 15.5)

**Purpose**: Valida a qualidade dos requisitos da API — contratos, autenticação/autorização, error handling, paginação, observabilidade e convenções do projeto para o endpoint `GET /api/v1/admin/accessibility-gaps` e integração com `ContentService`.
**Created**: 2026-06-25
**Feature**: [spec.md](../spec.md)

---

## Contrato e Formato de Resposta

- [x] CHK101 - O formato de resposta 200 está especificado com tipos concretos (`data[]` + `meta` com `total`, `page`, `pageSize`)? [Completude, Spec §FR-015, CA-004.1] {auto}
  > Evidência: CA-004.1 "retorna 200 com `{ data: [...], meta: { total, page, pageSize } }` para role `ADMIN_TENANT`"; FR-015 "Resposta do endpoint: `{ data: LessonAccessibilityGap[], meta: { total, page, pageSize } }`".

- [x] CHK102 - Os campos de `LessonAccessibilityGap` estão especificados com tipos concretos? [Completude, Spec §FR-015] {auto}
  > Evidência: FR-015 e Spec §2 Frente C: "`LessonAccessibilityGap`: `{ lessonId, lessonName, moduleName, trailName, tenantId }`". Plan §3.1.3 tem schema Zod com tipos.

- [x] CHK103 - Está definido que `contentBody` (campo sensível) é excluído da resposta do endpoint? [Completude, Spec §Plan §4.2] {auto}
  > Evidência: Plan §4.2 OWASP A02 "Resposta inclui apenas `lessonId`, nomes e `tenantId` (não `contentBody`)".

- [ ] CHK104 - Está especificado o comportamento quando não há aulas com `has_missing_alt_text=true` — retorna `{ data: [], meta: { total: 0, page: 1, pageSize: 20 } }` ou 404? [Clareza, Spec §CA-004.4, Ambiguity] {auto}
  > [Ambiguity]: CA-004.4 menciona "exibe estado vazio" na UI mas não especifica o response body do endpoint para lista vazia. Pela convenção do projeto (200 com array vazio, nunca 404 para lista vazia), deve ser 200 + `data: []` — mas não está explícito na spec.

- [x] CHK105 - As convenções de resposta do projeto (`{ data, meta? }` / erro `{ statusCode, error, message }`) estão documentadas como requisito inegociável? [Completude, Spec §6] {auto}
  > Evidência: Spec §6 Convenções "API responses: `{ data, meta? }` / erro `{ statusCode, error, message }`".

---

## Autenticação e Autorização

- [x] CHK106 - O guard de autenticação (`KeycloakAuthGuard`) está especificado como primeiro guard (antes do RolesGuard)? [Completude, Spec §Plan §3.1.3] {auto}
  > Evidência: Plan §3.1.3 "Guard: `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN_TENANT)`".

- [x] CHK107 - O código de resposta 403 para roles inválidos está especificado com critério de aceite mensurável? [Completude, Spec §CA-004.2, NFR-S2] {auto}
  > Evidência: CA-004.2 "Retorna 403 para role `PARTICIPANT` ou sem autenticação"; NFR-S2 "Guard `@Roles(Role.ADMIN_TENANT)` — 403 para outros roles".

- [ ] CHK108 - Está especificado o código de resposta para token inválido/expirado (401 vs 403)? [Clareza, Spec §CA-004.2, Ambiguity] {auto}
  > [Ambiguity]: CA-004.2 diz "403 para role PARTICIPANT ou **sem autenticação**". Sem autenticação deveria retornar 401 (Unauthorized), não 403 (Forbidden). O `KeycloakAuthGuard` tipicamente retorna 401 para token ausente/inválido e 403 para role insuficiente. A spec mistura os dois casos.

- [x] CHK109 - O isolamento por `tenant_id` via `AsyncLocalStorage` (nunca como parâmetro) está documentado? [Completude, Spec §NFR-S1, Plan §3.1.3] {auto}
  > Evidência: NFR-S1 "Endpoint admin isolado por `tenant_id` via RLS"; Plan §3.1.3 "Isolamento: `tenant_id` via `RequestContext` (AsyncLocalStorage) — nunca parâmetro".

---

## Paginação

- [x] CHK110 - Os parâmetros de paginação (`page`, `pageSize`) estão especificados com valores default? [Completude, Spec §Plan §3.1.3] {auto}
  > Evidência: Plan §3.1.3 "GET /api/v1/admin/accessibility-gaps?page=1&pageSize=20" — defaults documentados.

- [ ] CHK111 - Está especificado o limite máximo de `pageSize` (ex: 100) para evitar consultas excessivas? [Completude, Spec §FR-014, Gap] {auto}
  > [Gap]: FR-014 menciona paginação mas nem spec nem plan definem `pageSize` máximo. Sem cap, um cliente malicioso pode requerer `pageSize=100000` gerando consulta cara. A convenção do projeto (observada em outros endpoints com paginação) deve ser documentada aqui.

- [x] CHK112 - A validação dos parâmetros de paginação via Zod + `ZodValidationPipe` está documentada no plan? [Completude, Spec §Plan §4.2] {auto}
  > Evidência: Plan §4.2 OWASP A03 "Parâmetros `page`/`pageSize` — Validação Zod (int positivo) + Prisma parameterizado".

---

## Integração ContentService / AltTextValidator

- [x] CHK113 - A interface pública do `AltTextValidator` está especificada com assinatura síncrona e tipos concretos? [Completude, Spec §FR-012] {auto}
  > Evidência: FR-012 "`AltTextValidator.hasInvalidImgs(html: string): boolean` — parser de `<img>` sem `alt`".

- [x] CHK114 - Os 3 cenários de teste do `AltTextValidator` estão especificados como critérios de aceite mensuráveis? [Completude, Spec §CA-005.1, CA-005.2, CA-005.3] {auto}
  > Evidência: CA-005.1 (img sem alt → true), CA-005.2 (img com alt → false), CA-005.3 (contentBody null → false).

- [x] CHK115 - Está especificado que `createLesson` e `updateLesson` atualizam o flag de forma síncrona (não async)? [Completude, Spec §FR-013, Clarify P3] {auto}
  > Evidência: FR-013 "`ContentService.createLesson`/`updateLesson` chama `AltTextValidator` e seta flag"; Clarify P3 "Validação síncrona em `createLesson`/`updateLesson`".

- [ ] CHK116 - Está definido o comportamento do `ContentService` quando `contentBody` é atualizado para `null` após ter tido `has_missing_alt_text=true` (deve setar `false`)? [Completude, Spec §CA-005.3, Gap] {auto}
  > [Gap]: CA-005.3 cobre "contentBody null/vazio → `has_missing_alt_text=false`" para criação. Não está explícito que `updateLesson` com `contentBody: null` também reseta o flag. O plan menciona "qualquer operação que toca `contentBody`" mas a spec não tem CA explícito para esse cenário de update.

---

## Versionamento e Rota

- [x] CHK117 - A rota do endpoint inclui prefixo de versionamento `/api/v1/`? [Completude, Spec §FR-014] {auto}
  > Evidência: FR-014 "GET `/api/v1/admin/accessibility-gaps`".

- [x] CHK118 - O código de status para criação (201) e ausência de body para deleção (204) são respeitados — este endpoint (GET) retorna 200? [Completude, Spec §6] {auto}
  > Evidência: Spec §6 "Create=201, Delete=204"; endpoint é GET, portanto 200 é correto. CA-004.1 confirma "retorna 200".

---

## Observabilidade e Boot

- [x] CHK119 - O requisito de boot real da API após o novo controller está documentado como gate obrigatório? [Completude, Spec §FR-019, Plan §4.1] {auto}
  > Evidência: FR-019 "Boot real da API validado após novo controller (`start:e2e` + `/api/health`)"; Plan §4.1 "start:e2e + curl /api/health — onModuleInit do novo controller OK".

- [ ] CHK120 - Está definido se o `AdminAccessibilityController` deve ter `@ApiTags` e descrições Swagger (convenção do projeto)? [Completude, Spec §Plan §3.1.3, Gap] {auto}
  > [Gap]: O projeto usa NestJS com Swagger habilitado (observado em `admin-users.controller.ts`). O plan/spec não mencionam decoradores Swagger para o novo controller. CLAUDE.md menciona "Swagger descriptions: English" mas sem requisito explícito aqui.

---

## Notes

- Items `{auto}` resolvidos com `[x]` têm citação de evidência explícita
- **Gaps abertos ([ ] {auto})**: CHK104, CHK108, CHK111, CHK116, CHK120

### Follow-up dos Gaps

| Gap | Destino |
|-----|---------|
| CHK104 — response body para lista vazia | Especificar em CA-004.4: "retorna 200 com `data: [], meta: { total: 0, page: 1, pageSize: 20 }`" |
| CHK108 — 401 vs 403 sem autenticação | Corrigir CA-004.2: "Retorna 401 para token ausente/inválido; 403 para role insuficiente" |
| CHK111 — pageSize máximo | Especificar em FR-014: "pageSize máximo: 100; default: 20; page default: 1" |
| CHK116 — updateLesson contentBody null reseta flag | Adicionar CA-005.3b: "updateLesson com `contentBody: null` → `has_missing_alt_text=false`" |
| CHK120 — Swagger decorators | Especificar em FR-014: "incluir `@ApiTags('admin')` e descrição em inglês no controller" |
