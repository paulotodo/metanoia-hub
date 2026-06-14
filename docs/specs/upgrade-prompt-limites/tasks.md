# Backlog de Implementação: upgrade-prompt-limites

**Feature**: upgrade-prompt-limites  
**Spec**: [`spec.md`](./spec.md) · **Plano**: [`plan.md`](./plan.md)  
**Gerado por**: pipeline feature-00c (create-tasks, onda-004, 2026-06-14)  
**Status**: Pronto para execução

---

## Legenda de Criticidade

- `[crit]` — bloqueante; sem isso a feature não pode mergear
- `[imp]` — importante; afeta qualidade/cobertura mas não bloqueia build
- `[opt]` — opcional; melhoria incremental se houver tempo

---

## Escopo Coberto

- `apps/web/messages/pt-BR.json` — 4 chaves novas + remoção de `limitReached` bugada
- `apps/web/src/lib/errors/error-messages.ts` — mapa resource→errorKey + fallback corrigido
- `apps/web/src/lib/errors/__tests__/error-messages.spec.ts` — atualização e expansão de cobertura

## Escopo Excluído

- Qualquer arquivo em `apps/api/` — backend inalterado
- `apps/web/src/lib/api/client.ts` — inalterado
- Novos componentes de UI, toasts, links para `/planos`
- Schema Zod para `details` do erro 403

---

## Matriz de Dependências

```text
FASE-1.1 ──► FASE-1.2 ──► FASE-1.3 ──► FASE-2.1
                                     └──► FASE-2.2
                                     └──► FASE-2.3
                                     └──► FASE-2.4
```

- FASE-1.1 → 1.2 → 1.3: pipeline de decisão e mudança de chaves (ordem estrita)
- FASE-2.x: todas dependem de FASE-1.3 (arquivos prontos); independentes entre si

---

## Resumo das Tasks

| ID | Título | Arquivos Afetados | Criticidade |
|----|--------|-------------------|-------------|
| FASE-1.1 | Reconciliar fallback CHK009: convenção de chave coherente | `error-messages.ts` | `[crit]` |
| FASE-1.2 | Corrigir bug `pt-BR.json:1057` e migrar chave `limitReached` | `pt-BR.json` | `[crit]` |
| FASE-1.3 | Adicionar 4 chaves PT-BR pastorais no `pt-BR.json` | `pt-BR.json` | `[crit]` |
| FASE-2.1 | Implementar mapa `RESOURCE_TO_KEY` em `error-messages.ts` | `error-messages.ts` | `[crit]` |
| FASE-2.2 | Corrigir teste mascarador e adicionar casos por recurso | `error-messages.spec.ts` | `[crit]` |
| FASE-2.3 | Adicionar cobertura de fallback resource-desconhecido | `error-messages.spec.ts` | `[crit]` |
| FASE-2.4 | Snapshot do mapa resource→texto (regressão) | `error-messages.spec.ts` | `[imp]` |

---

## Tasks Detalhadas

### FASE-1.1 — Reconciliar fallback CHK009: convenção de chave coerente [crit]

**Dependência**: nenhuma (primeira task)  
**FR/AC**: CHK009 (checklist) · FR-005 (fallback sem placeholder) · FR-008 (mapeamento por recurso)

**Contexto do problema**:  
O mecanismo de fallback existente em `error-messages.ts:82-91` usa `${mappedKey}Generic` para montar a chave de fallback. Hoje `mappedKey = 'plan.limitReached'`, produzindo `plan.limitReachedGeneric` — que existe em `pt-BR.json`. Com a nova estrutura `error.plan.limit.<resource>` (chaves aninhadas), o mesmo mecanismo produziria `plan.limit.groupsGeneric` — chave que não existirá e quebraria o fallback silenciosamente.

**Decisão a implementar** (deve ser tomada antes de qualquer mudança de arquivo):

Opção A (recomendada): Manter o mapeamento `PlanLimitReached → 'plan.limitGeneric'` em `ERROR_NAME_TO_KEY`, eliminando a dependência do `${mappedKey}Generic`. O mapa `RESOURCE_TO_KEY` (FASE-2.1) retorna a chave específica por resource; quando resource é desconhecido/ausente, `resolveError` cai diretamente em `plan.limitGeneric` (não no sufixo `Generic` automático).

Opção B (não recomendada): Manter `ERROR_NAME_TO_KEY['PlanLimitReached'] = 'plan.limitReached'` e criar alias `plan.limitReachedGeneric → plan.limitGeneric`. Isso exige manter dois nomes de chave com semântica igual — tech debt sem benefício.

**Critério de done**:
- [ ] Decisão documentada em comentário JSDoc ou inline no `error-messages.ts`
- [ ] O mecanismo de fallback `${mappedKey}Generic` NÃO é responsável pelo fallback de `PlanLimitReached` — ou esse padrão foi explicitamente preservado de forma coerente com as novas chaves
- [ ] Nenhuma chave inexistente é referenciada pelo código (verificar via `grep` + inspeção)

**Arquivos afetados**:
- `apps/web/src/lib/errors/error-messages.ts` (decisão de design, sem mudança de código nesta task — apenas clareza antes de codificar)

---

### FASE-1.2 — Corrigir bug `pt-BR.json:1057` e migrar chave `limitReached` [crit]

**Dependência**: FASE-1.1 (convenção decidida)  
**FR/AC**: FR-001 (sem termos técnicos ao usuário) · FR-005 (sem `{` literal na tela) · Spec §Bug latente

**O que fazer**:

1. Remover (ou substituir) a chave `error.plan.limitReached` (`pt-BR.json:1057`) que interpola `{resource}` cru — essa interpolação produz `"3/3 groups"` ou `"3/3 membersPerGroup"` em inglês, violando FR-001.

2. Remover (ou renomear) `error.plan.limitReachedGeneric` (`pt-BR.json:1058`) — substituída por `error.plan.limitGeneric` (texto pastoral melhorado, task FASE-1.3).

3. Se FASE-1.1 escolheu Opção A: as duas chaves são REMOVIDAS (não há mais referência a `plan.limitReached` no código após FASE-2.1).

4. Verificar se há outros callers de `error.plan.limitReached` além de `resolveError`:
   ```bash
   grep -rn "limitReached\|limitReachedGeneric" apps/web/src/ apps/web/messages/
   ```
   Único caller conhecido: `ERROR_NAME_TO_KEY` em `error-messages.ts:11` e o teste `error-messages.spec.ts:15,31,39`.

**Critério de done**:
- [ ] `pt-BR.json` não contém `{resource}` em nenhuma string do namespace `error.plan.*`
- [ ] `grep -r 'limitReached' apps/web/messages/` → zero resultados (ou alias explicitamente mantido se Opção B foi escolhida em FASE-1.1)
- [ ] `node -e "require('./apps/web/messages/pt-BR.json')"` → sem erro (JSON válido)

**Arquivos afetados**:
- `apps/web/messages/pt-BR.json` — linhas 1056–1058 (remoção/substituição)

---

### FASE-1.3 — Adicionar 4 chaves PT-BR pastorais em `pt-BR.json` [crit]

**Dependência**: FASE-1.2 (chave bugada removida; namespace limpo)  
**FR/AC**: FR-002 (3 chaves distintas) · FR-003 (current/limit) · FR-004 (ação acionável) · FR-009 (tom acolhedor)

**Chaves a adicionar** (dentro de `error.plan`, substituindo o bloco removido em FASE-1.2):

```json
"plan": {
  "limit": {
    "groups": "Você alcançou o limite de comunidades de cuidado do seu plano ({current}/{limit}). Fale com o administrador para ampliar o plano.",
    "membersPerGroup": "Esta comunidade de cuidado já reúne o máximo de participantes do grupo ({current}/{limit}) permitido no plano. Fale com o administrador para ampliar o plano.",
    "leadersPerTenant": "Você alcançou o limite de pastores/líderes ativos do seu plano ({current}/{limit}). Fale com o administrador para ampliar o plano."
  },
  "limitGeneric": "Você alcançou um limite do seu plano. Fale com o administrador para ampliar o plano."
}
```

> Nota: o texto exato pode ser ajustado por UX writer (CHK034, item humano), mas a estrutura de chaves deve seguir este schema exato.

**Validações obrigatórias**:
- Cada chave de `plan.limit.*` contém `{current}` e `{limit}` — e SOMENTE esses placeholders (sem `{resource}`)
- `plan.limitGeneric` não contém nenhum placeholder `{`
- Glossário canônico (dec-007): `groups`→"comunidades de cuidado", `membersPerGroup`→"participantes do grupo", `leadersPerTenant`→"pastores/líderes ativos"
- Tom: acolhedor, não punitivo (FR-009)

**Critério de done**:
- [ ] `jq '.error.plan.limit | keys' apps/web/messages/pt-BR.json` → `["groups","leadersPerTenant","membersPerGroup"]`
- [ ] `jq '.error.plan.limitGeneric' apps/web/messages/pt-BR.json` → string sem `{`
- [ ] Nenhuma chave de `error.plan.limit.*` contém `{resource}` (verificar com `grep`)
- [ ] JSON permanece válido: `node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/pt-BR.json','utf8'))"` → ok

**Arquivos afetados**:
- `apps/web/messages/pt-BR.json` — bloco `error.plan` (linhas ~1056–1058, expansão)

---

### FASE-2.1 — Implementar mapa `RESOURCE_TO_KEY` em `error-messages.ts` [crit]

**Dependência**: FASE-1.1 (convenção de fallback definida) + FASE-1.3 (chaves PT-BR existem no JSON)  
**FR/AC**: FR-001 · FR-002 · FR-005 · FR-008 · research §D3

**O que implementar** em `apps/web/src/lib/errors/error-messages.ts`:

1. Definir a união literal de recursos (espelhando `PlanLimitedResource` do backend — não importar):
   ```typescript
   type PlanLimitedResource = 'groups' | 'membersPerGroup' | 'leadersPerTenant';
   ```

2. Criar o mapa tipado:
   ```typescript
   const RESOURCE_TO_KEY: Record<PlanLimitedResource, string> = {
     groups: 'plan.limit.groups',
     membersPerGroup: 'plan.limit.membersPerGroup',
     leadersPerTenant: 'plan.limit.leadersPerTenant',
   };
   ```

3. Atualizar `ERROR_NAME_TO_KEY` para apontar para `plan.limitGeneric` (Opção A de FASE-1.1):
   ```typescript
   PlanLimitReached: 'plan.limitGeneric',  // fallback quando resource ausente/desconhecido
   ```

4. Atualizar a lógica de `resolveError` no branch `PlanLimitReached`:
   - Antes de usar `mappedKey`, verificar se `details.resource` é um valor conhecido em `RESOURCE_TO_KEY`
   - Se sim: usar `RESOURCE_TO_KEY[details.resource]` como chave, interpolar com `params` (que contém `current`, `limit`)
   - Se não (ausente, desconhecido, ou `resource` não é string): usar `plan.limitGeneric` direto (sem `${mappedKey}Generic`)
   - O guard `interpolated.includes('{')` deve ser mantido como camada de defesa adicional (FR-005), mas com as novas chaves jamais deverá disparar para os 3 recursos conhecidos

   Pseudocódigo da lógica atualizada:
   ```typescript
   // dentro do branch `if (mappedKey)` para PlanLimitReached:
   const resource = typeof details['resource'] === 'string' ? details['resource'] : undefined;
   const resourceKey = resource && resource in RESOURCE_TO_KEY
     ? RESOURCE_TO_KEY[resource as PlanLimitedResource]
     : mappedKey; // mappedKey = 'plan.limitGeneric' para PlanLimitReached
   const template = lookup(resourceKey);
   ```

**Critério de done**:
- [ ] `tsc --noEmit` (ou `pnpm -F web typecheck`) → zero erros em `error-messages.ts`
- [ ] `resolveError(new ApiError(403, 'PlanLimitReached', '...', { resource: 'groups', current: 3, limit: 3 })).errorKey` → `'plan.limit.groups'`
- [ ] `resolveError(new ApiError(403, 'PlanLimitReached', '...', { resource: 'unknownResource', current: 1, limit: 1 })).errorKey` → `'plan.limitGeneric'`
- [ ] `resolveError(new ApiError(403, 'PlanLimitReached', '...')).errorKey` → `'plan.limitGeneric'`
- [ ] Nenhum dos outros caminhos de `resolveError` (Forbidden, NotFound, network, etc.) foi alterado
- [ ] `strict: true` mantido — sem `any`, sem cast unsafe

**Arquivos afetados**:
- `apps/web/src/lib/errors/error-messages.ts` — linhas 6–16 (`ERROR_NAME_TO_KEY`), bloco `resolveError` (~linha 74–98)

---

### FASE-2.2 — Corrigir teste mascarador e adicionar casos por recurso [crit]

**Dependência**: FASE-2.1 (lógica implementada)  
**FR/AC**: FR-010 · SC-3 (3 mensagens distintas) · research §D5 · checklist CHK021 · CHK030

**Testes a modificar** em `apps/web/src/lib/errors/__tests__/error-messages.spec.ts`:

1. **Remover/corrigir** o teste `'uses details.errorKey when present'` (linhas 6–19):
   - Hoje: passa `resource: 'grupos'` (PT, jamais enviado pelo backend) + `errorKey: 'plan.limitReached'`
   - Após FASE-1.2: `plan.limitReached` não existe mais no JSON → o teste quebraria de qualquer forma
   - Decisão: remover este teste ou reescrever para cobrir o path `details.errorKey` com uma chave real que ainda exista
   - Se mantido com `errorKey`: usar `errorKey: 'plan.limit.groups'` + `resource: 'groups'`, `current: 2`, `limit: 3` (contrato real)

2. **Corrigir** o teste `'interpolates plan.limitReached from PlanLimitReached + backend details'` (linhas 21–34):
   - Hoje: `resource: 'grupos'` (PT), espera `'3/3 grupos'` — mascarava o bug
   - Após: `resource: 'groups'` (canônico inglês, como o backend envia)
   - Nova asserção: `expect(r.errorKey).toBe('plan.limit.groups')` + `expect(r.message).toContain('3/3')` + `expect(r.message).toContain('comunidades de cuidado')` + `expect(r.message).not.toContain('{')` + `expect(r.message).not.toContain('groups')` (sem termo técnico)

3. **Corrigir** o teste `'falls back to plan.limitReachedGeneric when details lack interpolation keys'` (linhas 36–41):
   - Após FASE-1.2: `plan.limitReachedGeneric` não existe mais
   - Nova asserção: `expect(r.errorKey).toBe('plan.limitGeneric')`

4. **Adicionar** testes por recurso (mínimo 3, um por `PlanLimitedResource`):
   ```typescript
   it('maps groups → comunidades de cuidado (PT-BR pastoral)', () => { ... });
   it('maps membersPerGroup → participantes do grupo (PT-BR pastoral)', () => { ... });
   it('maps leadersPerTenant → pastores/líderes ativos (PT-BR pastoral)', () => { ... });
   ```
   Cada teste: `resource: '<canonical>'`, `current: X`, `limit: Y` → mensagem contém termo pastoral correto, contém `X/Y`, não contém `{`, não contém o valor canônico inglês do resource.

**Critério de done**:
- [ ] `pnpm -F web test error-messages` → verde (zero falhas)
- [ ] Nenhum teste passa `resource` em PT-BR — todos usam o valor canônico inglês (`groups`/`membersPerGroup`/`leadersPerTenant`)
- [ ] O teste do caminho `PlanLimitReached` usa `resource: 'groups'` e afirma `errorKey === 'plan.limit.groups'`
- [ ] O fallback test usa `errorKey === 'plan.limitGeneric'`
- [ ] Testes existentes para `Forbidden`, `NotFound`, `ConsentRequired`, `network`, `unknown`, `statusCode`, `'never echoes raw message'` continuam passando sem alteração

**Arquivos afetados**:
- `apps/web/src/lib/errors/__tests__/error-messages.spec.ts` — linhas 6–41 (modificação) + linhas novas após linha 41

---

### FASE-2.3 — Adicionar cobertura de fallback resource-desconhecido [crit]

**Dependência**: FASE-2.1 (lógica de fallback implementada)  
**FR/AC**: FR-005 · FR-010 · CHK002 · CHK018

**Testes a adicionar** em `apps/web/src/lib/errors/__tests__/error-messages.spec.ts`:

1. `resource` ausente (`details` sem campo `resource`):
   ```typescript
   it('falls back to limitGeneric when resource field is absent', () => {
     const err = new ApiError(403, 'PlanLimitReached', 'exceeded', { current: 1, limit: 1 });
     const r = resolveError(err);
     expect(r.errorKey).toBe('plan.limitGeneric');
     expect(r.message).not.toContain('{');
   });
   ```

2. `resource` desconhecido (valor fora do enum canônico):
   ```typescript
   it('falls back to limitGeneric when resource is an unknown value', () => {
     const err = new ApiError(403, 'PlanLimitReached', 'exceeded', {
       resource: 'trailsPerTenant', // valor futuro não mapeado ainda
       current: 5, limit: 3,
     });
     const r = resolveError(err);
     expect(r.errorKey).toBe('plan.limitGeneric');
     expect(r.message).not.toContain('{');
     expect(r.message).not.toContain('trailsPerTenant'); // sem vazar valor técnico
   });
   ```

3. `details` completamente ausente (sem payload estruturado):
   ```typescript
   it('falls back to limitGeneric when PlanLimitReached has no details', () => {
     const err = new ApiError(403, 'PlanLimitReached', 'exceeded');
     const r = resolveError(err);
     expect(r.errorKey).toBe('plan.limitGeneric');
     expect(r.message).not.toContain('{');
   });
   ```

**Critério de done**:
- [ ] Os 3 casos de fallback acima passam no Vitest
- [ ] Em nenhum caso o output contém `{` (guard FR-005)
- [ ] Em nenhum caso o output contém termos técnicos em inglês (`groups`, `membersPerGroup`, `leadersPerTenant`, `trailsPerTenant`)

**Arquivos afetados**:
- `apps/web/src/lib/errors/__tests__/error-messages.spec.ts` — adição de 3 novos casos

---

### FASE-2.4 — Snapshot do mapa resource→texto (regressão) [imp]

**Dependência**: FASE-2.1 + FASE-1.3 (mapa e chaves existem)  
**FR/AC**: SC-3 (3 mensagens distintas verificáveis) · CHK027 · research §D3

**O que adicionar** em `apps/web/src/lib/errors/__tests__/error-messages.spec.ts`:

Snapshot do comportamento completo do mapa para os 3 recursos, protegendo contra mudança acidental de texto pastoral:

```typescript
describe('RESOURCE_TO_KEY pastoral mapping (snapshot)', () => {
  const resources = ['groups', 'membersPerGroup', 'leadersPerTenant'] as const;

  it.each(resources)('resource %s → distinct PT-BR pastoral message', (resource) => {
    const err = new ApiError(403, 'PlanLimitReached', 'exceeded', {
      resource,
      plan: 'starter',
      current: 2,
      limit: 5,
    });
    const r = resolveError(err);
    expect(r.message).toMatchSnapshot();
    expect(r.message).not.toContain('{');
    expect(r.message).not.toContain(resource); // nunca exibe o valor técnico
    expect(r.message).toContain('2'); // interpola current
    expect(r.message).toContain('5'); // interpola limit
  });

  it('three resources produce three distinct messages', () => {
    const msgs = resources.map((resource) =>
      resolveError(
        new ApiError(403, 'PlanLimitReached', 'exceeded', { resource, current: 1, limit: 1 }),
      ).message,
    );
    expect(new Set(msgs).size).toBe(3); // todos distintos (SC-3)
  });
});
```

**Critério de done**:
- [ ] `pnpm -F web test error-messages` → gera snapshots em `__tests__/__snapshots__/error-messages.spec.ts.snap`
- [ ] Snapshots commitados junto com o PR (não em `.gitignore`)
- [ ] 3 snapshots distintos (conteúdo diferente por recurso)
- [ ] O teste `'three resources produce three distinct messages'` passa

**Arquivos afetados**:
- `apps/web/src/lib/errors/__tests__/error-messages.spec.ts` — adição do describe de snapshot
- `apps/web/src/lib/errors/__tests__/__snapshots__/error-messages.spec.ts.snap` — gerado automaticamente

---

## Ordem de Execução Recomendada

1. FASE-1.1 — decisão de design (sem código; 5 min de análise)
2. FASE-1.2 — remoção das chaves bugadas de `pt-BR.json`
3. FASE-1.3 — adição das 4 chaves novas em `pt-BR.json`
4. FASE-2.1 — implementar `RESOURCE_TO_KEY` + lógica em `error-messages.ts`
5. FASE-2.2 — corrigir e expandir testes existentes
6. FASE-2.3 — adicionar cobertura de fallback
7. FASE-2.4 — snapshot de regressão

Todas as tasks FASE-2.x podem ser feitas no mesmo commit ou em commits granulares por fase, desde que `pnpm -F web test` esteja verde ao final de cada commit.

---

## Notas Adicionais

- **CHK034 (humano, não bloqueante)**: o texto pastoral proposto deve ser validado por UX writer/pastor antes do merge. A task FASE-1.3 entrega o texto proposto no spec; ajustes de copy não requerem nova task, apenas edição do `pt-BR.json`.
- **CHK035 (humano, não bloqueante)**: decisão de produto sobre incluir link para `/planos` vs. texto orientativo. Se revisado, impacta só `pt-BR.json` (sem mudança de código TypeScript).
- **Callers de `resolveError`**: confirmar via `grep -rn "resolveError" apps/web/src/` que o único caller é o handler de erro existente. Se houver mais, garantir que todos estejam consistentes com as novas chaves após FASE-2.1.
