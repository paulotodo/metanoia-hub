# Security Checklist: health-check-integracoes

**Purpose**: Validar qualidade dos requisitos de segurança: authN/Z, proteção de secrets,
info-disclosure, injection, resource consumption e OWASP findings do gate plan.
**Created**: 2026-06-22
**Feature**: `docs/specs/health-check-integracoes/spec.md`
**OWASP gate (onda plan)**: Findings F1 (medium/authz), F2 (medium/info-disclosure),
F3 (low/injection), F4 (low/resource consumption) — convertidos em itens CHK verificáveis.

---

## Autenticação e Autorização (OWASP Finding F1)

- [x] CHK023 - O modelo de autorização (RBAC via Keycloak realm role) está documentado? [Completude, Spec §NFR-SEC-002, §FR-003] {auto}
  > Evidência: spec §NFR-SEC-002 define `KeycloakAuthGuard + RolesGuard(@Roles('super_admin'))`; §D-002 e §FR-008 confirmam que `super_admin` é `realm_role` do Keycloak.

- [x] CHK024 - O deny-by-default para não-super-admin está explícito (403)? [Completude, Spec §NFR-SEC-002, §FR-003] {auto}
  > Evidência: spec §NFR-SEC-002: "Retorna 403 para outros roles mesmo que autenticados"; §FR-003 define o response 403 literal `{ statusCode: 403, error: "Forbidden", message: "Acesso negado" }`.

- [ ] CHK025 - O requisito de usar `Role.SUPER_ADMIN` (enum) em vez de string literal `'super_admin'` está formalizado? [Clareza, Ambiguity, OWASP F1] {auto}
  > Ambiguidade (ver CHK013): spec usa string literal. OWASP Finding F1 (medium) exige enum TypeScript para type-safety. Sem o enum, refatorações futuras podem silenciosamente quebrar a guard. Ação: spec §NFR-SEC-002 deve referenciar o enum ou a task de implementação deve incluir instrução explícita.

- [ ] CHK026 - O teste de 403 está especificado para AMBOS os endpoints (`/integrations` E `/history`) de forma explícita? [Cobertura, Gap, OWASP F1] {auto}
  > Gap (ver CHK014): tabela de testes de spec §Testes especifica "403 para não-super-admin" apenas em `health-check.controller.spec.ts` sem nomear os dois endpoints. OWASP Finding F1 exige cobertura em ambos. Ação: detalhar cenários de teste na spec ou na task.

- [ ] CHK027 - O audit-log do acesso ao endpoint GET com `correlation_id` está especificado? [Cobertura, Gap, OWASP F1] {auto}
  > Gap (ver CHK015): spec §FR-007 especifica audit do evento de mudança de status (worker), mas não o acesso HTTP ao endpoint. OWASP Finding F1 requer audit-log do acesso com `correlation_id`. Ação: adicionar requisito §NFR-SEC-003 ou equivalente.

---

## Information Disclosure (OWASP Finding F2)

- [ ] CHK028 - As mensagens de erro do campo `message` são construídas a partir de uma allowlist sanitizada e não do erro bruto? [Completude, Ambiguity, OWASP F2] {auto}
  > Ambiguidade: spec §FR-002 exige "mensagem sanitizada (sem stack, sem secrets, sem IPs internos)" e §NFR-SEC-001 reforça, mas não define a allowlist explícita. OWASP Finding F2 exige allowlist canônica (ex.: "timeout", "connection refused", "High latency", "API key invalid"). Ação: spec §FR-002 ou §NFR-SEC-001 deve listar os valores permitidos para `message`.

- [x] CHK029 - O requisito de não logar `RESEND_API_KEY` em nenhum nível está especificado? [Completude, Spec §NFR-SEC-001] {auto}
  > Evidência: spec §NFR-SEC-001: "`RESEND_API_KEY` nunca em logs (mesmo pattern de `EmailService`)."

- [ ] CHK030 - O requisito de não incluir host de `KEYCLOAK_URL`/`MINIO_ENDPOINT` em `message` voltado ao cliente está especificado? [Completude, Gap, OWASP F2] {auto}
  > Gap: spec §NFR-SEC-001 proíbe URLs internas mas não especifica explicitamente que nomes de host de `KEYCLOAK_URL` e `MINIO_ENDPOINT` não podem aparecer no campo `message` retornado ao cliente. OWASP Finding F2 é explícito neste ponto. Ação: adicionar à spec §NFR-SEC-001 ou §FR-002.

- [ ] CHK031 - Existe requisito de teste que assevera que erros com secret (RESEND_API_KEY, KEYCLOAK_URL) não aparecem na resposta nem nos logs? [Cobertura, Gap, OWASP F2] {auto}
  > Gap: spec §Testes não define um cenário de teste explícito para info-disclosure. OWASP Finding F2 exige teste asseverando que erro contendo secret não vaza. Ação: adicionar cenário de teste em `resend-health.port.spec.ts` e `health-check.service.spec.ts`.

---

## SQL Injection (OWASP Finding F3)

- [x] CHK032 - O requisito de INSERT do worker via bind params posicionais (não concatenação SQL) está especificado? [Completude, Spec §D-001, OWASP F3] {auto}
  > Evidência: spec §D-001 define `$executeRawUnsafe` com cliente privilegiado "padrão idêntico ao `insertJobLog`/`evasion_job_log`". Research §Decision 3 confirma `$executeRawUnsafe` com params posicionais (padrão `detect-evasion-risk.processor.ts` L270). OWASP Finding F3 reforça bind params `$1::uuid, $2, ...` — o precedente já usa este padrão.

- [ ] CHK033 - O requisito explícito de NUNCA concatenar SQL no INSERT do worker está formalizado? [Clareza, Ambiguity, OWASP F3] {auto}
  > Ambiguidade: spec §D-001 referencia o padrão `evasion_job_log` mas não formaliza explicitamente "nunca concatenar SQL". A tarefa de implementação deve incluir instrução explícita de usar `$1::uuid, $2, ...` posicionais. Ação: adicionar ao §FR-001 ou à task.

---

## Resource Consumption (OWASP Finding F4)

- [x] CHK034 - O requisito de `AbortSignal.timeout(5000)` por probe HTTP está especificado? [Completude, Spec §FR-002, §D-002, OWASP F4] {auto}
  > Evidência: spec §D-002 define `AbortSignal.timeout(5000)` para probe Resend; §FR-002 define timeout 5s para probes HTTP e 3s para Redis/PG; §NFR-I5 garante total < 6s via `Promise.all`.

- [ ] CHK035 - O requisito de micro-cache/throttle server-side para coalescer refreshes rápidos do endpoint on-demand está especificado? [Completude, Gap, OWASP F4] {auto}
  > Gap: spec §FR-003 define que o endpoint executa probes on-demand mas não especifica proteção contra múltiplas chamadas simultâneas do dashboard (ex: vários tabs abertos). OWASP Finding F4 requer micro-cache (5-10s, in-memory ou Redis) para coalescer refreshes. Ação: adicionar requisito §NFR-PERF-001 ou equivalente.

- [x] CHK036 - O timeout de Redis/PostgreSQL (3s) está especificado e diferenciado do timeout HTTP (5s)? [Clareza, Spec §FR-002] {auto}
  > Evidência: spec §FR-002: "Redis: PING via RedisService timeout 3s; PostgreSQL: SELECT 1 timeout 3s" — diferenciado de "HTTP: timeout 5s". Claro e mensurável.

---

## Proteção de Dados e Secrets

- [x] CHK037 - Os secrets (`RESEND_API_KEY`, `KEYCLOAK_URL`, `MINIO_ENDPOINT`) são consumidos via `ConfigService` e não hardcodados? [Completude, Spec §FR-008] {auto}
  > Evidência: spec §FR-008 define `this.configService.get('RESEND_API_KEY')`; §FR-002 referencia `${KEYCLOAK_URL}` e `${MINIO_ENDPOINT}` como variáveis de ambiente.

- [x] CHK038 - O requisito de não retornar stack traces na resposta de erro está especificado? [Completude, Spec §NFR-SEC-001] {auto}
  > Evidência: spec §NFR-SEC-001: "message nas responses não inclui stack traces, URLs internas ou nomes de host de infraestrutura."

- [x] CHK039 - Os dados em `integration_health_log` são dados de plataforma não-sensíveis (sem PII, sem secrets)? [Completude, Spec §FR-001] {auto}
  > Evidência: spec §FR-001 define o schema: `id`, `integrationName`, `status`, `latencyMs`, `message?`, `checkedAt` — sem PII, sem tokens, sem IPs de infra. O campo `message` é sanitizado conforme §NFR-SEC-001.

---

## Probes em Testes/CI (NFR-TEST-001)

- [x] CHK040 - O requisito de mocking de probes em testes e CI (nunca bater em produção) está especificado? [Completude, Spec §NFR-TEST-001] {auto}
  > Evidência: spec §NFR-TEST-001: "Backend: todos os probes HTTP (`fetch`, `redis.ping()`, `prisma.$queryRaw`) devem ser mockados via `vi.mock` ou injeção de dependência. Frontend: MSW intercepta as chamadas. CI: sem conexão real a serviços externos."

- [x] CHK041 - O contexto crítico de que o host é produção (`metanoia-prod-*`) está documentado na spec? [Completude, Spec §Overview] {auto}
  > Evidência: spec §Overview §"Contexto: o host de PRODUÇÃO" e §NFR-TEST-001 documentam o risco explicitamente.

---

## Notes

- Items `{auto}` resolvidos pelo agente com citação da spec/plan.
- Items `{humano}`: nenhum nesta seção — todos os trade-offs de segurança são objetivamente verificáveis contra a spec ou identificados como gaps.
- **Gaps abertos**: CHK027 (audit HTTP), CHK028 (allowlist de `message`), CHK030 (host de infra em `message`), CHK031 (teste info-disclosure), CHK033 (instrução explícita anti-SQL-concat), CHK035 (micro-cache on-demand).
- **Ambiguidades**: CHK025 (enum vs string), CHK028 (allowlist não definida), CHK033 (instrução SQL).
- **Próximos passos**: CHK025/CHK028/CHK030/CHK031/CHK033/CHK035 → adicionar à spec §NFR-SEC ou à task de implementação como acceptance criteria.
