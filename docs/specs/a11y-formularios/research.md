# Research: a11y-formularios

> Fase: Phase 0 — Resolucao de unknowns antes do design.
> Todas as questoes levantadas na spec foram resolvidas antes do Phase 1.

---

## Decision 1: Localizacao do FormField reutilizavel

**Pergunta**: Onde mora o `FormField`? `packages/ui` ou `apps/web/src/components/forms/`?

**Decision**: `apps/web/src/components/forms/form-field.tsx`, exportado por
`apps/web/src/components/forms/index.ts`.

**Rationale**:
- `packages/ui` ja exporta primitivos stateless (`Input`, `Button`, `Card`, `Dialog`).
  `FormField` combina logica ARIA com contexto de formulario (IDs dinamicos, mensagens
  de erro, `aria-describedby` composto) e um componente composto, nao um primitivo.
- O pacote `packages/ui` nao tem `label.tsx` (confirmado: ausente em `packages/ui/components/`);
  a spec diz explicitamente "NAO altera `packages/ui/components/input.tsx`".
- Colocar em `apps/web` e consistente com `password-input-with-toggle.tsx`,
  `time-input.tsx`, `reflection-form-field.tsx` — todos compostos de formulario
  vivem em `apps/web/src/components/forms/`.
- Evita vazamento de dependencias de Next.js/React 18 `useId()` para o pacote compartilhado.

**Alternatives considered**:
- `packages/ui`: rejeitado — mistura primitivo com composto; cria dep de `useId` e
  logica de erro no pacote de UI puro.
- Novo pacote `packages/forms`: rejeitado — overhead de manutencao sem ganho real;
  `FormField` nao e compartilhado fora de `apps/web` neste projeto.

---

## Decision 2: Estrategia de IDs estaveis (SSR + CSR)

**Pergunta**: Como gerar IDs ARIA estaveis sem hidratacao mismatch?

**Decision**: `useId()` (React 18+) como fonte primaria. O `FormField` aceita `id?`
opcional; se omitido, usa `useId()` internamente. IDs derivados: `${baseId}-error`,
`${baseId}-description`.

**Rationale**:
- `ReflectionFormField` ja usa este padrao com sucesso (confirmado no codebase).
- `useId()` e stable entre SSR e CSR (React 18+ garante isso).
- Next.js 16.2 (projeto usa) suporta `useId()` plenamente.
- IDs derivados por sufixo (`-error`, `-description`) sao previsivos e testavel por spec.

**Alternatives considered**:
- `nanoid()` / `uuid`: nao-deterministico entre servidor e cliente — hidratacao mismatch.
- IDs estaticos manuais por form: escala pessimamente para 17 formularios; conflito quando
  multiplos forms na mesma pagina.

---

## Decision 3: aria-invalid — omitir vs false quando valido

**Pergunta**: usar `aria-invalid={false}` ou omitir quando o campo e valido?

**Decision**: Omitir `aria-invalid` quando campo valido (nao passar `aria-invalid={false}`).

**Rationale**:
- WCAG e ARIA spec: `aria-invalid` so deve ser presente quando o campo de fato tem erro.
  `aria-invalid="false"` e tecnicamente valido mas adiciona verbosidade desnecessaria
  para leitores de tela.
- A spec (FR-04) determina explicitamente: "omitido (nao `false`) caso contrario".
- `ReflectionFormField` ja implementa: `aria-invalid={invalid ? true : undefined}`.
- `contact-message-form` e `demo-request-form` ja usam `aria-invalid={!!errors.x}` —
  React converte `false` para omissao no DOM automaticamente.

**Alternatives considered**:
- `aria-invalid={error ? "true" : "false"}`: rejeitado — verbose; confunde leitores de tela.
- `aria-invalid={!!error}`: aceitavel (React omite `false`), mas `error ? true : undefined`
  e mais legivel e semanticamente correto.

---

## Decision 4: role="alert" vs aria-live para mensagens de erro

**Pergunta**: Usar `role="alert"` ou `aria-live="assertive"` para anunciar erros inline?

**Decision**: `role="alert"` exclusivamente. Nao adicionar `aria-live` no mesmo elemento.

**Rationale**:
- `role="alert"` implica `aria-live="assertive" aria-atomic="true"` pela especificacao ARIA.
  Combinar os dois e redundante e pode causar duplo anuncio em alguns leitores de tela.
- A spec (FR-05) determina explicitamente esta combinacao como anti-padrao.
- `contact-message-form` e `demo-request-form` ja usam este padrao corretamente.
- WCAG 4.1.3 (Status Messages) e atendido por `role="alert"`.

**Alternatives considered**:
- `aria-live="polite"` para erros: rejeitado — erros de validacao sao urgentes.
- `role="status"`: rejeitado — para mensagens informativas, nao erros.

---

## Decision 5: scrollToFirstError — implementacao

**Pergunta**: Qual a implementacao correta de `scrollToFirstError()`?

**Decision**: Localizar `[aria-invalid="true"]` via `document.querySelector`, invocar
`.scrollIntoView({ block: 'center', behavior: 'smooth' })` e `.focus()` em sequencia.
Exportado de `apps/web/src/lib/form-utils.ts`.

**Rationale**:
- Selecionar por `[aria-invalid="true"]` e robusto: funciona para qualquer tipo de controle
  (`<input>`, `<select>`, `<textarea>`) sem coupling com IDs especificos.
- `.focus()` apos `.scrollIntoView()` garante que o leitor de tela anuncia o campo e o erro.
- Exportar de `form-utils.ts` evita duplicacao em 17 formularios.

**Alternatives considered**:
- `[data-invalid]`: nao e semantica ARIA — leitores de tela nao a interpretam.
- Refs manuais passados como parametro: coupling excessivo.

---

## Decision 6: SubmitButton — componente separado vs helper

**Pergunta**: `SubmitButton` deve ser um componente React separado ou extensao do `Button` existente?

**Decision**: Componente wrapper `SubmitButton` em `apps/web/src/lib/form-utils.ts` que envolve
o `Button` de `@metanoia/ui` adicionando `aria-busy`, spinner `aria-hidden` e label de pending.

**Rationale**:
- `Button` de `@metanoia/ui` nao tem `aria-busy` embutido — adicionar la quebraria o contrato.
- Um wrapper em `form-utils.ts` e co-localizado com `scrollToFirstError()`.
- O spinner usa `aria-hidden="true"` para nao ser anunciado duas vezes.

**Alternatives considered**:
- Estender `Button` em `packages/ui`: rejeitado — adiciona dep de estado de formulario ao UI kit.
- Inline em cada form: rejeitado — duplicacao em 17 formularios.

---

## Decision 7: Grupos radio/checkbox — fieldset/legend vs role="radiogroup"

**Pergunta**: Converter `role="radiogroup"` para `<fieldset>/<legend>` nativo no wizard Step3?

**Decision**: Sim — converter para `<fieldset>/<legend>` nativo.

**Rationale**:
- `<fieldset>/<legend>` e semantica nativa HTML; suporte universal em leitores de tela.
- `role="radiogroup"` sem `<fieldset>` real nao propaga a legenda automaticamente para todos
  os leitores de tela (especialmente NVDA + Firefox).
- A spec (FR-06, FR-13, SC4.6) exige explicitamente esta conversao.

**Alternatives considered**:
- Manter `role="radiogroup"` + adicionar `aria-labelledby`: tecnicamente valido mas
  menos robusto; semantica nativa e preferida pela spec.

---

## Decision 8: Testes — jest-axe vs @axe-core/playwright — divisao de responsabilidades

**Pergunta**: Qual suite testa o que?

**Decision**:
- **jest-axe** (unit, via Vitest): FormField, SubmitButton, e cada formulario retrofitado.
  Regras: `label`, `aria-allowed-attr`, `aria-required-attr`, `aria-valid-attr-value`.
- **@axe-core/playwright** (E2E): rotas publicas — `/login`, `/register`,
  `/recuperar-senha`, `/nova-senha/[token]` e rota de convite.

**Rationale**:
- `jest-axe` (^10.0.0) e `@axe-core/playwright` (^4.11.3) estao em `package.json` de `apps/web`.
  Nao ha instalacao nova necessaria.
- `delete-group-dialog.spec.tsx` ja usa `jest-axe` — padrao estabelecido no projeto.
- Unit via jest-axe captura gaps ARIA antes do render real (mais rapido).
- E2E via Playwright captura focus management e anuncio de erro apos submit.

**Alternatives considered**:
- Apenas E2E: lento; nao captura regressoes durante desenvolvimento.
- Apenas unit: nao captura problemas de hidratacao e focus management real.
