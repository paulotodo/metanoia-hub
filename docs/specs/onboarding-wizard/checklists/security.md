# Security Requirements Checklist: Wizard de Onboarding (Story 10-1)

**Purpose**: Validar a QUALIDADE dos REQUISITOS de segurança — se os controles OWASP/ASVS estão especificados, quantificados e sem ambiguidade nos artefatos. Não testa implementação.
**Created**: 2026-06-13
**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md §Security Considerations) | **Contracts**: [onboarding-api.md](../contracts/onboarding-api.md)

> Cobre os 2 highs ratificados em **dec-018 / block-001** (A03 mass-assignment; A04/A08/API7 URL hardening) como controles MUST, mais os riscos medium/low do plan §Security Considerations. Itens `{auto}` resolvidos com evidência citada.

## A03/API3 — Mass-assignment (BOPLA) — RATIFICADO MUST (dec-018)

- [x] CHK001 - O requisito de allowlist anti mass-assignment em `PATCH /tenants/me` está especificado e não-ambíguo? [Completude/Clareza, plan §Security A03, contracts] {auto}
  - Evidência: plan L147 "Zod `.strict()` allowlist; sem spread-merge"; contracts §Hardening "`.strict()` com allowlist explícita; NUNCA spread-merge (`{...tenant, ...body}` proibido)".
- [x] CHK002 - O requisito de allowlist anti mass-assignment em `PATCH /users/me` está especificado? [Completude/Clareza, contracts §PATCH /users/me Hardening] {auto}
  - Evidência: contracts "Anti mass-assignment: Zod `.strict()`, sem spread-merge".
- [x] CHK003 - Os campos imutáveis (não-atualizáveis) estão enumerados explicitamente por endpoint? [Clareza, plan §Security, contracts] {auto}
  - Evidência: plan L147 `status, tenantId, email, onboardingCompletedAt`; contracts /users/me "`status`, `tenantId`, `onboardingCompletedAt`, `email` NÃO atualizáveis"; /tenants/me "metadata aceita só {denomination, city, state}".
- [x] CHK004 - O comportamento em presença de chave extra (rejeitar) está definido como verificável? [Mensurabilidade, contracts §tenants/me Hardening] {auto}
  - Evidência: contracts "chaves extras são rejeitadas (400)". Critério objetivo (status 400).
- [ ] CHK005 - O requisito de allowlist do shape interno do JSONB `onboardingProgress` (`.strict()`) está definido para bloquear injeção de chaves não previstas? [Completude, plan §Security A05, data-model] {auto}
  - `[x]` → satisfeito: plan L153 "shape via `OnboardingProgressSchema` `.strict()`"; contracts "validado por OnboardingProgressSchema". Marcado `[x]`.

## A04/A08 Stored XSS + API7 SSRF — URL hardening — RATIFICADO MUST (dec-018)

- [x] CHK006 - O requisito de validação de `logoUrl` (scheme + host allowlist) está especificado e quantificado? [Completude/Clareza, plan §Security A04/A08, contracts] {auto}
  - Evidência: contracts "Zod `.url()` + scheme allowlist `https:` apenas (rejeitar `javascript:`/`data:`/`file:`) + host/bucket allowlist (origem MinIO)".
- [x] CHK007 - O requisito de validação de `profilePhotoUrl` é especificado com as mesmas regras de logoUrl? [Completude/Consistência, contracts §users/me Hardening] {auto}
  - Evidência: contracts "profilePhotoUrl: mesmas regras de logoUrl (Zod `.url()` + `https:` + host/bucket allowlist + URL cunhada server-side; render via `<img>`)".
- [x] CHK008 - O requisito de origem da URL (cunhada server-side, não enviada pelo cliente) está sem ambiguidade? [Clareza, contracts §tenants/me Hardening] {auto}
  - Evidência: contracts "O valor DEVE ser a URL canônica retornada pelo endpoint de upload server-side; o cliente não envia URL arbitrária de origem externa".
- [x] CHK009 - O requisito de render seguro (somente `<img src>`, nunca `dangerouslySetInnerHTML`) está especificado? [Completude, plan §Security A04/A08, contracts] {auto}
  - Evidência: plan L148 "render só `<img src>`"; contracts "Render só via `<img src>` (nunca `dangerouslySetInnerHTML`)".
- [x] CHK010 - O requisito de rejeição explícita de schemes perigosos está enumerado (verificável)? [Mensurabilidade, contracts §tenants/me Hardening] {auto}
  - Evidência: contracts enumera `javascript:`/`data:`/`file:` como rejeitados → critério objetivo de teste.

## Upload de mídia (tipo/tamanho/magic-bytes) — medium

- [x] CHK011 - O requisito de validação de content-type por allowlist está especificado? [Completude, plan §Security upload, contracts §upload MUST] {auto}
  - Evidência: contracts "valida content-type por allowlist (`image/png`, `image/jpeg`, `image/webp`)".
- [x] CHK012 - O requisito de validação de magic-bytes (não só extensão) está especificado? [Clareza, contracts §upload MUST] {auto}
  - Evidência: contracts "magic-bytes (não só extensão)"; plan L151 "magic-bytes".
- [x] CHK013 - O requisito de tamanho máximo está presente (ainda que sem número)? [Completude, contracts §upload MUST] {auto}
  - Evidência: contracts "tamanho máximo". Presente como requisito.
- [ ] CHK014 - O valor do tamanho máximo de upload está quantificado? [Mensurabilidade, contracts §upload MUST] {auto}
  - `[Gap]`: contracts e plan citam "tamanho máximo"/"max size" sem valor numérico (ex.: MB). Requisito não mensurável como está. → `/create-tasks` ou `/clarify`: fixar o limite (MB) para foto e logo.
- [x] CHK015 - O comportamento fail-closed no upload preservando FR-13 (avança sem mídia) está especificado? [Consistência, contracts §upload MUST, Spec §FR-13] {auto}
  - Evidência: contracts "Fail-closed na validação (rejeita o arquivo) preservando a degradação graciosa FR-13 (etapa avança SEM a mídia)".

## API5 BFLA / AuthZ — medium

- [x] CHK016 - O requisito de autorização por role (`admin_tenant`) em `PATCH /tenants/me` está especificado? [Completude, plan §Security API5, contracts] {auto}
  - Evidência: plan L149 "guard de role explícito + assertion de teste; 3-camadas (Keycloak→guard→RLS)"; contracts "Auth: role `admin_tenant`; Guard: role + tenant".
- [x] CHK017 - O requisito de resolução de identidade via token (nunca id no body) em `/users/me` está claro? [Clareza, contracts §users/me Hardening API5] {auto}
  - Evidência: contracts "`/me` resolvido do token via `AsyncLocalStorage`, nunca id no body".
- [x] CHK018 - O requisito de testes de assertion de role/BFLA está declarado? [Mensurabilidade, plan §Security API5] {auto}
  - Evidência: plan L149 "+ assertion de teste".

## A01 Cross-tenant write / RLS — medium

- [x] CHK019 - O requisito de RLS-scoping dos write paths novos está especificado? [Completude, plan §Security A01/Constitution I] {auto}
  - Evidência: plan L150 "RLS + `withTenantTx`; RLS isolation spec dos write paths novos"; Constitution Check I idem.
- [x] CHK020 - O requisito de RLS isolation spec como defesa de teste está declarado? [Mensurabilidade, plan §Constitution I, Spec §SC-4] {auto}
  - Evidência: plan I "RLS isolation spec dos novos write paths incluído"; SC-4 "verificável via testes de isolamento RLS".
- [x] CHK021 - A migração é especificada como aditiva sem tocar policy (não introduz buraco RLS)? [Clareza, data-model §Migration, plan §Constitution I] {auto}
  - Evidência: data-model "Sem `CREATE POLICY`/`ALTER POLICY` (RLS já habilitada; colunas nullable)"; plan I "não toca policy".
- [x] CHK022 - O requisito de `hasRealGroups` derivado server-side RLS-scoped (não no FE) está especificado? [Clareza, contracts §GET status, plan §Constitution I] {auto}
  - Evidência: contracts "`hasRealGroups`: derivado server-side (count NÃO feito no FE — Decision 6)"; plan I "`hasRealGroups` derivado server-side RLS-scoped".

## A09 PII em logs/eventos — low

- [x] CHK023 - O requisito de payload do evento sem PII está especificado? [Completude, plan §Security A09, contracts §evento] {auto}
  - Evidência: plan L152 "payload do evento = `{step, stepName}` + tenantId (sem PII)"; contracts evento `data: {step, stepName}` + tenantId, sem nome/email.
- [ ] CHK024 - Há requisito explícito de scrub/proibição de PII (nome, e-mail, URLs de mídia) nos logs do fluxo de upload e dos PATCHs? [Completude, plan §Security A09] {auto}
  - `[Ambiguity]`: plan A09 cobre só o PAYLOAD DO EVENTO. Não há requisito explícito sobre LOGS dos endpoints PATCH (que recebem nome, e-mail de convite, URLs) nem do upload. Pode ser coberto pela política global de logging do projeto, mas não está citado nesta spec/plan. → `/clarify`: confirmar se a política global de log-scrub cobre os novos endpoints ou se um requisito dedicado é necessário.

## A05 Injection — low

- [x] CHK025 - O requisito de proteção contra injeção em JSONB (parametrização Prisma + shape strict) está especificado? [Completude, plan §Security A05] {auto}
  - Evidência: plan L153 "Prisma parametriza; shape via `OnboardingProgressSchema` `.strict()` — PASS".

## Validação de entrada e invariantes de negócio

- [x] CHK026 - O requisito de validação Zod em ambos os lados (request BE + response/status FE) está especificado? [Completude, plan §Validação Zod, contracts] {auto}
  - Evidência: plan "Borda: ambos (request via ZodValidationPipe no BE; response/status via parse no FE)"; schema compartilhado em packages/types.
- [x] CHK027 - A invariante de negócio FR-08 (completedAt XOR skippedAt) é especificada como rejeição server-side? [Clareza/Mensurabilidade, contracts §tenants/me] {auto}
  - Evidência: contracts "Invariante FR-08: o backend rejeita payload que defina `completedAt` E `skippedAt` simultaneamente".
- [x] CHK028 - O requisito de mensagens de erro sem stack trace ao FE está especificado? [Completude, contracts §header] {auto}
  - Evidência: contracts header "erro `{statusCode, error, message, details?}` sem stack trace"; plan Constitution IV idem.
- [x] CHK029 - O requisito de snapshot test dos schemas Zod (gate contra breaking change silencioso) está declarado? [Mensurabilidade, plan §Validação Zod/Constitution II] {auto}
  - Evidência: plan "snapshot test trava breaking changes"; data-model "snapshot test obrigatório".

## Itens de julgamento (dono do produto)

- [ ] CHK030 - O apetite de risco para tratar os 2 highs (A03, A04/A08) como MUST bloqueante (vs aceitar-risco) está alinhado com a política de segurança? [Risco] {humano}
  - Nota: já ratificado em dec-018/block-001 como MUST. Confirmar que nenhuma reavaliação de apetite é necessária para Release 1.
- [ ] CHK031 - Outros vetores (rate-limiting nos PATCHs, CSRF no fluxo de upload) deveriam ser requisitos nesta story ou ficam para hardening posterior? [Risco/Escopo] {humano}

## Notes

- 2 highs ratificados (dec-018/block-001) cobertos: A03 mass-assignment (CHK001-005), A04/A08/API7 URL hardening (CHK006-010).
- Gaps abertos que viram ação:
  - **CHK014** `[Gap]` → `/clarify` ou `/create-tasks`: quantificar tamanho máximo de upload.
  - **CHK024** `[Ambiguity]` → `/clarify`: requisito de log-scrub de PII nos novos endpoints.
- `{humano}` em aberto: CHK030, CHK031.
- Rastreabilidade: 31/31 itens com referência (plan §Security/contracts/data-model/Spec) = 100% (≥80% OK).
