# Spec: Screen Reader — Autenticação, Navegação Global & Landmarks (NFR-A4)

**Short Name**: a11y-screen-reader-auth
**Epic**: 15 — Acessibilidade Avançada
**Story**: 15.1
**Versão**: 1.0.0
**Data**: 2026-06-25
**Status**: draft

---

## 1. Objetivo

Garantir que usuários de tecnologia assistiva (VoiceOver, NVDA, JAWS) consigam navegar os fluxos de autenticação (login, registro, recuperação de senha, onboarding via convite) e a navegação global autenticada usando apenas um screen reader — sem perda de informação semântica, sem armadilhas de foco e com anúncios adequados de estado.

NFR de referência: **NFR-A4** (WCAG 2.1 AA, screen reader compatibility).

---

## 2. Escopo

### 2.1 Incluso

| Área | Arquivos-alvo | Trabalho |
|------|--------------|---------|
| Layout público | `apps/web/app/(public)/layout.tsx` | Adicionar `<header role="banner">` + `<footer role="contentinfo">` wrapping `<main>` |
| Layout onboarding | `apps/web/app/(onboarding)/layout.tsx` | Idem — `<header>` + `<footer>` |
| Login form | `apps/web/app/(public)/login/_components/login-form.tsx` | `aria-labelledby` no form → h1; `aria-pressed` no toggle; substituir emojis por SVG `aria-hidden` |
| Register form | `apps/web/app/(public)/register/_components/register-form.tsx` | Indicador de passo (single-page com step indicator visual); `aria-live="polite"` nos erros de campo inline |
| Recovery form | `apps/web/app/(public)/recuperar-senha/_components/recovery-form.tsx` | Landmarks; `role="alert"` nos erros; `role="status"` na confirmação de envio |
| Nova senha | `apps/web/app/(public)/nova-senha/[token]/_components/reset-password-form.tsx` | Idem recovery |
| Onboarding pages | `apps/web/app/(onboarding)/convite/[token]/_components/welcome-view.tsx`, `../termos/_components/terms-page-content.tsx`, `../criar-conta/_components/create-account-form.tsx` | `aria-live` nas transições entre steps; `FocusManager` no layout onboarding |
| i18n | `apps/web/messages/pt-BR.json` | Corrigir typos: `"Esconder senha"` → `"Ocultar senha"` (linha 684), `"invalido"` → `"inválido"` (linha 15) |
| Lang inline | Varredura global — componentes em `apps/web/src/` e `packages/ui/` | Termos estrangeiros recorrentes envoltos em `<span lang="en">` |
| Roteiro manual | `docs/specs/a11y-screen-reader-auth/manual-test-checklist.md` | Checklist para teste humano com VoiceOver/NVDA/JAWS |

### 2.2 Explicitamente Fora de Escopo (15.1)

- **Breadcrumbs ARIA** — não existem atualmente → escopo de 15.4
- **Páginas autenticadas novas** — sem adição de novas páginas ao `a11y-pages.json` (ratchet)
- **Teste real com screen readers** — não automatizável; entregue como roteiro humano (ver §6)
- **Dashboard Radar / módulos analíticos** — 15.3/15.4
- **Páginas autenticadas (aria-live por conteúdo dinâmico)** — 15.2

---

## 3. Análise do Estado Atual (pré-flight)

### 3.1 Já Coberto (NÃO reimplementar)

| Item | Localização | Evidência |
|------|-------------|-----------|
| Campos label/type/required + aria-invalid dinâmico | `login-form.tsx:89-129` | aria-invalid={errors.email ? true : undefined} |
| Erro login `role="alert"` + foco para primeiro campo inválido | `login-form.tsx:155`, `src/lib/form-utils.ts` | scrollToFirstError() via setTimeout |
| Skip-nav "Ir para conteúdo" | `src/components/a11y/skip-nav.tsx` | href="#conteudo", Epic 12 |
| `aria-current="page"` no sidebar | `navigation-shell.tsx:55` | `{"aria-current": "page"}` condicional |
| FormField injeta aria-required/invalid/describedby | `src/components/forms/form-field.tsx` | Herança automática |
| AsyncAnnouncerProvider (polite + assertive) | `src/components/a11y/async-announcer.tsx` | Usado em NavigationShell |
| FocusManager pós-navegação | `navigation-shell.tsx` (authenticated) | dynamic() com ssr:false |
| Sidebar `aria-label="Main navigation"` | `packages/ui/components/sidebar.tsx:153` | Presente no JSX |
| BottomTabs `aria-label="Mobile navigation"` | `packages/ui/components/bottom-tabs.tsx:21` | Presente no JSX |
| `PasswordInputWithToggle` com `aria-pressed` | `src/components/forms/password-input-with-toggle.tsx:41` | aria-pressed={visible} |
| Register success `role="status"` | `register-form.tsx:90` | Presente no JSX |

### 3.2 Lacunas Identificadas (trabalho da 15.1)

#### LAC-01: Landmarks ausentes em (public) e (onboarding)
**Criticidade**: Alta — bloqueia navegação por regiões em TODAS as páginas públicas.
- `apps/web/app/(public)/layout.tsx` só tem `<main id="conteudo">`, sem `<header role="banner">` e `<footer role="contentinfo">`
- `apps/web/app/(onboarding)/layout.tsx` igual: só `<main id="conteudo">`

#### LAC-02: Login form sem `aria-labelledby`
**Criticidade**: Média — screen reader não anuncia "formulário Entrar".
- `login-form.tsx` linha 85: `<h1>` não tem `id`; `<form>` não tem `aria-labelledby`

#### LAC-03: Toggle de senha no login sem `aria-pressed` + emojis não acessíveis
**Criticidade**: Média — o toggle inline usa 🙈/👁 (emojis sem aria-hidden) e não tem `aria-pressed`.
- `login-form.tsx` linha 128-140: toggle inline (não usa `PasswordInputWithToggle`)
- Solução: substituir pelo componente `PasswordInputWithToggle` já existente

#### LAC-04: Register form — indicador de passo (step indicator)
**Criticidade**: Baixa — registro é single-page hoje; AC#4 do story menciona "multi-step", mas código = single-page com 4 campos.
- **Decisão de clarify**: tratar como "passo único" (sem step indicator multi-etapa); adicionar `aria-live="polite"` nos erros inline de campo (atualmente apenas `role="alert"` no server error, mas erros de campo ficam no DOM sem anúncio polite explícito para os que aparecem fora do fluxo de submit)

#### LAC-05: Onboarding sem `FocusManager` + sem `aria-live` nas transições
**Criticidade**: Média — sem gestão de foco entre welcome→termos→criar-conta.
- `apps/web/app/(onboarding)/layout.tsx` não importa `FocusManager`
- Páginas do onboarding não usam `AsyncAnnouncerProvider`

#### LAC-06: `pt-BR.json` typos
**Criticidade**: Baixa (UX/a11y string).
- Linha 15: `"invalido"` sem acento → `"inválido"` (seção `register.errors.invalidEmail`)
- Linha 684: `"Esconder senha"` → `"Ocultar senha"` (seção `newPassword.hidePassword`)

#### LAC-07: `lang` inline para termos estrangeiros ausente
**Criticidade**: Baixa — WCAG 3.1.2 (apenas AA se causa confusão de pronúncia).
- Termos como "Dashboard", "Radar", "Epic", "VoiceOver" sem `lang="en"`

#### LAC-08: Recovery/nova-senha — sem landmarks e sem `role="status"` no sucesso
**Criticidade**: Média.
- `recovery-form.tsx` estado "sent" só tem `<h1>` + `<p>` — falta `role="status"` ou `role="alert"` no card de confirmação

---

## 4. Critérios de Aceite (AC)

### AC-1: Landmarks em todas as páginas públicas e onboarding

**Dado** que um usuário de screen reader acessa `/login`, `/register`, `/recuperar-senha` ou `/convite/[token]/*`
**Quando** a página carrega
**Então** a estrutura de landmarks inclui:
- Um elemento `<header>` com `role="banner"` (ou `<header>` HTML5 semântico no nível raiz)
- Um elemento `<main>` com `id="conteudo"`
- Um elemento `<footer>` com `role="contentinfo"`
- A `<nav>` só está presente quando há links de navegação (não obrigatória nas páginas públicas que não têm menu)

### AC-2: Login form identificado pelo heading

**Dado** que um screen reader navega para o formulário de login
**Então** o `<form>` tem `aria-labelledby` apontando para o `id` do `<h1>Entrar</h1>`, de modo que o screen reader anuncia "formulário Entrar"

### AC-3: Toggle de senha acessível (aria-pressed)

**Dado** que o toggle de senha está presente em login, register, onboarding criar-conta
**Então** o botão do toggle tem `aria-pressed="true"` quando a senha está visível e `aria-pressed="false"` quando oculta
**E** os ícones SVG têm `aria-hidden="true"` (sem emojis raw no DOM)
**E** o `aria-label` do botão é "Mostrar senha" / "Ocultar senha" (sem "Esconder")

### AC-4: Register — validação inline anunciada (polite)

**Dado** que o usuário de screen reader preenche o formulário de registro
**Quando** sai de um campo com erro de validação
**Então** o erro é anunciado sem interrupção via `aria-live="polite"` (ou via elemento com `role="alert"` já em cena na árvore de acessibilidade)
**E** o estado de sucesso ("Conta criada!") está em elemento com `role="status"`

### AC-5: Recovery/nova-senha — mesmos padrões do login

**Dado** que o usuário de screen reader navega recuperação de senha ou definição de nova senha
**Então** a estrutura de landmarks está presente (header/main/footer)
**E** mensagens de sucesso usam `role="status"` (polite)
**E** mensagens de erro usam `role="alert"` (assertive)

### AC-6: Onboarding — gestão de foco + aria-live

**Dado** que o usuário de screen reader navega o fluxo de convite (welcome → termos → criar-conta)
**Então** o foco é movido para o `<main>` (ou heading principal) ao entrar em cada etapa
**E** transições de etapa têm anúncio polite via `AsyncAnnouncerProvider` ou `aria-live`

### AC-7: `lang` inline para termos estrangeiros recorrentes

**Dado** que a página contém termos em inglês (ex: "Dashboard", "Radar", "check-in")
**Então** esses termos estão envoltos em `<span lang="en">` nos componentes onde ocorrem (telas públicas + componentes compartilhados)
**Nota**: aplica-se a termos tecnicamente em inglês — vocabulário pastoral (ex: "discipulado") permanece em PT-BR

### AC-8: Typos corrigidos em pt-BR.json

**Dado** que o arquivo `apps/web/messages/pt-BR.json` é carregado
**Então** `newPassword.hidePassword` = `"Ocultar senha"` (não "Esconder")
**E** `register.errors.invalidEmail` = `"E-mail inválido"` (com acento)

### AC-9: Roteiro de teste manual documentado

**Dado** que a história é entregue
**Então** existe `docs/specs/a11y-screen-reader-auth/manual-test-checklist.md` com roteiro cobrindo:
- Login com VoiceOver (macOS/Safari), NVDA (Windows/Chrome), JAWS (Windows/Chrome)
- Register, recuperação de senha, onboarding
- Cada passo do roteiro com instrução e resultado esperado
- Seção explícita "Gate humano pendente — NÃO marcar como DONE sem execução manual"

---

## 5. Restrições e Não-Requisitos

### SC-1: Zero novas violações axe-core
As páginas `/login`, `/register`, `/recuperar-senha` já estão em modo `hard` no `a11y-pages.json` do ratchet (Epic 12). NENHUMA nova violação axe deve ser introduzida. O CI bloqueia automaticamente.

### SC-2: Sem alteração de ratchet
NÃO adicionar páginas ao `a11y-pages.json` (promoção de baseline→hard é escopo de 15.2/15.4).

### SC-3: Onboarding não entra no ratchet
Páginas `/convite/[token]/*` não estão no `a11y-pages.json` e NÃO devem ser adicionadas nesta story.

### SC-4: `PasswordInputWithToggle` existente é o componente canônico
O toggle inline do `login-form.tsx` deve ser substituído por `PasswordInputWithToggle` (que já tem `aria-pressed`) para eliminar duplicação de lógica.

### SC-5: Sem alterações de backend/API
Esta story é exclusivamente frontend (Next.js). Nenhuma mudança em `apps/api/` é esperada.

### SC-6: Sem tenant name dinâmico no `<title>` pré-auth (fora de escopo)
O AC original menciona `<title>Entrar — {tenantName}</title>`. O `tenantName` pré-autenticação não é disponível via contexto de request no App Router sem cookie/header especial. **Decisão**: `<title>` fixo "Entrar — Metanoia Hub" para as páginas públicas. Implementação dinâmica de título por tenant é escopo de infraestrutura de tenant-branding (feature `branding-tenant`).

### SC-7: Register é single-page (sem multi-step ARIA)
O AC#4 menciona "Passo {n} de {total}" para registro multi-step. O código atual é single-page com 4 campos. **Decisão**: sem step indicator ARIA multi-etapa. Adicionar `aria-label="Formulário de cadastro"` ao `<form>` como substituto informativo.

---

## 6. Limite Honesto — Gate Humano

Esta story entrega código ARIA semanticamente correto e cobertura axe automatizada. O DoD do Épico 15 exige teste manual com ≥3 screen readers (VoiceOver/NVDA/JAWS). **O teste manual NÃO pode ser executado neste ambiente.**

O artefato de entrega obrigatório é `docs/specs/a11y-screen-reader-auth/manual-test-checklist.md` (AC-9). A story só pode ser marcada como **DONE** após um humano executar o roteiro e documentar os resultados.

---

## 7. Dependências

| Dependência | Tipo | Observação |
|------------|------|-----------|
| Epic 12 (a11y-ci-gate, a11y-teclado-publico) | Pré-condição | skip-nav, ratchet, axe CI já instalados |
| `src/components/a11y/async-announcer.tsx` | Reutilização | Usar no onboarding layout |
| `src/components/forms/password-input-with-toggle.tsx` | Reutilização | Substituir toggle inline do login |
| `apps/web/messages/pt-BR.json` | Edição | Typos LAC-06 |

---

## 8. Validation Gates (pré-done)

Executar antes de marcar a onda execute-task como concluída:

```bash
# 1. Lint (monorepo inteiro)
pnpm turbo lint

# 2. Testes unitários web
pnpm --filter @metanoia/web test

# 3. Build web
pnpm turbo build --filter=@metanoia/web

# 4. Gates a11y hard (Epic 12)
bash scripts/check-focus-ring-variants.sh --ci
node apps/web/scripts/check-contrast-tokens.mjs
bash scripts/check-motion-safe.sh --ci

# 5. Se tocar packages/ui ou packages/types
pnpm --filter @metanoia/ui test
```

---

## 9. Artefatos de Saída

| Artefato | Localização |
|---------|-------------|
| Spec (este documento) | `docs/specs/a11y-screen-reader-auth/spec.md` |
| Plan | `docs/specs/a11y-screen-reader-auth/plan.md` |
| Tasks | `docs/specs/a11y-screen-reader-auth/tasks.md` |
| Roteiro manual | `docs/specs/a11y-screen-reader-auth/manual-test-checklist.md` |

---

## Clarifications

**Q1 — Register multi-step vs single-page** (dec-pré-flight / SC-7)
Tratado como single-page (código real = 4 campos em uma tela). Adicionar `aria-label="Formulário de cadastro"` ao `<form>`. Sem step indicator ARIA.

**Q2 — Tenant name dinâmico no `<title>` pré-auth** (dec-pré-flight / SC-6)
Fora de escopo da 15.1. `<title>` fixo "Entrar — Metanoia Hub". Aguarda feature `branding-tenant`.

**Q3 — Breadcrumbs ARIA** (dec-pré-flight)
Breadcrumbs não existem na codebase. Escopo de 15.4. Não implementar em 15.1.

**C1 — Escopo de lang inline para termos estrangeiros** (dec-008, score 2)
Opção A: lista fechada de termos visíveis em UI (Dashboard, Radar, VoiceOver, NVDA, JAWS, check-in, login, onboarding) apenas em texto renderizado de telas públicas + packages/ui. Não aplicar em comentários ou variáveis. Vocabulário pastoral permanece PT-BR sem `lang`.

**C2 — Mecanismo de foco no onboarding** (dec-009, score 3)
Opção A: reutilizar `FocusManager` existente (`apps/web/app/(authenticated)/_components/focus-manager.tsx`) via `dynamic(() => import(...), { ssr: false })` no `(onboarding)/layout.tsx`. O hook `useFocusOnRouteChange` usa apenas `usePathname()` sem acoplamento ao shell autenticado. Cada etapa (welcome/termos/criar-conta) tem pathname distinto, garantindo disparo do hook.

**C3 — Local da correção de aria-live no register** (dec-010, score 3)
Opção B: corrigir apenas em `register-form.tsx` com wrapper local. `register-form.tsx` não usa `FormField` — implementa seus próprios `<label>` + `<Input>` + `<p role="alert">` diretos. Corrigir `FormField` seria ineficaz e introduziria blast radius desnecessário em outros formulários.
