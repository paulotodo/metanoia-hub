# Spec — a11y-conteudo-multimidia (Story 15.5)
# Conteúdo Multimídia Acessível — Follow-up Epic 15

**Status**: rascunho  
**Versão**: 1.0.0  
**Data**: 2026-06-25  
**Pipeline**: feature-00c  
**Short-name**: a11y-conteudo-multimidia  

---

## 1. Contexto e Motivação

O Epic 15 entregou acessibilidade de FE nas telas públicas e autenticadas do metanoia-hub
(NFR-A4/A5, UX-DR20). Três itens foram diferidos da Story 15.4 por exigirem migration
em produção e novos endpoints backend:

1. **Lesson Viewer** — rota `/app/consumo/trilhas/[trailId]/aulas/[lessonId]` **não existe**;
   `trail-playlist-route.tsx` já redireciona para ela, mas a página nunca foi criada.
2. **Plyr** — `video-player.tsx` usa `<video>` nativo, sem controles i18n PT-BR nem
   suporte a atalhos de teclado/painel de atalhos. Plyr não está instalado.
3. **Governança alt-text** — não há validação de `<img>` sem `alt` no conteúdo publicado,
   nem endpoint/página admin para auditar lacunas.

Esta feature entrega as três frentes como story full-stack, com migration local validada
antes do PR. Não bloqueia o Epic 15 (já concluído).

**Referência**: `_bmad-output/implementation-artifacts/epic-15-followup-15-5.md` e
`/root/.claude/jobs/b47e3f6a/tmp/15-5-preflight-reconciliation.md`.

---

## 2. Escopo

### IN — 3 Frentes

**Frente A — Lesson Viewer (FE, NOVO)**
- Criar `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/aulas/[lessonId]/page.tsx`
  (Server Component shell: busca dados da aula + nome do módulo).
- Criar `lesson-viewer.tsx` (Client Component): switch por `contentType`
  (`video` | `rich_text` | `pdf_doc` | `external_link`).
- a11y: `<h1>` = nome da aula; hierarquia de headings no rich-text; links descritivos;
  imagens com fallback `alt="Imagem sem descrição"`.
- Botão "Próxima aula" (ordem+1 no módulo) / "Próximo módulo" (fim do módulo): navegação
  sequencial, liga `nextModuleButtonRef` do VideoPlayer.
- Gate a11y: focus-ring, contraste ≥ 4.5:1, `motion-safe:` em toda animação.

**Frente B — Plyr Video Player (FE, NOVO)**
- Instalar `plyr` via `pnpm`.
- Criar `plyr-video-player.tsx` (wrapper Plyr) substituindo o `video-player.tsx` órfão
  dentro do lesson viewer.
- i18n PT-BR: Reproduzir / Pausar / Volume / Mudo / Tela cheia / Avançar 10s / Retroceder 10s.
- `role="slider"` + `aria-valuenow` no scrubber (nativo do Plyr, sem markup manual).
- Painel de atalhos de teclado (tecla "?") com tabela acessível.
- Importar CSS do Plyr globalmente.
- Reaproveitar `apps/web/src/hooks/use-video-progress.ts` (analytics).

**Frente C — Governança alt-text (BACKEND + admin FE)**
- **Migration Prisma**: campo `has_missing_alt_text Boolean @default(false)
  @map("has_missing_alt_text")` no modelo `Lesson` + índice `(tenant_id, has_missing_alt_text)`.
  Aplicar localmente (`pnpm --filter @metanoia/api db:migrate` em dev).
  RLS test obrigatório (idempotente, rodar 2×).
  Apply em produção é deploy **manual** do operador.
- **Validador alt-text**: `alt-text.validator.ts` — parser de `contentBody` HTML
  (campo `Lesson.contentBody`) detectando `<img>` sem atributo `alt` preenchido.
  Plugado em `ContentService.createLesson` / `updateLesson`.
- **Endpoint admin**: `GET /api/v1/admin/accessibility-gaps`
  (guard `@Roles(Role.ADMIN_TENANT)`).
  Retorna `{ data: LessonAccessibilityGap[], meta: { total, page, pageSize } }`.
  `LessonAccessibilityGap`: `{ lessonId, lessonName, moduleName, trailName, tenantId }`.
  Espelhar estrutura de `apps/api/src/admin-users/` (controller + service + repository).
- **Página admin FE**: `apps/web/app/(authenticated)/app/admin/accessibility-gaps/page.tsx`
  — tabela de aulas com alt-text ausente. Espelhar `app/admin/grupos/page.tsx` (TanStack Query
  + guard role). Hook `useAccessibilityGaps()`.
- **Seed demo**: `apps/api/prisma/seeds/demo-seed.ts` — 2–3 lessons idempotentes com
  `<img>` sem `alt` em `contentBody` (UUID v7 fixo, `is_demo_data=true`).
- Textos PT-BR em `apps/web/messages/pt-BR.json` (`admin.accessibilityGaps.*`).

### OUT (não escopo desta story)
- Screen reader testing com AT real (NVDA, VoiceOver, Orca).
- Closed captions / legendas no Plyr (dependem de assets .vtt que não existem).
- Migrar `video-player.tsx` para Plyr fora do contexto de lesson viewer.
- Retroativamente corrigir alt-text em conteúdo legado (flag apenas sinaliza; correção é tarefa do líder/admin).
- Interface de edição inline de alt-text.
- Apply em produção (responsabilidade manual do operador).

---

## 3. User Stories

### US-001 — Consumidor assiste aula de vídeo via rota dedicada
**Como** participante de uma trilha de discipulado,  
**quero** acessar uma rota dedicada de aula (`/aulas/[lessonId]`) ao clicar em uma aula na playlist,  
**para que** eu possa consumir o vídeo com controles acessíveis (PT-BR) e navegar para a próxima aula com teclado ou clique.

**Critérios de Aceite:**
- CA-001.1: Rota `/app/consumo/trilhas/[trailId]/aulas/[lessonId]` renderiza sem erro 404.
- CA-001.2: `<h1>` contém o nome da aula (único por página).
- CA-001.3: Botão "Próxima aula" / "Próximo módulo" está visível e navegável via Tab.
- CA-001.4: Ao fim do vídeo, foco move para o botão "Próxima aula" se existente.
- CA-001.5: Build `pnpm turbo build` passa sem erro de TypeScript.

### US-002 — Consumidor usa player de vídeo Plyr com i18n PT-BR
**Como** participante com deficiência auditiva ou cognitiva,  
**quero** que os controles do player de vídeo estejam rotulados em português do Brasil,  
**para que** eu possa operar o player com leitor de tela ou teclado sem depender de ícones sem rótulo.

**Critérios de Aceite:**
- CA-002.1: `aria-label` dos botões principais em PT-BR (Reproduzir, Pausar, Volume, Mudo, Tela cheia, Avançar 10s, Retroceder 10s).
- CA-002.2: Scrubber de progresso tem `role="slider"` e `aria-valuenow` (fornecido pelo Plyr nativamente).
- CA-002.3: Tecla "?" abre painel de atalhos de teclado com tabela descritiva.
- CA-002.4: CSS do Plyr importado sem conflito com Tailwind.
- CA-002.5: `pnpm --filter @metanoia/web test` passa (incluindo `plyr-video-player.spec.tsx`).

### US-003 — Consumidor navega conteúdo rich-text / PDF / link externo acessível
**Como** participante de uma aula com conteúdo não-vídeo,  
**quero** que textos, PDFs e links externos sejam apresentados com hierarquia semântica e rótulos descritivos,  
**para que** eu possa navegar com tecnologia assistiva sem perder contexto.

**Critérios de Aceite:**
- CA-003.1: `contentType = rich_text` — conteúdo renderizado com `<h2>` para seções, sem saltar níveis.
- CA-003.2: `contentType = pdf_doc` — link "Abrir documento" com `aria-label="Abrir documento: {nome}"`.
- CA-003.3: `contentType = external_link` — link descritivo `aria-label="Acessar recurso externo: {nome}"`, ícone `aria-hidden="true"`.
- CA-003.4: Imagens em `rich_text` com fallback `alt="Imagem sem descrição"` quando `alt` vazio/ausente.
- CA-003.5: Gate axe-core sem violations `serious`/`critical`.

### US-004 — Admin audita conteúdo com alt-text ausente
**Como** administrador de tenant,  
**quero** acessar `/app/admin/accessibility-gaps` e ver a lista de aulas com imagens sem alt-text,  
**para que** eu possa priorizar a correção do conteúdo inacessível.

**Critérios de Aceite:**
- CA-004.1: `GET /api/v1/admin/accessibility-gaps` retorna 200 com `{ data: [...], meta: { total, page, pageSize } }` para role `ADMIN_TENANT`.
- CA-004.2: Retorna 403 para role `PARTICIPANT` ou sem autenticação.
- CA-004.3: Dados são isolados por `tenant_id` (RLS).
- CA-004.4: Página FE lista as aulas retornadas; exibe estado vazio se nenhuma aula com alt-text ausente.
- CA-004.5: Seed demo inclui ≥ 2 aulas com `has_missing_alt_text=true` visíveis na página.

### US-005 — Sistema valida alt-text na publicação de conteúdo
**Como** desenvolvedor/operador,  
**quero** que o `ContentService` detecte automaticamente `<img>` sem `alt` ao criar/atualizar uma aula,  
**para que** `has_missing_alt_text` seja mantido atualizado sem intervenção manual.

**Critérios de Aceite:**
- CA-005.1: `createLesson` com `contentBody` contendo `<img>` sem `alt` → `has_missing_alt_text=true`.
- CA-005.2: `updateLesson` corrigindo todos os `alt` → `has_missing_alt_text=false`.
- CA-005.3: `contentBody` null/vazio → `has_missing_alt_text=false`.
- CA-005.4: Testes unitários cobrem os 3 cenários acima (mock do `AltTextValidator`).
- CA-005.5: `pnpm --filter @metanoia/api test` passa.

### US-006 — Migration alt-text válida com RLS
**Como** desenvolvedor,  
**quero** que a migration `has_missing_alt_text` passe nos testes RLS obrigatórios,  
**para que** o campo respeite o isolamento multi-tenant antes do deploy em produção.

**Critérios de Aceite:**
- CA-006.1: Migration SQL executa sem erro em Postgres de dev.
- CA-006.2: Índice `(tenant_id, has_missing_alt_text)` criado.
- CA-006.3: RLS test `rls_lessons_tenant_isolation` passa com o novo campo (rodar 2× — idempotente).
- CA-006.4: `pnpm --filter @metanoia/types test` passa se schema Zod de Lesson foi atualizado.
- CA-006.5: `pnpm turbo build` (api+web) passa.

---

## 4. Requisitos Funcionais

| ID | Requisito | US | Prioridade |
|----|-----------|----|-----------|
| FR-001 | Criar rota `/app/consumo/trilhas/[trailId]/aulas/[lessonId]` como Server Component | US-001 | MUST |
| FR-002 | `lesson-viewer.tsx` Client Component com switch por `contentType` (4 ramos: video, rich_text, pdf_doc, external_link) | US-001 US-003 | MUST |
| FR-003 | `<h1>` = nome da aula; único por página | US-001 | MUST |
| FR-004 | Botão "Próxima aula"/"Próximo módulo" com `nextModuleButtonRef` e foco pós-vídeo | US-001 | MUST |
| FR-005 | Instalar `plyr`; criar `plyr-video-player.tsx` com i18n PT-BR dos controles | US-002 | MUST |
| FR-006 | Painel de atalhos de teclado (tecla "?") no `plyr-video-player.tsx` | US-002 | MUST |
| FR-007 | CSS do Plyr importado em layout global (ou página de aula) | US-002 | MUST |
| FR-008 | Reaproveitar `use-video-progress.ts` no `plyr-video-player.tsx` | US-002 | SHOULD |
| FR-009 | Imagens em rich_text: fallback `alt="Imagem sem descrição"` | US-003 | MUST |
| FR-010 | Links pdf_doc e external_link com `aria-label` descritivos | US-003 | MUST |
| FR-011 | Migration Prisma: `has_missing_alt_text Boolean @default(false)` em `Lesson` + índice | US-006 | MUST |
| FR-012 | `AltTextValidator.hasInvalidImgs(html: string): boolean` — parser de `<img>` sem `alt` | US-005 | MUST |
| FR-013 | `ContentService.createLesson`/`updateLesson` chama `AltTextValidator` e seta flag | US-005 | MUST |
| FR-014 | `GET /api/v1/admin/accessibility-gaps` com guard `@Roles(Role.ADMIN_TENANT)` e paginação | US-004 | MUST |
| FR-015 | Resposta do endpoint: `{ data: LessonAccessibilityGap[], meta: { total, page, pageSize } }` | US-004 | MUST |
| FR-016 | Página FE `/app/admin/accessibility-gaps` com TanStack Query + hook `useAccessibilityGaps()` | US-004 | MUST |
| FR-017 | Textos PT-BR em `messages/pt-BR.json` (`admin.accessibilityGaps.*`) | US-004 | MUST |
| FR-018 | Seed demo: ≥ 2 aulas com `<img>` sem alt (UUID v7 fixo, `is_demo_data=true`) | US-004 | SHOULD |
| FR-019 | Boot real da API validado após novo controller (`start:e2e` + `/api/health`) | transversal | MUST |
| FR-020 | RLS test da migration idempotente, rodar 2× | US-006 | MUST |

---

## 5. Requisitos Não-Funcionais

| ID | NFR | Notas |
|----|-----|-------|
| NFR-A4 | Hierarquia de headings sem saltar nível | WCAG 1.3.1 |
| NFR-A5 | Contraste mínimo 4.5:1 (texto normal), 3:1 (UI) | WCAG 1.4.3 |
| NFR-A6 | `motion-safe:` em toda animação/transição | WCAG 2.3.3 |
| NFR-A7 | Focus-ring visível em todos os interativos | WCAG 2.4.7 |
| NFR-A8 | Ícones decorativos com `aria-hidden="true"` e `focusable="false"` | WCAG 1.1.1 |
| NFR-S1 | Endpoint admin isolado por `tenant_id` via RLS | OWASP A01 |
| NFR-S2 | Guard `@Roles(Role.ADMIN_TENANT)` — 403 para outros roles | OWASP A01 |
| NFR-S3 | Sem exposição de dados cross-tenant no endpoint | OWASP A01 |
| NFR-P1 | Bundle Plyr ~50KB — validar `pnpm turbo build` sem regressão de tamanho crítica | — |
| NFR-T1 | Cobertura: `plyr-video-player.spec.tsx`, `alt-text.validator.spec.ts`, `content.service.spec.ts` (3 cenários), `admin-accessibility.controller.spec.ts` | — |

---

## 6. Convenções de Projeto (non-negotiable)

- UUID v7 via `uuidv7()` — nunca `@default(uuid())` em Prisma.
- `tenant_id` em toda tabela — nunca passar como parâmetro; usar `AsyncLocalStorage` (`RequestContext`).
- Zod em `packages/types`; `ZodValidationPipe` no backend.
- API responses: `{ data, meta? }` / erro `{ statusCode, error, message }`.
- Nulls explícitos, datas ISO 8601; Create=201, Delete=204.
- Textos user-facing em `apps/web/messages/pt-BR.json`.
- NÃO commitar `next-env.d.ts`.
- Animações: **sempre** `motion-safe:` antes de `transition-*`/`animate-*`.
- `aria-label` em elemento **interativo** (nunca em `<div>`/`<span>` genérico).

---

## 7. Sequenciamento Interno (sugerido)

1. **Fase backend**: migration + validador + seed → validar Postgres local + RLS test 2×.
2. **Fase endpoint + admin FE**: controller/service/repository + página admin → boot API + health.
3. **Fase lesson viewer**: rota + `lesson-viewer.tsx` (4 contentTypes) + botão navegação.
4. **Fase Plyr**: instalar + `plyr-video-player.tsx` + i18n PT-BR + painel atalhos.
5. **Gates finais**: lint + tests (web/api/types) + build + boot + 3 gates a11y hard + roteiro manual.

---

## 8. Artefatos

| Artefato | Path |
|----------|------|
| Spec | `docs/specs/a11y-conteudo-multimidia/spec.md` |
| Plan | `docs/specs/a11y-conteudo-multimidia/plan.md` |
| Checklist | `docs/specs/a11y-conteudo-multimidia/checklists/` |
| Tasks | `docs/specs/a11y-conteudo-multimidia/tasks.md` |
| Manual test checklist | `docs/specs/a11y-conteudo-multimidia/manual-test-checklist.md` |
| Roteiro player | `docs/specs/a11y-conteudo-multimidia/manual-test-checklist.md` |

---

## Clarifications

Respondido na fase clarify (answerer, 2026-06-25). Nenhuma questão de produto pausou para humano.

**P1 — Fetch SC vs CC no lesson-viewer** (score 3)  
`page.tsx` (Server Component) busca dados da aula via `fetch` nativo e passa como props para `lesson-viewer.tsx` (Client Component). Progresso gerenciado separadamente via `use-video-progress.ts` (hook existente). Evidência: CLAUDE.md "Server Components use native fetch — no TanStack Query".

**P2 — Módulo NestJS para accessibility-gaps** (score 2)  
Criar módulo novo `admin-accessibility/` (controller + service + repository), espelhando `admin-users/`. `ContentRepository` pode ser reutilizado via injeção de dependência no novo service — sem duplicação. Bounded context próprio (admin + a11y).

**P3 — AltTextValidator síncrono vs BullMQ** (score 3)  
Validação **síncrona** em `createLesson`/`updateLesson`. Parser in-memory de HTML é sub-milissegundo para conteúdo típico (<50KB). CA-005.1 exige consistência imediata (flag=true logo após createLesson). BullMQ reservado para operações assíncronas reais (padrão Epic 14).

**P4 — Roles para /admin/accessibility-gaps** (score 2)  
Guard: `@Roles(Role.ADMIN_TENANT)` **somente**. NFR-S2 da spec define explicitamente `@Roles(Role.ADMIN_TENANT) — 403 para outros roles`. US-004 descreve ator como "administrador de tenant". Incluir LIDER contradiria NFR-S2.

**P5 — CSS do Plyr: escopo de import** (score 2)  
Importar CSS do Plyr no **layout global autenticado** (`apps/web/app/(authenticated)/layout.tsx`). Spec Frente B diz "Importar CSS do Plyr globalmente". Garante CSS disponível sem condicional em toda a área autenticada.
