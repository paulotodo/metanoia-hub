---
design_intent: S
design_status: not-started
---

# 05: Admin faz onboarding mínimo numa tarde de sábado

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Screen Flow (desktop, wizard linear com skip-everything)
**Priority:** ⭐ Priority 2 — Supporting (onboarding crítico para ativação)
**Release gate:**
- **Variante Release 1a-beta (MVP minimalista):** tela de boas-vindas + dados de demonstração + acesso direto à home do admin (Epic 7 Stories 7.1 + 7.2). Sem wizard guiado.
- **Variante Release 1b (experiência completa):** wizard guiado de 5 passos (Epic 10 Story 10.1) + importador de planilha perdoando erros (Epic 10 Story 10.2).
- Ver seção Release Gate Audit para mapeamento completo e débitos.

---

## Nota terminológica

Assim como no cenário 03: **"Pastor"** é vocabulário narrativo; **"Admin Tenant"** é o role RBAC (dos 6 roles: Super Admin, Admin Tenant, Editor de Conteúdo, Líder, Participante, Auditor). A pessoa que executa este onboarding é, na prática, o Pastor Titular da igreja (ou alguém que ele delegou — um pastor auxiliar, um administrador eclesiástico), operando tecnicamente como `Admin Tenant`. A UI chama "Administração da Igreja" — nunca "Pastor" como rótulo de interface.

---

## Transaction (Q1)

**What this scenario covers:**
Sair do momento *"comprei um software e recebi um link no email"* até o momento *"minha igreja está funcionando no Hub e eu já vi o radar ao vivo com dados de demonstração"* **em ≤10 minutos (primeiro valor percebido, alinhado com NFR-X1)**, numa tarde de sábado, sem precisar pedir ajuda para alguém que "entende de computador". A transação cobre: aceitar o convite, aceitar termos/LGPD, criar a conta admin, criar o primeiro grupo com pelo menos 1 participante, e ver o radar pastoral funcionando com dados de demonstração — tudo dentro da janela NFR-X1.

**Duas métricas de completude:**
- **≤10 min — Primeiro valor percebido** (NFR-X1): conta criada + tenant ativo + 1 grupo + 1 participante + radar com dados de demonstração visível. Este é o momento *"wow, comprei a coisa certa"*.
- **≤25 min — Setup estendido opcional** (não obrigatório): convidar o primeiro líder, definir cadência de encontros (se for design-driven requirement promovido), importar membros via planilha (Release 1b). Pode ser feito nessa tarde ou ficar para amanhã, sem perda de valor.

A segunda métrica nunca é apresentada como obrigação — é o caminho completo para quem quer terminar tudo num sábado à tarde. O NFR-X1 é a promessa pública; o setup estendido é o convite.

---

## Business Goal (Q2)

**Goal:** `Onboarding mínimo é uma ponte que atravessa, não um labirinto que prende` (Trigger Map · Business Goal B3 — ativação de tenant)

**Objective (primary, NFR-X1 compliant):** `% novos tenants que criam o primeiro grupo com ≥1 participante em ≤10 min desde o primeiro login` — métrica de ativação primária, alinhada com NFR-X1 do PRD. Meta MVP Release 1a-beta: ≥80% dos tenants novos.

**Objective (secondary, enriquecido):** `% novos tenants que completam setup estendido (grupo + líder convidado + cadência definida) em ≤25 min desde o aceite do convite` — métrica de engajamento profundo, aplicável à variante Release 1b com wizard guiado completo. Meta Release 1b: ≥60%.

A transação materializa o princípio *"O valor do produto aparece na primeira semana, não na primeira hora de setup"*. O onboarding não é o produto — é a porta. Se a porta for pesada, o pastor nunca chega ao que comprou. O NFR-X1 existe para garantir que a porta é leve.

---

## User & Situation (Q3)

**Persona:** Admin Tenant (mapeamento narrativo: Pastor Titular, ou alguém da equipe pastoral delegado por ele). **Não é um profissional de TI.** É alguém que usa WhatsApp, Gmail, talvez Google Forms, e essa é a escala de fluência digital assumida. Não fala "CSV", não sabe o que é "tenant", não tem certeza do que significa "ativar integração". Mas sabe exatamente o que quer: **que a igreja dele funcione no produto antes do próximo grupo pequeno (quinta que vem)**.

**Situation:**
Sábado, 14h40. O pastor acabou de almoçar com a família, a casa está calma, a esposa saiu com as crianças pra visitar a avó. Ele tem umas 2 horas livres antes de estudar o sermão de domingo. Na sexta à noite, concluiu a compra do metanoia-hub no site — escolheu o plano, pagou com cartão, recebeu o email "Bem-vindo ao Hub! Clique aqui para começar". Abre o email no notebook (mesmo notebook do cenário 03) e clica. Ele quer: (1) deixar pelo menos a infraestrutura mínima pronta hoje, (2) enviar os convites pros líderes ainda no sábado à noite, (3) no domingo após o culto, chamar os 4 líderes de grupo pequeno rapidamente pro corredor e avisar que vai ter um novo jeito de fazer as reuniões, (4) começar a usar de verdade na quarta/quinta seguinte. A janela que ele tem para o setup é *agora* — e se o app torrar esse tempo, é um risco real de frustração e devolução.

---

## Driving Forces (Q4)

**Hope:** Em ≤10 minutos ver o radar pastoral funcionando na tela com dados de demonstração e ter a sensação de *"comprei a coisa certa, é mais simples do que eu temia"*. Em ≤25 min, se quiser seguir adiante naquela tarde mesmo, ter o primeiro líder convidado — mas sem sentir que isso era obrigação.

**Worry:** Travar numa tela técnica que pede algo que ele não sabe (tipo *"importar arquivo com coluna `member_uuid`"*). Perder o fio e ter que começar de novo. Descobrir que o setup é muito mais longo que o prometido e começar a duvidar da compra. Ter que chamar um sobrinho "que mexe com computador" e sentir vergonha. Ou pior: desistir no meio e deixar aberto "pra fazer amanhã" — e "amanhã" não chegar nunca.

---

## Device & Starting Point (Q5 + Q6)

**Device:** Desktop / notebook. Este fluxo é **desktop-first**: formulários, upload de arquivo, janela de foco de 30–45 min, todos mais confortáveis no desktop. Mobile funciona (PWA responsiva), mas o wizard é otimizado para uma sessão sentada com notebook.

**Entry:** Clique no link do email de ativação recebido após a compra. Link é um **token de uso único** de tenant-invite (válido por 7 dias, RLS zero até o aceite). A primeira tela do wizard começa em **#12 Aceite do convite** — não há login obrigatório antes disso; o token autentica o aceite.

**Nota de release gate:** O email de boas-vindas/ativação em si é Epic 14 (Notificações, Release 2) *ou* pode entrar como transactional email simples no Release 1a-beta. Este é um ponto a confirmar no grooming — **se Epic 14 é Release 2, o email transacional de convite precisa ser entregue por outro mecanismo no MVP** (ex: serviço de email Postmark/Resend direto, fora do framework de notificações). Débito documentado na audit abaixo.

---

## Best Outcome (Q7)

**User Success — momento ≤10 min (primário, NFR-X1):**
Às 14h49 (9 minutos depois do clique no email), o pastor está olhando para o radar pastoral na tela com dados de demonstração carregados. Ele tem:
- Conta admin criada, termos aceitos, tenant *"Igreja Batista Esperança"* configurado.
- 1 grupo criado (*"Grupo da Quinta — casa do Pedro"*) com o próprio nome dele como participante de teste.
- Radar pastoral visível na home `/app/admin/` com a narrativa pastoral dos dados de demonstração — o primeiro sinal de que *"isso funciona"*.

A sensação: *"em 9 minutos comecei a entender o produto — vou mostrar pros líderes amanhã."* **Este é o momento NFR-X1.** A partir daqui, ele pode fechar o notebook sem culpa *ou* seguir para o setup estendido.

**User Success — momento ≤25 min (secundário, opcional, Release 1b):**
Às 15h05 (25 minutos depois do clique), se o pastor escolheu seguir com o wizard completo, ele tem adicionalmente:
- 1 líder convidado por email (*"Marcos Silva"*, que ele vai avisar pelo WhatsApp mais tarde).
- Cadência de encontros definida (semanal, quintas 20h — se esse campo entrar como design-driven requirement).
- Checklist visual de prontidão.
- Tela de *"Está pronto. Bem-vindo ao Hub."* confirmando.

A sensação estendida: *"terminei o setup completo em meia hora, com tempo de sobra para o sermão."*

**Business Success:**
- Primário: +1 evento `tenant.activation.primary` (conta + tenant + 1 grupo + radar visível, ≤10 min). Meta MVP Release 1a-beta: ≥80% dos tenants novos.
- Secundário: +1 evento `tenant.activation.extended` (+ líder convidado + cadência definida, ≤25 min). Meta Release 1b: ≥60%.
- Churn early: <10% dos tenants abandona o fluxo antes de atingir o primário; <5% abandona sem retomar em 48h.

---

## Shortest Path (Q8)

Duas variantes convivem no mesmo outline, porque estão em releases diferentes:

### Variante 1a-beta — Caminho minimalista (Epic 7 Stories 7.1 + 7.2, ≤10 min, NFR-X1 compliant)

Caminho linear mínimo usando **apenas o que Epic 7 entrega hoje**: tela de boas-vindas + dados de demonstração + CTA direto para a home do admin. Sem wizard guiado. O pastor cria o primeiro grupo manualmente pela home `/app/admin/grupos` logo após a tela de boas-vindas.

1. **Aceite do convite (#12)** — Primeira tela após o clique no email. *"Bem-vindo! Você foi convidado para criar a conta da sua igreja no metanoia-hub."* Botões: *"Aceitar e começar"* · *"Ver os termos primeiro"*.
2. **Termos / LGPD (#13)** — Texto dos termos em copy pastoral (não juridiquês), checkbox de aceite, *"Continuar"*.
3. **Criar conta admin (#15)** — Nome, email, senha (ou Google OAuth — Stories 2.1/2.2) + nome da igreja. *"Criar conta"* → Keycloak role `Admin Tenant` → tenant criado com RLS ativo.
4. **Tela de boas-vindas + dados de demonstração (Story 7.1 + 7.2)** — Tela única após o login: *"Bem-vindo ao Hub, [Nome]. Sua igreja está pronta."* Exibe o radar pastoral carregado com **dados de demonstração** (Story 7.2) — o pastor *vê* o produto funcionando antes de configurar nada. Bloco abaixo: *"Próxima ação: crie seu primeiro grupo"* com botão direto *"Criar grupo"*.
5. **Criar primeiro grupo (#30 ou rota direta `/app/admin/grupos/novo`)** — Formulário de 3 campos (nome, descrição opcional, horário opcional) + campo *"Adicionar você mesmo como participante de teste"* já marcado. *"Criar grupo"* → grupo criado, evento `tenant.activation.primary` disparado. **Neste ponto, NFR-X1 está satisfeito (≤10 min).** O pastor é levado para `/app/admin/` com o novo grupo visível + radar vivo com os dados de demonstração mesclados ao grupo real.

O pastor pode parar aqui, fechar o notebook, e voltar depois. A variante 1a-beta termina neste estado.

### Variante 1b — Wizard guiado completo (Epic 10 Story 10.1 + Story 10.2, ≤25 min)

Quando Epic 10 é entregue (Release 1b), o caminho minimalista acima é complementado por um wizard guiado de **5 passos** (alinhado com Story 10.1) que o pastor pode escolher percorrer logo após criar a conta, ou agendar para depois. Os passos são:

1. **Passo 1 de 5 — Seu perfil pastoral** (parte de #28) — Confirma nome do admin, cidade (opt), anos de pastoreio (opt), tradição/denominação (opt). *"Próximo"*.
2. **Passo 2 de 5 — Sua comunidade** (parte de #28) — Nome da igreja já preenchido + tamanho aproximado (faixas) + tipo (opt). *"Próximo"*.
3. **Passo 3 de 5 — Seu primeiro grupo** (#30) — Mesmo formulário da variante 1a-beta passo 5, agora integrado ao wizard. *"Próximo"*.
4. **Passo 4 de 5 — Convide um líder** (#31) — *"Quem lidera este grupo?"* com campo email + botão *"Convidar por email"*. Dispara email transacional com token único. Pular com honestidade: *"Você pode mostrar o app aos líderes pessoalmente primeiro e enviar os convites quando eles estiverem prontos."*
5. **Passo 5 de 5 — Conheça o Radar** (#33/#34 merged + tour) — Tour curto do radar pastoral com os dados do grupo recém-criado misturados aos dados de demonstração. Checklist visual final: ✅ Conta, ✅ Igreja, ✅ Grupo, ✅ Líder, ⚪ Membros (opcional, ver abaixo). Tela final *"Está pronto. Bem-vindo ao Hub."* + CTA *"Entrar no painel de administração"* → `/app/admin/`.

**Story 10.2 — Importação de planilha perdoando erros (Release 1b, opcional, #29):** Oferecida como trilho paralelo acessível tanto de dentro do wizard (entre passo 3 e 4) quanto da home do admin depois. Aceita CSV e XLSX, perdoa erros comuns (espaços extras, BOM, colunas em ordem diferente, cabeçalhos em PT-BR ou EN), mostra preview antes de confirmar. **Nunca obrigatória**; o caminho do wizard completa sem ela.

**Nota: a cadência de encontros / ciclos de reunião (#32)** não aparece em nenhum dos 5 passos da Story 10.1. É um **design-driven requirement** — ver nota de mapeamento na Release Gate Audit.

---

## Trigger Map Connections

**Persona:** Admin Tenant (narrativo: Pastor Titular não-técnico · Desktop-first wizard)

**Driving Forces Addressed:**
- ✅ **Want:** *"Sair do wizard antes de perder a paciência"* — ≤45 min, skip-everything, progresso salvo
- ✅ **Want:** *"Não ter vergonha da própria fluência digital"* — linguagem humana, zero jargão técnico user-facing, perdão para erros comuns de planilha
- ❌ **Fear:** *"Travar numa tela técnica sem explicação"* — cada campo tem rótulo em linguagem humana, cada erro explica *o que fazer*, não só *o que deu errado*
- ❌ **Fear:** *"Ter gastado dinheiro numa coisa complicada demais"* — a tela #34 existe especificamente para fechar esse medo com uma sensação tangível de "está pronto"

**Business Goal:** Ativação de tenant como ponte curta (Trigger Map §01-business-goals.md — funil de ativação)

**Design Implications aplicadas (§05-key-insights.md):**
- **A — Radar humilde (aplicado ao wizard):** o app sugere o caminho mais curto possível, nunca exige o caminho completo
- **D — Densidade invertida (desktop):** mais contexto textual por tela comparado ao líder mobile, porque o pastor *quer* ver o que vai fazer a seguir
- **F — Improviso Sagrado (aplicado ao onboarding):** o app não presume o formato da igreja, não insiste em "boas práticas", não oferece templates de discipulado — só infra
- **Linguagem humana-primeiro:** zero "tenant", zero "CSV", zero "provisionar". Substitutos: "configuração da igreja", "lista de membros", "criar o espaço da sua igreja"

**Anti-patterns bloqueados:**
- ❌ Nenhum campo obrigatório além do legal mínimo (termos LGPD) e do mínimo funcional (nome da igreja, conta admin)
- ❌ Nenhum popup de upsell durante o onboarding ("você sabia que o plano Gold tem...")
- ❌ Nenhum vídeo tutorial obrigatório (disponível como link opcional, nunca como bloqueio)
- ❌ Nenhum checklist gamificado com *"você completou 83%!"* ou badges
- ❌ Nenhum coletor de email marketing embutido no wizard
- ❌ Nenhum *"pular"* disfarçado que, no final, cobra o pulo ("ah, você pulou os membros, agora precisa voltar")
- ❌ Nenhum formulário que apaga dados ao voltar
- ❌ Nenhum jargão user-facing: "tenant", "SSO", "webhook", "RLS", "bounded context"

---

## Scenario Steps

### Variante 1a-beta — 5 steps

| Step | Page | Purpose | Exit Action |
|------|------|---------|-------------|
| 05.1 | `05.1-aceite-convite/` (#12) | Aceitar o convite via token de uso único | *"Aceitar e começar"* → carrega termos |
| 05.2 | `05.2-termos-lgpd/` (#13) | Ler e aceitar termos LGPD | *"Continuar"* → carrega criação de conta |
| 05.3 | `05.3-criar-conta-admin/` (#15) | Criar conta admin + nome da igreja | *"Criar conta"* → sessão ativa, tenant criado com RLS |
| 05.4 | `05.4-boas-vindas-demo/` (Story 7.1 + 7.2) | Ver tela de boas-vindas + radar com dados de demonstração | *"Criar grupo"* → formulário de grupo |
| 05.5 | `05.5-criar-primeiro-grupo/` (#30) | Criar primeiro grupo com o próprio admin como participante de teste | *"Criar grupo"* → home `/app/admin/` com radar vivo ✓ |

**Meta de tempo:** ≤10 min (NFR-X1). `tenant.activation.primary` disparado ao final do step 05.5.

### Variante 1b — 10 steps (wizard completo Epic 10)

| Step | Page | Purpose | Exit Action |
|------|------|---------|-------------|
| 05.1 | `05.1-aceite-convite/` (#12) | Aceitar o convite via token de uso único | *"Aceitar e começar"* |
| 05.2 | `05.2-termos-lgpd/` (#13) | Aceitar termos LGPD | *"Continuar"* |
| 05.3 | `05.3-criar-conta-admin/` (#15) | Criar conta admin + nome da igreja | *"Criar conta"* |
| 05.4 | `05.4-wizard-perfil-pastoral/` (#28 parte 1) | Passo 1/5 — Seu perfil pastoral | *"Próximo"* |
| 05.5 | `05.5-wizard-sua-comunidade/` (#28 parte 2) | Passo 2/5 — Dados da igreja, tamanho, tipo | *"Próximo"* |
| 05.6 | `05.6-wizard-primeiro-grupo/` (#30) | Passo 3/5 — Criar primeiro grupo | *"Próximo"* |
| 05.7 | `05.7-wizard-convidar-lider/` (#31) | Passo 4/5 — Convidar líder por email | *"Próximo"* ou *"Convidar depois"* |
| 05.8 | `05.8-wizard-conheca-radar/` (#33+#34 merged) | Passo 5/5 — Tour do radar + checklist + confirmação final | *"Entrar no painel"* → `/app/admin/` ✓ |
| 05.9 (opt) | `05.9-importar-planilha/` (#29, Story 10.2) | Trilho paralelo — importar membros com perdão de erros | *"Importar"* ou voltar ao wizard |
| 05.10 (DDR) | `05.10-cultos-ciclos/` (#32) | Configurar cadência de encontros | *"Próximo"* — **design-driven requirement** |

**Meta de tempo:** ≤25 min (opcional, após cumprir NFR-X1 na variante minimalista). `tenant.activation.extended` disparado ao final do step 05.8.

**First step (05.1)** inclui o contexto de entrada completo: situation (Q3) + mental state (Q4) + token de uso único (Q6). Per-page detalhes ficam para Phase 4 (UX Design / wireframes).

**On-step interactions** (que não saem do step): progresso salvo automaticamente a cada `"Próximo"` no wizard 1b, retomada exata ao voltar ao link, preview do arquivo antes de importar no 05.9 (com highlight de erros recuperáveis), confirmação de envio do convite ao líder (toast), e tela de erro humano se o token de convite expirou (*"Esse link expirou — peça outro ao time do Hub pelo suporte"* — nunca *"Token inválido"*). Todos documentados como storyboard items dentro de cada page spec na Phase 4.

---

## Release Gate Audit

Este cenário tem **duas variantes com releases distintos** explicitamente reconhecidas. Cada variante tem sua própria compliance matrix.

### Variante 1a-beta — Mapeamento de features (NFR-X1 compliant)

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Token de convite (uso único) | ✅ Release 1a | Epic 2 (Auth) | Fluxo de tenant-invite |
| Email transacional de ativação e convite de líder | ⚠️ A verificar | Ver débito #1 abaixo | Epic 14 é R2; MVP precisa de rota alternativa |
| Aceite de termos + LGPD | ✅ Release 1a | Epic 2 / Compliance | Requisito legal inegociável |
| Criação de conta Admin Tenant via Keycloak | ✅ Release 1a | Stories 1.7, 1.8, 2.1, 2.2 | Fluxo unificado mergeado |
| Criação de tenant com RLS ativo | ✅ Release 1a | Epic de Multi-tenancy | Base arquitetural |
| Tela de boas-vindas pós-login | ✅ Release 1a-beta | **Epic 7 Story 7.1** | Core do MVP minimalista |
| Radar pastoral com dados de demonstração | ✅ Release 1a-beta | **Epic 7 Story 7.2** | Core do MVP minimalista — é o momento "wow" |
| Criação de grupo via `/app/admin/grupos` | ✅ Release 1a-beta | Epic 5 (Group Lifecycle) | NFR-X1: ≤10 min |
| Adicionar admin como participante de teste | ⚠️ A verificar | Story 5.x | Alinha com NFR-X1 para radar funcionar imediatamente |

**Conformidade NFR-X1:** ✅ A variante 1a-beta cumpre ≤10 min para "primeiro grupo com participantes" usando exclusivamente features já planejadas no Epic 7 (7.1 + 7.2) + Epic 5 (criação básica de grupo).

### Variante 1b — Mapeamento de features (wizard completo)

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Wizard guiado de 5 passos | ⚠️ **Release 1b** | **Epic 10 Story 10.1** | Explicitamente Release 1b no PRD |
| Importador de planilha perdoando erros | ⚠️ **Release 1b** | **Epic 10 Story 10.2** | Explicitamente Release 1b no PRD |
| Convite de líder por email dentro do wizard | ⚠️ **Release 1b** | Epic 10 Story 10.1 passo 4/5 | Depende da rota de email (débito #1) |
| Tour "Conheça o Radar" final | ⚠️ **Release 1b** | Epic 10 Story 10.1 passo 5/5 | Parte do wizard guiado |
| Progresso salvo / retomada do wizard | ⚠️ **Design-driven requirement (Release 1b)** | Epic 10 (extensão) | Ver nota de mapeamento abaixo |
| Configuração de cadência de encontros (#32) | ⚠️ **Design-driven requirement (Release indefinido)** | Epic 5 ou 10 (extensão) | Ver nota de mapeamento abaixo |

**Confessado:** A variante 1b **não é MVP**. Ela existe neste outline porque:
- (a) é o caminho final completo do produto maduro,
- (b) pastores do piloto 1a-beta vão pedir *"onde tá o wizard?"* e a resposta precisa ser *"Release 1b, setembro"* em vez de *"qual wizard?"*,
- (c) o cenário 04 (champion marketing) e o cenário 03 (vista agregada) referenciam esse wizard como parte da promessa comercial — se não documentarmos, vira surpresa para o time depois.

### Vetos permanentes (ambas variantes)

| Elemento | Status |
|---|---|
| Upsell / marketing collection durante onboarding | ❌ Veto permanente — viola dignidade do usuário não-técnico |
| Vídeo tutorial obrigatório (bloqueia avanço) | ❌ Veto permanente — substituído por copy clara |
| Checklist gamificado com %/badges | ❌ Veto permanente — infantiliza o usuário |
| Jargão técnico user-facing (tenant, SSO, RLS, webhook, CSV sem explicação) | ❌ Veto permanente |

### Débito de release gate #1: Email transacional MVP (aplicável a ambas variantes)

**Problema:** Ambas variantes dependem de email transacional (ativação do pastor + convite do líder). Epic 14 (Notificações) é Release 2. O MVP 1a-beta precisa de rota alternativa para os 2 emails.

**Proposta:** Serviço transactional direto (Postmark, Resend, SendGrid ou Amazon SES — decisão de infra no grooming) integrado como sub-story do Epic 2 (Auth) ou Epic 7 (Onboarding). **Independente do framework completo de notificações do Epic 14.** Apenas 2 tipos de email: (1) boas-vindas/ativação, (2) convite de líder. Zero filtragem, zero preferências do usuário, zero templates ricos — texto simples + link de uso único.

**Ação requerida no grooming:** Decidir alocação (sub-story Epic 2 ou story curta no Epic 7).

### Débito de release gate #2: Cadência de encontros (#32)

**Problema:** A configuração de cadência de encontros (*"semanal, quinzenal, mensal, ritmo próprio"*) não aparece em nenhum FR nem nos 5 passos da Story 10.1. É um **design-driven requirement**.

**Proposta:** Story nova no Epic 5 (Group Lifecycle) ou Epic 10 (Wizard), modelo:

```
{
  id: uuidv7(),
  tenant_id: string,     // RLS base
  group_id: string,      // ou null para cadência default do tenant
  cadence_type: enum('weekly','biweekly','monthly','custom'),
  day_of_week: integer,  // opt, para padrão
  time_of_day: time,     // opt, para padrão
  cycle_label: string,   // opt, ex "Discipulado 2026 Q1"
  created_at: timestamp
}
```

**Ação requerida no grooming:** Decidir se a cadência entra como Release 1a-beta (junto com Epic 5 Group Lifecycle) ou Release 1b (junto com Epic 10 Wizard). **Recomendação do design:** Release 1a-beta, para que os líderes do piloto tenham contexto de cadência nas reuniões do cenário 02 — caso contrário, o cenário 02 precisa ser ajustado.

### Débito de release gate #3: Progresso salvo / retomada (apenas variante 1b)

**Problema:** O wizard de 5 passos da Story 10.1 precisa permitir que o pastor feche o notebook no meio e retome depois. Não há FR explícito para isso.

**Proposta:** Story nova no Epic 10:
- `onboarding.wizard.progress.save` — persiste o estado do wizard entre sessões, scoped por `user_id` + `tenant_id`. RLS: só o próprio user.

**Ação requerida no grooming:** Formalizar no escopo do Epic 10 antes da sprint Release 1b.

### Resumo dos débitos

Este cenário gera **3 débitos explícitos** para o grooming:

1. **Rota de email transacional MVP** — sub-story Epic 2/7, não bloqueada pelo Epic 14 Release 2. **Afeta ambas variantes.**
2. **Cadência de encontros (#32)** — design-driven requirement, recomendação Release 1a-beta para coerência com cenário 02.
3. **Progresso salvo do wizard** — design-driven requirement, Release 1b junto com Epic 10.

Todos documentados. Nenhum débito escondido. **Conformidade NFR-X1 preservada na variante 1a-beta.**

---

## Tone audit (glossário banido)

Verificação interna antes de salvar — nenhuma ocorrência user-facing de: *tenant (na UI), SSO, webhook, RLS, bounded context, provision, onboarding (na UI), churn, upsell, CSV (na UI sem explicação — o termo aparece como "arquivo de planilha"), wizard (na UI — termo interno), activation, KPI, conversão, funil, lead, pipeline, dashboard*. ✅

**Substituições deliberadas:**
- "tenant" → "a configuração da sua igreja" / "o espaço da sua igreja"
- "onboarding" (UI) → "primeiros passos" / "configuração inicial"
- "CSV" (UI) → "arquivo de planilha" / "lista de membros"
- "ativar conta" → "criar conta"
- "wizard" (UI) → nada (apenas numeração visual *"Passo 1 de 5"* na variante 1b, alinhado com Story 10.1)
- "checklist de ativação" → "resumo do que está pronto"

Vocabulário substitutivo adotado: *configuração, igreja, espaço, grupo, líder, convite, passo, pronto, começar, próximo.*

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Este cenário é a **ponte** que leva o pastor comprador para o cenário 03 (vista agregada) e subsequentemente para o cenário 01 (líder na quarta de manhã) — o sunshine path comercial do produto começa aqui · **Duas variantes explícitas:** 1a-beta minimalista (NFR-X1 compliant, Epic 7 Stories 7.1 + 7.2) e 1b wizard guiado (Epic 10 Stories 10.1 + 10.2) · 3 débitos de release gate documentados explicitamente para grooming._
