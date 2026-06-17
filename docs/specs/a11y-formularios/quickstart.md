# Quickstart / Cenarios de Teste: a11y-formularios

> Feature: Story 12.5 — Formularios Acessiveis (NFR-A3)
> Fluxos criticos a validar manualmente e via E2E.

---

## Cenario 1: FormField — campo valido -> campo com erro -> recuperacao

**Contexto**: FormField instanciado com um Input de email.

1. Renderizar `<FormField label="E-mail" required error={undefined}><Input .../></FormField>`
2. **Verificar**: `<label>` tem `htmlFor` apontando para `id` do Input; controle tem
   `aria-required="true"`; sem `aria-invalid`; sem `aria-describedby`.
3. Simular submit com campo vazio — erro `"Campo obrigatorio"` injetado.
4. **Verificar**: controle tem `aria-invalid="true"`; `aria-describedby` aponta para
   `${id}-error`; `<p role="alert" id="${id}-error">Campo obrigatorio</p>` visivel.
5. Corrigir campo — erro removido.
6. **Verificar**: `aria-invalid` omitido; `aria-describedby` omitido ou aponta so para
   `${id}-description` (se description presente).

**Expected**: `toHaveNoViolations()` em todos os estados (valid, error, recovered).

---

## Cenario 2: scrollToFirstError — submit com multiplos campos invalidos

**Contexto**: Formulario de registro com email e senha invalidos.

1. Abrir `/register` — ambos os campos vazios.
2. Clicar em "Criar Conta".
3. **Verificar**: `aria-invalid="true"` no campo de email (primeiro invalido).
4. **Verificar**: foco movido para o campo de email (pode ser confirmado via
   `document.activeElement === emailInput`).
5. Scroll posicionado com o campo visivel no viewport.

**Expected**: leitor de tela anuncia o label do campo + o erro via `aria-describedby`.

---

## Cenario 3: SubmitButton — aria-busy durante submissao

**Contexto**: Qualquer formulario com `SubmitButton`.

1. Preencher formulario corretamente.
2. Clicar em "Enviar".
3. **Verificar durante submissao**: `aria-busy="true"` no botao; `disabled="true"`;
   label muda para texto de pending; spinner com `aria-hidden="true"` visivel.
4. Submissao completa (sucesso ou erro).
5. **Verificar apos**: `aria-busy` omitido; botao reativado; label retorna ao original.

---

## Cenario 4: Wizard Step3 — fieldset/legend para radiogroup

**Contexto**: Step 3 do wizard de onboarding — escolha de modo (criar grupo vs demo).

1. Renderizar Step3Group.
2. **Verificar**: o agrupamento de opcoes usa `<fieldset>` com `<legend>` descrevendo
   o grupo; cada opcao e um `<input type="radio">` com `<label>` associado via `htmlFor`.
3. Navegar pelo teclado: Tab entra no grupo; setas navegam entre opcoes.
4. **Verificar**: leitor de tela anuncia legenda ao entrar no grupo.

**Expected**: `toHaveNoViolations()` no componente Step3Group.

---

## Cenario 5 (E2E Playwright): Pagina de login — sem violacoes WCAG AA

**Contexto**: `/login` — rota publica, sem autenticacao.

1. Navegar para `http://localhost:3000/login`.
2. Executar `@axe-core/playwright` na pagina.
3. **Verificar**: zero violacoes de nivel AA.
4. Focar no campo de email via Tab; digitar email invalido; Tab para senha; Tab para submit.
5. Clicar em submit (ou Enter).
6. **Verificar**: `role="alert"` aparece; foco movido ao primeiro campo invalido.
7. Re-executar axe apos estado de erro.
8. **Verificar**: zero violacoes no estado de erro.

---

## Cenario 6 (E2E Playwright): Pagina de registro — fluxo de erro e recuperacao

**Contexto**: `/register` — rota publica.

1. Navegar para `/register`.
2. Clicar em "Criar Conta" sem preencher.
3. **Verificar**: `aria-invalid` nos campos vazios; `role="alert"` nas mensagens de erro.
4. Preencher campos corretamente.
5. **Verificar**: `aria-invalid` removido; mensagens de erro desaparecem.
6. axe audit no estado valido: zero violacoes.

---

## Cenario 7 (E2E Playwright): Pagina de recuperacao de senha

**Contexto**: `/recuperar-senha` — rota publica.

1. Navegar para `/recuperar-senha`.
2. axe audit na pagina carregada: zero violacoes.
3. Submit sem email.
4. **Verificar**: `aria-invalid`, `role="alert"`, foco movido.
5. axe audit no estado de erro: zero violacoes.

---

## Cenario 8: reflection-form-field — prop required

**Contexto**: `ReflectionFormField` com `required={true}`.

1. Renderizar com `required={true}`.
2. **Verificar**: `aria-required="true"` no textarea.
3. Renderizar sem `required` (padrao).
4. **Verificar**: `aria-required` omitido.

**Expected**: `toHaveNoViolations()` em ambos os estados.

---

## Notas de execucao de testes

- **Vitest + jest-axe**: `pnpm --filter @metanoia/web test` (ou `vitest run`).
- **Playwright E2E**: `pnpm --filter @metanoia/web exec playwright test --grep a11y`.
- Job CI existente "E2E (Playwright)" sera usado para os cenarios 5-7.
- Variavel `NEXT_PUBLIC_API_URL` necessaria para rodar E2E localmente (ver docker-compose.yml).
