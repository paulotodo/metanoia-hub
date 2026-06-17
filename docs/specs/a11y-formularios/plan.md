# Implementation Plan: a11y-formularios

> **Feature**: Story 12.5 — Formularios Acessiveis (NFR-A3)
> **Data**: 2026-06-17
> **Status**: Aprovado para implementacao

---

## Summary

**Requisito primario**: Garantir conformidade WCAG AA em todos os 17 formularios do
metanoia-hub (autenticacao, onboarding, pastoral e marketing), eliminando os gaps de
`aria-describedby`, `aria-invalid`, `aria-required`, `aria-busy` e foco no erro
identificados na auditoria pre-spec.

**Abordagem tecnica**:
1. Criar componente `FormField` reutilizavel (`apps/web/src/components/forms/form-field.tsx`)
   com gestao de IDs ARIA via `useId()`, mensagens de erro com `role="alert"`, e variante
   `fieldset/legend` para grupos radio/checkbox.
2. Criar utilitarios `scrollToFirstError()` e `SubmitButton` em `apps/web/src/lib/form-utils.ts`.
3. Adicionar namespace `form.*` em `apps/web/messages/pt-BR.json`.
4. Retrofitar os 17 formularios em 3 fases priorizadas (must-have primeiro, should-have depois).
5. Cobrir com `jest-axe` (unit) e `@axe-core/playwright` (E2E) — ambas as libs ja instaladas.

**Decisoes chave** (todas resolvidas no Phase 0 / clarify):
- `FormField` mora em `apps/web/src/components/forms/` (nao em `packages/ui`) — NC3/dec-010.
- Erros inline por campo via `aria-describedby` + `aria-invalid` + `role="alert"` — NC4/dec-011.
- `aria-invalid` omitido (nao `false`) quando campo valido — research Decision 3.
- `role="alert"` sem `aria-live` redundante — research Decision 4.
- `scrollToFirstError()` via seletor `[aria-invalid="true"]` — research Decision 5.
- Grupos radio/checkbox: `<fieldset>/<legend>` nativo, nao `role="radiogroup"` — research Decision 7.
- Testes: `jest-axe` (unit) + `@axe-core/playwright` (E2E publico) — research Decision 8.

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript 5.x, strict: true |
| Framework | Next.js 16.2 (App Router) |
| Runtime React | React 18+ (useId() disponivel) |
| Componentes UI | `@metanoia/ui` — Input, Button, Card (primitivos) |
| Validacao | Zod + react-hook-form ^7.72.1 (formularios com RHF) / estado local (login, register) |
| Testes unit | Vitest ^4.1.3 + @testing-library/react + jest-axe ^10.0.0 |
| Testes E2E | Playwright ^1.59.1 + @axe-core/playwright ^4.11.3 |
| i18n | `apps/web/messages/pt-BR.json` (next-intl ou objeto importado diretamente) |
| Escopo de alteracao | Frontend apenas — zero alteracao em packages/types, API, DB |
| SSR/CSR | Formularios de autenticacao sao Client Components ("use client") |

---

## Constitution Check

*GATE: Deve passar antes do Phase 0. Re-checado apos Phase 1.*

| Principio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | N/A | Feature e frontend-only; nenhuma query/backend alterada |
| II. Type-Safety & UUIDs | PASS | Nenhuma alteracao em tipos compartilhados; FormField e tipado com strict |
| III. Idioma & Vocabulario Pastoral | PASS | Labels e mensagens de erro em PT-BR via pt-BR.json; codigo em ingles |
| IV. Contratos de API | N/A | Nenhum contrato de API alterado |
| V. Separacao de Estado no Frontend | PASS | FormField e Client Component quando usa useId(); Server Components nao afetados |
| VI. Qualidade Verificavel | PASS | WCAG AA e MUST na constitution; esta feature o implementa com cobertura jest-axe + E2E |
| VII. Processo de Entrega Auditavel | PASS | PR por fase; CI verde obrigatorio (lint + test + build) |

**Resultado**: PASS em todos os principios aplicaveis. Nenhuma violacao de MUST detectada.

---

## Project Structure

### Documentation (this feature)

```
docs/specs/a11y-formularios/
  spec.md          — Story 12.5 com clarificacoes NC1-NC4 (especificacao)
  plan.md          — Este arquivo (plano tecnico)
  research.md      — 8 decisoes tecnicas (Phase 0)
  data-model.md    — Contratos de props/interfaces React
  quickstart.md    — Cenarios de teste e validacao
```

### Source Code — novos artefatos

```
apps/web/
  src/
    components/
      forms/
        form-field.tsx           [NOVO] FormField reutilizavel
        index.ts                 [NOVO ou ATUALIZAR] Exportacoes do diretorio forms
    lib/
      form-utils.ts              [NOVO] scrollToFirstError() + SubmitButton
  messages/
    pt-BR.json                   [ATUALIZAR] namespace form.*
```

### Source Code — formularios a retrofitar

```
apps/web/
  app/
    (public)/
      login/_components/
        login-form.tsx                      [ATUALIZAR] Fase 1 — Must-have
      register/_components/
        register-form.tsx                   [ATUALIZAR] Fase 1 — Must-have
      recuperar-senha/_components/
        recovery-form.tsx                   [ATUALIZAR] Fase 2 — Should-have
      nova-senha/[token]/_components/
        reset-password-form.tsx             [ATUALIZAR] Fase 2 — Should-have
    (onboarding)/
      convite/[token]/criar-conta/_components/
        create-account-form.tsx             [ATUALIZAR] Fase 1 — Must-have
    (authenticated)/
      app/admin/grupos/novo/_components/
        create-group-form.tsx               [ATUALIZAR] Fase 2 — Should-have
      app/admin/igreja/grupos/[groupId]/trilhas/
        group-trails-client.tsx             [ATUALIZAR] Fase 2 — Should-have
      app/gestao/radar/[participantId]/cuidado/
        page.tsx                            [ATUALIZAR] Fase 2 — Should-have
      app/gestao/reunioes/[meetingId]/reflexao/
        page.tsx                            [ATUALIZAR] Fase 2 — Should-have
  src/
    components/
      onboarding/wizard/steps/
        Step1Profile.tsx                    [ATUALIZAR] Fase 1 — Must-have
        Step2Community.tsx                  [ATUALIZAR] Fase 1 — Must-have
        Step3Group.tsx                      [ATUALIZAR] Fase 1 — Must-have (fieldset)
        Step4Invite.tsx                     [ATUALIZAR] Fase 1 — Must-have
      groups/
        group-form.tsx                      [ATUALIZAR] Fase 2 — Should-have
        invite-members-form.tsx             [ATUALIZAR] Fase 2 — Should-have
      marketing/
        contact-message-form.tsx            [ATUALIZAR] Fase 2 — Should-have
        demo-request-form.tsx               [ATUALIZAR] Fase 2 — Should-have
      meetings/
        reflection-form-field.tsx           [ATUALIZAR] Fase 2 — Should-have (prop required)
      forms/
        password-input-with-toggle.tsx      [ATUALIZAR] Fase 2 — Should-have (audit)
        terms-checkbox.tsx                  [ATUALIZAR] Fase 2 — Should-have (audit)
        day-of-week-select.tsx              [ATUALIZAR] Fase 2 — Should-have (audit)
```

### Source Code — testes

```
apps/web/
  src/components/forms/__tests__/
    form-field.spec.tsx                     [NOVO] jest-axe: FormField valid/error/recovered
  src/lib/__tests__/
    form-utils.spec.ts                      [NOVO] scrollToFirstError unit test
  src/__tests__/components/
    [formulario].spec.tsx                   [NOVO/ATUALIZAR] jest-axe por form
  e2e/
    a11y-forms.spec.ts                      [NOVO] @axe-core/playwright rotas publicas
```

---

## Convencoes de Borda

**N/A — Single-layer (frontend only)**.

Esta feature nao atravessa fronteiras backend/frontend. Os formularios ja enviam dados
para APIs existentes; nenhum contrato de API e alterado. A unica "borda" relevante e:

| Camada | Convencao | Observacao |
|--------|-----------|------------|
| Props React | camelCase | TypeScript convencional |
| IDs DOM (ARIA) | `${useId()}-error`, `${useId()}-description` | Sufixo kebab-case |
| Chaves i18n | `form.error.required`, `form.submit`, etc. | Namespace dotted em pt-BR.json |
| Atributos HTML/ARIA | kebab-case | `aria-invalid`, `aria-describedby`, `aria-busy` |

---

## Design Tecnico: FormField

### Variante default (campo unico)

```
<div className="space-y-1">
  <label htmlFor={fieldId}>
    {label}
    {required && <span aria-hidden="true"> *</span>}
  </label>
  {description && <p id={`${fieldId}-description`}>{description}</p>}
  {React.cloneElement(children, {
    id: fieldId,
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': ariaDescribedby || undefined,
  })}
  {error && (
    <p id={`${fieldId}-error`} role="alert">
      {error}
    </p>
  )}
</div>
```

**Nota de implementacao**: usar `React.cloneElement` com `children` tipado como
`React.ReactElement<React.HTMLAttributes<HTMLElement>>` para injetar props ARIA
no controle filho sem acoplamento com o tipo especifico (Input, select, textarea).

### Variante fieldset (grupo radio/checkbox)

```
<fieldset>
  <legend>
    {legend}
    {required && <span aria-hidden="true"> *</span>}
  </legend>
  {children}
  {error && (
    <p id={`${fieldsetId}-error`} role="alert">
      {error}
    </p>
  )}
</fieldset>
```

---

## Design Tecnico: form-utils.ts

### scrollToFirstError()

```typescript
export function scrollToFirstError(): void {
  const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.focus();
}
```

### SubmitButton

```typescript
interface SubmitButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'> {
  label: string;
  pendingLabel: string;
  isPending: boolean;
}

export function SubmitButton({ label, pendingLabel, isPending, ...props }: SubmitButtonProps) {
  return (
    <Button
      {...props}
      type="submit"
      disabled={isPending}
      aria-busy={isPending || undefined}
    >
      {isPending ? (
        <>
          <span aria-hidden="true">{/* spinner SVG */}</span>
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
```

---

## Fases de implementacao

### Fase 0 — Infraestrutura (prerequisito para fases 1 e 2)

**US1 + US2 + US3**

| Tarefa | Arquivo | Descricao |
|--------|---------|-----------|
| T0.1 | `src/components/forms/form-field.tsx` | Criar FormField (variante default + fieldset) |
| T0.2 | `src/components/forms/index.ts` | Exportar FormField (e demais componentes do diretorio) |
| T0.3 | `src/lib/form-utils.ts` | scrollToFirstError() + SubmitButton |
| T0.4 | `messages/pt-BR.json` | Adicionar namespace `form.*` (erros genericos, submit, labels) |
| T0.5 | `src/components/forms/__tests__/form-field.spec.tsx` | jest-axe: FormField valid/error/recovered/fieldset |
| T0.6 | `src/lib/__tests__/form-utils.spec.ts` | Unit test scrollToFirstError + SubmitButton |

**Criterio de saida Fase 0**: `pnpm test` verde; FormField e form-utils exportados e testados.

---

### Fase 1 — Must-have: Autenticacao e Onboarding

**US4** — 7 formularios

| Formulario | Path | Gaps a corrigir |
|-----------|------|----------------|
| login-form | `app/(public)/login/_components/login-form.tsx` | aria-required, aria-describedby->erro, aria-invalid, scrollToFirstError, aria-busy |
| register-form | `app/(public)/register/_components/register-form.tsx` | aria-required (adicionar), scrollToFirstError, aria-busy; aria-describedby ja parcial |
| create-account-form | `app/(onboarding)/convite/[token]/criar-conta/_components/create-account-form.tsx` | audit + retrofit completo com FormField |
| Step1Profile | `src/components/onboarding/wizard/steps/Step1Profile.tsx` | aria-label no input file, role="alert" no erro de upload, aria-busy |
| Step2Community | `src/components/onboarding/wizard/steps/Step2Community.tsx` | fieldset/legend para cidade+estado, aria-label no logo file, aria-busy |
| Step3Group | `src/components/onboarding/wizard/steps/Step3Group.tsx` | fieldset/legend para radiogroup (substituir role="radiogroup"), aria-invalid, aria-describedby, aria-required, aria-busy |
| Step4Invite | `src/components/onboarding/wizard/steps/Step4Invite.tsx` | aria-required, aria-describedby->erro, aria-invalid, "(opcional)" em campos opcionais, aria-busy |

**Criterio de saida Fase 1**: todos os 7 formularios com `toHaveNoViolations()`; CI verde.

---

### Fase 2 — Should-have: Pastoral, Gestao e Marketing

**US5** — 10 formularios

| Formulario | Path | Gaps a corrigir |
|-----------|------|----------------|
| recovery-form | `app/(public)/recuperar-senha/_components/recovery-form.tsx` | audit + retrofit com FormField |
| reset-password-form | `app/(public)/nova-senha/[token]/_components/reset-password-form.tsx` | audit + retrofit com FormField |
| group-form | `src/components/groups/group-form.tsx` | aria-invalid dinamico (ja tem aria-describedby estatico), scrollToFirstError |
| invite-members-form | `src/components/groups/invite-members-form.tsx` | remover aria-label redundante, aria-describedby->erro |
| create-group-form | `app/(authenticated)/app/admin/grupos/novo/_components/create-group-form.tsx` | audit + retrofit com FormField |
| group-trails-client | `app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/group-trails-client.tsx` | audit + retrofit com FormField |
| radar/cuidado | `app/(authenticated)/app/gestao/radar/[participantId]/cuidado/page.tsx` | audit + retrofit com FormField |
| reunioes/reflexao | `app/(authenticated)/app/gestao/reunioes/[meetingId]/reflexao/page.tsx` + `src/components/meetings/reflection-form-field.tsx` | prop required, aria-required |
| contact-message-form | `src/components/marketing/contact-message-form.tsx` | aria-describedby, scrollToFirstError, label para select |
| demo-request-form | `src/components/marketing/demo-request-form.tsx` | aria-describedby, scrollToFirstError, label para select churchSize |

**Auditoria de componentes auxiliares (dentro da Fase 2)**:

| Componente | Path | Acao |
|-----------|------|------|
| `password-input-with-toggle.tsx` | `src/components/forms/` | Auditar aria-required, aria-invalid propagacao |
| `terms-checkbox.tsx` | `src/components/forms/` | Auditar aria-required, aria-invalid; label ja presente |
| `day-of-week-select.tsx` | `src/components/forms/` | Auditar aria-required, aria-invalid; label via htmlFor no parent |

**Criterio de saida Fase 2**: todos os 10 formularios com `toHaveNoViolations()`; CI verde.

---

### Fase 3 — Testes E2E e cobertura final

**US6**

| Tarefa | Path | Descricao |
|--------|------|-----------|
| T3.1 | `e2e/a11y-forms.spec.ts` | @axe-core/playwright: `/login`, `/register`, `/recuperar-senha`, `/nova-senha/token`, `/convite/token/criar-conta` |
| T3.2 | Jest-axe por formulario | Garantir cobertura em todos os 17 forms (unit specs co-localizados) |
| T3.3 | Regressao | Verificar que testes existentes continuam passando apos refactor |

---

## Detalhes criticos de implementacao

### Injecao de props ARIA no controle filho (FormField)

`FormField` usa `React.cloneElement` para injetar `id`, `aria-required`, `aria-invalid`,
`aria-describedby` no filho sem coupling com o tipo do controle:

```typescript
// Pseudo-codigo — detalhes em form-field.tsx
const child = React.Children.only(children) as React.ReactElement;
const injectedChild = React.cloneElement(child, {
  id: fieldId,
  'aria-required': required ? true : undefined,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': ariaDescribedby || undefined,
});
```

**Restricao**: filho deve aceitar `id`, `aria-*` como HTML attributes (Input, select,
textarea, PasswordInputWithToggle — todos aceitam via `...props` ou `...rest`).

### Composicao do aria-describedby

```typescript
const parts: string[] = [];
if (description) parts.push(`${fieldId}-description`);
if (error) parts.push(`${fieldId}-error`);
const ariaDescribedby = parts.length > 0 ? parts.join(' ') : undefined;
```

Ordem: description primeiro (hint permanente), erro depois (dinamico) — leitores de tela
anunciam na ordem do valor do atributo.

### Step3Group — conversao de radiogroup

Antes (problematico):
```tsx
<div role="radiogroup" aria-labelledby="mode-label">
  <p id="mode-label">Como voce quer comecar?</p>
  {/* botoes de radio ad-hoc */}
</div>
```

Depois (correto):
```tsx
<fieldset>
  <legend>Como voce quer comecar?</legend>
  <div className="flex flex-col gap-3">
    <label>
      <input type="radio" name="group-mode" value="create" ... />
      Criar meu grupo
    </label>
    <label>
      <input type="radio" name="group-mode" value="demo" ... />
      Explorar com dados de exemplo
    </label>
  </div>
</fieldset>
```

### login-form — form nativo (NC1)

O `login-form.tsx` e um form nativo Next.js (confirmado por dec-008). Nao usa
`useForm` de react-hook-form. O retrofit adiciona `aria-*` direto nos elementos
HTML sem necessidade de `FormField` obrigatorio — pode usar FormField como wrapper
ou adicionar os atributos manualmente. Preferir FormField para consistencia.

### group-trails-client — Radar Pastoral e reunioes

Estes forms autenticados nao tem fluxo de login a ser simulado no E2E. Os testes
E2E cobrem apenas rotas publicas (`/login`, `/register`, `/recuperar-senha`,
`/nova-senha`, `/convite`). Para forms autenticados: cobertura via jest-axe (unit).

---

## Qualidade

### Gate owasp-security

**Avaliacao**: SKIP com justificativa auditada.

Esta feature e camada de apresentacao (frontend-only, acessibilidade ARIA). Nao ha:
- Novos endpoints de API
- Alteracao de autenticacao/autorizacao
- Processamento de dados sensiveis novos
- Logica de negocio

Os formularios de autenticacao (login, register, recovery, reset-password) existentes
ja passaram por revisao de seguranca. Esta feature adiciona apenas atributos ARIA
e utilitarios de focus — zero superficie OWASP nova.

Decisao registrada: `dec-018` (owasp-security skip, score 3, evidencia: "feature e
acessibilidade ARIA pura sem endpoint, auth, ou dados novos").

### jest-axe — regras ativas

Regras relevantes para formularios:
- `label`: todo controle de formulario tem label associado
- `aria-allowed-attr`: atributos ARIA validos para o role do elemento
- `aria-required-attr`: atributos ARIA obrigatorios presentes
- `aria-valid-attr-value`: valores de atributos ARIA validos

### Criterios de sucesso (da spec)

| Criterio | Metrica |
|----------|---------|
| SC1 | 17 formularios com `toHaveNoViolations()` (jest-axe) |
| SC2 | 5 rotas publicas com zero violacoes WCAG AA (@axe-core/playwright) |
| SC3 | `scrollToFirstError()` move foco ao primeiro `[aria-invalid="true"]` |
| SC4 | `aria-busy="true"` + `disabled` no submit durante submissao |
| SC5 | `role="alert"` nas mensagens de erro; sem `aria-live` redundante |
| SC6 | `useId()` garante IDs estaveis entre SSR e CSR |
| SC7 | Step3 usa `<fieldset>/<legend>` nativo (nao `role="radiogroup"`) |
| SC8 | Testes existentes passam apos refactor |

---

## Complexity Tracking

Nenhuma violacao de principio MUST na constitution. Sem entrada necessaria.

---

## Artefatos

| Arquivo | Status |
|---------|--------|
| `docs/specs/a11y-formularios/plan.md` | Criado |
| `docs/specs/a11y-formularios/research.md` | Criado (8 decisoes) |
| `docs/specs/a11y-formularios/data-model.md` | Criado |
| `docs/specs/a11y-formularios/quickstart.md` | Criado (8 cenarios) |
| `docs/specs/a11y-formularios/contracts/` | N/A — single-layer |

---

## Proximos Passos

1. `/checklist` — Gerar quality gate antes de implementar
2. `/create-tasks` — Decompor plano em tarefas executaveis (Fase 0 + 1 + 2 + 3)
3. `/execute-task` — Implementar a partir da Fase 0 (FormField + form-utils)
