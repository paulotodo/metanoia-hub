---
design_intent: D
design_status: not-started
phase4_note: "DDRs obrigatórios no wireframe: FR83/Story 2.9 (password recovery), Keycloak email template pastoral PT-BR"
---

# 07: Líder recupera acesso antes da quarta de manhã

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Screen Flow (edge case · mobile-first · recovery rápido)
**Priority:** ⭐ Priority 2 — Edge case de resiliência (falha no cenário 01 step 01.1)
**Release gate:**
- **Auth email/senha (Story 2.1) — Release 1a (mergeado, PR #19).**
- **Auth Google OAuth (Story 2.2) — Release 1a (mergeado, PR #20).**
- **Password recovery (FR83, Story 2.9) — Release 1a-beta (Epic 2). Criado a partir deste outline.**

---

## ⚠️ Nota de rastreabilidade — rótulos semânticos

Seguindo o padrão 11 consolidado no outline 06, este outline usa **rótulos semânticos** para telas em vez de numeração `#N` não verificada. Consolidação no Step 06 hub (`00-ux-scenarios.md`).

**Rótulos semânticos usados neste outline:**
- **Tela de login** — rota `(public)/login`, já implementada (`apps/web/app/(public)/login/page.tsx`)
- **Tela de recuperação de senha** — FR83 Story 2.9 (Release 1a-beta) — rota `(public)/recuperar-senha`
- **Email de reset** — email transacional disparado pelo Keycloak (built-in capability, não implementado)
- **Tela de nova senha** — FR83 Story 2.9 (Release 1a-beta) — rota `(public)/nova-senha/[token]`
- **Tela principal líder** — rota `/app/gestao/` (experiência consolidada, UX-DR22–25)

---

## Nota de persona — por que este edge case é crítico

O cenário 01 (líder-vence-a-quarta-de-manha) é o **cenário-âncora** do produto inteiro — o momento de valor sustentado em que o Marcos abre o radar pastoral antes do trabalho. O step 01.1 assume que a sessão do Marcos está ativa ou que ele consegue re-autenticar rapidamente. **O outline 07 é o que acontece quando esse passo falha.**

Se o Marcos não consegue entrar no app na quarta de manhã, ele não vê o radar, não lembra quem precisa de atenção, e o ciclo de cuidado pastoral **quebra naquela semana**. A pessoa que precisava de uma mensagem não recebe. O impacto em cascata é: o radar existe mas ninguém olha → o produto vira mais um app abandonado → a tese pastoral falha.

**Mapeamento RBAC:** `Líder` é 1 dos 6 roles reais do sistema. Persona narrativa = role mapeado para a experiência `/app/gestao/*`.

---

## Transaction (Q1)

**What this scenario covers:**
Do momento *"acordo na quarta de manhã, abro o app, e ele pede login — mas eu não lembro a senha"* até *"entrei de novo e tô vendo o radar"*, em **≤ 3 minutos**. O cenário cobre os 2 caminhos de recuperação: (A) Google OAuth como escape hatch imediato se Marcos cadastrou via Google, e (B) password recovery via email se Marcos cadastrou com email/senha. O caminho A é instantâneo; o caminho B é o edge case real que precisa de UI ainda inexistente.

**O cenário NÃO cobre:** perda de acesso ao email pessoal, perda do celular, conta Google comprometida, MFA lockout (Story 2.3, só para Super Admin/Admin Tenant). Esses são edge cases de segundo nível, fora do sunshine path do MVP.

---

## Business Goal (Q2)

**Goal:** `Garantir que a perda de credenciais do líder nunca seja a razão pela qual o ciclo pastoral da semana se quebra` (resiliência do cenário-âncora 01)

**Objective:** `% de tentativas de login falhadas que resultam em re-autenticação bem-sucedida em ≤ 3 min` — métrica de resiliência de auth, derivada do cenário 01 step 01.1 (caminho alternativo).

---

## User & Situation (Q3)

**Persona:** Líder (⭐ Primary target · mobile Android gama média-baixa · rotina de quarta de manhã)

**Nome fictício:** Marcos, líder de grupo pequeno (mesmo Marcos do outline 01 e da PRD Jornada 2). Acordou às 6h15. Café na mão, celular na outra mão. **3 minutos antes de começar a se arrumar pro trabalho.** Abre o app pelo ícone na home screen do celular (PWA). Tela de login aparece — a sessão expirou (JWT venceu, ou ele limpou cache do navegador, ou o celular reiniciou, ou mudou de navegador). Marcos tenta logar.

**Cenário A (sunshine path, 80% dos casos):** Marcos cadastrou via Google OAuth. Toca em "Continuar com Google" → Google seleciona conta automaticamente → redirect → radar aparece. **~8 segundos.** Cenário resolvido sem atrito.

**Cenário B (edge case, 20% dos casos):** Marcos cadastrou com email/senha. Tenta digitar a senha. Erra. Tenta de novo. Erra. **Precisa de um caminho de recuperação.** Esse é o sunshine path real deste outline — quando Google OAuth não resolve.

---

## Driving Forces (Q4)

**Hope:** *"Entrar rápido e ver o radar antes do trabalho — como sempre."* Marcos não quer aprender nada novo, não quer criar senha nova complexa, não quer receber email com 4 parágrafos de instruções. Quer tocar em 2 botões e voltar pra rotina dele.

**Worry:** *"Não conseguir entrar, fechar o app, ir pro trabalho, e esquecer de olhar o radar essa semana — e alguém que precisava de atenção fica sem."* Ou: *"Receber um email de 'sua conta foi bloqueada' com linguagem corporativa que me faz sentir que errei algo."* Ou pior: *"Ter que ligar pra alguém da igreja pedindo ajuda técnica às 6h da manhã."*

---

## Device & Starting Point (Q5 + Q6)

**Device:** Mobile Android gama média-baixa (Moto G4/G5 floor), conexão Wi-Fi de casa (mais estável que 4G do outline 06), tela com brilho baixo (acabou de acordar), uma mão (outra segura o café).

**Entry:** App aberto pelo ícone PWA na home screen. Sessão expirada → redirect automático para **Tela de login** (`(public)/login`). O Marcos **já está na tela de login** — não precisa clicar em nada pra chegar lá. A tela de login atual (`apps/web/app/(public)/login/page.tsx`, ~130 linhas) tem email/senha + botão "Continuar com Google" mas **NÃO tem link "Esqueci minha senha"** — esse é o gap que o outline 07 expõe.

---

## Best Outcome (Q7)

**User Success — Cenário A (Google OAuth):**
Marcos toca em "Continuar com Google" → seleção automática de conta → redirect → radar às 6h16. **8 segundos.** Nem percebeu que a sessão tinha expirado.

**User Success — Cenário B (password recovery):**
Marcos toca em *"Esqueci minha senha"* → recebe email em ≤ 30s → toca no link do email → cria nova senha em 1 campo (confirmação no segundo) → redirect automático para o radar. **≤ 3 min total**. A mensagem do email é pastoral e curta: *"Marcos, aqui tá o link pra criar uma senha nova. Sem pressa."*

**Business Success:**
- Evento `auth.recovery.started` quando Marcos toca em "Esqueci minha senha"
- Evento `auth.recovery.completed` quando Marcos cria nova senha com sucesso
- Métrica: `recovery_to_radar_time ≤ 3 min` (target operacional)
- **Zero perda de ciclo pastoral por falha de auth** — Marcos vê o radar na quarta como sempre

---

## Shortest Path (Q8)

**Este outline tem 2 sunshine paths paralelos** — ambos lineares, zero branches. O cenário A (Google OAuth) é trivial; o cenário B (password recovery) é o que expõe o DDR.

### Cenário A — Google OAuth recovery (trivial, ≤ 10s)

1. **Tela de login** — Marcos vê a tela de login (sessão expirada). Toca em **"Continuar com Google"**. ~2s.
2. **OAuth Google** (fora do produto) — Seleção automática de conta → consentimento → redirect. ~6s.
3. **Tela principal líder** — Radar pastoral aparece, ciclo da quarta retomado. ✓

### Cenário B — Password recovery (DDR, ≤ 3 min)

1. **Tela de login** — Marcos tenta digitar a senha. Erra 2x. Olha pra baixo: link discreto **"Esqueci minha senha"** (⚠️ **não existe no código atual** — DDR). Toca no link. ~15s.
2. **Tela de recuperação de senha** — Campo único: *"Qual é o email da sua conta?"*. Marcos digita o email. Botão **"Enviar link de recuperação"**. Toca. Confirmação discreta: *"Se esse email existir na nossa base, você vai receber um link nos próximos segundos."* (anti-credential-enumeration per Story 2.2 pattern). ~20s.
3. **Email de reset** — Marcos abre o Gmail (ou outra app de email). Remetente: nome da plataforma com tom pastoral. Assunto: *"Marcos, aqui tá o link pra sua senha nova"*. Corpo: 1 frase curta + 1 botão grande **"Criar nova senha"**. Zero footer corporativo, zero "se você não solicitou esse email". Token com expiração curta (15 min). ~30s de espera do email.
4. **Tela de nova senha** — 2 campos: nova senha + confirmação. Validação OWASP inline (mesma da Story 2.1: mínimo 8 chars, sem regra absurda de "maiúscula + símbolo + número + emoji"). Botão **"Salvar e entrar"**. Marcos digita, toca. ~30s.
5. **Tela principal líder** — Redirect automático pós-save → sessão criada → radar pastoral aparece. Ciclo da quarta retomado. ✓

**Tempo total Cenário B:** ~2 min (best case) a ~3 min (email demorado). Dentro do target operacional.

### Fora do sunshine (trilhos alternativos para Phase 4)

- **Marcos cadastrou com email/senha mas tem Google account associada ao mesmo email:** a tela de login pode mostrar hint *"Você também pode entrar com Google"* se o backend detectar OAuth linkado. Não é DDR — é quality-of-life para Phase 4 wireframes.
- **Email de reset não chega (spam, delay):** confirmação pastoral: *"Se não chegou em 1 minuto, confere a caixa de spam. Se nada, tenta de novo."* + link *"Reenviar"*.
- **Marcos erra 3x a senha sem tocar em "Esqueci":** rate limiting da Story 2.2 (já mergeado) bloqueia por 5 min + mostra mensagem explicativa. A mensagem deve ser pastoral, não punitiva: *"Muitas tentativas. Espera 5 minutinhos ou usa 'Esqueci minha senha'."*
- **Marcos esqueceu o email que usou:** edge case de segundo nível. Fora do escopo do MVP. Caminho: falar com Admin Tenant da igreja dele.
- **Token de reset expirado (>15 min):** tela de nova senha mostra *"Esse link já venceu — pede outro na tela de login."* + redirect para login.

---

## Trigger Map Connections

**Persona:** Líder (⭐ Primary target · `/app/gestao/*` · mobile Android)

**Driving Forces Addressed** (puxadas de `design-process/B-Trigger-Map/personas/02-primary-persona-lider-de-grupo.md`):

- ✅ **Want:** *"Vencer a quarta-feira de manhã no celular, antes do trabalho"* — o recovery precisa ser tão rápido que o ciclo da quarta não se quebra
- ❌ **Fear:** *"Fadiga de ferramenta"* — se o recovery for complicado (MFA, captcha, 3 emails, link com 5 passos), o Marcos desiste e o app vira "mais uma coisa complicada"
- ❌ **Fear:** *"É mais uma coisa pra aprender"* — o recovery deve funcionar no padrão que o Marcos já conhece (Google account ou email com link)

**Business Goal:** Resiliência do cenário-âncora 01 — garantir que auth nunca seja o gargalo do ciclo pastoral semanal.

**Conexão com outline 01:** este cenário **é o caminho alternativo do step 01.1** do outline-âncora. Quando o outline 01 diz *"Em sessão expirada, login rápido por email/senha ou Google OAuth"*, o outline 07 detalha o que acontece quando o "login rápido" falha. O outline 01 assume sucesso; o outline 07 cobre o fracasso e a recuperação.

**Anti-patterns bloqueados:**
- ❌ Nenhum captcha na tela de recovery (anti-padrão de fadiga; se rate limiting do Story 2.2 funciona, captcha é redundante)
- ❌ Nenhuma pergunta de segurança ("Qual o nome do seu primeiro pet?") — anti-pastoral e anti-UX
- ❌ Nenhum MFA para Líder (Story 2.3 é só para Super Admin / Admin Tenant)
- ❌ Nenhuma mensagem punitiva (*"Sua conta foi bloqueada"*, *"Atividade suspeita detectada"*) — tom pastoral em mensagens de erro
- ❌ Nenhum termo do glossário banido nas mensagens de recovery

---

## Scenario Steps

| Step | Rótulo semântico | Rota | Purpose | Exit Action |
|------|------------------|------|---------|-------------|
| 07.A1 | `07.A1-login-google/` | `(public)/login` | Cenário A: sessão expirada → toque em "Continuar com Google" | OAuth redirect |
| 07.A2 | `07.A2-oauth-google/` | Externa (Google) | Seleção automática de conta | Redirect → radar ✓ |
| 07.B1 | `07.B1-login-falha/` | `(public)/login` | Cenário B: senha errada 2x → toque em "Esqueci minha senha" | Redirect para tela de recovery |
| 07.B2 | `07.B2-recuperar-senha/` | `(public)/recuperar-senha` (FR83 Story 2.9) | Digitar email → enviar link de reset | Abrir email |
| 07.B3 | `07.B3-email-reset/` | Externa (Gmail/email) | Receber email pastoral com link de reset | Toque no botão "Criar nova senha" |
| 07.B4 | `07.B4-nova-senha/` | `(public)/nova-senha/[token]` (FR83 Story 2.9) | Criar nova senha (2 campos) + validação OWASP inline | Salvar → redirect → radar ✓ |

**Nota de cenários paralelos:** este é o primeiro outline com 2 sunshine paths (A e B). Ambos são lineares e independentes. O cenário A (Google OAuth) tem 2 steps e é trivial. O cenário B (password recovery) tem 4 steps e expõe o DDR.

**First step (07.A1 / 07.B1)** é o mesmo step: tela de login. O branch acontece **na decisão do usuário** (Google vs. "Esqueci"), não na lógica do sistema. O sunshine path B é documentado como principal porque é o que expõe o gap.

**Rotas referenciadas:**
- `(public)/login` — já implementada (`apps/web/app/(public)/login/page.tsx`)
- `(public)/recuperar-senha` — **DDR, não existe**
- `(public)/nova-senha/[token]` — **DDR, não existe**
- `/app/gestao/` — experiência consolidada do líder (UX-DR22–25)

---

## Release Gate Audit

### Features com story/FR real no Release 1a (mergeadas)

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Login email/senha | ✅ **Release 1a (mergeado)** | Story 2.1 (PR #19) | `apps/web/app/(public)/login/page.tsx` |
| Login Google OAuth | ✅ **Release 1a (mergeado)** | Story 2.2 (PR #20) | `apps/api/src/auth/oauth.controller.ts` |
| Rate limiting em tentativas falhas | ✅ **Release 1a (mergeado)** | Story 2.2 | Anti-credential-enumeration |
| JWT + session management | ✅ **Release 1a (mergeado)** | Story 2.2 (NFR-S9) | Session persistente |
| OWASP password validation | ✅ **Release 1a (mergeado)** | Story 2.1 | Mínimo 8 chars, validação inline |

### Password recovery — FR83 + Story 2.9 (criados a partir deste outline)

**⚠️ Gap corrigido:** este outline expôs que password recovery não existia como FR, Story ou UI. O gap foi corrigido diretamente nos artefatos de planejamento:

- **`docs/prd.md`:** FR83 adicionado à seção "1. Identidade & Acesso" — *"O sistema deve permitir que o usuário recupere acesso à conta via email quando esquecer a senha, utilizando o fluxo nativo de reset do provedor de identidade (Keycloak)"* — Release 1a-beta
- **`_bmad-output/planning-artifacts/epics.md`:** FR83 adicionado à tabela FR→Epic (Epic 2) + Story 2.9 criada com acceptance criteria completos após Story 2.8
- **`docs/prd.md`:** FR83 adicionado à tabela de cobertura FR×Role (todos os 4 roles: Participante ✓, Líder ✓, Admin ✓, Super Admin ✓)

**Scope da Story 2.9 (Release 1a-beta):**
- Link "Esqueci minha senha" no login form existente (`apps/web/app/(public)/login/page.tsx`)
- Rota `(public)/recuperar-senha` com campo de email + anti-credential-enumeration
- Trigger Keycloak `FORGOT_PASSWORD` realm action
- Rota `(public)/nova-senha/[token]` com 2 campos de senha + validação OWASP inline
- Email transacional em tom pastoral (PT-BR, zero corporate footer)
- Redirect automático pós-reset → sessão criada → experiência consolidada do role
- Zero tabela nova no PostgreSQL (Keycloak gerencia 100%)
- Zero tenant_id envolvido (recovery é per-user)

**Capacidade de infraestrutura:** Keycloak já está integrado (`apps/api/src/auth/keycloak-admin.service.ts`) com realm provisioning. O `FORGOT_PASSWORD` realm action é built-in — o trabalho é expor via endpoint NestJS + UI Next.js.

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Link "Esqueci minha senha" no login | ✅ **Release 1a-beta** | Story 2.9 (FR83) | Adição ao form existente |
| Rota `(public)/recuperar-senha` | ✅ **Release 1a-beta** | Story 2.9 (FR83) | SSR, sem auth |
| Rota `(public)/nova-senha/[token]` | ✅ **Release 1a-beta** | Story 2.9 (FR83) | SSR, sem auth |
| Email transacional de reset (tom pastoral) | ✅ **Release 1a-beta** | Story 2.9 (FR83) | Template Keycloak customizado |
| Endpoints API (`forgot-password`, `reset-password`) | ✅ **Release 1a-beta** | Story 2.9 (FR83) | Via Keycloak Admin API |

### Vetos permanentes

| Elemento | Status |
|---|---|
| Captcha na tela de recovery | ❌ Veto permanente (rate limiting já cobre; captcha é anti-pastoral) |
| Perguntas de segurança | ❌ Veto permanente (anti-UX, anti-pastoral) |
| MFA para Líder | ❌ Story 2.3 é só Super Admin / Admin Tenant |
| Mensagens punitivas de erro | ❌ Veto permanente (tom pastoral obrigatório) |
| "Your account has been locked" em inglês | ❌ Veto permanente (user-facing = PT-BR, CLAUDE.md rule) |

### Resumo dos débitos

Este cenário **não gera débitos pendentes** — o gap principal (password recovery) foi corrigido diretamente nos artefatos:

1. ~~**Password recovery como DDR**~~ → **Resolvido:** FR83 adicionado ao PRD + Story 2.9 criada no Epic 2 (Release 1a-beta). Scope: 2 rotas + 2 endpoints + 1 template de email + 1 link no login form. Keycloak faz o heavy lifting.

**Ação remanescente no grooming:** confirmar tom pastoral dos emails transacionais de recovery e validar que Story 2.9 entra no sprint de Release 1a-beta.

---

## Tone audit (glossário banido)

Verificação interna — nenhuma ocorrência user-facing de termos banidos. ✅

**Substituições deliberadas para mensagens de auth recovery:**
- "Your account has been locked" → *"Muitas tentativas. Espera 5 minutinhos ou usa 'Esqueci minha senha'."*
- "Password reset link" → *"Link pra criar sua senha nova"*
- "If you did not request this email" → **removido** (zero footer corporativo defensivo)
- "Security alert" → nunca aparece
- "Invalid credentials" → *"Essa senha não bateu. Tenta de novo ou usa 'Esqueci minha senha'."*
- "Account recovery" → *"Recuperar acesso"* (PT-BR, sem jargão)

**Vocabulário substitutivo adotado:** *recuperar acesso, criar senha nova, esqueci minha senha, link de recuperação, sem pressa, tenta de novo.*

---

## Conexão com outros outlines

- **Outline 01 step 01.1 (login líder):** o outline 07 **é o caminho alternativo** do step 01.1 quando a re-autenticação rápida falha. Se o outline 07 não estiver implementado (DDR não resolvido), o step 01.1 tem um dead-end silencioso para líderes que cadastraram com email/senha e esqueceram.
- **Outline 06 (participante-recebe-cuidado-com-dignidade):** se a Juliana (participante) cadastrou com Google OAuth no outline 06, ela herda automaticamente o cenário A do outline 07 para recovery futuro. Se cadastrou com email/senha, ela herda o cenário B — com o mesmo DDR de password recovery.
- **Outline 05 (admin-faz-onboarding-minimo):** o Admin Tenant (Cláudia) que faz o onboarding no outline 05 também herda o DDR. Mas como Admin Tenant tem MFA (Story 2.3), o recovery dela pode ser mais complexo — edge case de terceiro nível, fora do escopo do 07.

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Este cenário é o **edge case do cenário-âncora** 01 — a prova de que o produto resiste à falha mais mundana (esqueceu a senha) sem quebrar o ciclo pastoral da semana · Gap corrigido: FR83 + Story 2.9 criados diretamente nos artefatos (PRD + epics.md) a partir deste outline · Tom pastoral obrigatório em todas as mensagens de erro de auth — zero linguagem corporativa de "security alert" · Padrão emergido: **outline 07 provou que os cenários de UX são ferramenta de fact-check dos artefatos de planejamento** — password recovery era table-stakes mas não existia como FR ou Story até ser exposto pelo outline._
