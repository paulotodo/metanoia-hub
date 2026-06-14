# Data Model: upgrade-prompt-limites

**Gerado por**: pipeline feature-00c (plan / Phase 1), 2026-06-14

> Feature **stateless**. Nenhuma tabela, migration, coluna ou entidade persistida
> nova. As "entidades" abaixo são conceituais (tipos em trânsito / config de FE).

---

## Entity: PlanLimitedResource (enum espelhado)

Conjunto fechado dos recursos sujeitos a limite. Fonte da verdade no backend
(`apps/api/src/common/plan-limits/plan-limits.config.ts`); o frontend espelha uma
união literal equivalente.

| Valor (canônico, en) | Glossário pastoral (PT-BR, dec-007) | Onde é aplicado |
|----------------------|--------------------------------------|-----------------|
| `groups` | "comunidades de cuidado" | `PlanLimitsGuard` via `@PlanLimit('groups')` em groups.controller |
| `membersPerGroup` | "participantes do grupo" | `group-members.service` (enforcement manual) |
| `leadersPerTenant` | "pastores/líderes ativos" | `group-members.service` (enforcement manual) |

**Invariante**: o backend NUNCA traduz esse valor; envia sempre o canônico em
inglês no `details.resource`. O frontend é o único ponto de tradução.

---

## Entity: ErrorDetails (em trânsito — payload do 403)

Estrutura carregada no campo `details` do contrato de erro padrão. NÃO persistida.
NÃO validada por Zod (estado atual mantido — dec-011).

| Campo | Tipo | Origem | Uso no FE |
|-------|------|--------|-----------|
| `resource` | `string` (∈ PlanLimitedResource) | `hasCapacity` | seleciona a chave PT-BR pastoral |
| `plan` | `string` (`free`/`pro`/`enterprise`) | `hasCapacity` | não exibido ao usuário (evita termo técnico) |
| `current` | `number` | `hasCapacity` (count real, sob RLS) | interpolado em `{current}` |
| `limit` | `number` | `hasCapacity` (override > plano > fallback) | interpolado em `{limit}` |

**Cobertura de override (Edge Case da spec)**: como `current`/`limit` vêm já
resolvidos por `hasCapacity` (que aplica `planLimitsOverride` do tenant), a mensagem
exibe o valor REAL do tenant, não o default do plano — sem trabalho extra no FE.

**Cobertura enterprise (`Infinity`)**: `hasCapacity` retorna `allowed: true` para
limite `Infinity`, então o 403 nunca é lançado — cenário não chega ao FE (spec P1
Edge Case).

---

## Entity: ResourceMessageMap (config de FE — nova)

Mapa declarativo no frontend que associa cada `resource` à sua chave de localização.

| Chave (resource) | errorKey resolvido |
|------------------|---------------------|
| `groups` | `error.plan.limit.groups` |
| `membersPerGroup` | `error.plan.limit.membersPerGroup` |
| `leadersPerTenant` | `error.plan.limit.leadersPerTenant` |
| *(desconhecido / ausente)* | `error.plan.limitGeneric` (fallback — FR-005) |

**State transitions**: N/A (config imutável em tempo de build).

---

## Entity: LocalizedLimitMessage (texto PT-BR — em `pt-BR.json`)

Texto final exibido. Template com placeholders `{current}` / `{limit}` interpolados
do `ErrorDetails`. Forma proposta (texto exato decidido em `/execute-task`):

| errorKey | Esboço de texto (pastoral, acionável) |
|----------|----------------------------------------|
| `error.plan.limit.groups` | limite de **comunidades de cuidado** (`{current}/{limit}`) + "fale com o administrador para ampliar o plano" |
| `error.plan.limit.membersPerGroup` | máximo de **participantes do grupo** nesta comunidade (`{current}/{limit}`) + ação |
| `error.plan.limit.leadersPerTenant` | limite de **pastores/líderes ativos** (`{current}/{limit}`) + ação |
| `error.plan.limitGeneric` | "Você alcançou um limite do seu plano. Fale com o administrador para ampliar o plano." (sem placeholders) |

**Invariantes**:
1. Nenhum texto contém termo técnico (`resource`, `plan`, `groups`, `count`).
2. Nenhum texto exibido contém `{` não-interpolado (FR-005).
3. Cada texto é acolhedor e termina com ação concreta (FR-004, FR-009).
