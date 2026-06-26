# Security Checklist: a11y-conteudo-multimidia (Story 15.5)

**Purpose**: Valida a qualidade dos requisitos de segurança — autenticação, autorização, isolamento multi-tenant, proteção de dados, validação de input e logging para as 3 frentes da story.
**Created**: 2026-06-25
**Feature**: [spec.md](../spec.md)

---

## Autenticação e Autorização (OWASP A01)

- [x] CHK201 - O requisito de guard duplo (`KeycloakAuthGuard` + `RolesGuard`) está documentado para o endpoint admin? [Completude, Spec §NFR-S2, Plan §3.1.3, Plan §4.2] {auto}
  > Evidência: Plan §3.1.3 "`@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN_TENANT)`"; Plan §4.2 OWASP A01 "Guard `@Roles(Role.ADMIN_TENANT)` + `RolesGuard`".

- [x] CHK202 - O requisito de 403 para escalada de privilégio (roles insuficientes) está definido com critério mensurável? [Completude, Spec §CA-004.2, NFR-S2] {auto}
  > Evidência: CA-004.2 "Retorna 403 para role `PARTICIPANT` ou sem autenticação"; NFR-S2 "`@Roles(Role.ADMIN_TENANT)` — 403 para outros roles".

- [x] CHK203 - Está documentado que nenhum outro role (LIDER, PARTICIPANT, etc.) tem acesso ao endpoint de accessibility-gaps? [Completude, Spec §NFR-S2, Clarify P4] {auto}
  > Evidência: NFR-S2 "403 para outros roles"; Clarify P4 (dec-012) "Guard: `@Roles(Role.ADMIN_TENANT)` somente — NFR-S2 da spec define explicitamente". Decisão auditada em dec-012.

- [ ] CHK204 - Está especificado o requisito de teste de autorização para o endpoint (não apenas 200/403, mas também tentativa de IDOR — acessar dados de outro tenant via manipulação de parâmetro)? [Completude, Spec §CA-004.3, Gap] {auto}
  > [Gap]: CA-004.3 define "Dados são isolados por `tenant_id` (RLS)" mas não há CA que cubra teste explícito de IDOR: "tenant A com token válido NÃO consegue ver dados do tenant B". NFR-S3 menciona "sem exposição de dados cross-tenant" mas sem CA mensurável de teste.

---

## Isolamento Multi-tenant (OWASP A01 / IDOR)

- [x] CHK205 - O requisito de `tenant_id` via `AsyncLocalStorage` (nunca como parâmetro) está documentado como convenção inegociável? [Completude, Spec §6, Plan §3.1.3] {auto}
  > Evidência: Spec §6 "`tenant_id` em toda tabela — nunca passar como parâmetro; usar `AsyncLocalStorage` (`RequestContext`)"; Plan §3.1.3 "Isolamento: `tenant_id` via `RequestContext` (AsyncLocalStorage) — nunca parâmetro".

- [x] CHK206 - O requisito de RLS no Postgres para a migration `has_missing_alt_text` está documentado? [Completude, Spec §FR-020, CA-006.3] {auto}
  > Evidência: CA-006.3 "RLS test `rls_lessons_tenant_isolation` passa com o novo campo (rodar 2× — idempotente)"; Spec §2 Frente C "RLS test obrigatório (idempotente, rodar 2×)".

- [x] CHK207 - Está documentado que o campo `has_missing_alt_text` herda a política RLS existente sem nova política necessária? [Completude, Spec §Plan §3.1.1] {auto}
  > Evidência: Plan §3.1.1 "campo `has_missing_alt_text` herda `rls_lessons_tenant_isolation` existente (política `USING (tenant_id = current_setting('app.tenant_id')::uuid)` já cobre todo SELECT/UPDATE)".

- [x] CHK208 - O índice composto `(tenant_id, has_missing_alt_text)` está especificado para garantir performance nas queries filtradas por tenant? [Completude, Spec §FR-011, CA-006.2, Plan §3.1.1] {auto}
  > Evidência: CA-006.2 "Índice `(tenant_id, has_missing_alt_text)` criado"; Plan §3.1.1 "CREATE INDEX... ON lessons (tenant_id, has_missing_alt_text)".

---

## Proteção de Dados e Info-disclosure (OWASP A02)

- [x] CHK209 - Está definido que `contentBody` (dados de conteúdo potencialmente sensíveis) é excluído da resposta do endpoint admin? [Completude, Spec §Plan §4.2] {auto}
  > Evidência: Plan §4.2 OWASP A02 "Resposta inclui apenas `lessonId`, nomes e `tenantId` (não `contentBody`)".

- [ ] CHK210 - Está definido se `tenantId` deve ser incluído na resposta do endpoint — ou se é redundante (usuário já pertence ao tenant via token)? [Clareza, Spec §FR-015, Ambiguity] {auto}
  > [Ambiguity]: FR-015 e o schema Zod (`LessonAccessibilityGapSchema`) incluem `tenantId` na resposta. Para um endpoint autenticado por tenant (o usuário só vê o próprio tenant), expor `tenantId` é redundante e aumenta a superfície de info-disclosure. A spec deveria justificar ou remover.

- [x] CHK211 - O requisito NFR-S3 ("sem exposição de dados cross-tenant") está documentado? [Completude, Spec §NFR-S3] {auto}
  > Evidência: NFR-S3 "Sem exposição de dados cross-tenant no endpoint".

---

## Validação de Input (OWASP A03)

- [x] CHK212 - O requisito de validação Zod dos parâmetros de paginação (`page`, `pageSize` como int positivo) está documentado? [Completude, Spec §Plan §4.2] {auto}
  > Evidência: Plan §4.2 OWASP A03 "Parâmetros `page`/`pageSize` — Validação Zod (int positivo) + Prisma parameterizado".

- [x] CHK213 - O requisito de `ZodValidationPipe` no backend (nunca libs de validação de terceiros) está documentado como convenção? [Completude, Spec §6] {auto}
  > Evidência: Spec §6 "Zod em `packages/types`; `ZodValidationPipe` no backend".

- [x] CHK214 - O `AltTextValidator` usa regex sobre string HTML (não eval nem `innerHTML` em server-side) — requisito de segurança documentado? [Completude, Spec §FR-012, Plan §3.1.2] {auto}
  > Evidência: Plan §3.1.2 detalha implementação via `RegExp` sobre string — sem DOM parsing server-side, sem `innerHTML`. Regex é síncrono e não executa conteúdo.

- [ ] CHK215 - Está especificado o requisito de sanitização de `contentBody` HTML antes do parse do `AltTextValidator` — ou explicitamente documentado que sanitização NÃO é responsabilidade deste validador? [Completude, Spec §FR-012, Gap] {auto}
  > [Gap]: FR-012 define `hasInvalidImgs(html: string): boolean` mas não menciona se o HTML recebido é confiável (gerado por TipTap gerenciado internamente) ou poderia conter payload hostil. Para conteúdo gerado internamente pelo TipTap, sanitização prévia é assumida mas não explicitada. Documentar essa premissa protege contra drift futuro.

---

## Migration e Banco de Dados

- [x] CHK216 - O requisito de aplicar migration apenas localmente (nunca automaticamente em prod) está documentado com a fronteira de responsabilidade? [Completude, Spec §2 Frente C, Plan §8] {auto}
  > Evidência: Spec §2 Frente C "Apply em produção é deploy **manual** do operador"; Plan §8 "Migration falha em Postgres local — Validar localmente antes de qualquer PR; RLS test 2×".

- [x] CHK217 - O requisito de `NOT NULL DEFAULT FALSE` para `has_missing_alt_text` (sem quebrar registros existentes) está documentado? [Completude, Spec §FR-011, Plan §3.1.1] {auto}
  > Evidência: FR-011 "`has_missing_alt_text Boolean @default(false)`"; Plan §3.1.1 SQL "ADD COLUMN `has_missing_alt_text` BOOLEAN NOT NULL DEFAULT FALSE" — compatível com dados existentes.

---

## Seed e Dados Demo

- [x] CHK218 - O requisito de `is_demo_data=true` e `upsert` idempotente por UUID v7 fixo para o seed está especificado? [Completude, Spec §FR-018, Plan §3.1.3] {auto}
  > Evidência: FR-018 "Seed demo: ≥ 2 aulas com `<img>` sem alt (UUID v7 fixo, `is_demo_data=true`)"; Plan §3.1.3 "2 lessons com `contentBody` contendo `<img src='...' />` (sem alt) — UUID v7 fixo, `is_demo_data=true`. Idempotente: `upsert` por `id`".

- [ ] CHK219 - Está definido que o seed demo NÃO usa `<img>` com URLs externas reais (que poderiam vazar requests de rede em testes)? [Completude, Spec §FR-018, Gap] {auto}
  > [Gap]: Plan §3.1.3 descreve `<img src="..." />` sem especificar se `src` é placeholder (ex: `data:image/gif;base64,...` ou `/assets/placeholder.png`) ou URL real. Para seed de teste/demo, URLs externas reais em `<img src>` podem gerar requests de rede nos testes.

---

## Notes

- Items `{auto}` resolvidos com `[x]` têm citação de evidência explícita
- **Gaps abertos ([ ] {auto})**: CHK204, CHK210, CHK215, CHK219

### Follow-up dos Gaps

| Gap | Destino |
|-----|---------|
| CHK204 — IDOR test CA | Adicionar CA-006.3b: "token do tenant A NÃO retorna dados do tenant B no endpoint" |
| CHK210 — tenantId na resposta | Revisar FR-015: documentar justificativa de incluir tenantId ou remover do schema Zod |
| CHK215 — premissa de sanitização do HTML | Especificar em FR-012: "contentBody é HTML gerado por TipTap (confiável); AltTextValidator faz parse estrutural, não sanitização" |
| CHK219 — src das imgs no seed | Especificar em FR-018: "seed usa `src='/placeholder.png'` (asset local) nos `<img>` de demo" |
