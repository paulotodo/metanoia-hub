# Tasks — Story 12.5: Formulários Acessíveis (NFR-A3)

**Feature**: a11y-formularios
**Epic**: 12 — Acessibilidade
**Gerado em**: 2026-06-17
**Versão do plan**: 1.0.0 (plan.md aprovado)
**Pipeline**: create-tasks → execute-task

> **Reconciliação CHK016 (dec-025)**: prop do `SubmitButton` usa `pendingLabel`
> (plan.md + data-model.md — artefatos mais recentes). A spec SC2.3 (`labelPending`)
> estava divergente — todas as tasks abaixo usam `pendingLabel`.
>
> **Resolução CHK030 (dec-027)**: `scrollToFirstError()` usa DOM order
> (`document.querySelector('[aria-invalid="true"]')`) — correto para WCAG 1.3.2.
>
> **Resolução CHK034 (dec-028)**: transição `pending→error` é implícita —
> quando o pai seta `isPending=false`, `aria-busy` e `disabled` são removidos.
>
> **Resolução CHK035 (dec-029)**: `login-form.tsx` usa `useState<Errors>` para
> gerenciar `aria-invalid` dinamicamente sem react-hook-form.

---

## Legenda de Criticidade

- **[crit]** — Crítico: bloqueia todas as outras tasks da mesma fase ou é gate de CI
- **[high]** — Alta: must-have da story; sem isso a story não está entregue
- **[med]** — Média: should-have; melhora cobertura mas não bloqueia entrega
- **[low]** — Baixa: refinamento ou conveniência; pode ser adiado se necessário

---

## Escopo Coberto

- Fase 0: FormField + form-utils + i18n (infraestrutura para todas as demais fases)
- Fase 1: 7 formulários must-have (autenticação + onboarding)
- Fase 2: 10 formulários should-have (pastoral, gestão, marketing) + 3 componentes auxiliares
- Fase 3: Testes E2E Playwright + cobertura jest-axe final + regressão

## Escopo Excluído

- `BrandingSettingsForm.tsx` — adiado para story `settings-a11y` (dec-013)
- `super/tenants/novo/page.tsx` — adiado para story `settings-a11y` (dec-013)
- `packages/types` — nenhuma alteração de Zod/contratos de API
- Backend/API — feature é frontend-only

---

## Matriz de Dependências

```
0.1 (FormField) <── 0.2 (index.ts)
0.1 <── 0.5 (form-field.spec.tsx)
0.3 (form-utils) <── 0.4 (pt-BR.json)
0.3 <── 0.6 (form-utils.spec.ts)
[0.1 + 0.3 + 0.4] <── FASE 1 inteira
FASE 1 <── FASE 2 inteira
[FASE 1 + FASE 2] <── 3.1 (E2E)
[FASE 1 + FASE 2] <── 3.2 (cobertura jest-axe)
[FASE 1 + FASE 2] <── 3.3 (regressão)
```

---

## Resumo de Tasks por Fase

| Fase | Tasks | Tipo | Formulários/artefatos |
|------|-------|------|-----------------------|
| Fase 0 | 0.1–0.6 | Infraestrutura | FormField, form-utils, i18n, testes unitários |
| Fase 1 | 1.1–1.7 | Must-have | login, register, create-account, wizard Steps 1-4 |
| Fase 2 | 2.1–2.13 | Should-have | 10 forms + 3 componentes auxiliares |
| Fase 3 | 3.1–3.3 | Qualidade | E2E Playwright + cobertura jest-axe + regressão |
| **Total** | **23 tasks** | | |

---

## FASE 0 — Infraestrutura (pré-requisito para Fases 1-3)

> **Critério de saída**: `pnpm turbo test --filter=@metanoia/web` verde; FormField e form-utils exportados e testados; namespace `form.*` em pt-BR.json presente.

### 0.1 Criar componente FormField reutilizável [crit]

**Arquivo-alvo**: `apps/web/src/components/forms/form-field.tsx` (NOVO)

**Descrição**: Criar o componente `FormField` com variante default e variante `fieldset`.
Encapsula label, input, description e erro com ARIA correto. Injeta props ARIA no
controle filho via `React.cloneElement`. Gera IDs estáveis via `useId()` quando `id`
não é fornecido.

**Implementação**:

- Props: `label`, `id?`, `error?`, `description?`, `required?`, `className?`, `children`
- Variante fieldset: `variant: 'fieldset'`, `legend`, `children`, `error?`, `required?`, `className?`
- `useId()` gera `baseId`; sufixos: `${baseId}-error`, `${baseId}-description`
- `aria-describedby` composto: description-id primeiro, error-id depois (omitido se ambos ausentes)
- `aria-invalid={true}` quando `error` é string não-vazia; **omitido** (não `false`) quando ausente
- `aria-required={true}` quando `required=true`; omitido caso contrário
- `role="alert"` na mensagem de erro (sem `aria-live` redundante)
- `<span aria-hidden="true"> *</span>` no label quando `required=true` (visual only)
- Variante fieldset: `<fieldset><legend>...</legend>{children}{error && <p role="alert">}</fieldset>`

**Critério de aceite**:
- [ ] TypeScript strict sem erros (`tsc --noEmit`)
- [ ] Renderiza `htmlFor` no label ligado ao `id` do controle
- [ ] Injeta `aria-required`, `aria-invalid`, `aria-describedby` no filho via `React.cloneElement`
- [ ] Quando `error` é `undefined`: `aria-invalid` é omitido do DOM (não `aria-invalid="false"`)
- [ ] Variante fieldset renderiza `<fieldset><legend>` nativo
- [ ] Exportado de `apps/web/src/components/forms/index.ts` (task 0.2)

**Dependências**: nenhuma (task raiz da Fase 0)

---

### 0.2 Exportar FormField em index.ts [high]

**Arquivo-alvo**: `apps/web/src/components/forms/index.ts` (NOVO ou ATUALIZAR se existir)

**Descrição**: Garantir que `FormField` (e demais componentes do diretório `forms/`) estão
exportados via barrel `index.ts`. Verificar se o arquivo já existe antes de criar.

**Critério de aceite**:
- [ ] `import { FormField } from '@/components/forms'` resolve sem erro
- [ ] Demais componentes pré-existentes no diretório continuam exportados

**Dependências**: 0.1

---

### 0.3 Criar form-utils.ts (scrollToFirstError + SubmitButton) [crit]

**Arquivo-alvo**: `apps/web/src/lib/form-utils.ts` (NOVO)

**Descrição**: Criar utilitários de formulário acessíveis.

**scrollToFirstError()**:
- Seletor: `document.querySelector<HTMLElement>('[aria-invalid="true"]')`
- Se encontrar: `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` → `el.focus()`
- Se não encontrar: retorna sem exceção (no-op)
- Ordem de foco: DOM order (dec-027 — WCAG 1.3.2 correto)

**SubmitButton**:
- Props: `label: string`, `pendingLabel: string`, `isPending: boolean` + HTMLButtonElement attrs (exceto `type`, `disabled`)
- Quando `isPending=true`: `aria-busy={true}`, `disabled`, spinner `<span aria-hidden="true">` + texto `pendingLabel`
- Quando `isPending=false`: sem `aria-busy`, sem `disabled`, exibe `label`
- Transição `pending→error` (dec-028): quando pai seta `isPending=false`, re-renderiza automaticamente sem `aria-busy`
- Usa componente `Button` de `@metanoia/ui`

**Critério de aceite**:
- [ ] `scrollToFirstError` exportada como função nomeada
- [ ] `SubmitButton` exportado como componente nomeado
- [ ] Prop é `pendingLabel` (não `labelPending`) — dec-025
- [ ] TypeScript strict sem erros

**Dependências**: nenhuma (pode ser desenvolvida em paralelo com 0.1)

---

### 0.4 Adicionar namespace form.* em pt-BR.json [high]

**Arquivo-alvo**: `apps/web/messages/pt-BR.json` (ATUALIZAR)

**Descrição**: Adicionar namespace `form` com chaves para erros genéricos, labels e
estados de submissão. Não duplicar chaves existentes (`register.*`, `group.field.name.error.*`).

**Chaves a adicionar** (CHK015 — lista concreta):

```json
{
  "form": {
    "error": {
      "required": "Este campo é obrigatório",
      "email": "Informe um endereço de e-mail válido",
      "password": {
        "min": "A senha deve ter no mínimo 8 caracteres",
        "max": "A senha deve ter no máximo 128 caracteres",
        "mismatch": "As senhas não coincidem",
        "compromised": "Esta senha foi exposta em vazamentos. Escolha uma senha diferente"
      },
      "file": {
        "type": "Tipo de arquivo não permitido",
        "size": "O arquivo excede o tamanho máximo permitido"
      },
      "invite": {
        "email": "Informe um endereço de e-mail válido para o convite"
      }
    },
    "submitting": "Enviando...",
    "submit": "Enviar",
    "optional": "(opcional)",
    "required_indicator": "Campo obrigatório",
    "file": {
      "select_profile_photo": "Selecionar foto de perfil",
      "select_community_logo": "Selecionar logotipo da comunidade"
    }
  }
}
```

**Nota CHK007 (dec-026)**: `form.file.select_profile_photo` e `form.file.select_community_logo`
fornecem os textos concretos de `aria-label` para os inputs file do wizard.

**Critério de aceite**:
- [ ] JSON válido após adição (sem erros de parse)
- [ ] Nenhuma chave duplica `register.*` ou `group.field.name.error.*` existentes
- [ ] Chaves de vocabulário pastoral em PT-BR
- [ ] `pnpm turbo build --filter=@metanoia/web` não quebra

**Dependências**: nenhuma (pode ser desenvolvida em paralelo com 0.1 e 0.3)

---

### 0.5 Testes jest-axe do FormField [high]

**Arquivo-alvo**: `apps/web/src/components/forms/__tests__/form-field.spec.tsx` (NOVO)

**Descrição**: Testes unitários com jest-axe cobrindo todos os estados do `FormField`.

**Cenários obrigatórios** (SC-A):
1. Estado válido (sem error, sem required): `toHaveNoViolations()`
2. Estado com erro (error="Campo obrigatório"): `toHaveNoViolations()`, verifica `aria-invalid="true"` no controle, `role="alert"` na mensagem
3. Estado recovered (error="" após ter tido erro): verifica `aria-invalid` omitido
4. required=true: verifica `aria-required="true"` no controle, asterisco com `aria-hidden="true"`
5. optional=true: verifica "(opcional)" visível no label
6. description presente: verifica `aria-describedby` inclui id do description
7. Variante fieldset: `toHaveNoViolations()`, verifica `<fieldset>` e `<legend>`

**Critério de aceite**:
- [ ] Todos os 7 cenários passam `toHaveNoViolations()`
- [ ] Nenhum cenário tem `aria-invalid="false"` literal
- [ ] `pnpm test --filter=@metanoia/web` verde

**Dependências**: 0.1, 0.2

---

### 0.6 Testes unitários de form-utils [high]

**Arquivo-alvo**: `apps/web/src/lib/__tests__/form-utils.spec.ts` (NOVO)

**Descrição**: Testes unitários (Vitest) para `scrollToFirstError` e `SubmitButton`.

**Cenários scrollToFirstError** (SC-G — mínimo 3 casos):
1. Encontra `[aria-invalid="true"]`: verifica `scrollIntoView({ behavior: 'smooth', block: 'center' })` chamado
2. Encontra `[aria-invalid="true"]`: verifica `focus()` chamado no mesmo elemento
3. Nenhum `[aria-invalid="true"]` no DOM: função retorna sem exceção (no-op)

**Cenários SubmitButton** (SC-D):
1. `isPending=false`: sem `aria-busy`, sem `disabled`, exibe `label`
2. `isPending=true`: `aria-busy="true"`, `disabled`, exibe `pendingLabel`, spinner com `aria-hidden="true"`
3. Transição `isPending=true` → `isPending=false`: `aria-busy` removido (dec-028)

**Critério de aceite**:
- [ ] Mínimo 3 cenários de `scrollToFirstError` passando
- [ ] Cenários do `SubmitButton` passando
- [ ] `pnpm test --filter=@metanoia/web` verde

**Dependências**: 0.3

---

## FASE 1 — Must-Have: Autenticação e Onboarding

> **Critério de saída**: todos os 7 formulários passam `toHaveNoViolations()` (jest-axe); CI verde (lint + test + build).

### 1.1 login-form.tsx — retrofit ARIA completo [high]

**Arquivo-alvo**: `apps/web/app/(public)/login/_components/login-form.tsx` (ATUALIZAR)

**Descrição**: Retrofitar o formulário de login nativo Next.js (não usa react-hook-form).
Adicionar ARIA completo via `FormField` + gerenciamento de erros por estado local.

**Implementação** (dec-029 — CHK035):
- Adicionar `useState<{ email?: string; password?: string }>({})` para erros de campo
- Submit handler: validar campos → setar errors → chamar `scrollToFirstError()`
- Envolver campos em `<FormField>` para injeção automática de `aria-invalid`, `aria-describedby`, `aria-required`
- Substituir botão de submit por `<SubmitButton label={t('form.submit')} pendingLabel={t('form.submitting')} isPending={isPending} />`
- Erros de campo via `t('form.error.*')` (sem hardcode — CHK024)

**Arquivos impactados**:
- `apps/web/app/(public)/login/_components/login-form.tsx`
- `apps/web/src/components/forms/__tests__/login-form.spec.tsx` (NOVO — jest-axe)

**Critério de aceite**:
- [ ] `FormField` envolve cada input de email e senha
- [ ] `aria-required="true"` em ambos os campos
- [ ] Erros inline com `role="alert"` e `aria-describedby` ligando campo ao erro
- [ ] `aria-invalid="true"` nos campos com erro (gerenciado via useState — dec-029)
- [ ] `scrollToFirstError()` invocado no submit com campos inválidos
- [ ] `SubmitButton` com `pendingLabel` (não `labelPending`)
- [ ] Nenhum `aria-invalid="false"` literal
- [ ] jest-axe: `toHaveNoViolations()` em estado inicial, com erro, recovered
- [ ] Strings via `pt-BR.json` (sem hardcode PT-BR em JSX)

**Dependências**: 0.1, 0.2, 0.3, 0.4, 0.6

---

### 1.2 register-form.tsx — completar ARIA [high]

**Arquivo-alvo**: `apps/web/app/(public)/register/_components/register-form.tsx` (ATUALIZAR)

**Descrição**: Formulário de registro já tem `aria-describedby`/`aria-invalid` parcial.
Completar com: `aria-required` em todos os campos obrigatórios, `scrollToFirstError()` no
submit, `SubmitButton` com `pendingLabel`, migrar para `FormField`.

**Arquivos impactados**:
- `apps/web/app/(public)/register/_components/register-form.tsx`
- `apps/web/src/components/forms/__tests__/register-form.spec.tsx` (NOVO — jest-axe)

**Critério de aceite**:
- [ ] Todos os campos obrigatórios com `aria-required="true"` (via FormField)
- [ ] `aria-describedby` apontando para erro E instrução (`register.passwordHint`) quando ambos presentes
- [ ] `scrollToFirstError()` no submit
- [ ] `SubmitButton` substituindo botão inline com prop `pendingLabel`
- [ ] jest-axe: `toHaveNoViolations()`
- [ ] Testes existentes do registro continuam passando (SC-H equivalente)

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 1.3 create-account-form.tsx — retrofit completo [high]

**Arquivo-alvo**: `apps/web/app/(onboarding)/convite/[token]/criar-conta/_components/create-account-form.tsx` (ATUALIZAR)

**Descrição**: Auditoria completa + retrofit com `FormField`. Fluxo de convite.

**Arquivos impactados**:
- `apps/web/app/(onboarding)/convite/[token]/criar-conta/_components/create-account-form.tsx`
- Teste jest-axe co-localizado

**Critério de aceite**:
- [ ] Todos os campos com label via `FormField`
- [ ] `aria-required`, `aria-invalid`, `aria-describedby` via `FormField`
- [ ] `scrollToFirstError()` no submit
- [ ] `SubmitButton` com `pendingLabel`
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 1.4 Step1Profile.tsx — aria-label no input file + aria-busy [high]

**Arquivo-alvo**: `apps/web/src/components/onboarding/wizard/steps/Step1Profile.tsx` (ATUALIZAR)

**Descrição**: Retrofit cirúrgico no wizard Step 1. Foco nos gaps de upload de foto.

**Implementação**:
- Input file de foto: `aria-label={t('form.file.select_profile_photo')}` (dec-026 — CHK007)
- Erro de upload: garantir `role="alert"` na mensagem de erro
- Botão de avanço: `<SubmitButton pendingLabel={t('form.submitting')} />` com `aria-busy`
- Demais campos: envolver em `FormField`

**Arquivos impactados**:
- `apps/web/src/components/onboarding/wizard/steps/Step1Profile.tsx`
- Teste jest-axe co-localizado

**Critério de aceite**:
- [ ] Input file tem `aria-label="Selecionar foto de perfil"` (via i18n)
- [ ] Erro de upload anunciado via `role="alert"`
- [ ] Botão de avanço usa `SubmitButton` com `aria-busy`
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 1.5 Step2Community.tsx — fieldset cidade+estado + aria-label logo [high]

**Arquivo-alvo**: `apps/web/src/components/onboarding/wizard/steps/Step2Community.tsx` (ATUALIZAR)

**Descrição**: Agrupar campos cidade+estado semanticamente; adicionar `aria-label` no
input file de logo.

**Implementação**:
- Campos cidade+estado: envolver em `<FormField variant="fieldset" legend="Localização">`
- Input file de logo: `aria-label={t('form.file.select_community_logo')}` (dec-026 — CHK007)
- Botão de avanço: `SubmitButton` com `aria-busy`

**Arquivos impactados**:
- `apps/web/src/components/onboarding/wizard/steps/Step2Community.tsx`
- Teste jest-axe co-localizado

**Critério de aceite**:
- [ ] Campos cidade+estado dentro de `<fieldset>` com `<legend>` visível
- [ ] Input file de logo tem `aria-label` via i18n
- [ ] Botão de avanço usa `SubmitButton` com `aria-busy`
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 1.6 Step3Group.tsx — fieldset/legend para radiogroup + ARIA completo [high]

**Arquivo-alvo**: `apps/web/src/components/onboarding/wizard/steps/Step3Group.tsx` (ATUALIZAR)

**Descrição**: Conversão do `role="radiogroup"` ad-hoc para `<fieldset>/<legend>` nativo.
Completar ARIA do form de criação de grupo.

**Implementação** (plan.md §Step3Group — before/after):
- Remover `<div role="radiogroup" aria-labelledby="mode-label">`
- Substituir por `<fieldset><legend>Como você quer começar?</legend>...</fieldset>`
- Cada `<input type="radio">` dentro de `<label>` nativo
- Campos do form de grupo: `FormField` com `aria-required`, `aria-invalid`, `aria-describedby`
- Botão de avanço: `SubmitButton` com `aria-busy`

**Arquivos impactados**:
- `apps/web/src/components/onboarding/wizard/steps/Step3Group.tsx`
- Teste jest-axe co-localizado

**Critério de aceite**:
- [ ] `role="radiogroup"` removido; `<fieldset><legend>` nativo no lugar
- [ ] Cada `<input type="radio">` dentro de `<label>` ou com `aria-label`
- [ ] Campos do form de grupo com `aria-required`, `aria-invalid`, `aria-describedby` via FormField
- [ ] Botão de avanço usa `SubmitButton` com `aria-busy`
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 1.7 Step4Invite.tsx — campos opcionais + i18n + aria-busy [high]

**Arquivo-alvo**: `apps/web/src/components/onboarding/wizard/steps/Step4Invite.tsx` (ATUALIZAR)

**Descrição**: Marcar campos opcionais com "(opcional)" via `FormField prop optional`.
Adicionar `aria-required`, `aria-describedby`→erro, `aria-invalid`. Usar i18n.

**Arquivos impactados**:
- `apps/web/src/components/onboarding/wizard/steps/Step4Invite.tsx`
- Teste jest-axe co-localizado

**Critério de aceite**:
- [ ] Campos opcionais têm `optional=true` no `FormField` → "(opcional)" visível no label
- [ ] Campos obrigatórios com `required=true` no `FormField`
- [ ] `aria-describedby` → erro quando presente
- [ ] `aria-invalid` via `FormField`
- [ ] Botão de avanço usa `SubmitButton` com `pendingLabel` via i18n
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

## FASE 2 — Should-Have: Pastoral, Gestão e Marketing

> **Critério de saída**: todos os 10 formulários + 3 componentes auxiliares passam `toHaveNoViolations()` (jest-axe); CI verde.

### 2.1 recovery-form.tsx — retrofit completo [med]

**Arquivo-alvo**: `apps/web/app/(public)/recuperar-senha/_components/recovery-form.tsx` (ATUALIZAR)

**Critério de aceite**:
- [ ] Campo email com `FormField`: `aria-required`, `aria-describedby`→erro, `aria-invalid`
- [ ] `SubmitButton` com `pendingLabel`
- [ ] `scrollToFirstError()` no submit
- [ ] jest-axe: `toHaveNoViolations()`
- [ ] Strings PT-BR via `pt-BR.json` (sem hardcode)

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.2 reset-password-form.tsx — retrofit completo [med]

**Arquivo-alvo**: `apps/web/app/(public)/nova-senha/[token]/_components/reset-password-form.tsx` (ATUALIZAR)

**Critério de aceite**:
- [ ] Campos nova-senha e confirmação com `FormField`: `aria-required`, `aria-describedby`→erro, `aria-invalid`
- [ ] `description` no campo de senha (hint de requisitos) via `aria-describedby`
- [ ] `SubmitButton` com `pendingLabel`
- [ ] `scrollToFirstError()` no submit
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.3 group-form.tsx — aria-invalid dinâmico + scrollToFirstError [med]

**Arquivo-alvo**: `apps/web/src/components/groups/group-form.tsx` (ATUALIZAR)

**Descrição**: Formulário já tem `aria-describedby` estático — dinamizar `aria-invalid`
e adicionar `scrollToFirstError()`.

**Critério de aceite**:
- [ ] `aria-invalid` dinâmico via `FormField`
- [ ] `scrollToFirstError()` invocado no submit com campos inválidos
- [ ] `SubmitButton` com `pendingLabel`
- [ ] Testes existentes de `group-form.spec.tsx` continuam passando (SC6.4)
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.4 invite-members-form.tsx — remover aria-label redundante + aria-describedby [med]

**Arquivo-alvo**: `apps/web/src/components/groups/invite-members-form.tsx` (ATUALIZAR)

**Critério de aceite**:
- [ ] `aria-label` redundante removido do input de email
- [ ] `FormField` envolve o input com `aria-describedby`→erro
- [ ] `aria-invalid` via `FormField`
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.5 create-group-form.tsx — retrofit completo [med]

**Arquivo-alvo**: `apps/web/app/(authenticated)/app/admin/grupos/novo/_components/create-group-form.tsx` (ATUALIZAR)

**Critério de aceite**:
- [ ] Todos os campos com `FormField`: `aria-required`, `aria-invalid`, `aria-describedby`
- [ ] `SubmitButton` com `pendingLabel`
- [ ] `scrollToFirstError()` no submit
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.6 group-trails-client.tsx — retrofit ou N/A [med]

**Arquivo-alvo**: `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/group-trails-client.tsx` (ATUALIZAR)

**Descrição**: Verificar se contém formulário real com `<form>` e submit. Se for apenas
listagem sem `<form>`, documentar como N/A e registrar decisão.

**Critério de aceite**:
- [ ] Se contém `<form>`: campos com `FormField`, `aria-required`, `aria-invalid`, jest-axe verde
- [ ] Se não contém `<form>`: registrar decisão "N/A — componente sem formulário de submit" e marcar concluído

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.7 radar/cuidado/page.tsx — retrofit completo [med]

**Arquivo-alvo**: `apps/web/app/(authenticated)/app/gestao/radar/[participantId]/cuidado/page.tsx` (ATUALIZAR)

**Critério de aceite**:
- [ ] Campos com `FormField`: `aria-required`, `aria-invalid`, `aria-describedby`
- [ ] `SubmitButton` com `pendingLabel`
- [ ] `scrollToFirstError()` no submit
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.8 reunioes/reflexao — page.tsx + reflection-form-field.tsx [med]

**Arquivos-alvo**:
- `apps/web/app/(authenticated)/app/gestao/reunioes/[meetingId]/reflexao/page.tsx` (ATUALIZAR)
- `apps/web/src/components/meetings/reflection-form-field.tsx` (ATUALIZAR)

**Descrição**: Adicionar prop `required?` ao `ReflectionFormField` e propagar `aria-required`.
O componente já usa `useId()` — extensão aditiva e não-breaking (SC-H).

**Critério de aceite**:
- [ ] `required?: boolean` adicionado à interface de `ReflectionFormField`
- [ ] `aria-required` propagado quando `required=true`
- [ ] Testes existentes do `reflection-form-field` continuam passando (SC-H)
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.4

---

### 2.9 contact-message-form.tsx — aria-describedby + scrollToFirstError + label select [med]

**Arquivo-alvo**: `apps/web/src/components/marketing/contact-message-form.tsx` (ATUALIZAR)

**Descrição**: Formulário já usa `role="alert"` (padrão a preservar). Adicionar
`aria-describedby` nos campos, `scrollToFirstError()`, e label explícito para `<select>`.

**Critério de aceite**:
- [ ] `aria-describedby` em todos os campos via `FormField`
- [ ] `<select>` tem `<label>` explícito com `htmlFor` correto
- [ ] `scrollToFirstError()` no submit
- [ ] `role="alert"` preservado (não adicionar `aria-live` redundante)
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.10 demo-request-form.tsx — aria-describedby + scrollToFirstError + label churchSize [med]

**Arquivo-alvo**: `apps/web/src/components/marketing/demo-request-form.tsx` (ATUALIZAR)

**Descrição**: Mesmo padrão de `contact-message-form`. Label explícito para `<select churchSize>`.

**Critério de aceite**:
- [ ] `aria-describedby` em todos os campos via `FormField`
- [ ] `<select>` de `churchSize` tem `<label>` explícito (ex: "Tamanho da comunidade")
- [ ] `scrollToFirstError()` no submit
- [ ] `role="alert"` preservado
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2, 0.3, 0.4

---

### 2.11 password-input-with-toggle.tsx — auditoria ARIA (CHK010) [med]

**Arquivo-alvo**: `apps/web/src/components/forms/password-input-with-toggle.tsx` (ATUALIZAR)

**Descrição**: Auditoria + correção. Estado-destino (CHK010):
- Botão toggle: `aria-label` dinâmico ("Mostrar senha" / "Ocultar senha")
- Componente propaga `aria-required`, `aria-invalid`, `aria-describedby` via `...props`

**Critério de aceite**:
- [ ] Botão toggle tem `aria-label` dinâmico (não ícone-only sem label)
- [ ] Componente propaga `aria-required`, `aria-invalid`, `aria-describedby` via `...props`
- [ ] jest-axe: `toHaveNoViolations()` (senha-oculta E senha-visível)

**Dependências**: 0.1, 0.2

---

### 2.12 terms-checkbox.tsx — auditoria ARIA (CHK010) [med]

**Arquivo-alvo**: `apps/web/src/components/forms/terms-checkbox.tsx` (ATUALIZAR)

**Descrição**: Estado-destino (CHK010):
- Checkbox tem label associado (`htmlFor` ou `<label>` wrapper)
- Propaga `aria-required`, `aria-invalid`, `aria-describedby`
- Estado de erro: `aria-invalid` + `role="alert"` na mensagem

**Critério de aceite**:
- [ ] Checkbox tem label associado
- [ ] Propaga `aria-required`, `aria-invalid`, `aria-describedby`
- [ ] Estado de erro: `aria-invalid` + `role="alert"` na mensagem
- [ ] jest-axe: `toHaveNoViolations()`

**Dependências**: 0.1, 0.2

---

### 2.13 day-of-week-select.tsx — auditoria ARIA + critério jest-axe (CHK036) [med]

**Arquivo-alvo**: `apps/web/src/components/forms/day-of-week-select.tsx` (ATUALIZAR)

**Descrição**: Label-por-delegação via `htmlFor` no parent — verificar se passa jest-axe
quando renderizado isoladamente. Se falhar: adicionar fallback `aria-label` interno.

**Nota CHK036**: testar com wrapper que inclui o label externo no mesmo container.

**Critério de aceite**:
- [ ] jest-axe `toHaveNoViolations()` com label externo no mesmo container de teste
- [ ] Propaga `aria-required`, `aria-invalid`, `aria-describedby` via `...props`
- [ ] Se label-por-delegação falhar isolado: fallback `aria-label` com texto adequado adicionado

**Dependências**: 0.1, 0.2

---

## FASE 3 — Testes E2E e Cobertura Final

> **Critério de saída**: E2E verde nas 5 rotas públicas; cobertura jest-axe em todos os formulários; zero regressão.

### 3.1 E2E Playwright — rotas públicas acessíveis [high]

**Arquivo-alvo**: `apps/web/e2e/a11y-forms.spec.ts` (NOVO)

**Descrição**: Testes Playwright com `@axe-core/playwright` nas 5 rotas públicas.

**Rotas cobertas** (plan.md §Fase 3 — T3.1):
1. `/login`
2. `/register`
3. `/recuperar-senha`
4. `/nova-senha/test-token`
5. `/convite/test-token/criar-conta`

**Cenários** (SC-C, SC-D):
- `checkA11y()` em cada rota (zero violações WCAG AA)
- Submit vazio → `aria-invalid="true"` nos campos, `role="alert"` com texto i18n
- Submit vazio → foco movido para primeiro campo inválido (DOM order — dec-027)
- Submit em progresso → `aria-busy="true"` e `disabled` no botão

**Critério de aceite**:
- [x] 5 rotas com zero violações `checkA11y()` (nível AA)
- [x] `aria-invalid="true"` verificado após submit vazio
- [x] `aria-busy="true"` verificado durante submissão
- [x] Foco no primeiro campo inválido verificado
- [x] Job "E2E (Playwright)" no CI verde

**Dependências**: FASE 1 completa (1.1–1.7)

---

### 3.2 Cobertura jest-axe — todos os formulários [high]

**Descrição**: Confirmar que todos os formulários auditados têm spec jest-axe com
`toHaveNoViolations()`. Criar specs faltantes co-localizadas.

**Cobertura obrigatória** (SC-B): FormField, form-utils/SubmitButton + todos os 17 formulários
das Fases 1 e 2.

**Critério de aceite**:
- [x] `find apps/web -name '*.spec.tsx' -path '*__tests__*'` lista spec para cada formulário auditado
- [x] Cada spec tem cenários: initial, com error, recovered
- [x] `pnpm turbo test --filter=@metanoia/web` verde

**Dependências**: FASE 1 + FASE 2 completas

---

### 3.3 Gate de não-regressão e SC-F [crit]

**Descrição**: Gate final de CI local + verificação automatizada de strings hardcoded (SC-F).

**Gate local**:
```bash
pnpm --filter @metanoia/api exec prisma generate
pnpm turbo build
pnpm turbo lint --max-warnings 0
pnpm turbo test --filter=@metanoia/web
```

**Grep SC-F** (CHK024 — verificação automatizada):
```bash
grep -rn --include="*.tsx"   -e '"Enviando"' -e '"Salvar"' -e '"Enviar"'   -e '"Campo obrigatório"' -e '"E-mail inválido"'   apps/web/app/'(public)'/   apps/web/src/components/forms/   apps/web/src/components/groups/   apps/web/src/components/marketing/
# Saída vazia = aprovado (SC-F verde)
```

**Critério de aceite**:
- [x] `pnpm turbo build` zero erros TypeScript
- [x] `pnpm turbo lint --max-warnings 0` passa
- [x] `pnpm turbo test` verde (todos os testes existentes + novos)
- [x] Grep SC-F retorna saída vazia
- [x] `reflection-form-field` testes existentes verdes (SC-H)
- [x] `group-form.spec.tsx` existente verde (SC6.4)

**Dependências**: 3.1, 3.2
