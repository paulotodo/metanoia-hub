# Feature Spec: Wizard de Onboarding para Admin Tenant

**Short name**: `onboarding-wizard`
**Status**: Draft
**FR de origem**: FR70 (Epic 10 — Onboarding Avançado)
**Depende de**: `dados-demonstracao` (10-2, já entregue), grupos (Epic 4), convites (4-3), Radar Pastoral (Epic 6)

> Decisões de infraestrutura: N/A principal (feature majoritariamente stateless de UI com persistência de progresso em campo JSONB já existente no tenant). Sem scheduling periódico, sem key rotation, sem refresh de token externo, sem mutex multi-pod. Upload de arquivos via política de armazenamento permanente (foto/logo) — sem TTL de link pré-assinado relevante para o fluxo.

---

## User Scenarios & Testing

### P1 — Admin Tenant novo completa o wizard no primeiro login

**Actor**: Admin Tenant com tenant recém-provisionado (sem grupos reais, sem dados de configuração preenchidos)

**Scenario**:
Dado que um Admin Tenant faz login pela primeira vez,
Quando o painel principal carrega,
Então o sistema exibe um wizard de configuração em tela cheia com 5 etapas numeradas e indicador visual de progresso,
E o wizard não pode ser fechado sem interação explícita (concluir ou pular explicitamente).

**Acceptance Scenarios**:
- Wizard exibido automaticamente no primeiro acesso sem grupos/configuração
- Indicador de progresso mostra etapa atual dentre 5
- Navegação por teclado funcional (avançar, voltar, pular quando permitido)
- Componente passa em testes de acessibilidade WCAG AA

**Edge Cases**:
- Admin recarrega a página na etapa 3 → retoma da etapa 3 (estado persistido)
- Admin fecha o navegador na etapa 2 → no próximo login retoma da etapa 2
- Admin com papel `super_admin` não vê o wizard (wizard é exclusivo de `admin_tenant`)

---

### P2 — Admin configura perfil pastoral (Etapa 1)

**Actor**: Admin Tenant no wizard, Etapa 1

**Scenario**:
Dado que o wizard está na Etapa 1 "Seu Perfil Pastoral",
Quando o admin preenche nome de exibição, título pastoral e foto opcional,
Então o perfil do usuário é atualizado e a etapa é marcada como concluída no progresso do wizard.

**Acceptance Scenarios**:
- Nome de exibição: obrigatório, salvo ao avançar
- Título pastoral (ex.: "Pastor", "Coordenador"): opcional, campo livre
- Foto de perfil: upload opcional via armazenamento de mídia com política permanente
- Vocabulário pastoral nos rótulos (ex.: "Como seus discípulos te conhecem?" em vez de "Nome de exibição")
- Erro de upload (arquivo inválido, excede tamanho): mensagem acionável em PT-BR, não bloqueia avanço

**Edge Cases**:
- Arquivo de foto com formato não suportado → mensagem clara, campo permanece opcional
- Nome de exibição já existente no sistema → permitido (não é chave única)

---

### P3 — Admin configura dados da comunidade (Etapa 2)

**Actor**: Admin Tenant no wizard, Etapa 2

**Scenario**:
Dado que o wizard está na Etapa 2 "Sua Comunidade",
Quando o admin preenche o nome da igreja e campos opcionais,
Então os dados do tenant são atualizados e a etapa é marcada como concluída.

**Acceptance Scenarios**:
- Nome da igreja: obrigatório para avançar
- Denominação, cidade/UF: opcionais
- Logo da comunidade: upload opcional via armazenamento de mídia com política permanente
- Progresso persistido ao servidor após concluir a etapa

**Edge Cases**:
- Admin deixa cidade/UF em branco → permitido, salvo com campos nulos explícitos
- Falha de upload de logo → mensagem acionável, campo opcional não bloqueia avanço

---

### P4 — Admin cria primeiro grupo ou explora com dados de demonstração (Etapa 3)

**Actor**: Admin Tenant no wizard, Etapa 3

**Scenario**:
Dado que o wizard está na Etapa 3 "Seu Primeiro Grupo de Discipulado",
O admin tem duas opções mutuamente exclusivas:
  (a) Criar um grupo real (formulário: nome + descrição), com admin automaticamente definido como líder
  (b) Explorar com dados de demonstração (pular para Etapa 5, usando demo data da Story 10-2)

**Acceptance Scenarios**:
- Opção (a): grupo criado com sucesso, admin marcado como líder automaticamente, etapa marcada como "criou-grupo"
- Opção (b): etapa marcada como "modo-demo", Etapa 4 pulada automaticamente, avanço direto para Etapa 5
- Ambas as opções contam como "Etapa 3 concluída"

**Edge Cases**:
- Admin tenta criar grupo com nome duplicado no tenant → mensagem de erro acionável, pode ajustar e tentar novamente
- Demo data indisponível (10-2 falhou no provisioning) → opção (b) não aparece; apenas (a) disponível (degradação graciosa)

---

### P5 — Admin convida um líder (Etapa 4, skippável)

**Actor**: Admin Tenant no wizard, Etapa 4 (ativa apenas se Etapa 3 foi via opção "a")

**Scenario**:
Dado que o admin concluiu a Etapa 3 criando um grupo real,
Quando o wizard está na Etapa 4 "Convide um Líder",
O admin pode inserir nome e e-mail de um líder para enviar convite, ou pular com "Fazer depois".

**Acceptance Scenarios**:
- Convite enviado com sucesso: feedback positivo, etapa marcada como "convidou"
- Skip explícito: etapa marcada como "pulou", progresso não bloqueado
- Se Etapa 3 foi em modo-demo: Etapa 4 não exibida (skip automático)
- E-mail inválido → validação inline antes de enviar

**Edge Cases**:
- E-mail de líder já pertence a um usuário deste tenant → mensagem informativa, não envia convite duplicado
- Falha no envio do convite → mensagem de erro, admin pode tentar novamente ou pular

---

### P6 — Admin conhece o Radar Pastoral (Etapa 5)

**Actor**: Admin Tenant no wizard, Etapa 5

**Scenario**:
Dado que o wizard está na Etapa 5 "Conheça o Radar Pastoral",
O admin vê uma explicação interativa do semáforo pastoral (verde/amarelo/vermelho) com prévia de dados (demo ou reais).

**Acceptance Scenarios**:
- Explicação do semáforo com as 3 cores e o que cada uma significa pastoralmente
- Explicação de que os sinais vêm de participação em encontros e trilhas
- Se modo-demo ativo: prévia usando dados de demonstração (10-2) com rótulo "Exemplo de como o radar funciona"
- Se modo-demo inativo (admin criou grupo real): prévia com dados reais do tenant (ou prompt para aguardar primeiros sinais)
- Botão "Concluir Setup" conclui o wizard

**Edge Cases**:
- Admin no modo-demo sem dados de demo disponíveis → exibe explicação sem prévia, sem erro

---

### P7 — Admin conclui o wizard

**Actor**: Admin Tenant no wizard, Etapa 5

**Scenario**:
Dado que o admin clica em "Concluir Setup" na Etapa 5,
Então o wizard é marcado como concluído no registro do tenant,
E o admin é redirecionado ao painel principal,
E o wizard não é exibido em logins subsequentes.

**Acceptance Scenarios**:
- `onboardingCompletedAt` gravado no tenant
- Wizard não reapresenta em futuros logins
- Link "Rever tutorial" disponível nas configurações para replay em modo leitura (sem editar dados)

---

### P8 — Admin pula explicitamente o wizard

**Actor**: Admin Tenant que prefere configurar manualmente

**Scenario**:
Dado que o wizard está visível,
Quando o admin aciona "Pular configuração" (disponível como ação secundária),
Então `onboardingSkippedAt` é gravado no tenant e o admin vai ao painel.

**Acceptance Scenarios**:
- Wizard não reapresenta após skip
- Admin pode acessar "Rever tutorial" nas configurações para retomar voluntariamente
- `onboardingSkippedAt` distinto de `onboardingCompletedAt` (semântica diferente para analytics)

---

## Requirements

### Functional Requirements

**FR-01 — Exibição e controle do wizard**
O sistema deve exibir o wizard em tela cheia para Admin Tenant cujo tenant não possui `onboardingProgress.completed = true` E `onboardingSkippedAt` nulo E sem grupos reais existentes. O wizard se integra ao guard de onboarding existente (user-scoped) sem substituí-lo: o guard redireciona ao wizard em vez da tela de boas-vindas genérica para `admin_tenant`.

**FR-02 — Persistência de progresso por etapa**
Ao concluir cada etapa, o sistema deve salvar o estado do wizard no tenant (`onboardingProgress` JSONB: `{ currentStep, completedSteps[], stepData: {...}, completedAt?, skippedAt? }`). Se o admin fechar o navegador e retornar, o wizard deve retomar da última etapa concluída.

**FR-03 — Etapa 1: perfil do usuário administrador**
O sistema deve permitir atualizar o nome de exibição (obrigatório), título pastoral (opcional) e foto de perfil (opcional, upload permanente). O vocabulário da interface deve usar termos pastorais. A etapa deve ser concluída mesmo sem foto.

**FR-04 — Etapa 2: configuração do tenant/comunidade**
O sistema deve permitir atualizar nome da comunidade (obrigatório), denominação, cidade/UF e logo (upload permanente, opcional). A etapa só avança quando nome da comunidade preenchido.

**FR-05 — Etapa 3: primeiro grupo ou modo-demo**
O sistema deve oferecer duas opções mutuamente exclusivas: (a) criar grupo com nome + descrição, com admin automaticamente como líder; (b) ativar modo-demo (disponível apenas se dados de demonstração existem no tenant). Escolher (b) implica skip automático da Etapa 4.

**FR-06 — Etapa 4: convite de líder (condicional, skippável)**
O sistema deve exibir a Etapa 4 apenas se a Etapa 3 foi concluída via opção "criar grupo real". A etapa aceita nome e e-mail; o convite usa o mecanismo de convite existente (Epic 4). A etapa pode ser pulada com "Fazer depois".

**FR-07 — Etapa 5: radar pastoral**
O sistema deve exibir explicação do semáforo pastoral e prévia de dados (demo ou reais). A prévia com dados de demonstração é exibida com rótulo claro indicando que são dados de exemplo.

**FR-08 — Conclusão e skip**
O sistema deve registrar `onboardingCompletedAt` (conclusão via Etapa 5) ou `onboardingSkippedAt` (saída antecipada) no tenant. Apenas um deles pode ser preenchido por vez (mutuamente exclusivos funcionalmente).

**FR-09 — Replay em modo leitura**
O sistema deve oferecer link "Rever tutorial" nas configurações do admin que exibe o wizard em modo leitura (visualização das explicações, sem salvar dados novamente).

**FR-10 — Eventos de domínio por etapa**
A cada etapa concluída, o sistema deve emitir um evento de domínio `onboarding.wizard.step_completed` com `{ tenantId, step, stepName, timestamp }` para consumo futuro por analytics (Epic 13).

**FR-11 — Acessibilidade e navegação por teclado**
O wizard deve suportar navegação completa por teclado (avançar, voltar, pular quando permitido) e passar em testes de acessibilidade WCAG AA.

**FR-12 — Endpoints necessários (novos)**
O sistema requer dois endpoints de atualização ainda não existentes:
- Atualização de perfil do usuário autenticado (nome, foto, título pastoral)
- Atualização de dados do tenant autenticado (nome, logo, denominação, cidade/UF, persistência de `onboardingProgress`)
Ambos devem respeitar multi-tenancy e autorização existentes.

**FR-13 — Degradação graciosa**
Se dados de demonstração indisponíveis: opção (b) da Etapa 3 oculta, Etapa 5 sem prévia de demo. Se upload de foto/logo falhar: erro acionável, campo opcional não bloqueia avanço.

---

### Key Entities

| Entidade | Descrição | Atributos relevantes para este feature |
|----------|-----------|----------------------------------------|
| Tenant | Organização/comunidade | `name`, `metadata` (logo, denominação, cidade/UF), `onboardingProgress` (JSONB), `onboardingSkippedAt` (novo) |
| User (Admin Tenant) | Administrador do tenant | `displayName`, `profilePhoto` (novo via perfil), `roleTitle` (novo via perfil) |
| Group | Primeiro grupo de discipulado | criado na Etapa 3; admin automaticamente como líder |
| Invite | Convite para líder | gerado na Etapa 4 via mecanismo existente |
| DemoData | Dados de demonstração do tenant | providos pela Story 10-2; consultados nas Etapas 3 e 5 |

---

## Success Criteria

1. **Conclusão em menos de 10 minutos**: 80% dos Admin Tenants novos completam todas as 5 etapas do wizard em menos de 10 minutos (medido via eventos `step_completed` e `onboarding.wizard.completed`).

2. **Taxa de conclusão ≥ 70%**: dos admins que iniciam o wizard, pelo menos 70% chegam à Etapa 5 (ou registram skip explícito em vez de abandonar).

3. **Retomada após interrupção**: 100% dos admins que recarregam ou fecham o navegador retomam o wizard da última etapa concluída (testável via testes automatizados de persistência).

4. **Zero erros de isolamento de tenant**: nenhum dado de um tenant é visível ou modificável por outro tenant durante o fluxo do wizard (verificável via testes de isolamento RLS).

5. **Acessibilidade**: todos os componentes do wizard passam em 100% dos testes jest-axe WCAG AA sem exceções suprimidas.

6. **Degradação graciosa em falha de upload**: em 100% dos casos de falha de upload de foto/logo, o wizard exibe mensagem acionável e permite avançar sem a mídia (verificável via testes de erro de upload).

---

## Clarifications

> Todas as ambiguidades críticas foram resolvidas na RECONCILIACAO-EPIC10.md (§10) antes da geração desta spec. Nenhum `[NEEDS CLARIFICATION]` remanescente.

- **`/me` vs `/current`**: endpoints novos usam `/me` (padrão do repo). Decidido em RECONCILIACAO §1.2.
- **Tracking user-scoped vs tenant-scoped**: coexistem. User-scoped (`onboardingCompletedAt` no User) permanece intacto; tenant-scoped (`onboardingProgress` no Tenant) é adicionado. Decidido em RECONCILIACAO §1.4/§10.1.
- **Guard existente**: `onboarding-redirect-guard.tsx` não é recriado. O wizard engata no redirecionamento existente para `/app/admin/boas-vindas`; a tela de boas-vindas existente passa a renderizar o wizard. Decidido em RECONCILIACAO §1.4.
- **Demo data**: Step 3 opção (b) e Step 5 preview dependem de `dados-demonstracao` (10-2, já entregue). Degradação graciosa se indisponível. Decidido em RECONCILIACAO §10.6.
