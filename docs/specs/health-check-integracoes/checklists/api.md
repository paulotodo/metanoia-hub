# API Checklist: health-check-integracoes

**Purpose**: Validar qualidade dos requisitos de contrato, auth/authz, error handling,
observabilidade e contratos Zod do endpoint de health-check de integrações.
**Created**: 2026-06-22
**Feature**: `docs/specs/health-check-integracoes/spec.md`

---

## Contratos e Schemas

- [x] CHK001 - São os formatos de request/response definidos para todos os endpoints? [Completude, Spec §FR-003, §FR-004] {auto}
  > Evidência: spec §FR-003 define response 200 completo com `{ data: { integrations[], summary } }`; §FR-004 define `/history` com `data.points[]` + `meta`; §FR-009 define schemas Zod compartilhados em `packages/types/src/integration-health.ts`.

- [x] CHK002 - São os schemas Zod mantidos como contrato formal compartilhado FE+BE? [Consistencia, Spec §FR-009] {auto}
  > Evidência: spec §FR-009 define `IntegrationHealthStatusSchema`, `IntegrationHealthItemSchema`, `IntegrationHealthResponseSchema`, `IntegrationHealthHistoryPointSchema` em `packages/types`; plan §Project Structure lista `packages/types/src/integration-health.ts` como fonte única.

- [x] CHK003 - É a estratégia de versionamento de API especificada? [Clareza, Spec §NFR-SEC-002] {auto}
  > Evidência: plan §Technical Context define prefixo `/api/v1/`; endpoints em §FR-003 e §FR-004 usam `/api/v1/admin/health/integrations`.

- [x] CHK004 - Os query params de `/history` têm tipo, obrigatoriedade, default e limites definidos? [Clareza, Spec §FR-004] {auto}
  > Evidência: spec §FR-004 define `integration` (string, required), `hours` (integer, optional, default=24, max=72); limite derivado `hours * 12` pontos; plan §Convenções lista `integration-history-query.dto.ts` como DTO validado.

- [x] CHK005 - Os valores permitidos para o enum de status são consistentes entre DB, backend e frontend? [Consistencia, Spec §FR-001, §FR-009] {auto}
  > Evidência: spec §FR-001 define enum Prisma `{ healthy, degraded, unhealthy }`; §FR-009 define `z.enum(['healthy', 'degraded', 'unhealthy'])`; §FR-010 define badge colors por valor; plan §Convenções documenta o mapeamento DB↔DTO↔API.

- [x] CHK006 - O endpoint de status imediato (`/integrations`) é distinguido claramente do endpoint de histórico (`/history`)? [Clareza, Spec §FR-003, §FR-004] {auto}
  > Evidência: spec §FR-003 explicita "O endpoint executa as probes on-demand (não lê apenas do banco)"; §D-005 explica que o banco é fonte do histórico. Distinção clara e justificada.

---

## Error Handling

- [x] CHK007 - O formato de resposta 403 está especificado para os dois endpoints? [Completude, Spec §FR-003] {auto}
  > Evidência: spec §FR-003 define `{ "statusCode": 403, "error": "Forbidden", "message": "Acesso negado" }`; §NFR-SEC-002 confirma que ambos os endpoints têm o mesmo guard.

- [x] CHK008 - O comportamento em erro de probe individual está definido? [Completude, Spec §FR-002] {auto}
  > Evidência: spec §FR-002: "Em erro: `status = 'unhealthy'`, `latencyMs = tempo até o erro`, `message = mensagem sanitizada` (sem stack, sem secrets, sem IPs internos)."

- [ ] CHK009 - Os formatos de erro para query params inválidos em `/history` (400/422) estão especificados? [Completude, Gap, Spec §FR-004] {auto}
  > Gap: spec §FR-004 define os query params mas não especifica o formato de resposta quando `integration` tem valor fora do enum de nomes válidos ou `hours` excede 72. O contrato de validação de entrada está ausente. Ação: adicionar à spec ou à tarefa de implementação (DTO `ZodValidationPipe` padrão do projeto).

- [x] CHK010 - As mensagens de erro são seguras para exibição ao usuário (sem secrets, IPs, stack traces)? [Clareza, Spec §NFR-SEC-001, §FR-002] {auto}
  > Evidência: spec §NFR-SEC-001 proíbe RESEND_API_KEY, stack traces, URLs internas em logs/responses; §FR-002 exige `message = mensagem sanitizada`. OWASP Finding F2 reforça allowlist sanitizada.

---

## Autenticação e Autorização

- [x] CHK011 - Os requisitos de autenticação são consistentes entre os dois endpoints? [Consistencia, Spec §NFR-SEC-002] {auto}
  > Evidência: spec §NFR-SEC-002: "`GET /api/v1/admin/health/integrations` e `GET /api/v1/admin/health/integrations/history` têm `KeycloakAuthGuard` + `RolesGuard(@Roles('super_admin'))`."

- [x] CHK012 - O comportamento de 403 para usuário autenticado sem role `super_admin` está especificado? [Completude, Spec §NFR-SEC-002] {auto}
  > Evidência: spec §NFR-SEC-002: "Retorna 403 para outros roles mesmo que autenticados."

- [ ] CHK013 - O guard referencia `Role.SUPER_ADMIN` (enum TypeScript) e não a string literal `'super_admin'`? [Clareza, Ambiguity, OWASP Finding F1] {auto}
  > Ambiguidade: spec §NFR-SEC-002 usa a string `'super_admin'` em `@Roles('super_admin')`. O OWASP gate (Finding F1) requer uso do enum `Role.SUPER_ADMIN` para type-safety. A spec não referencia o enum; a tarefa de implementação precisa resolver isso. Ação: atualizar spec §NFR-SEC-002 ou registrar na task.

- [ ] CHK014 - O teste de 403 está especificado explicitamente para AMBOS `/integrations` E `/history`? [Cobertura, Gap, Spec §Testes, OWASP Finding F1] {auto}
  > Gap: tabela de testes em spec §Testes define "403 para não-super-admin" em `health-check.controller.spec.ts` mas não especifica que cobre `/history` explicitamente. OWASP Finding F1 exige teste 403 em ambos os endpoints.

- [ ] CHK015 - O audit-log do acesso HTTP ao endpoint com `correlation_id` está especificado? [Cobertura, Gap, OWASP Finding F1] {auto}
  > Gap: spec §FR-007 define audit-log do evento `INTEGRATION_STATUS_CHANGED` (evento do worker), mas não há requisito de audit-log do acesso HTTP ao `GET /integrations`. OWASP Finding F1 requer audit do acesso com `correlation_id`. Ação: adicionar requisito de log de acesso ao endpoint.

---

## Observabilidade

- [x] CHK016 - Os requisitos de logging estruturado do worker estão definidos? [Cobertura, Spec §FR-005, §FR-007] {auto}
  > Evidência: spec §FR-007 define `auditService.create` com campos estruturados; §NFR-SEC-001 proíbe log de secrets. Ack silencioso do lock em §FR-005 implica log mínimo.

- [ ] CHK017 - São métricas de latência do endpoint (p50, p95) ou do job BullMQ requeridas? [Cobertura, Gap] {humano}
  > Julgamento de produto: spec §NFR-I5 define latência das probes < 6s mas não requer coleta de métricas de latência do endpoint para observabilidade contínua. Decidir se alertas de degradação são necessários nesta story.

- [x] CHK018 - O `correlation_id` é propagado do worker ao audit e ao evento de domínio? [Cobertura, Spec §FR-007] {auto}
  > Evidência: spec §FR-007 define `metadata: { correlationId: '<uuidv7>' }` no evento e `auditService.create` inclui `correlation_id` no contexto do worker. Propagação especificada para o evento do worker.

---

## Idempotência e Retry

- [x] CHK019 - A idempotência do job BullMQ (single-execution) está especificada como requisito? [Clareza, Spec §FR-005, §D-003] {auto}
  > Evidência: spec §FR-005 e §D-003 definem Redis lock `SET rt:health-check:lock:integration 1 NX EX 270`; §Testes define "BullMQ single-execution 2 instâncias simuladas".

- [x] CHK020 - O comportamento de falha de lock (ack silencioso sem escrita) está especificado? [Completude, Spec §FR-005] {auto}
  > Evidência: spec §FR-005: "Se lock falhar (outra instância): ack silencioso, sem escrita."

- [x] CHK021 - A ausência de retry por probe individual (falha → unhealthy imediato) está especificada e é intencional? [Cobertura, Spec §FR-002, §NFR-I5] {auto}
  > Evidência: spec §NFR-I5 exige latência total < 6s com `Promise.all`; §FR-002 usa `AbortSignal.timeout(5000)`. Retry por probe violaria o budget de 6s. Comportamento intencional e claro.

---

## Paginação

- [x] CHK022 - Os limites de resultado do endpoint `/history` são definidos e consistentes com o índice de banco? [Clareza, Spec §FR-004, §D-005] {auto}
  > Evidência: spec §FR-004: `hours * 12` pontos (24h = 288); §D-005 e §FR-001 definem índice `(integration_name, checked_at DESC)`. Meta retorna `total`. Latência esperada < 50ms com índice.

---

## Notes

- Items `{auto}` resolvidos pelo agente com citação da spec/plan.
- Items `{humano}` aguardam decisão do dono do produto.
- **Gaps abertos**: CHK009 (erro 400/422 em `/history`), CHK014 (403 em `/history` explícito nos testes), CHK015 (audit-log de acesso HTTP).
- **Ambiguidade**: CHK013 (string literal vs enum `Role.SUPER_ADMIN`).
- **Próximos passos**: CHK009/CHK015 → adicionar à spec ou task; CHK013 → task deve referenciar enum; CHK017 → decisão de produto.
