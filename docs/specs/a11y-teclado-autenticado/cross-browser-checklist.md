# Checklist Cross-Browser — Story 12.2 (a11y-teclado-autenticado)

**FR-027, CHK013, CHK018**

## Responsabilidade e Momento de Execução (CHK013)

| Etapa | Executor | Quando |
|-------|----------|--------|
| **DEV** | Dev responsável pela feature (Paulo ou designado) | **Antes do PR de merge** — testar manualmente |
| **QA** | QA do time | **Em staging, pré-release** — re-validar os mesmos fluxos |

## Escopo de Browsers (CHK018)

> **NOTA OBRIGATÓRIA:** O CI executa **apenas Chromium** (playwright.config.ts, projeto único).
> Firefox e Safari são cobertos **exclusivamente via teste manual** conforme esta lista.
> Não há automação de cross-browser no pipeline de CI.

| Browser | Versão alvo | Cobertura |
|---------|-------------|-----------|
| Chrome | latest (stable) | CI automático + manual DEV/QA |
| Firefox | latest (stable) | **Manual apenas** — DEV pré-merge + QA staging |
| Safari | latest (macOS) | **Manual apenas** — DEV pré-merge + QA staging |

---

## Como Usar Este Checklist

1. Para cada US e cenário, testar nos 3 browsers e marcar: ✅ (passa) | ❌ (falha) | N/A
2. Adicionar observações na coluna "Obs" para falhas ou comportamentos divergentes
3. **DEV:** preencher as colunas Chrome, Firefox, Safari antes de abrir o PR
4. **QA:** re-preencher em staging antes do release
5. Incluir screenshots ou logs como evidências no PR (link na seção "Evidências" abaixo)

---

## Checklist de Testes Manuais

### US1 — Navegação por Teclado no Dashboard

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US1 | Navegar entre itens da sidebar com Arrow Keys (↑/↓) | ☐ | ☐ | ☐ | |
| US1 | Item ativo da sidebar tem foco visual visível (focus ring) | ☐ | ☐ | ☐ | |
| US1 | Tab na sidebar vai ao próximo elemento de página (não fica em loop) | ☐ | ☐ | ☐ | |
| US1 | `aria-current="page"` presente no item ativo | ☐ | ☐ | ☐ | |
| US1 | Sidebar colapsada: itens não focáveis via Tab | ☐ | ☐ | ☐ | |

### US2 — Foco Pós-Login (TD-001)

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US2 | Após login, foco vai automaticamente ao `<main>` ou `<h1>` do dashboard | ☐ | ☐ | ☐ | |
| US2 | Após navegação interna (route change), foco retorna ao topo do conteúdo | ☐ | ☐ | ☐ | |
| US2 | Anúncio de página via `aria-live` audível no NVDA/VoiceOver | ☐ | ☐ | ☐ | |
| US2 | Sem "jump" visual inesperado no foco durante navegação | ☐ | ☐ | ☐ | |

### US3 — CRUD de Grupos e Convite de Membros

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US3 | Formulário de criação de grupo: todos os campos alcançáveis via Tab | ☐ | ☐ | ☐ | |
| US3 | Dialog de exclusão de grupo: foco fica dentro do dialog (focus trap) | ☐ | ☐ | ☐ | |
| US3 | Dialog de exclusão: fechar com Escape retorna foco ao botão de origem | ☐ | ☐ | ☐ | |
| US3 | Formulário de convite: campo de email tem label acessível | ☐ | ☐ | ☐ | |
| US3 | Botão "Enviar convite" ativável com Enter/Space | ☐ | ☐ | ☐ | |
| US3 | Lista de membros: ações de cada membro alcançáveis via Tab | ☐ | ☐ | ☐ | |

### US4 — Builder de Trilhas (Alternativa ao Drag-and-Drop)

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US4 | Botões "Mover para cima" e "Mover para baixo" sempre visíveis (não dependem de hover) | ☐ | ☐ | ☐ | |
| US4 | Ativar botão com Enter/Space reordena o item | ☐ | ☐ | ☐ | |
| US4 | Após reordenação, foco permanece no botão ativado | ☐ | ☐ | ☐ | |
| US4 | Anúncio de posição ("Módulo X movido para posição Y") audível | ☐ | ☐ | ☐ | |
| US4 | Formulários de módulo/lição: Tab order lógico (top-to-bottom) | ☐ | ☐ | ☐ | |
| US4 | Botão no topo desabilitado quando item já é o primeiro | ☐ | ☐ | ☐ | |
| US4 | Botão no fim desabilitado quando item já é o último | ☐ | ☐ | ☐ | |

### US5 — Catálogo de Trilhas e Busca

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US5 | Campo de busca alcançável via Tab | ☐ | ☐ | ☐ | |
| US5 | Resultados de busca anunciados via `aria-live` | ☐ | ☐ | ☐ | |
| US5 | Cards de trilha ativáveis com Enter (navegar para detalhes) | ☐ | ☐ | ☐ | |
| US5 | Tab order entre cards é sequencial (esquerda-para-direita, top-to-bottom) | ☐ | ☐ | ☐ | |
| US5 | Paginação alcançável e operável via teclado | ☐ | ☐ | ☐ | |

### US6 — Configuração do Tenant e Branding

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US6 | Formulário de branding: todos os campos com labels associadas | ☐ | ☐ | ☐ | |
| US6 | Upload de logo: botão acessível e com nome descritivo | ☐ | ☐ | ☐ | |
| US6 | Dialog de confirmação de salvar: focus trap ativo | ☐ | ☐ | ☐ | |
| US6 | Dialog: fechar com Escape retorna foco ao botão de origem | ☐ | ☐ | ☐ | |
| US6 | Submissão do formulário via Enter no último campo | ☐ | ☐ | ☐ | |

### US7 — Gestão de Planos e Upgrade

| US | Cenário | Chrome | Firefox | Safari | Obs |
|----|---------|--------|---------|--------|-----|
| US7 | Cards de plano focáveis via Tab | ☐ | ☐ | ☐ | |
| US7 | Selecionar plano com Enter/Space abre dialog de upgrade | ☐ | ☐ | ☐ | |
| US7 | Dialog de upgrade: foco vai ao primeiro elemento interativo | ☐ | ☐ | ☐ | |
| US7 | Dialog de upgrade: Escape cancela e retorna foco ao card | ☐ | ☐ | ☐ | |
| US7 | Tabela de comparação de planos: cabeçalhos de coluna/linha presentes | ☐ | ☐ | ☐ | |
| US7 | Botão de confirmação de upgrade ativável via Enter | ☐ | ☐ | ☐ | |

### Transversal — Hooks e Componentes Base

| Categoria | Cenário | Chrome | Firefox | Safari | Obs |
|-----------|---------|--------|---------|--------|-----|
| Skip Nav | Link "Pular para conteúdo" visível no foco (Tab no topo da página) | ☐ | ☐ | ☐ | |
| Skip Nav | Ativar Skip Nav com Enter vai ao conteúdo principal | ☐ | ☐ | ☐ | |
| Focus Ring | Todos os elementos interativos têm focus ring visível | ☐ | ☐ | ☐ | |
| Anúncios | `AsyncAnnouncer` não duplica mensagens no NVDA/VoiceOver | ☐ | ☐ | ☐ | |

---

## Resumo por Browser (Preencher após testes)

| Browser | Total | Passou | Falhou | % |
|---------|-------|--------|--------|---|
| Chrome | 34 | — | — | — |
| Firefox | 34 | — | — | — |
| Safari | 34 | — | — | — |

---

## Evidências (DEV — preencher antes do PR)

> Adicionar links para screenshots ou logs aqui. Formato sugerido:
> `- [US1 Firefox] Screenshot: <link>` ou `- [US3 Safari dialog] Vídeo: <link>`

_Evidências serão adicionadas pelo dev antes do PR de merge._

---

## Evidências (QA — preencher em staging)

_Evidências de QA serão adicionadas antes do release._

---

## Notas

- **CI = Chromium-only** (CHK018): não há plano de adicionar Firefox/Safari ao CI.
  A decisão é de escopo deliberado — cross-browser é gate manual.
- Cenários de leitor de tela (NVDA, VoiceOver) são **best-effort** e não bloqueiam
  o PR, mas falhas devem ser documentadas para sprint de hardening.
- Este checklist deve ser arquivado no PR de merge como evidência do DoD transversal
  do Épico 12.

---

*Criado pelo pipeline `feature-00c` — feature `a11y-teclado-autenticado` — FASE 9, task 9.2*  
*FR-027, CHK013, CHK018 resolvidos.*
