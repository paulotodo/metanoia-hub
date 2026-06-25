# Roteiro Manual de Teste — Screen Reader: Autenticação

> **AVISO: Gate humano pendente**
>
> Este roteiro descreve verificações que DEVEM ser executadas manualmente
> com screen readers reais. NÃO marque a story 15.1 como DONE sem que
> pelo menos os cenários críticos tenham sido executados e registrados
> na seção "Resultados" abaixo.

---

## Pré-requisitos

- macOS com VoiceOver ativado (CMD+F5)
- Windows com NVDA instalado (https://www.nvaccess.org/download/)
- Windows com JAWS instalado (https://www.freedomscientific.com/products/software/jaws/)
- Browser recomendado: Safari (VoiceOver), Chrome (NVDA/JAWS)
- Ambiente local rodando em `http://localhost:3000`

---

## Atalhos de referência rápida

| Ação | VoiceOver (macOS/Safari) | NVDA (Win/Chrome) | JAWS (Win/Chrome) |
|------|--------------------------|-------------------|-------------------|
| Navegar landmarks | VO+U (rotor) → Landmarks | R / Shift+R | ; / Shift+; |
| Próximo heading | VO+CMD+H | H | H |
| Próximo campo | Tab | Tab | Tab |
| Ler formulário atual | VO+A | Insert+A | Insert+A |
| Sair de modo formulário | Esc | Insert+Space | Esc |
| Ir para região | VO+U | R | ; |

---

## 1. Verificação de Landmarks

### Objetivo
Confirmar que `<header>`, `<main>` e `<footer>` são anunciados como
landmarks (banner / main / contentinfo) nos layouts público e onboarding.

### Páginas: `/login`, `/register`, `/recuperar-senha`, `/convite/{token}`

**VoiceOver:**
1. Abrir página, pressionar CMD+F5 para ativar VoiceOver
2. Pressionar VO+U para abrir o Rotor → navegar até "Landmarks"
3. Verificar: deve listar "banner", "main content", "contentinfo"
4. Navegar por cada landmark com seta → confirmar que o foco muda para o elemento correto

**NVDA:**
1. Pressionar R para saltar para a próxima region
2. Verificar: leitor anuncia "banner landmark" → "main landmark" → "contentinfo landmark"

**JAWS:**
1. Pressionar ; para navegar entre regiões
2. Verificar: JAWS anuncia "banner region" / "main region" / "contentinfo region"

| Cenário | VoiceOver | NVDA | JAWS |
|---------|-----------|------|------|
| `/login` — banner | | | |
| `/login` — main | | | |
| `/login` — contentinfo | | | |
| `/register` — landmarks | | | |
| `/recuperar-senha` — landmarks | | | |
| `/convite/{token}` — landmarks | | | |

---

## 2. Formulário de Login

### Objetivo
Verificar que o formulário é identificado corretamente (`aria-labelledby`)
e que o toggle de senha usa `aria-pressed`.

**Passos:**
1. Navegar para `/login`
2. Pressionar Tab até alcançar o formulário
3. Verificar: leitor anuncia "Entrar — formulário" (identificado pelo heading "Entrar")
4. Pressionar Tab → campo E-mail
5. Verificar: leitor anuncia "E-mail, campo de edição obrigatório"
6. Pressionar Tab → campo Senha
7. Verificar: leitor anuncia "Senha, campo de edição obrigatório"
8. Pressionar Tab → botão de toggle de senha
9. Verificar: leitor anuncia "Mostrar senha, botão, não pressionado"
10. Pressionar Space (ou Enter) para ativar o toggle
11. Verificar: leitor anuncia "Ocultar senha, botão, pressionado"
12. Submeter formulário com credenciais inválidas (e.g., `a@b.com` / `senha`)
13. Verificar: leitor anuncia o erro de validação imediatamente

| Cenário | VoiceOver | NVDA | JAWS |
|---------|-----------|------|------|
| Formulário identificado pelo heading | | | |
| Toggle "Mostrar senha" anunciado com estado | | | |
| Toggle muda para "Ocultar senha" após ativação | | | |
| Erro de campo anunciado ao submeter | | | |
| Erro de servidor (401) anunciado | | | |

---

## 3. Formulário de Cadastro

### Objetivo
Verificar que o formulário tem `aria-label="Formulário de cadastro"` e
que erros inline são anunciados via `aria-live="polite"`.

**Passos:**
1. Navegar para `/register`
2. Pressionar Tab até o formulário
3. Verificar: leitor anuncia "Formulário de cadastro, formulário"
4. Preencher nome, e-mail inválido, senhas diferentes
5. Submeter o formulário
6. Verificar: leitor anuncia os erros politely (sem interromper a leitura atual)
7. Verificar: erros dos campos nome, e-mail, senha são anunciados separadamente
8. Corrigir o e-mail → verificar que o erro de e-mail desaparece (região aria-live limpa)

| Cenário | VoiceOver | NVDA | JAWS |
|---------|-----------|------|------|
| Formulário identificado como "Formulário de cadastro" | | | |
| Erro de e-mail inválido anunciado via aria-live | | | |
| Erro de senha anunciado via aria-live | | | |
| Erro de nome anunciado via aria-live | | | |
| Limpeza de erro após correção anunciada | | | |
| Sucesso após cadastro ("Conta criada!") anunciado | | | |

---

## 4. Recuperação de Senha

### Objetivo
Verificar `aria-label` no formulário e `role="status"` na confirmação.

**Passos:**
1. Navegar para `/recuperar-senha`
2. Verificar: leitor anuncia "Formulário de recuperação de senha, formulário"
3. Preencher e-mail e submeter
4. Verificar: após sucesso, leitor anuncia o conteúdo da tela de confirmação
   ("E-mail enviado" ou similar) — o `role="status"` garante anúncio polite
5. Submeter com e-mail inválido → verificar anúncio de erro com `role="alert"`

| Cenário | VoiceOver | NVDA | JAWS |
|---------|-----------|------|------|
| Formulário identificado como "Formulário de recuperação de senha" | | | |
| Erro de e-mail inválido anunciado (role=alert) | | | |
| Tela de confirmação anunciada (role=status) | | | |
| Botão "Reenviar" disponível e funcional | | | |

---

## 5. Nova Senha

### Objetivo
Verificar `aria-labelledby` no formulário de redefinição.

**Passos:**
1. Acessar `/nova-senha/{token-valido}`
2. Verificar: leitor anuncia o formulário identificado pelo heading da página
3. Preencher nova senha
4. Ativar toggle de senha → verificar estado `aria-pressed`
5. Submeter com senhas que não conferem → verificar anúncio de erro
6. Testar estado "token expirado" — verificar que `<h1>` é anunciado

| Cenário | VoiceOver | NVDA | JAWS |
|---------|-----------|------|------|
| Formulário identificado pelo heading | | | |
| Toggle de senha com aria-pressed | | | |
| Erro de senha anunciado | | | |
| Estado "token expirado" — h1 anunciado | | | |

---

## 6. Onboarding (Fluxo de Convite)

### Objetivo
Verificar landmarks no layout onboarding e gerenciamento de foco
entre etapas do fluxo convite.

**Passos:**
1. Acessar `/convite/{token-valido}`
2. Verificar landmarks: banner, main, contentinfo presentes
3. Verificar: `<h1>` "Bem-vindo ao metanoia-hub" é anunciado ao carregar
4. Clicar "Aceitar e começar" → navegar para `/convite/{token}/termos`
5. Verificar: foco move para o `<h1>` "Termos de uso e privacidade" automaticamente
6. Confirmar termos e clicar "Continuar" → navegar para criar-conta
7. Verificar: foco move para o `<h1>` da página criar-conta automaticamente

| Cenário | VoiceOver | NVDA | JAWS |
|---------|-----------|------|------|
| Landmarks no layout onboarding | | | |
| Foco no h1 ao carregar `/convite/{token}` | | | |
| Foco move para h1 de termos ao navegar | | | |
| Foco move para h1 de criar-conta ao navegar | | | |
| Checkbox de termos anunciado corretamente | | | |

---

## Resultados

Preencher após execução manual. Legenda: ✅ Passou | ❌ Falhou | ⚠️ Parcial | — Não testado

| Fluxo | VoiceOver | NVDA | JAWS | Notas |
|-------|-----------|------|------|-------|
| Landmarks (todas as páginas) | — | — | — | |
| Login — identificação do form | — | — | — | |
| Login — toggle senha aria-pressed | — | — | — | |
| Login — erros de validação | — | — | — | |
| Register — aria-label do form | — | — | — | |
| Register — erros via aria-live | — | — | — | |
| Recovery — aria-label do form | — | — | — | |
| Recovery — role=status no sucesso | — | — | — | |
| Nova senha — aria-labelledby | — | — | — | |
| Onboarding — gerenciamento de foco | — | — | — | |

---

## Critérios de Aprovação

A story 15.1 pode ser marcada como DONE quando:

1. **Todos os fluxos críticos** (login, register, recovery) passam em ≥ 2 dos 3 screen readers
2. **Landmarks** são anunciados corretamente em todas as páginas públicas em ≥ 2 dos 3 screen readers
3. **Nenhum fluxo crítico** tem resultado ❌ em todos os 3 screen readers simultaneamente

Fluxos de criticidade [M] (onboarding, lang inline) podem ter resultado ⚠️ sem bloquear aprovação,
desde que registrados como tech debt para stories subsequentes.

---

_Gerado por: agente-00c-feature-orchestrator | Feature: a11y-screen-reader-auth | Story: 15.1_
