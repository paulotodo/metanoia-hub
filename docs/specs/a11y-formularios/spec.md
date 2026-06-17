# Spec — Story 12.5: Formulários Acessíveis (NFR-A3)

**Feature**: a11y-formularios
**Epic**: 12 — Acessibilidade
**Versão da spec**: 1.0.0
**Data**: 2026-06-17
**Status**: draft — aguardando clarify
**Spec autoritativa de referência**: `_bmad-output/implementation-artifacts/12-5-formularios-acessiveis-nfr-a3.md`
**Constitution**: `docs/constitution.md`
**Stories anteriores entregues**: 12.1 (teclado), 12.2 (focus/contrast), 12.3 (touch/motion), 12.4 (ARIA regions/skip-nav/announcer)

---

## Contexto e escopo

Esta story entrega a camada de apresentação acessível para formulários do metanoia-hub, cumprindo NFR-A3 (WCAG 2.1 AA — formulários). O escopo é **exclusivamente a camada de UI** — a validação Zod em `packages/types` não é alterada.

### Estado atual do código (auditado antes da spec)

A auditoria do codebase revelou o seguinte ponto de partida:

| Formulário | Labels/htmlFor | aria-required | aria-describedby→erro | aria-invalid | role="alert" | scroll+foco no erro | aria-busy submit |
|---|---|---|---|---|---|---|---|
| `group-form.tsx` | OK (Story 12.2) | OK | Parcial (span vazio estático) | Ausente | Parcial (span sr-only) | Ausente | Ausente |
| `invite-members-form.tsx` | OK (Story 12.2) | Ausente | Ausente | Ausente | Ausente | N/A | Ausente |
| `contact-message-form.tsx` | OK | Ausente | Ausente | Parcial | OK | Ausente | Ausente |
| `demo-request-form.tsx` | OK | Ausente | Ausente | Parcial | OK | Ausente | Ausente |
| `reflection-form-field.tsx` | OK | Ausente | Parcial (errorId opcional) | Parcial | Ausente | N/A | N/A |
| `Step1Profile.tsx` (wizard) | OK (htmlFor) | Ausente | Ausente | Ausente | Ausente | Ausente | Ausente |
| `Step2Community.tsx` (wizard) | OK (htmlFor) | Ausente | Ausente | Ausente | Ausente | Ausente | Ausente |
| `Step3Group.tsx` (wizard) | OK (htmlFor) | Ausente | Ausente | Ausente | Parcial (role="alert" no erro) | Ausente | Ausente |
| `Step4Invite.tsx` (wizard) | OK (htmlFor) | Ausente | Ausente | Ausente | Ausente | Ausente | Ausente |
| Login/Registro (Keycloak) | Fora do app — delegado ao Keycloak IDP; NEEDS_CLARIFICATION NC1 | — | — | — | — | — | — |
| `BrandingSettingsForm` | Nao implementado ainda (diretório settings/ vazio) | — | — | — | — | — | — |
| `password-input-with-toggle.tsx` | A auditar | A auditar | A auditar | A auditar | A auditar | N/A | N/A |
| `terms-checkbox.tsx` | A auditar | A auditar | A auditar | A auditar | A auditar | N/A | N/A |
| `day-of-week-select.tsx` | A auditar | A auditar | A auditar | A auditar | A auditar | N/A | N/A |

**Padrão já presente** (positivo): `ReflectionFormField` usa `useId()` para gerar IDs estáveis — este padrão deve ser estendido ao `FormField` reutilizável. `contact-message-form` e `demo-request-form` já usam `role="alert"` para erros inline (sem `aria-live` redundante) — padrão correto a preservar.

**Gap principal**: nenhum formulário implementa `aria-describedby` ligando campo-erro com IDs dinâmicos, `aria-invalid` consistente, `aria-required` em campos obrigatórios, `scroll+foco no primeiro erro` no submit, nem `aria-busy` no botão durante submissão.

**Gap de componente**: não existe `FormField` reutilizável em `apps/web/src/components/forms/`. Cada formulário implementa o padrão manualmente e de forma inconsistente. Esta story cria o componente.

---

## User Stories

### US1 — Criar componente FormField reutilizável
**Como** desenvolvedor implementando formulários no metanoia-hub,
**quero** um componente `FormField` que encapsule label, input, descricao/instrucao e mensagem de erro com ARIA correto,
**para que** todo formulário novo ou retrofitado use o mesmo padrão acessível sem reimplementação.

**Critérios de aceite (US1)**:
- SC1.1: `FormField` aceita props: `id?` (se omitido, gera via `useId()`), `label`, `required?`, `optional?`, `description?`, `error?`, `children` (o controle nativo ou `<Input>`).
- SC1.2: Auto-gera `htmlFor` no `<label>`, `id` no controle, `aria-describedby` composto por `${id}-description` (se `description` fornecido) e `${id}-error` (se `error` fornecido).
- SC1.3: Quando `required=true`: adiciona `aria-required="true"` ao controle e indicador visual `*` com `aria-hidden="true"` no label.
- SC1.4: Quando `optional=true`: adiciona "(opcional)" ao label (visível, sem `aria-hidden`).
- SC1.5: Quando `error` é string não-vazia: renderiza `<span id="${id}-error" role="alert">`, adiciona `aria-invalid="true"` ao controle via contexto ou `cloneElement`.
- SC1.6: Quando `error` é `undefined` ou vazio: `aria-invalid` é removido (não `false` literal — omitido).
- SC1.7: Suporta agrupamento: variant `fieldset` renderiza `<fieldset><legend>{label}</legend>{children}</fieldset>` para grupos de radio/checkbox.
- SC1.8: Passa jest-axe sem violations (`toHaveNoViolations()`).
- SC1.9: Exportado de `apps/web/src/components/forms/index.ts`.

### US2 — Criar utilitário scrollToFirstError e SubmitButton acessível
**Como** desenvolvedor implementando submit de formulários,
**quero** utilitários que movam o foco ao primeiro campo inválido e indiquem carregamento de forma acessível,
**para que** usuários de teclado e leitores de tela sejam guiados ao erro e informados do estado de submissão.

**Critérios de aceite (US2)**:
- SC2.1: `scrollToFirstError()` em `apps/web/src/lib/form-utils.ts`: busca o primeiro elemento com `[aria-invalid="true"]` no DOM, chama `scrollIntoView({ behavior: 'smooth', block: 'center' })` e depois `focus()`.
- SC2.2: Se nenhum elemento com `aria-invalid="true"` for encontrado, a função é no-op (sem exceção).
- SC2.3: `SubmitButton` aceita props `pending: boolean`, `label: string`, `labelPending: string`.
- SC2.4: Quando `pending=true`: `aria-busy="true"`, `disabled`, spinner com `aria-hidden="true"`, texto do botão muda para `labelPending`.
- SC2.5: Quando `pending=false`: sem `aria-busy`, sem `disabled`, exibe `label`.
- SC2.6: `SubmitButton` e `scrollToFirstError` têm testes unitários (Vitest).

### US3 — Adicionar chaves i18n de formulários
**Como** usuário de leitor de tela interagindo com mensagens de erro,
**quero** mensagens em português com vocabulário pastoral, centralizadas em `pt-BR.json`,
**para que** a UI nunca exiba strings hardcoded e as mensagens sejam coerentes com a identidade do produto.

**Critérios de aceite (US3)**:
- SC3.1: Adicionar namespace `form` em `apps/web/messages/pt-BR.json` com chaves para: campo obrigatório genérico, e-mail inválido, senha (mínimo, máximo, confirmação não coincide, comprometida), nome do grupo (obrigatório, duplicado), e-mail de convite inválido, arquivo inválido (tipo, tamanho), envio em progresso (`form.submitting`).
- SC3.2: Chaves de erros de campo já existentes (`register.*`, `group.field.name.error.*`, etc.) NÃO são duplicadas — apenas referenciadas ou estendidas onde necessário.
- SC3.3: Nenhuma string de erro em formulários auditados usa texto hardcoded após esta story.
- SC3.4: Mensagens usam vocabulário pastoral onde adequado.

### US4 — Auditar e corrigir formulários must-have (Registro, Wizard Onboarding)
**Como** usuário de leitor de tela ou navegação por teclado,
**quero** que os formulários críticos de entrada (registro e wizard de onboarding) anunciem erros, associem labels e movam o foco corretamente,
**para que** eu consiga completar o fluxo de entrada na plataforma sem barreiras.

**Critérios de aceite (US4)**:
- SC4.1: Formulário de registro (`register.*`): todos os campos têm `<label>` com `htmlFor`, `aria-required`, `aria-describedby` apontando para erro e/ou instrução (`register.passwordHint`).
- SC4.2: Em erro de submissão do registro: `aria-invalid="true"` nos campos com erro, `role="alert"` na mensagem, `scrollToFirstError()` invocado.
- SC4.3: Botão de submit do registro: `aria-busy="true"` + `disabled` durante submissão.
- SC4.4: Wizard Step 1 (Perfil): campo de foto tem `<label>` explícito, `aria-label` no input `file`, upload error anunciado via `role="alert"`.
- SC4.5: Wizard Step 2 (Comunidade): campos cidade+estado agrupados semanticamente (fieldset/legend ou aria-labelledby equivalente); upload de logo tem `aria-label` no input file.
- SC4.6: Wizard Step 3 (Grupo): radiogroup atual (`role="radiogroup"`) convertido para `<fieldset>/<legend>` nativo; campos do form de criação de grupo com `aria-required`, `aria-invalid`, `aria-describedby`.
- SC4.7: Wizard Step 4 (Convite): campos opcionais marcados "(opcional)"; i18n de `pt-BR.json`.
- SC4.8: Cada step do wizard: botão de avanço tem `aria-busy` durante submissão assíncrona.

### US5 — Auditar e corrigir formulários should-have
**Como** usuário de leitor de tela interagindo com CRUD de grupos e conteúdo,
**quero** que todos os formulários secundários sigam o mesmo padrão acessível,
**para que** a acessibilidade cubra toda a plataforma.

**Critérios de aceite (US5)**:
- SC5.1: `group-form.tsx`: erro dinâmico via `FormField`; `aria-invalid` dinâmico; `scrollToFirstError()` no submit.
- SC5.2: `invite-members-form.tsx`: remover `aria-label` redundante do input de email (já tem label visual); adicionar `aria-describedby`->erro.
- SC5.3: `contact-message-form.tsx` e `demo-request-form.tsx`: `aria-describedby` nos campos; `scrollToFirstError()`; label explícito para select `churchSize`.
- SC5.4: `reflection-form-field.tsx`: aceitar prop `required?`; propagar `aria-required`.
- SC5.5: `password-input-with-toggle.tsx`, `terms-checkbox.tsx`, `day-of-week-select.tsx`: auditar e corrigir labels, aria-required, aria-invalid.
- SC5.6: Formulários de trilha e BrandingSettings/TenantConfig: NEEDS_CLARIFICATION NC2.

### US6 — Cobertura de testes
**Como** time de desenvolvimento,
**quero** testes automáticos cobrindo os padrões ARIA implementados,
**para que** regressões sejam detectadas antes de chegar em produção.

**Critérios de aceite (US6)**:
- SC6.1: jest-axe para: `FormField`, `SubmitButton`, `group-form`, `invite-members-form`, `contact-message-form`, `demo-request-form`, `reflection-form-field`, steps 1-4 do wizard.
- SC6.2: Vitest unitário para `scrollToFirstError()`: (a) encontra primeiro campo `aria-invalid`, (b) chama `scrollIntoView` e `focus`, (c) no-op quando sem campo inválido.
- SC6.3: Playwright E2E em `apps/web/e2e/a11y/accessible-forms.e2e-spec.ts`: submit vazio em group-form e registro, verificar `aria-invalid`, `role="alert"`, foco movido, `aria-busy` no submit.
- SC6.4: Testes existentes (`group-form.spec.tsx`, etc.) continuam passando.

---

## Functional Requirements

| ID | Requisito | US | Prioridade |
|---|---|---|---|
| FR-01 | Criar `FormField` em `apps/web/src/components/forms/form-field.tsx` com props e comportamentos de US1. | US1 | Must |
| FR-02 | `FormField` gera IDs estáveis via `useId()` quando `id` não é fornecido. | US1 | Must |
| FR-03 | `aria-describedby` composto dinamicamente: `${id}-description` (se `description`) + `${id}-error` (se `error`); omitido se ambos ausentes. | US1 | Must |
| FR-04 | `aria-invalid` no controle filho apenas quando `error` é string não-vazia; omitido (não `false`) caso contrário. | US1 | Must |
| FR-05 | Mensagem de erro com `role="alert"`. Não combinar com `aria-live` (redundante). | US1 | Must |
| FR-06 | Variant `fieldset` de `FormField` renderiza `<fieldset>/<legend>` nativo. | US1 | Should |
| FR-07 | `scrollToFirstError()` em `apps/web/src/lib/form-utils.ts`: localiza `[aria-invalid="true"]`, scroll + focus. | US2 | Must |
| FR-08 | `SubmitButton` com `aria-busy`, `disabled`, spinner `aria-hidden`, label i18n durante pending. | US2 | Must |
| FR-09 | Namespace `form.*` em `pt-BR.json` com chaves de erro genéricas e específicas. Chaves existentes não duplicadas. | US3 | Must |
| FR-10 | Registro: labels/htmlFor, aria-required, aria-describedby->erro, aria-invalid, scrollToFirstError(), aria-busy no submit. | US4 | Must |
| FR-11 | Wizard Step 1: aria-label no input file de foto, role="alert" no erro de upload. | US4 | Must |
| FR-12 | Wizard Step 2: cidade+estado agrupados semanticamente. | US4 | Should |
| FR-13 | Wizard Step 3: radiogroup para fieldset/legend; form de grupo com aria-invalid, aria-describedby, aria-required. | US4 | Must |
| FR-14 | Wizard Step 4: campos opcionais marcados "(opcional)"; i18n. | US4 | Should |
| FR-15 | Botões de submit nos steps do wizard com aria-busy durante submissão. | US4 | Must |
| FR-16 | group-form.tsx: erro dinâmico, aria-invalid dinâmico, scrollToFirstError(). | US5 | Must |
| FR-17 | invite-members-form.tsx: remover aria-label redundante; adicionar aria-describedby->erro. | US5 | Should |
| FR-18 | contact-message-form e demo-request-form: aria-describedby; scrollToFirstError(); label para select. | US5 | Should |
| FR-19 | reflection-form-field.tsx: prop required? + aria-required. | US5 | Should |
| FR-20 | jest-axe para todos os formulários auditados; Playwright E2E para fluxos críticos. | US6 | Must |
| FR-21 | Testes existentes continuam passando após refactor. | US6 | Must |

---

## Success Criteria (mensuráveis)

| ID | Critério | Forma de verificação |
|---|---|---|
| SC-A | `FormField` passa `toHaveNoViolations()` no jest-axe em 100% dos cenários (com error, sem error, required, optional, fieldset). | CI: jest-axe |
| SC-B | Todos os formulários auditados nas US4 e US5 passam `toHaveNoViolations()` no jest-axe. | CI: jest-axe |
| SC-C | Playwright E2E: submit vazio de group-form -> aria-invalid="true" no campo nome, role="alert" com texto i18n, foco movido para campo. | CI: Playwright |
| SC-D | Playwright E2E: botão submit exibe aria-busy="true" e disabled durante submissão. | CI: Playwright |
| SC-E | Nenhum erro TypeScript (tsc --noEmit) introduzido. | CI: tsc |
| SC-F | Nenhuma string de erro hardcoded em formulários auditados — todos via pt-BR.json. | CI: grep lint ou revisão |
| SC-G | scrollToFirstError() tem cobertura unitária >= 3 casos. | CI: Vitest |
| SC-H | ReflectionFormField continua passando seus testes existentes (adição de required? é aditiva). | CI: Vitest |

---

## Clarifications

> **Resolvido na fase clarify (onda-002, 2026-06-17).** Forms reportados
> como "não encontrados" na specify eram FALSO NEGATIVO da busca — paths
> reais verificados via `ls`/`find`/`grep`. Decisões abaixo (dec-008 a
> dec-012); ver `state.json` para auditoria completa.

### Escopo concreto de formulários (paths reais verificados)

**Componente base (US1/US2):**
- Criar `FormField` reutilizável em `apps/web/src/components/forms/index.ts` (NC3 — confirmado pela spec, score 2).
- `scrollToFirstError()` + `SubmitButton` (aria-busy) + erro inline por campo (aria-describedby + aria-invalid + role="alert") + foco no 1º campo inválido (NC4 — padrão WCAG/WAI, score 2).

**Forms must-have no escopo (autenticação + onboarding):**
- `apps/web/app/(public)/login/_components/login-form.tsx` (Q1, score 2 — form nativo confirmado, 6595 bytes; corrige NC1)
- `apps/web/app/(public)/register/_components/register-form.tsx`
- `apps/web/app/(onboarding)/convite/[token]/criar-conta/_components/create-account-form.tsx`
- `apps/web/src/components/onboarding/wizard/steps/Step1Profile.tsx`
- `apps/web/src/components/onboarding/wizard/steps/Step2Community.tsx`
- `apps/web/src/components/onboarding/wizard/steps/Step3Group.tsx`
- `apps/web/src/components/onboarding/wizard/steps/Step4Invite.tsx`

**Forms should-have no escopo:**
- `apps/web/app/(public)/recuperar-senha/_components/recovery-form.tsx` (Q2, score 2)
- `apps/web/app/(public)/nova-senha/[token]/_components/reset-password-form.tsx` (Q2, score 2)
- `apps/web/src/components/groups/group-form.tsx`
- `apps/web/src/components/groups/invite-members-form.tsx`
- `apps/web/app/(authenticated)/app/admin/grupos/novo/_components/create-group-form.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/group-trails-client.tsx` (Q4, score 3 — canônico)
- `apps/web/app/(authenticated)/app/gestao/radar/[participantId]/cuidado/page.tsx` (Q5, score 3 — Radar Pastoral)
- `apps/web/app/(authenticated)/app/gestao/reunioes/[meetingId]/reflexao/page.tsx` + `apps/web/src/components/meetings/reflection-form-field.tsx` (Q5, score 3)
- `apps/web/src/components/marketing/contact-message-form.tsx`
- `apps/web/src/components/marketing/demo-request-form.tsx`

**Fora de escopo (documentado):**
- `apps/web/src/components/trails/group-trails-client.tsx` — RESÍDUO. A rota App Router importa `./group-trails-client` (versão `app/`); a versão `src/` tem ZERO imports externos e ZERO `<form` (não é mais um form). Candidato a remoção em limpeza futura (Q4, dec-009).
- `apps/web/src/components/catalog/catalog-search.tsx` — não possui form com submit (busca/filtro), fora do escopo de formulários.

**EM ABERTO — aguarda decisão humana (block-001, dec-012):**
- `apps/web/app/(authenticated)/app/admin/configuracoes/branding/BrandingSettingsForm.tsx` (17522 bytes — existe; NC2 resolvido quanto à existência, mas inclusão no escopo desta story é tradeoff de priorização). Mesmo perfil: `apps/web/app/(authenticated)/app/admin/super/tenants/novo/page.tsx` (367 linhas).


## NEEDS_CLARIFICATION

### NC1 — Escopo do formulário de Login
**Contexto**: A busca no codebase não encontrou nenhum componente de formulário de login nativo em `apps/web/src/app/**`. O projeto usa Keycloak como IDP.

**Ambiguidade**: A spec autoritativa (12-5) lista "Login (email + senha)" como must-have #1. Isso pode significar: (a) existe um form de login no app não encontrado pela busca; (b) o "login" é o fluxo do Keycloak, fora do escopo do app.

**Impacto**: Se (a), precisa ser localizado e auditado. Se (b), o must-have #1 não tem código correspondente e Registro assume prioridade máxima.

**Pergunta**: O formulário de login é renderizado pelo app Next.js ou inteiramente delegado ao Keycloak? Se existe form nativo, qual o path?

### NC2 — Formulários ainda não implementados (BrandingSettings, TenantConfig, Trilhas)
**Contexto**: `apps/web/src/components/settings/` está vazio. Formulários de CRUD de trilhas/módulos/lições não foram encontrados.

**Ambiguidade**: A spec autoritativa os lista em "should-have". Se não estão implementados, não há o que auditar/corrigir neles nesta story.

**Impacto**: Se ausentes, o escopo de should-have reduz. A story entrega FormField + correção dos forms existentes.

**Pergunta**: BrandingSettings, TenantConfigForm e formulários de trilhas/módulos/lições estão implementados? Se sim, qual o path? Se não, confirmamos que esta story não os inclui.

### NC3 — Estratégia: FormField reutilizável vs. retrofit in-loco
**Decisão proposta** (score 2): Criar `FormField` e refatorar todos os forms existentes para usá-lo (opção A). Alinhado com o artefato explícito da spec autoritativa. Confirmação no clarify.

### NC4 — Estratégia de anúncio: role="alert" por campo vs. sumário no topo
**Decisão proposta** (score 2): Erros inline por campo com `role="alert"` + `scrollToFirstError()` (opção A). Já parcialmente adotado. Sem sumário centralizado. Confirmação no clarify.

---

## Dependências e restrições

- Depende de Stories 12.1-12.4 entregues.
- NÃO altera: validação Zod em `packages/types`, contratos de API, lógica de negócio.
- NÃO altera: `packages/ui/components/input.tsx` (primitivo correto).
- NÃO migra para shadcn/ui Form components (mantém HTML semântico nativo para controle ARIA explícito).
- Labels e erros sempre em PT-BR via `pt-BR.json`. Código em inglês.
- `role="alert"` implica `aria-live="assertive" aria-atomic="true"` — NÃO adicionar `aria-live` no mesmo elemento.
- `aria-invalid="false"` difere de omitir — preferir omissão quando campo é válido.
- `useId()` (React 18+) para IDs estáveis em SSR+CSR.
