# Research: a11y-screen-reader-auth

## Decision 1 — Landmarks em layouts Server Component

**Decision**: Envolver o `<main id="conteudo">` existente com `<header role="banner">` e `<footer role="contentinfo">` nos layouts `(public)/layout.tsx` e `(onboarding)/layout.tsx`. Não usar `<body>` ou wrappers extras.

**Rationale**:
- Os layouts são Server Components puros (sem `"use client"`) — podem receber elementos HTML semânticos sem nenhum overhead de hidratação.
- WCAG 1.3.1 (Info and Relationships) exige landmarks ARIA no nível raiz para que screen readers possam navegar por regiões (`R` no NVDA/JAWS, `W` no VoiceOver).
- `<header>` e `<footer>` como elementos HTML5 raiz implicitamente têm `role="banner"` e `role="contentinfo"` respectivamente. `role="banner"` e `role="contentinfo"` explícitos são redundantes mas inofensivos — usar somente HTML5 semântico é suficiente e mais limpo.
- Páginas públicas não têm menu de navegação — nenhum `<nav>` necessário nos layouts.

**Alternatives considered**:
- Adicionar landmarks apenas nas pages individuais (login/page.tsx, register/page.tsx...): rejeitado por duplicar a estrutura e criar divergências entre páginas.
- Usar `<div role="banner">`: rejeitado em favor de HTML5 semântico (`<header>`), que é mais robusto.

---

## Decision 2 — Login form: aria-labelledby

**Decision**: Adicionar `id="login-form-heading"` ao `<h1>` e `aria-labelledby="login-form-heading"` ao `<form>` em `login-form.tsx`.

**Rationale**:
- WCAG 1.3.1 + ARIA Authoring Practices 1.1 recomendam `aria-labelledby` em `<form>` apontando para o heading visível quando o formulário tem um propósito claro.
- O heading `<h1>` já existe com texto `t.login.title` = "Entrar" — basta associar.
- Não cria novo texto ou elemento — apenas adiciona atributos a elementos existentes.

**Alternatives considered**:
- `aria-label="Formulário de login"` no `<form>`: rejeitado porque duplica texto já presente no DOM (WCAG SC 2.5.3 — label in name) e não usa o texto visível existente.

---

## Decision 3 — Toggle de senha: usar PasswordInputWithToggle

**Decision**: Substituir o toggle inline do `login-form.tsx` (botão com emojis 🙈/👁 sem `aria-pressed`) pelo componente `PasswordInputWithToggle` já existente em `src/components/forms/password-input-with-toggle.tsx`.

**Rationale**:
- `PasswordInputWithToggle` já tem `aria-pressed={visible}`, `aria-label` dinâmico (toggleShowLabel/toggleHideLabel), e SVG com `aria-hidden="true"` — todas as lacunas do toggle inline são resolvidas por reutilização.
- SC-4 da spec: "PasswordInputWithToggle existente é o componente canônico".
- Emojis brutos no DOM são pronunciados como "olho" ou texto alternativo do emoji pelo screen reader — não é o anúncio correto para um toggle de senha.
- O componente recebe `toggleShowLabel` e `toggleHideLabel` como props: passar `t.newPassword.showPassword` ("Mostrar senha") e `t.newPassword.hidePassword` (corrigido para "Ocultar senha").

**Alternatives considered**:
- Adicionar `aria-pressed` e `aria-hidden` ao toggle inline existente: rejeitado para eliminar duplicação de lógica (mesmo comportamento em dois lugares = manutenção dupla).

---

## Decision 4 — Register: aria-live nos erros inline

**Decision**: Adicionar `aria-live="polite"` ao elemento wrapper dos erros de campo inline em `register-form.tsx` usando elemento estático sempre presente na árvore acessível (empty container que recebe texto quando há erro).

**Rationale**:
- C3 da clarify confirmou: `register-form.tsx` não usa `FormField` — não é possível herdar `role="alert"` do FormField.
- `role="alert"` (assertive) nos erros de campo inline interrompe o screen reader em campos com validação em tempo real — `aria-live="polite"` é o padrão correto para erros de campo (não interrompe narração atual).
- Padrão: `<div aria-live="polite" aria-atomic="true">` estático no DOM, invisível quando vazio, recebe conteúdo de erro apenas quando presente.

**Alternatives considered**:
- Adicionar `role="alert"` aos `<p>` de erro existentes: problemático porque `role="alert"` insere o elemento no DOM após a digitação (não estava presente na árvore inicial), e alguns screen readers anunciam `role="alert"` apenas quando o elemento é inserido dinamicamente — comportamento inconsistente entre NVDA/VoiceOver/JAWS.
- Static `aria-live` container com `role="status"`: rejeitado porque `role="status"` implica `aria-live="polite"` mas tem semântica de status (operação concluída), não de validação de campo.

---

## Decision 5 — Onboarding: FocusManager via dynamic() no layout

**Decision**: Importar `FocusManager` via `dynamic()` no `(onboarding)/layout.tsx` convertendo-o para Client Component com `"use client"`. Adicionar também `AsyncAnnouncerProvider` wrapping os children.

**Rationale**:
- C2 da clarify (dec-009, score 3): reutilizar FocusManager existente no layout.
- `useFocusOnRouteChange` usa apenas `usePathname()` — sem acoplamento ao shell autenticado.
- Cada etapa tem pathname distinto: `/convite/[token]`, `/convite/[token]/termos`, `/convite/[token]/criar-conta` — o hook detecta a mudança e move o foco para o `h1` ou `#conteudo`.
- `AsyncAnnouncerProvider` já é usado no shell autenticado — reutilizável no onboarding para anúncios de transição de etapa (ex: "Termos de uso" ao entrar na tela de termos).
- Converter `(onboarding)/layout.tsx` para Client Component: necessário porque `dynamic()` com `ssr:false` precisa estar em Client Component. O layout tem apenas `AppQueryProvider` + `<main>` — custo de hidratação mínimo.

**Alternatives considered**:
- Usar `useEffect` + `ref.focus()` em cada page component: rejeitado porque replica lógica em 3 arquivos e não cobre o caso de loading states (FocusManager resolve após mount).

---

## Decision 6 — lang inline: termos elegíveis

**Decision**: Lista fechada de termos elegíveis para `<span lang="en">` em texto renderizado de telas públicas + packages/ui:

| Termo | Ocorrência típica | Justificativa |
|-------|-------------------|---------------|
| `login` | Botão "Entrar com Google" / links | Pronúncia PT-BR é "lóguin", diferente do inglês |
| `onboarding` | Rótulos de tela | Sem equivalente PT-BR comum |
| `VoiceOver` | Roteiro manual (markdown) | Nome próprio de produto |
| `NVDA` | Roteiro manual | Sigla em inglês |
| `JAWS` | Roteiro manual | Sigla em inglês |
| `Dashboard` | Se aparecer como texto renderizado | Frequente em PT-BR tech, mas pronúncia diverge |
| `check-in` | Módulos de reunião | Composto inglês |

**Nota**: os termos "VoiceOver/NVDA/JAWS" aparecem apenas no roteiro manual (markdown), não em componentes React. No HTML renderizado ao usuário, os termos relevantes são "login", "onboarding" e "Dashboard" (se aparecerem como texto literal). "Radar" é vocabulário pastoral reapropriado — NÃO recebe `lang="en"`.

**Alternatives considered**:
- Varredura aberta sem lista: rejeitado (C1 da clarify) por produzir resultados inconsistentes e dificultar review.

---

## Decision 7 — Recovery/nova-senha: role="status" no sucesso

**Decision**: Adicionar `role="status"` ao elemento de confirmação de envio em `recovery-form.tsx` (estado "sent") e ao estado de loading/sucesso em `reset-password-form.tsx`. Erros mantêm `role="alert"`.

**Rationale**:
- `role="status"` tem `aria-live="polite"` implícito — anuncia a confirmação sem interromper narração.
- Landmarks já são resolvidos pelo layout (Decision 1) — sem necessidade de repetir no componente.
- O estado "sent" do recovery é uma mensagem de sucesso, não um erro — `role="status"` é semanticamente correto (ARIA APG).

---

## Decision 8 — Register form: aria-label no form

**Decision**: Adicionar `aria-label="Formulário de cadastro"` ao `<form>` em `register-form.tsx`.

**Rationale**:
- SC-7: register é single-page; sem step indicator ARIA multi-etapa.
- `aria-label` no `<form>` fornece contexto ao screen reader ao entrar na região de formulário.
- Diferente do login (que usa `aria-labelledby` apontando ao h1 visível), o register-form.tsx tem h1 com texto apenas, portanto `aria-label` direto no form é igualmente válido.
