# Performance Checklist: SSE Reconnection & Gap Fill

**Purpose**: Validar a qualidade dos requisitos de performance — backoff exponencial, gap-fill sob carga, latência do filtro `since`, e comportamento de degradação.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)

## Targets de Backoff Mensuráveis

- [x] CHK058 - Os intervalos do backoff exponencial estão quantificados com valores concretos (1s, 2s, 4s, 8s, teto 30s)? [Clareza, Spec §FR-001] {auto}
  > _Evidência_: FR-001: "backoff exponencial: 1s, 2s, 4s, 8s, com teto máximo de 30s por tentativa." plan §5: `min(2^attempt*1000, 30000)`. Valores concretos e fórmula explicitados.

- [x] CHK059 - O limiar de 5 falhas consecutivas no teto (30s) antes do aviso de outage está quantificado? [Clareza, Spec §FR-004] {auto}
  > _Evidência_: FR-004: "Após 5 falhas consecutivas no intervalo máximo de backoff (30s)". Threshold numérico explícito.

- [x] CHK060 - O critério de sucesso SC-002 (indicador aparece em <2s após perda, desaparece em <2s após reconexão) é mensurável? [Mensurabilidade, Spec §SC-002] {auto}
  > _Evidência_: SC-002: "o indicador 'Reconectando...' aparece em menos de 2 segundos após a perda de conexão e desaparece em menos de 2 segundos após a reconexão bem-sucedida." Mensurável via Playwright (`waitFor` com timeout).

- [ ] CHK061 - Há requisito de performance para o tempo total de gap-fill (fetch + merge + render) após reconexão? [Clareza, Gap] {humano}
  > _Gap_: SC-001 e SC-002 cobrem a reconexão SSE, mas não há SLO definido para o tempo do gap-fill (fetch `?since` + dedup + render no centro). Em cenários com muitas notificações perdidas, o gap-fill pode ser lento. Decisão de produto: é necessário um SLO (ex.: gap-fill completo em <3s) ou a ausência de loading state durante o gap-fill é aceitável?

## Degradação Graciosa

- [x] CHK062 - O comportamento de falha silenciosa do gap-fill (retry na próxima reconexão) está especificado? [Cobertura, Spec §Edge Cases] {auto}
  > _Evidência_: spec §Edge Cases: "A falha é silenciosa para o usuário; as notificações perdidas não são recuperadas nessa tentativa. Na próxima reconexão SSE, um novo gap fill é tentado com o mesmo `lastReceivedAt`."

- [x] CHK063 - O comportamento de continuação das tentativas de reconexão em background durante o aviso de outage está especificado? [Completude, Spec §FR-006, US2 AC4] {auto}
  > _Evidência_: FR-006: "As tentativas de reconexão DEVEM continuar em segundo plano mesmo quando o aviso de outage estendido está visível." Sem degradação total do sistema — reconexão automática persiste.

- [ ] CHK064 - Há requisito de comportamento do gap-fill sob carga pesada (muitas notificações perdidas + rede lenta) — ex.: indicador de loading, cancelamento se nova reconexão ocorrer antes do fetch terminar? [Cobertura, Gap] {humano}
  > _Gap_: a spec define o gap-fill como "buscar e mesclar", mas não define o que acontece se: (a) o fetch de gap-fill ainda está em andamento quando uma nova desconexão ocorre, (b) o usuário navega para outra página durante o fetch de gap-fill. Sem esse requisito, a implementação pode ter condições de corrida silenciosas.

## Queries e I/O

- [x] CHK065 - O filtro `since` usa índice existente sobre `created_at` (sem necessidade de full scan)? [Completude, plan §data-model] {auto}
  > _Evidência_: plan §Technical Context: "zero migrations — feature read-only sobre `notifications.created_at`". A coluna `created_at` já existe da 14-2a; a query `AND created_at > $N::timestamptz` usa o índice de `created_at` existente. Nenhuma migration de índice nova necessária.

- [ ] CHK066 - Há requisito de que a query do filtro `since` não degrada performance para tenants com volume alto de notificações (ex.: índice composto `(tenant_id, created_at)`)? [Cobertura, Gap] {humano}
  > _Gap_: plan não especifica requisito de performance de query para o filtro `since` combinado com RLS (WHERE tenant_id = X AND created_at > Y). Se não existir índice composto `(tenant_id, created_at)`, a query pode ser lenta para tenants com muitas notificações. Decisão de produto/DBA necessária.

- [x] CHK067 - O filtro `since` é aplicado tanto no SELECT (dados) quanto no COUNT (para meta de paginação)? [Completude, plan §Backend passo 3] {auto}
  > _Evidência_: plan §Backend passo 3: "adicionar `AND created_at > $N::timestamptz` (bind posicional, nunca interpolado) ao SELECT **e ao COUNT**." Ambas as queries cobertas.

## Gap-Fill e Volume

- [x] CHK068 - O deduplication por `id` no gap-fill está especificado como requisito (não apenas como comportamento implícito)? [Completude, Spec §FR-011, SC-004] {auto}
  > _Evidência_: FR-011: "notificações retornadas pelo gap fill DEVEM ser mescladas no Notification Center deduplicando por `id`". SC-004: "o mesmo ID de notificação nunca aparece duas vezes no Notification Center, independente de quantas reconexões ocorram."

- [x] CHK069 - O critério de sucesso de zero duplicatas (SC-004) é mensurável em teste? [Mensurabilidade, Spec §SC-004] {auto}
  > _Evidência_: SC-004 é verificável via teste unitário (simular gap-fill com IDs sobrepostos e verificar que o resultado não tem duplicatas) e E2E (FR-020a: desconexão → reconexão → gap-fill verifica notificações sem duplicatas).

- [ ] CHK070 - Há requisito de performance para a deduplicação quando o Notification Center tem muitas notificações (ex.: complexidade O(n) aceitável com Set vs. O(n²) com array.find)? [Clareza, Gap] {humano}
  > _Gap_: spec define a deduplicação por `id` mas não especifica a estratégia de implementação (Set vs. Map vs. array.find). Para volumes típicos de notificações pastorais (dezenas, não milhares), O(n²) é aceitável. Mas se o volume crescer, pode impactar. Decisão técnica: documentar explicitamente a complexidade esperada nas tasks.

## Cleanup e Memory Leaks

- [x] CHK071 - O cancelamento dos timers de backoff no desmonte do componente está especificado para evitar memory leaks? [Completude, Spec §Edge Cases, plan §5] {auto}
  > _Evidência_: spec §Edge Cases: "os timers de backoff são cancelados" no desmonte. plan §5 hook: "cleanup de timer no desmonte". FR-021 cobre testes unitários — o cleanup deve ser verificado via `afterEach` no Vitest.

- [x] CHK072 - O fechamento da conexão SSE (`EventSource.close()`) no desmonte do hook está especificado? [Completude, Spec §Edge Cases, plan §5] {auto}
  > _Evidência_: spec §Edge Cases: "a conexão SSE é fechada" no desmonte. plan §5 menciona `EventSource` nativo e cleanup no desmonte como requisito.

## Observabilidade de Performance

- [ ] CHK073 - Há requisito de métricas de performance para o filtro `since` no backend (latência p95 do endpoint com since ativo vs. sem since)? [Cobertura, Gap] {humano}
  > _Gap_: spec e plan não definem métricas de observabilidade para o filtro `since`. Feature de infraestrutura — nível de cobertura de monitoring é decisão de produto/SRE. Espelho de CHK022 (domínio API).

## Notes

- Items `{auto}` resolvidos com `[x]` incluem citação da seção que sustenta a conclusão.
- Items `{humano}` em aberto: CHK061, CHK064, CHK066, CHK070, CHK073.
- CHK064 (condição de corrida no gap-fill) e CHK066 (índice composto) têm maior impacto em produção — recomenda-se decidir antes de implementar o filtro `since`.
- CHK070 pode ser resolvido pelo executor (usar `Set<string>` para deduplicação é a escolha óbvia O(n)) sem decisão de produto.
