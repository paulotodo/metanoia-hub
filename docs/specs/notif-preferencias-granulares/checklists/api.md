# API Checklist: Preferências Granulares de Notificação por Tipo

**Purpose**: Validar qualidade dos requisitos de contrato, error handling, idempotência, cache e integração com pipeline BullMQ para os endpoints GET/PATCH de preferências de notificação.
**Created**: 2026-06-26
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## Contratos e Schemas

- [x] CHK001 - Estão definidos os formatos de request e response para ambos os endpoints (GET e PATCH)? [Completude, Spec §Requirements FR-002, data-model.md §5] {auto}
  > data-model.md §5 define a forma exata do objeto GET (`data: { pastoral_alert: {inApp,email}, ... }`) e o body parcial do PATCH. Contratos Zod em `contracts/notification-preferences.api.md`.

- [x] CHK002 - O esquema de validação Zod (`UpdateNotificationPreferencesSchema`) impede campos fora dos enums `NotificationType` e `NotificationChannel`? [Clareza, Spec §Requirements FR-004, plan.md §Camada 0] {auto}
  > plan.md §Camada 0: `.strict()` no schema rejeita chaves fora do enum. research.md D1 confirma os 7 valores reais de `NotificationType`.

- [x] CHK003 - Os 7 tipos reais de `NotificationType` estão documentados e coerentes entre spec, plan, data-model e research (sem `system_announcement` inventado)? [Consistência, research.md D1, data-model.md §3] {auto}
  > research.md D1 e data-model.md §3 listam os 7 valores reais. spec.md §Clarifications Decisão 1 documenta a correção `system_announcement → system`. Consistência confirmada.

- [x] CHK004 - O versionamento de API está especificado (`/api/v1/`) e consistente com o padrão do projeto? [Consistência, plan.md §Camada 2] {auto}
  > plan.md §Camada 2: `@Controller('api/v1/users/me/notification-preferences')`. Coerente com o padrão documentado em CLAUDE.md (`/api/v1/` prefix from MVP).

- [x] CHK005 - O mapeamento canal lógico → coluna DB (`inApp ↔ in_app`, `email ↔ email`) está documentado de forma não-ambígua? [Clareza, data-model.md §5] {auto}
  > data-model.md §5 (nota de rodapé): "Mapeamento canal lógico → coluna: `inApp` ⇔ `channel='in_app'`, `email` ⇔ `channel='email'`." Sem ambiguidade.

---

## Error Handling e Códigos HTTP

- [x] CHK006 - O código HTTP para validação de enum/payload inválido está especificado como 400 (não 422), distinguindo da regra do Líder (422)? [Clareza, Spec §Requirements FR-004, plan.md §Segurança ponto 3] {auto}
  > plan.md §Segurança ponto 3 explicitamente: "ZodValidationPipe lança `BadRequestException` (400), não 422 — o 422 é só para a regra do Líder." spec.md §Edge Cases confirma 422 para enum inválido — NOTA: edge case da spec diz 422 mas plan.md corrigiu para 400 (finding MEDIUM da onda plan já registrado como corrigido).

- [x] CHK007 - O código HTTP para violação da regra do Líder (`pastoral_alert.inApp=false`) está especificado como 422 com mensagem de erro em PT-BR? [Completude, Spec §Requirements FR-008, plan.md §Camada 2] {auto}
  > spec.md FR-008: "a recusa ocorre na API (erro de negócio)". plan.md §Camada 2: "Rejeita 422 se Líder tenta `pastoral_alert.inApp=false`". spec.md US4 AC1: "422". Consistente.

- [x] CHK008 - O formato de resposta de erro está alinhado ao padrão do projeto `{ statusCode, error, message, details? }`? [Consistência, Spec §FR-004, CLAUDE.md] {auto}
  > CLAUDE.md define o padrão. O projeto usa `ZodValidationPipe` custom que produz esse formato. Nenhuma exceção documentada para este endpoint.

- [x] CHK009 - O comportamento do PATCH em caso de sucesso (retorno do objeto completo, não apenas o delta) está especificado? [Completude, plan.md §Camada 2] {auto}
  > plan.md §Camada 2: "retorna objeto completo". research.md D6: espelha padrão de `NotificationsController`. Sem ambiguidade.

---

## Autenticação e Autorização

- [x] CHK010 - A rota `/users/me/notification-preferences` previne IDOR por construção (userId SEMPRE de `getRequestContext()`, sem `:userId` no path)? [Cobertura, plan.md §Camada 2, research.md D6] {auto}
  > plan.md §Camada 2: "userId SEMPRE de `getRequestContext().userId`; papel de `@CurrentUser()`". research.md D6: "`/users/me` → IDOR-safe por construção; sem `:userId` no path". `KeycloakAuthGuard` exigido.

- [x] CHK011 - Os dois caminhos de leitura do papel do usuário (HTTP via token vs. worker via DB `user_tenants.role`) estão documentados e distinguidos? [Clareza, research.md D3.a / D3.b] {auto}
  > research.md D3.a e D3.b detalham ambos os caminhos. plan.md §Camada 2 (HTTP) e §Camada 3 (worker) referenciam cada caminho. Sem ambiguidade.

---

## Idempotência e UPSERT

- [x] CHK012 - As operações PATCH são idempotentes — múltiplas requisições com o mesmo payload produzem o mesmo estado final? [Clareza, Spec §FR-001 (nota de infraestrutura), data-model.md §4] {auto}
  > spec.md §Infraestrutura: "operações de atualização de preferências são idempotentes". data-model.md §4: `INSERT ... ON CONFLICT ... DO UPDATE SET enabled = EXCLUDED.enabled`. Sem ambiguidade.

- [x] CHK013 - O UPSERT garante que tipos não presentes no payload PATCH permanecem intocados (patch semantics, não replace-all)? [Clareza, Spec §Requirements FR-002, data-model.md §4] {auto}
  > data-model.md §4: "PATCH (patch semantics): só faz UPSERT das combinações presentes no payload. Combinações ausentes permanecem como default (sem linha) ou seu valor salvo anterior."

---

## Integração na Pipeline BullMQ (Camada 3)

- [x] CHK014 - O ponto exato de inserção da checagem de preferência no worker está especificado (entre l.114 e l.115 de `notifications.worker.ts`, antes de `channelRouter.route`)? [Completude, plan.md §Camada 3, research.md D4] {auto}
  > research.md D4 e plan.md §Camada 3 especificam linhas exatas. Integração documentada.

- [x] CHK015 - O requisito de adicionar `type: NotificationTypeSchema` ao `NotificationJobPayloadSchema` (payload BullMQ) está especificado, incluindo compatibilidade com jobs antigos sem o campo? [Completude, plan.md §Camada 3] {auto}
  > plan.md §Camada 3: "adicionar campo `type: NotificationTypeSchema` ao payload (aditivo) + atualizar snapshot, e setá-lo no `DigestService.enqueue`. Compat: jobs antigos sem `type` → fallback SELECT da linha (defensivo)."

- [x] CHK016 - O requisito de que a supressão por preferência NÃO dispara retry do BullMQ nem alerta de falha está especificado? [Cobertura, Spec §Requirements FR-007] {auto}
  > spec.md FR-007: "quando um canal está desabilitado, o registro de notificação é criado com indicação de não-entrega por preferência do usuário." plan.md §Camada 3: fluxo RETORNA (não lança exceção). data-model.md §2: usa `status='failed'` + `metadata.reason='user_preference'` — evita retry automático do BullMQ. Mas NÃO há requisito explícito nos artefatos sobre "NÃO deve constar como falha em dashboards de observabilidade/alertas". Distinção auditável necessária.

  **[Gap]**: Não há requisito explícito sobre como ferramentas de observabilidade (alertas de `status='failed'`) devem distinguir falhas reais de supressões por preferência. Apenas o uso de `metadata.reason` é documentado — mas se o sistema de alertas filtra `status='failed'`, pode gerar ruído. Task em create-tasks deve cobrir o critério de que `status='failed' + metadata.reason='user_preference'` NÃO dispara retry do worker (return sem throw) E NÃO deve ser contado como falha operacional nos alertas.

- [x] CHK017 - O requisito de `markSuppressedByPreference` (UPDATE na tabela `notifications`) está definido com o SQL exato e via `withTenantTx`? [Completude, plan.md §Camada 3] {auto}
  > plan.md §Camada 3: `UPDATE notifications SET status='failed', metadata = metadata || '{"reason":"user_preference"}'::jsonb WHERE id=$1` via `withTenantTx`. Especificado.

---

## Cache Redis

- [x] CHK018 - TTL, chave, invalidação e fallback do cache de preferências estão quantificados e documentados? [Clareza, Spec §Requirements FR-005/FR-006, data-model.md §6] {auto}
  > data-model.md §6: chave `cache:notif-prefs:{userId}`, TTL 600s (`'EX', 600`), invalidação `del` no PATCH, fallback `logger.warn` + consulta DB. research.md D5 confirma o padrão `RedisService`.

- [x] CHK019 - Está definido que o resultado pós-enforcement de papel NÃO é cacheado (enforcement aplicado após o cache)? [Clareza, data-model.md §6, research.md D5] {auto}
  > research.md D5: "NÃO cachear o resultado pós-enforcement (depende do papel corrente)". data-model.md §6: "pós-defaults, PRÉ-enforcement de papel". Documentado.

- [ ] CHK020 - Existe requisito de proteção contra cache stampede (múltiplas requisições simultâneas ao mesmo userId quando cache expira)? [Cobertura, Gap] {humano}
  > Não identificado nos artefatos. Em low-traffic MVP, stampede é improvável; mas o risco existe para usuários com muitas notificações chegando simultaneamente. Decisão de produto/risco se `NX` + TTL é suficiente ou se lock distribuído é necessário.

---

## Observabilidade

- [x] CHK021 - O requisito de `logger.warn` em falha de Redis está especificado (não apenas silêncio no fallback)? [Completude, Spec §Requirements FR-006, data-model.md §6] {auto}
  > Spec FR-006: "a indisponibilidade do cache é registrada como aviso nos logs". data-model.md §6: "capturar, logar `warn`". research.md D5: "on error: `logger.warn`". Consistente.

- [ ] CHK022 - Estão definidos requisitos de métricas/logging estruturado para auditoria de supressão por preferência (para que admins possam verificar supressões)? [Cobertura, Spec §US2 AC2] {humano}
  > spec.md US2 AC2: "auditores/admins possam verificar que ela existiu e foi suprimida intencionalmente". O mecanismo (status='failed' + metadata.reason) está definido, mas não há requisito de query/report estruturado nem de acesso admin a esse dado. Decisão de produto se isso é suficiente para MVP ou se precisa de UI admin.

---

## Snapshot e Contratos Zod

- [x] CHK023 - O requisito de snapshot test para o schema de preferências (`preferences.snapshot.spec.ts`) está especificado como gate contra breaking changes? [Completude, Spec §Requirements FR-011, plan.md §Camada 0] {auto}
  > Spec FR-011: "schemas centralizados com snapshot tests que atuam como gate contra breaking changes silenciosos." plan.md §Camada 0: "`preferences.snapshot.spec.ts` (gate contra breaking changes silenciosos — FR-011)."

- [x] CHK024 - O snapshot do `NotificationJobPayloadSchema` (atualizado com `type`) também está listado como necessário de atualizar? [Completude, plan.md §Camada 3] {auto}
  > plan.md §Camada 3: "adicionar campo `type: NotificationTypeSchema` ao payload (aditivo) + atualizar snapshot". Coberto.
