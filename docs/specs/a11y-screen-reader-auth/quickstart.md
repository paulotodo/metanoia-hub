# Quickstart: a11y-screen-reader-auth

## Cenário 1 — Happy Path: Login acessível com screen reader

**Pré-condição**: Screen reader ativo (VoiceOver/NVDA/JAWS). Página `/login` carregada.

1. Screen reader navega por landmarks → Anuncia "banner" (header) → "principal" (main)
2. Screen reader entra na região `main` → Anuncia heading `h1` "Entrar"
3. Screen reader navega para o formulário → Anuncia "formulário Entrar" (via `aria-labelledby`)
4. Tab para campo E-mail → Anuncia "E-mail, campo de texto, obrigatório"
5. Tab para campo Senha → Anuncia "Senha, campo de texto, obrigatório"
6. Tab para botão toggle senha → Anuncia "Mostrar senha, não pressionado" (`aria-pressed="false"`)
7. Ativa toggle → Anuncia "Ocultar senha, pressionado" (`aria-pressed="true"`)
8. Submete formulário com credenciais inválidas → Anuncia imediatamente "E-mail ou senha incorretos" (via `role="alert"`)
9. Foco move para a mensagem de erro ou primeiro campo inválido
10. **Expected**: Toda a sequência ocorre sem silêncio, sem leituras inesperadas, sem armadilhas de foco

---

## Cenário 2 — Error Path: Validação de registro

**Pré-condição**: Página `/register` carregada.

1. Tab para campo Nome → Preenche e sai sem inserir valor
2. **Expected**: screen reader anuncia o erro de validação (polite — não interrompe)
3. Submete formulário vazio
4. **Expected**: foco move para primeiro campo inválido; erros anunciados
5. Preenche todos os campos corretamente e submete
6. **Expected**: screen reader anuncia "Conta criada! Verifique seu e-mail..." (`role="status"` — polite)

---

## Cenário 3 — Navigation: Onboarding via convite

**Pré-condição**: URL `/convite/[token]` acessada.

1. Página welcome carrega → foco movido para `h1` "Bem-vindo ao metanoia-hub" (FocusManager)
2. Tab para botão "Aceitar e começar" → Ativa navegação para `/convite/[token]/termos`
3. **Expected**: foco move automaticamente para `h1` da página de termos (FocusManager detecta pathname change)
4. Navega pelos termos → Tab para "Aceitar e continuar"
5. Página criar conta carrega → foco move para `h1`
6. Tab pelo formulário de criação de conta → toggle de senha anuncia `aria-pressed` corretamente
7. **Expected**: sem foco preso na tela anterior; sem anúncio de "loading"

---

## Cenário 4 — Recovery: Recuperação de senha

**Pré-condição**: Página `/recuperar-senha` carregada.

1. Landmarks presentes: header + main + footer
2. Tab para campo E-mail → Preenche e submete
3. Estado "sent" → **Expected**: `role="status"` anuncia "E-mail enviado!" (polite, sem interrupção)
4. Erro de rede → **Expected**: `role="alert"` anuncia erro (assertive, imediato)

---

## Testes Automatizados (axe-core)

Os cenários 1-4 têm cobertura axe via CI (Epic 12). Zero novas violações é o gate.

Para rodar localmente:
```bash
# E2E axe (requer Docker)
pnpm --filter @metanoia/web e2e -- --grep "a11y"
```

## Gate Humano (AC-9)

Ver `docs/specs/a11y-screen-reader-auth/manual-test-checklist.md`.
