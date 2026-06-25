# Spec: Screen Reader — Dashboard Líder, Radar Pastoral & Atualizações SSE (NFR-A4)

**Short Name**: a11y-screen-reader-dashboard
**Epic**: 15 — Acessibilidade Avançada
**Story**: 15.2
**Versão**: 1.0.0
**Data**: 2026-06-25
**Status**: draft

---

## Clarifications

### Sessão 2026-06-25 (clarify — onda-001)

Resolvidas via clarify-answerer (score >=2) e orquestrador (decisões aterradas com evidência empírica). Nenhuma exigiu pausa humana — todas são detalhes de implementação de baixo risco; as decisões de produto (busca, fronteira 15.2/15.3, tabelas) já estavam resolvidas na §2 e §8.

| # | Pergunta | Decisão | Base |
|---|----------|---------|------|
| C1 | Onde colocar o `aria-label` de status do card? | `aria-label` no elemento raiz do card (`<div>` do Expanded, `<Link>` do Medium) | `grep` confirmou ausência de `aria-labelledby` interno → sem conflito (dec-009) |
| C2 | Textos exatos do status para AT? | `care-urgent`="Urgente", `care-attention`="Atenção necessária", `care-ok`="Bem" | AC-1/LAC-02/LAC-05 + Constitution Princípio III (vocabulário pastoral) (dec-008) |
| C3 | Hook `useParticipantStatusAnnouncer` local ou compartilhado? | Hook local co-located em `radar/page.tsx` (ou `_components/`) | YAGNI — só o Radar consome hoje; refatorar para `src/hooks/` se story futura precisar (dec-010) |
| C4 | Asserção anti-redirect: novo describe ou inline? | Inline no bloco `[axe:hard]` existente, após `goto`, antes de `analyze()` | Spec axe é data-driven (`for (const pageEntry of allPages)`) — describe isolado não cabe no padrão (dec-011) |
| C5 | Mecanismo de title dinâmico em Client Component? | `document.title` via `useEffect` quando `groupName` muda | Página é `"use client"` com estado client-side; `generateMetadata` é server-only e estático; sem hook `useHead` no projeto (dec-012) |

> **Nota de descoberta** (validação de código durante clarify): `SemaforoPill` já tem `role="switch"` + `aria-pressed` + `aria-live="polite"`; `GrupoPillFilter` já usa `role="radiogroup"` + `role="radio"` + `aria-checked`. Portanto LAC-04 (RF-03) reduz-se a adicionar **apenas** a contagem `aria-live` de resultado pós-filtro — a semântica dos pills já existe. Refletido no plan.

---

## 1. Objetivo

Garantir que líderes pastorais que usam tecnologia assistiva (VoiceOver, NVDA, JAWS) consigam operar o Radar Pastoral — visualizar o semáforo de cuidado de participantes, expandir cards, usar filtros e receber atualizações de tempo real via SSE — sem perda de informação semântica e com anúncios adequados de estado.

NFR de referência: **NFR-A4** (WCAG 2.1 AA, screen reader compatibility) e **UX-DR20** (`aria-live` para mudanças em tempo real).

---

## 2. Escopo

### 2.1 Incluso

| Área | Arquivos-alvo | Trabalho |
|------|--------------|---------|
| Radar page title dinâmico | `apps/web/app/(authenticated)/app/gestao/radar/page.tsx` | `<title>` dinâmico "Radar Pastoral — {groupName}" via `next/head` ou segment metadata |
| ParticipantCard — semáforo acessível | `apps/web/app/(authenticated)/app/gestao/radar/_components/participant-card.tsx` | Adicionar `aria-label` com status por extenso a `ParticipantCardExpanded` e `ParticipantCardMedium`; `aria-controls` no botão compacto |
| ParticipantCardCompact — lista semântica | `apps/web/app/(authenticated)/app/gestao/radar/_components/participant-card.tsx` | O painel expandido já usa `<ul>/<li>`; confirmado. `aria-controls` faltante no `<button>` → adicionar |
| Filtros semáforo/grupo — semântica | `apps/web/app/(authenticated)/app/gestao/radar/_components/semaforo-pill.tsx`, `grupo-pill.tsx` | Filtros existentes (role=radiogroup já no GrupoPillFilter); SemaforoPill: verificar `aria-pressed` nos estados de filtro |
| SSE — anúncio de status de participante + debounce | `apps/web/app/(authenticated)/app/gestao/radar/page.tsx` (novo hook `useParticipantStatusAnnouncer`) | Hook que escuta mudanças de `signalType` no array de participantes, debounce 3s, chama `announce()` com texto por extenso |
| SSE — reconexão com grace period 5s | `apps/web/src/hooks/use-notification-stream.ts` | Adicionar grace period de 5s após reconexão antes de anunciar batch de atualizações represadas |
| SSE — anúncio "Conexão restaurada" | `apps/web/src/hooks/use-notification-stream.ts` (ou `connection-status.tsx`) | Após 5s grace, `announce("Conexão restaurada. {n} participantes atualizados.")` |
| Ratchet upgrade | `apps/web/e2e/a11y/a11y-pages.json` | Promover `dashboard-lider` e `radar-pastoral` de `"baseline"` para `"hard"` após validar axe=0; incluir asserção anti-redirect |
| Roteiro manual | `docs/specs/a11y-screen-reader-dashboard/manual-test-checklist.md` | Checklist para teste humano com VoiceOver/NVDA/JAWS + cenários SSE |

### 2.2 Explicitamente Fora de Escopo (15.2)

- **Busca full-text de participantes** — a feature não existe; apenas semântica ARIA no filtro existente (role=radiogroup + aria-live no resultado de filtro)
- **Semáforo como ícone+texto visível** — esse é o trabalho da 15.3 (Semáforo Multimodal); 15.2 entrega apenas aria-label para screen reader (texto não-visível para AT)
- **Tabelas HTML com `<caption>/<th scope>`** — não existem tabelas reais (`<table>`) na área do Radar; AC#5 da story de referência é N/A; timeline usa `<ul>/<li>` semântico já validado
- **Dashboard do Admin** (`/app/admin/igreja/dashboard`) — fora do fluxo de líder do Radar Pastoral; summary cards já têm `role="status"` + `aria-label` contextual
- **Teste real com screen readers** — não automatizável; entregue como roteiro humano (§6 — gate humano)
- **Múltiplos idiomas / `lang` inline** — escopo de outra story
- **Breadcrumbs ARIA** — escopo de 15.4

> **Decisões de infraestrutura**: N/A — feature stateless de FE/a11y sem scheduling, sem dados novos, sem auth nova.

---

## 3. Análise do Estado Atual (pré-flight)

### 3.1 Já Coberto (NÃO reimplementar)

| Item | Localização | Evidência |
|------|-------------|-----------|
| Summary cards `role="status"` + `aria-label` contextual | `_components/status-summary-card.tsx:32` | `role="status"` + `aria-label="{label}: {count} de {total} participantes"` |
| Dashboard h1 com `data-autofocus` | `dashboard-client.tsx:55` | `<h1 className="text-display" data-autofocus>` |
| Timeline cuidado `<ul>/<li>` + `aria-labelledby` | `_components/timeline-cuidado.tsx:143` | Semântico, sem `<table>` real |
| SSE silenciar suprime `announce()` | `use-notification-stream.ts:144-146` | `if (!silenced) announce(...)` |
| ConnectionStatus `aria-live="polite"` + texto+botão | `src/components/notifications/connection-status.tsx` | Estados com texto + visual, não cor-only |
| AsyncAnnouncer em NavigationShell | `src/components/a11y/async-announcer.tsx` | `useAsyncAnnouncer().announce(msg, {politeness})` disponível |
| GrupoPillFilter `role="group"` + `aria-label` | `radar/page.tsx` | `role="group" aria-label="Filtros do semáforo pastoral"` |
| Seções com `aria-labelledby` | `radar/page.tsx` | `<section aria-labelledby={sectionId}>` por signalType |
| ParticipantCardCompact painel expandido `<ul>/<li>` | `participant-card.tsx` | `<ul>` + `<li key={p.participantId}>` no painel expanded |
| SemaforoPill filtro area | `_components/semaforo-pill.tsx` | Verificar `aria-pressed`/`role` no plan |

### 3.2 Lacunas Identificadas (trabalho da 15.2)

#### LAC-01: Page title estático — sem groupName dinâmico
**Criticidade**: Média — screen reader anuncia título da aba; sem contexto do grupo ativo torna a janela ambígua em alt-tab.
- `radar/page.tsx` não tem `<title>` dinâmico com `groupName`
- Solução: metadata dinâmica via segment ou `useHead`; quando groupId selecionado → "Radar Pastoral — {groupName}"; senão → "Radar Pastoral"

#### LAC-02: ParticipantCard — status do semáforo é cor-only
**Criticidade**: Alta — WCAG 1.4.1; cor da borda (`border-l-care-urgent`, `border-l-care-attention`) é o único indicador de status para AT.
- `ParticipantCardExpanded`: `<div className="... border-l-care-urgent ...">` sem texto de status
- `ParticipantCardMedium`: `<Link className="... border-l-care-attention ...">` sem texto de status
- Solução: `aria-label` no elemento raiz do card → "{nome} — Atenção necessária" / "{nome} — Urgente"

#### LAC-03: ParticipantCardCompact — `aria-controls` ausente no botão
**Criticidade**: Média — WCAG 4.1.2; `aria-expanded` presente mas `aria-controls` faltante; AT não sabe qual região o botão controla.
- `participant-card.tsx` linha ~117: `<button aria-expanded={expanded}>` sem `aria-controls`
- Solução: `id` no `<ul>` do painel + `aria-controls={panelId}` no `<button>`

#### LAC-04: Filtro de participantes sem `aria-live` no resultado
**Criticidade**: Média — ao filtrar por grupo/semáforo, mudança no número de participantes visíveis não é anunciada.
- `radar/page.tsx`: filtro muda `activePill`/`selectedGroupId` sem anúncio de contagem
- Solução: região `aria-live="polite"` com "{n} participantes visíveis" após mudança de filtro

#### LAC-05: SSE — anúncio de mudança de status de participante ausente
**Criticidade**: Alta — participantes que passam de `care-ok` para `care-urgent` não são anunciados ao líder com screen reader.
- `radar/page.tsx`/`use-radar.ts`: atualização de dados via TanStack Query reativa sem announce
- Solução: hook `useParticipantStatusAnnouncer` que compara snapshot anterior vs atual, debounce 3s, chama `announce()` com texto "{n} participantes atualizados" (ou "{nome} — Atenção necessária" se só 1)

#### LAC-06: SSE reconexão — sem grace period 5s + sem anúncio de batch represado
**Criticidade**: Média — ao reconectar, dados do gap-fill chegam em burst; sem debounce/grace a lista de anúncios inunda o AT.
- `use-notification-stream.ts` gap-fill (linha ~52): dados chegam imediatamente após reconexão sem grace period
- Solução: flag `isPostReconnect` ativa por 5s após `connected` retornar; suprime announces individuais nesse período; ao expirar, emite "Conexão restaurada. {n} participantes atualizados."

---

## 4. Critérios de Aceite (AC)

### AC-1: Semáforo anunciado por texto, não por cor

**Dado** que um líder com screen reader navega a lista de participantes no Radar Pastoral
**Quando** o screen reader foca em um card de participante
**Então** o card anuncia por extenso o status: "{nome} — Atenção necessária" ou "{nome} — Urgente"
**E** o status não depende exclusivamente da cor da borda para ser compreendido

### AC-2: ParticipantCardCompact com `aria-controls` funcional

**Dado** que o líder usa um screen reader e navega até o grupo de participantes "Bem"
**Quando** o screen reader lê o botão de expansão
**Então** o botão anuncia o estado atual: "Expandir" (ou nome dos participantes) + "recolhido/expandido"
**E** `aria-controls` aponta para o id do painel `<ul>`, permitindo navegação direta ao conteúdo

### AC-3: Filtro de grupo/semáforo anuncia resultado

**Dado** que o líder usa o filtro de semáforo ou grupo para refinar a lista
**Quando** o filtro é ativado
**Então** uma região `aria-live="polite"` anuncia "{n} participantes visíveis" ou "Nenhum participante nessa categoria"
**E** o filtro atual tem estado anunciado (aria-pressed="true" quando ativo)

### AC-4: Page title dinâmico com contexto do grupo

**Dado** que o líder seleciona um grupo no filtro GrupoPill
**Quando** o filtro de grupo muda
**Então** o `<title>` da página reflete "Radar Pastoral — {groupName}"
**E** sem filtro de grupo ativo, o título é "Radar Pastoral"

### AC-5: Mudanças de status de participante anunciadas com debounce

**Dado** que os dados do Radar são atualizados via SSE e o TanStack Query recarrega a lista
**Quando** um ou mais participantes mudam de signalType
**Então** as mudanças são acumuladas por 3 segundos (debounce)
**E** ao final do debounce, uma única `aria-live="polite"` anuncia:
  - Se 1 participante: "{nome} — {novo status por extenso}"
  - Se 2+: "{n} participantes atualizados"
**E** quando o toggle "silenciar notificações" está ativo, nenhum anúncio é emitido

### AC-6: Reconexão SSE com grace period e anúncio de batch

**Dado** que a conexão SSE é interrompida e depois restaurada
**Quando** a reconexão ocorre e o gap-fill recarrega dados represados
**Então** há um período de silêncio de 5 segundos após a reconexão (grace period)
**E** após os 5 segundos, uma única mensagem anuncia: "Conexão restaurada. {n} participantes atualizados."
**E** o indicador visual de "Conexão interrompida" some após reconexão bem-sucedida

### AC-7: Ratchet promovido para hard após axe=0

**Dado** que as mudanças da 15.2 eliminam as violações axe nas páginas do Radar
**Quando** o pipeline CI executa os gates de a11y
**Então** `radar-pastoral` e `dashboard-lider` estão como `"hard"` em `a11y-pages.json`
**E** o spec axe inclui asserção anti-redirect (verifica que conteúdo autenticado real carregou, não /login)

---

## 5. Requisitos Funcionais

### RF-01: Status textual para AT em todos os cards de participante
O sistema DEVE expor o status de cuidado (care-ok, care-attention, care-urgent) como texto legível por tecnologia assistiva em cada card de participante no Radar Pastoral. Esse texto NÃO precisa ser visualmente renderizado (pode ser `sr-only` ou `aria-label`).

### RF-02: Controle expansível com referência ao painel
O botão de expansão do `ParticipantCardCompact` DEVE ter `aria-controls` apontando para o `id` do painel que ele expande, de modo que AT possa navegar diretamente ao conteúdo expandido.

### RF-03: Anúncio de resultado de filtro
Ao alterar o filtro de grupo ou semáforo, o sistema DEVE anunciar via `aria-live="polite"` a quantidade de participantes visíveis após o filtro.

### RF-04: Batching de anúncios de participantes — debounce 3s
Atualizações de status de participantes recebidas via TanStack Query (alimentado por SSE) DEVEM ser acumuladas por uma janela de 3 segundos. Ao final da janela, apenas um único anúncio é emitido. Múltiplos anúncios em sequência rápida DEVEM ser suprimidos e substituídos pela versão batched.

### RF-05: Respeito ao toggle de silenciar para anúncios de participante
O toggle "silenciar notificações" (Epic 14, `useNotificationSilence`) DEVE também suprimir os anúncios de mudança de status de participante (RF-04). Quando silenciado, `aria-live` para anúncios de participante DEVE ser definido como `aria-live="off"`.

### RF-06: Grace period de 5s após reconexão SSE
Após a reconexão da stream SSE, o sistema DEVE aguardar 5 segundos antes de emitir qualquer anúncio de AT sobre participantes atualizados. Esse período evita flood de anúncios do gap-fill.

### RF-07: Anúncio único de reconexão com contagem de atualizados
Após o grace period (RF-06), o sistema DEVE emitir exatamente um anúncio: "Conexão restaurada. {n} participantes atualizados." onde {n} é o número de participantes cujo status mudou no gap-fill.

### RF-08: Title dinâmico com nome do grupo
A página do Radar DEVE atualizar o `<title>` da aba ao selecionar um grupo via GrupoPill, usando o padrão "Radar Pastoral — {groupName}".

### RF-09: Ratchet axe promovido a hard
Após as correções da 15.2, as entradas `dashboard-lider` e `radar-pastoral` em `a11y-pages.json` DEVEM ser promovidas de `"baseline"` para `"hard"`, e os specs correspondentes DEVEM incluir asserção que confirme que conteúdo autenticado carregou (anti-redirect).

### RF-10: Roteiro manual de testes de screen reader
O projeto DEVE manter um roteiro de testes manuais (`manual-test-checklist.md`) com cenários para VoiceOver/NVDA/JAWS cobrindo: navegação pelo Radar, expansão de cards, filtros, anúncios SSE (debounce, silenciar, desconexão/reconexão).

---

## 6. Success Criteria (Technology-Agnostic)

| Critério | Medida | Verificação |
|----------|--------|-------------|
| Zero violações axe nas páginas do Radar | 0 violations no axe-core em modo autenticado | CI gate axe (ratchet hard) |
| Status de participante anunciado sem depender de cor | Todos os cards `care-urgent` e `care-attention` expõem texto de status para AT | Revisão de código + roteiro manual |
| Máximo 1 anúncio por burst de 3s de mudanças SSE | 5 mudanças em 2s geram exatamente 1 anúncio batched | Spec de testes automatizados (mocked SSE) |
| Reconexão não inunda AT | Burst de gap-fill após reconexão gera exatamente 1 anúncio após 5s | Spec de testes automatizados |
| Toggle silenciar suprime 100% dos anúncios de participante | Com silenciar ativo: 0 anúncios emitidos, `aria-live="off"` | Spec de testes automatizados |
| Roteiro manual publicado e aprovado pelo PO | Arquivo `manual-test-checklist.md` completo, revisado | Gate humano pré-release |

---

## 7. Dependências

| Dependência | Tipo | Notas |
|-------------|------|-------|
| Epic 12 — base a11y (axe-core CI, skip-nav, FocusManager) | Pré-requisito | Done |
| Epic 14 — SSE, `useNotificationSilence`, `AsyncAnnouncer` | Pré-requisito | Done |
| Epic 7 — Radar Pastoral (ParticipantCard, SemaforoPill, GrupoPillFilter) | Pré-requisito | Done |
| Story 15.1 — a11y-screen-reader-auth | Pré-requisito | Done |
| Story 15.3 — Semáforo Multimodal (cor+ícone+texto visível) | Dependência lateral | 15.2 NÃO faz o visual; 15.3 faz |

---

## 8. Fronteira Explícita 15.2 × 15.3 × Busca

### 8.1 Fronteira 15.2 × 15.3 (Semáforo)
- **15.2 (esta story)**: status do semáforo como `aria-label` / texto oculto para AT — não visível na tela.
- **15.3**: adicionar ícone + texto visível ao semáforo — visível na tela para todos os usuários.
- As duas stories são independentes e não interferem entre si.

### 8.2 Busca de Participantes — Decisão de Escopo
- **Busca full-text não existe** hoje — há apenas filtro por grupo (GrupoPillFilter, role=group) e filtro por semáforo (SemaforoPill).
- **15.2 NÃO implementa busca full-text** — seria expansão fora do escopo da story.
- **15.2 adiciona**: `aria-live="polite"` na contagem de resultado dos filtros existentes + verificação de `aria-pressed` nos SemaforoPills.
- Busca full-text, se implementada no futuro, já herdará a semântica correta dos filtros.

### 8.3 Tabelas (AC#5 original da story)
- Não existem elementos `<table>` na área do Radar. A timeline de cuidado usa `<ul>/<li>` semântico.
- AC#5 (caption/th scope) é **N/A** para esta story.

---

## Histórico de Versões

| Versão | Data | Autor | Mudança |
|--------|------|-------|---------|
| 1.0.0 | 2026-06-25 | agente-00c-feature-orchestrator | Criação inicial |
