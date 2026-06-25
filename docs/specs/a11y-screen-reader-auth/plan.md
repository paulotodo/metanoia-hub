# Plan: Screen Reader — Autenticação, Navegação Global & Landmarks

**Feature**: a11y-screen-reader-auth
**Epic/Story**: 15.1
**Branch**: feat/epic15-15-1-screen-reader-auth
**Data**: 2026-06-25

---

## Summary

Implementar suporte a screen reader (VoiceOver/NVDA/JAWS) nos fluxos de autenticação pública e onboarding do metanoia-hub. A story é exclusivamente frontend — sem alterações de backend, sem novas rotas, sem novos schemas Zod. O trabalho consiste em 8 lacunas de ARIA/semântica identificadas em pré-flight, resolvíveis por adição de atributos e reestruturação mínima de componentes existentes.

**Abordagem**: reutilização máxima de componentes existentes (`PasswordInputWithToggle`, `FocusManager`, `AsyncAnnouncerProvider`) + adição pontual de atributos ARIA onde ausentes + correções de strings i18n.

---

## Constitution Check

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | N/A | Sem tabelas, queries ou migrations |
| II. Type-Safety | PASS | Atributos ARIA são booleanos/strings tipadas corretamente |
| III. Idioma & Vocabulário Pastoral | PASS | pt-BR.json corrigido; lang inline não viola centralização |
| IV. Contratos de API | N/A | Sem endpoints novos ou modificados |
| V. Separação de Estado Frontend | PASS | FocusManager via dynamic() ssr:false = padrão estabelecido |
| VI. Qualidade Verificável | PASS | Gates axe + lint + build + scripts a11y + roteiro humano |
| VII. Processo de Entrega | PASS | 1 story = 1 branch já criada |

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript (strict: true) |
| Framework | Next.js 16.2 (App Router) |
| UI lib | shadcn/ui + packages/ui interno |
| i18n | next-intl ou JSON direto (`apps/web/messages/pt-BR.json`) |
| Testes | Vitest 4.1.2, Testing Library, axe-core (via Playwright no CI) |
| Lint/Build | pnpm turbo lint + turbo build |
| A11y CI | Playwright + axe (axe-quality-gate E2E), scripts hard (Epic 12) |
| Backend | NÃO envolvido |
| Banco | NÃO envolvido |

---

## Convencoes de Borda

N/A — single-layer (frontend exclusivo). Sem borda backend↔frontend nesta story.

---

## Project Structure

```
docs/specs/a11y-screen-reader-auth/
  spec.md                            # Spec da feature (9 ACs, 8 lacunas)
  plan.md                            # Este documento
  research.md                        # 8 decisões técnicas documentadas
  quickstart.md                      # Cenários de teste
  manual-test-checklist.md           # Roteiro humano VoiceOver/NVDA/JAWS (AC-9)
  tasks.md                           # Backlog executável

apps/web/
  app/
    (public)/
      layout.tsx                     # LAC-01: adicionar header + footer
      login/
        _components/login-form.tsx   # LAC-02, LAC-03
      register/
        _components/register-form.tsx # LAC-04 (C3)
      recuperar-senha/
        _components/recovery-form.tsx # LAC-08
      nova-senha/[token]/
        _components/reset-password-form.tsx # LAC-08
    (onboarding)/
      layout.tsx                     # LAC-01 + LAC-05 (FocusManager + AsyncAnnouncerProvider)
      convite/[token]/
        _components/welcome-view.tsx  # LAC-05 (aria-live transição)
        termos/_components/terms-page-content.tsx # LAC-05
        criar-conta/_components/create-account-form.tsx # LAC-05 (toggle ok)
  messages/
    pt-BR.json                       # LAC-06: typos "Esconder"→"Ocultar", "invalido"→"inválido"
  src/
    components/
      forms/
        password-input-with-toggle.tsx # SC-4: componente canônico (já OK)

packages/ui/
  components/
    sidebar.tsx                      # Já tem aria-label (sem alteração)
    bottom-tabs.tsx                  # Já tem aria-label (sem alteração)
```

---

## Mapa de Lacunas → Arquivos → Estratégia

### LAC-01: Landmarks ausentes (PRIORIDADE ALTA)

**Arquivos**: `apps/web/app/(public)/layout.tsx`, `apps/web/app/(onboarding)/layout.tsx`

**Estratégia**:
```tsx
// Antes:
<main id="conteudo" className="...">
  {children}
</main>

// Depois:
<>
  <header>{/* vazio ou logo placeholder futuro */}</header>
  <main id="conteudo" className="...">
    {children}
  </main>
  <footer>{/* vazio ou copyright placeholder futuro */}</footer>
</>
```

`<header>` e `<footer>` no nível raiz de uma página implicitamente têm `role="banner"` e `role="contentinfo"` — sem necessidade de atributos `role` explícitos (HTML5 semântico).

Para `(onboarding)/layout.tsx`: converter para `"use client"` e adicionar `FocusManager` + `AsyncAnnouncerProvider` (ver LAC-05).

---

### LAC-02: Login form sem aria-labelledby

**Arquivo**: `apps/web/app/(public)/login/_components/login-form.tsx`

**Estratégia**:
```tsx
// h1 (linha 85 aprox.):
<h1 id="login-form-heading" className="text-display mb-6 text-center">
  {t.title}
</h1>

// form (linha 87 aprox.):
<form
  onSubmit={handleSubmit}
  noValidate
  aria-labelledby="login-form-heading"
  className="flex flex-col gap-4"
>
```

---

### LAC-03: Toggle de senha no login (substituir por componente canônico)

**Arquivo**: `apps/web/app/(public)/login/_components/login-form.tsx`

**Estratégia**: Remover o bloco `<div className="relative"> <Input .../> <button ...>🙈/👁</button> </div>` e substituir por `<PasswordInputWithToggle>`:

```tsx
import { PasswordInputWithToggle } from '@/components/forms';

// Substituir o bloco de senha:
<PasswordInputWithToggle
  id="login-password"
  autoComplete="current-password"
  required
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  aria-invalid={errors.password ? (true as unknown as boolean) : undefined}
  aria-describedby={errors.password ? 'login-password-error' : undefined}
  toggleShowLabel={messages.newPassword.showPassword}
  toggleHideLabel={messages.newPassword.hidePassword}
  data-testid="login-password"
/>
```

Remover o `useState<boolean> showPassword` que o toggle inline controlava (o `PasswordInputWithToggle` gerencia internamente). Remover import de `messages.newPassword` separado — já usado via props.

**Atenção**: o `data-testid="login-toggle-password"` existente no botão de toggle deve ser preservado passando-o para o componente ou adicionando ao `PasswordInputWithToggle` via prop se necessário para os testes. Verificar os testes em `__tests__/login.spec.tsx` e ajustar seletores se necessário.

---

### LAC-04: Register — aria-label no form + aria-live nos erros

**Arquivo**: `apps/web/app/(public)/register/_components/register-form.tsx`

**Estratégia**:

1. Adicionar `aria-label="Formulário de cadastro"` ao `<form>`:
```tsx
<form onSubmit={handleSubmit} noValidate aria-label="Formulário de cadastro" className="flex flex-col gap-4">
```

2. Para erros de campo inline: os `<p role="alert">` existentes são inseridos dinamicamente. Adicionar `aria-live="polite"` ao container do campo para garantir anúncio consistente entre screen readers:
```tsx
// Wrapper de cada campo com erro:
<div aria-live="polite" aria-atomic="true">
  {errors.name && (
    <p id="name-error" className="text-caption mt-1 text-state-danger">
      {errors.name[0]}
    </p>
  )}
</div>
```

**Nota**: usar `aria-live="polite"` (sem `role="alert"`) para validação de campo — interrupção assertiva não é desejada durante digitação.

---

### LAC-05: Onboarding — FocusManager + AsyncAnnouncerProvider

**Arquivo**: `apps/web/app/(onboarding)/layout.tsx`

**Estratégia**: Converter layout para Client Component e adicionar providers:
```tsx
"use client";

import dynamic from "next/dynamic";
import { AppQueryProvider } from "@/lib/query";
import { AsyncAnnouncerProvider } from "@/components/a11y/async-announcer";

const FocusManager = dynamic(
  () =>
    import("@/app/(authenticated)/_components/focus-manager").then(
      (m) => ({ default: m.FocusManager }),
    ),
  { ssr: false },
);

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppQueryProvider>
      <AsyncAnnouncerProvider>
        <FocusManager />
        <main id="conteudo" className="min-h-dvh bg-background">
          {children}
        </main>
      </AsyncAnnouncerProvider>
    </AppQueryProvider>
  );
}
```

`header` e `footer` serão adicionados via LAC-01 (ver acima). O `FocusManager` detecta mudanças em `/convite/[token]` → `/convite/[token]/termos` → `/convite/[token]/criar-conta` via `usePathname()` e move o foco para o `h1` de cada etapa.

---

### LAC-06: Typos em pt-BR.json

**Arquivo**: `apps/web/messages/pt-BR.json`

**Mudanças**:
- Linha 15: `"invalidEmail": "E-mail invalido"` → `"E-mail inválido"` (seção `register.errors`)
- Linha 684: `"hidePassword": "Esconder senha"` → `"Ocultar senha"` (seção `newPassword`)

---

### LAC-07: lang inline para termos estrangeiros

**Arquivos**: varredura em `apps/web/src/` e `packages/ui/` buscando os termos da lista fechada como texto renderizado (não em comentários/variáveis).

**Estratégia**:
- Buscar ocorrências literais de "login", "onboarding", "Dashboard", "check-in" em JSX como texto renderizado
- Envolver com `<span lang="en">termo</span>`
- Atualizar `pt-BR.json` se o termo aparece como string de mensagem (ex: `"googleButton": "Entrar com <span lang='en'>login</span>"` — na prática, o JSON não suporta HTML; verificar se os termos aparecem como chaves de tradução ou hardcoded em JSX)

**Escopo limitado**: na prática, "login" em português é tratado como empréstimo linguístico. Focar em termos que causam pronúncia incorreta clara: "onboarding", "Dashboard" (se renderizado), "check-in".

---

### LAC-08: Recovery/nova-senha — role="status" no sucesso + landmarks

**Arquivo**: `apps/web/app/(public)/recuperar-senha/_components/recovery-form.tsx`

**Estratégia** (estado "sent"):
```tsx
if (formState === 'sent') {
  return (
    <Card className="w-full max-w-md p-8" data-testid="recovery-sent" role="status">
      <h1 ...>{t.sent.title}</h1>
      ...
    </Card>
  );
}
```

**Arquivo**: `apps/web/app/(public)/nova-senha/[token]/_components/reset-password-form.tsx`

Estados de sucesso e erros de servidor já seguem o padrão. Adicionar `aria-labelledby` ao form principal (mesmo padrão do login — ver LAC-02).

---

## Roteiro de Implementação (ordem de execução)

1. **FASE 1 — i18n** (LAC-06): corrigir typos em pt-BR.json → zero risco de regressão
2. **FASE 2 — Landmarks** (LAC-01): layouts public + onboarding → base para todas as outras mudanças
3. **FASE 3 — Login** (LAC-02 + LAC-03): aria-labelledby + substituição do toggle inline
4. **FASE 4 — Register** (LAC-04): aria-label no form + aria-live nos erros
5. **FASE 5 — Recovery/nova-senha** (LAC-08): role="status" + aria-labelledby
6. **FASE 6 — Onboarding** (LAC-05): FocusManager + AsyncAnnouncerProvider no layout
7. **FASE 7 — Lang inline** (LAC-07): varredura + wrapping de termos da lista fechada
8. **FASE 8 — Roteiro manual** (AC-9): criar manual-test-checklist.md
9. **FASE 9 — Validation gates**: lint + testes + build + scripts a11y hard

---

## Validation Gates (pré-done)

```bash
# Lint (monorepo inteiro, sem --filter)
pnpm turbo lint

# Testes unitários web
pnpm --filter @metanoia/web test

# Build web
pnpm turbo build --filter=@metanoia/web

# Gates a11y hard (Epic 12)
bash scripts/check-focus-ring-variants.sh --ci
node apps/web/scripts/check-contrast-tokens.mjs
bash scripts/check-motion-safe.sh --ci

# Se tocar packages/ui (somente se alterar sidebar/bottomtabs — não esperado)
pnpm --filter @metanoia/ui test

# Se tocar packages/types (não esperado nesta story)
pnpm --filter @metanoia/types test
```

**Nota**: `pnpm turbo lint --force` para invalidar cache após correções iterativas.

---

## Re-check Constitution (pós-design)

Nenhuma violação introduzida pelo design:
- `"use client"` no onboarding layout: necessário para `dynamic()` + `usePathname()` — alinhado com Princípio V (Client Component apenas quando necessário).
- Substituição do toggle inline por componente canônico: reduz duplicação, alinhado com Princípio VI (qualidade verificável).
- `aria-live` containers estáticos: não alteram lógica de estado ou contratos de API.
