## Epic 15: Acessibilidade Avançada

Compatibilidade com leitores de tela (VoiceOver, NVDA, JAWS) nas áreas críticas da plataforma e semáforo pastoral multimodal — garantindo que nenhuma informação dependa exclusivamente de cor. Continuação do Epic 12 (que cobriu keyboard nav, contraste WCAG AA, formulários acessíveis e axe-core no CI). Este épico fecha os gaps de acessibilidade para Release 2.

**NFRs cobertos:** NFR-A4, NFR-A5
**UX-DRs cobertos:** UX-DR20
**Pré-requisito:** Epic 12 (infraestrutura de acessibilidade base)

**Definition of Done (transversal):** Relatório de teste manual com pelo menos 3 screen readers (VoiceOver macOS/iOS, NVDA Windows, TalkBack Android) documentando: áreas testadas, issues encontradas, issues corrigidas. Nenhum blocker crítico (conteúdo inacessível) remanescente. Um membro da equipe designado como "accessibility champion" é responsável por validar os testes e manter o checklist atualizado. **Baseline axe-core:** antes de iniciar este épico, gerar snapshot do relatório axe-core em todas as rotas críticas (login, dashboard, trilhas, progresso). Após conclusão, comparar com o snapshot: o número de violations deve ser igual ou menor — qualquer aumento indica regressão e bloqueia o DoD.

### Story 15.1: Screen Reader — Autenticação, Navegação Global & Landmarks (NFR-A4)

As a user who relies on a screen reader,
I want to navigate authentication flows and global navigation using VoiceOver, NVDA, or JAWS,
So that I can access the platform independently from the very first interaction.

**Acceptance Criteria:**

**Given** a screen reader user accesses the login page
**When** the page loads
**Then** the page has proper landmark structure: `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<footer role="contentinfo">`
**And** the page title (`<title>`) announces "Entrar — {tenantName}" (or platform name if no tenant context)
**And** the login form has `aria-labelledby` pointing to a visible heading "Entrar"

**Given** a screen reader user navigates the login form
**When** they tab through the fields
**Then** each field announces: label text, field type, and required state (e.g., "E-mail, campo de texto, obrigatório")
**And** the password field has a visibility toggle that announces "Mostrar senha" / "Ocultar senha" with `aria-pressed` state
**And** the submit button announces "Entrar" with `role="button"`

**Given** a login attempt fails (invalid credentials)
**When** the error is displayed
**Then** the error message container has `role="alert"` (implicit `aria-live="assertive"`) so it is announced immediately
**And** the error text is descriptive: "E-mail ou senha incorretos" (not just "Erro")
**And** focus moves to the error message or to the first invalid field

**Given** a screen reader user navigates the registration flow
**When** they complete the multi-step form
**Then** each step announces its position: "Passo {n} de {total}: {stepName}" via `aria-label` on the form section
**And** validation errors are announced in real time via `aria-live="polite"` as the user leaves each field
**And** success feedback ("Conta criada com sucesso") uses `role="status"` for polite announcement

**Given** a screen reader user navigates the password reset flow
**When** they request a reset and enter the new password
**Then** all form fields, success messages, and error states follow the same patterns as login (landmarks, `role="alert"`, descriptive labels)

**Given** a screen reader user navigates any page in the platform
**When** they press Tab as the first action
**Then** the skip navigation link "Ir para conteúdo" (already implemented in Epic 12) is the first focusable element and is announced by the screen reader
**And** the sidebar navigation items announce their label and expanded/collapsed state (`aria-expanded`)
**And** the current page in the sidebar is announced as "atual" via `aria-current="page"`
**And** when multiple `<nav>` landmarks exist on the same page (e.g., sidebar + breadcrumbs), each has a distinct `aria-label`: `aria-label="Navegação principal"` vs `aria-label="Breadcrumbs"` — so screen readers can distinguish them

**Given** the page contains text in a language different from PT-BR (e.g., technical terms, feature names)
**When** the screen reader encounters these terms
**Then** inline `lang="en"` (or appropriate language) attributes wrap foreign-language terms so screen readers pronounce them correctly
**And** this applies globally across all pages, not just authentication flows

**Given** the onboarding flow (Epic 10) is accessed by a screen reader user
**When** the user goes through the first-time experience
**Then** all onboarding steps, tooltips, and guided tours are fully accessible (landmarks, focus management, `aria-live` for step transitions)
**And** if any onboarding component is NOT screen-reader accessible, it is documented as a gap and tracked as tech debt for remediation before this epic is considered complete

**Teste:** Manual testing with VoiceOver (macOS/Safari), NVDA (Windows/Chrome), and TalkBack (Android/Chrome) covering: login, registration, password reset, global navigation, onboarding flow. Automated: axe-core regression (already in CI from Epic 12) must pass with zero new violations. Checklist: every `role="alert"` confirmed to announce immediately, every `aria-live="polite"` confirmed to announce without interrupting, every landmark present and correctly nested, every `<nav>` has a distinct `aria-label`. TalkBack-specific: verify touch exploration works for all interactive elements. Language test: verify `lang` attribute on foreign terms (manually check 3+ pages with mixed-language content).

### Story 15.2: Screen Reader — Dashboard Líder, Radar Pastoral & Listas (NFR-A4)

As a Líder who uses a screen reader,
I want to navigate the pastoral dashboard, participant lists, and care actions using assistive technology,
So that I can fulfill my pastoral care responsibilities regardless of visual ability.

**Acceptance Criteria:**

**Given** a Líder using a screen reader accesses the dashboard (`/app/gestao/dashboard`)
**When** the page loads
**Then** the page title announces "Radar Pastoral — {groupName}"
**And** the page has a descriptive `<h1>` that is the first content landmark
**And** summary cards (total participantes, atenção necessária, reuniões agendadas) each have `role="region"` with `aria-label` describing the metric (e.g., "Participantes que precisam de atenção: 3")
**And** each summary card value is not just a number — it includes context (e.g., `aria-label="3 de 12 participantes precisam de atenção"`)

**Given** a Líder navigates the participant list
**When** the list renders
**Then** it uses `role="list"` with `role="listitem"` for each participant (or semantic `<ul>/<li>`)
**And** each participant item announces: name, semáforo status as text (e.g., "Maria Silva — Atenção necessária"), and available actions
**And** the list supports `aria-sort` if sortable, announcing sort direction when changed

**Given** a Líder expands a participant card (ParticipantCard, UX-DR05)
**When** the card expands
**Then** the trigger has `aria-expanded="false"` → `"true"` transition announced
**And** the expanded content includes: pastoral context, timeline, and action buttons
**And** each action button (e.g., "Registrar cuidado", "Ver histórico") has a descriptive `aria-label` if the visible text alone is ambiguous
**And** `aria-controls` links the trigger to the expanded panel

**Given** a Líder uses the participant filter/search
**When** they type in the search field
**Then** the field has `role="searchbox"` with `aria-label="Buscar participantes"`
**And** results count is announced via `aria-live="polite"`: "{n} participantes encontrados"
**And** if no results, "Nenhum participante encontrado" is announced

**Given** the dashboard shows data tables (e.g., attendance history, care timeline)
**When** a screen reader navigates the table
**Then** the table has `<caption>` describing its content (e.g., "Histórico de presença — últimas 4 reuniões")
**And** row/column headers use `<th scope="col">` and `<th scope="row">` correctly
**And** the screen reader can navigate cell-by-cell using table navigation shortcuts

**Given** real-time updates arrive on the dashboard (SSE from Epic 14)
**When** a participant's status changes
**Then** the change is announced via `aria-live="polite"` (UX-DR20): "{participantName} mudou para {newStatus}"
**And** the announcement is debounced: if multiple changes arrive within 3 seconds, they are batched into a single announcement: "{n} participantes atualizados"
**And** when the "silenciar notificações" toggle (Epic 14, localStorage) is active, `aria-live` announcements are ALSO suppressed — the toggle controls both visual notifications and screen reader announcements

**Given** the SSE connection drops (network issue, server restart)
**When** the dashboard detects the disconnection
**Then** a `role="status"` region announces: "Conexão em tempo real interrompida. Os dados podem estar desatualizados."
**And** a visual indicator (icon + text, not color-only) appears near the dashboard header
**And** when the SSE reconnects automatically, the first batch of updates waits 5 seconds before announcing (to accumulate represadas updates into a single batch instead of flooding)
**And** after the 5s grace period, the status announces: "Conexão restaurada. {n} participantes atualizados."
**And** the visual indicator disappears after successful reconnection

**Teste:** Manual testing with VoiceOver, NVDA, and TalkBack on: dashboard load, participant list navigation, card expansion, search/filter, table navigation, SSE updates, SSE disconnect/reconnect. Automated: axe-core on `/app/gestao/dashboard` — zero violations. Specific test: verify `aria-live` announcements are batched for rapid SSE updates (simulate 5 status changes in 2s → expect 1 batched announcement). SSE disconnect test: simulate network drop → verify announcement + visual indicator → restore → verify 5s grace period → verify single batched recovery announcement. Silenciar toggle test: activate toggle → verify `aria-live` region is set to `aria-live="off"` → no announcements arrive.

### Story 15.3: Semáforo Multimodal — Ícones, Texto Complementar & ARIA (NFR-A5)

As a user with color vision deficiency or using a screen reader,
I want the pastoral semáforo to communicate status through icons and text (not color alone),
So that I can understand participant engagement status regardless of how I perceive the interface.

**Acceptance Criteria:**

**Given** the semáforo component renders a participant's status
**When** the status is displayed
**Then** each status level includes THREE complementary channels:
  - **Color**: Verde (#22c55e), Amarelo (#eab308), Vermelho (#ef4444) — with dark mode variants maintaining 3:1 contrast against background
  - **Icon**: Distinct icon per status — ✅ (check-circle) for verde, ⚠️ (alert-triangle) for amarelo, 🔴 (alert-circle) for vermelho — using Lucide icons for consistency
  - **Text label**: "Ativo", "Atenção", "Crítico" — always visible (not tooltip-only)
**And** the combination of icon + text is sufficient to distinguish all states without any color perception

**Given** a screen reader encounters the semáforo
**When** it reads the component
**Then** the `aria-label` announces the full context: "{statusLabel} — {participantName}" (e.g., "Atenção — Maria Silva")
**And** the color indicator has `aria-hidden="true"` (since color is redundant with icon + text for AT users)
**And** the icon has `role="img"` with `aria-hidden="true"` (since the text label carries the meaning)
**And** Lucide SVG icons have `focusable="false"` to prevent SVGs from receiving spurious focus in any browser

**Given** a participant's semáforo status changes in real time (SSE)
**When** the transition occurs
**Then** `aria-live="polite"` announces: "{participantName}: status mudou para {newStatusLabel}" (UX-DR20)
**And** the visual transition includes a brief highlight animation (pulse border) that respects `prefers-reduced-motion`:
  - Motion enabled: 1s pulse animation on the status badge
  - Motion reduced: instant swap with no animation, only a subtle opacity transition (0.15s)
**And** the `prefers-reduced-motion` check uses CSS media query (NOT JavaScript) for performance

**Given** the semáforo appears in different contexts (ParticipantCard, dashboard summary, group list)
**When** rendered in compact mode (e.g., GroupCard aggregated view, UX-DR15)
**Then** the icon is always present even in compact view (minimum 16x16px)
**And** the text label may be truncated to initial letter ("A", "At", "C") in compact mode but full text is available via `aria-label` (NOT `title` — `title` is inconsistent across screen readers and inaccessible on mobile/touch)
**And** `aria-label` always contains the full status text regardless of visual truncation

**Given** the platform is in dark mode
**When** semáforo colors render
**Then** verde uses `#4ade80` (lighter), amarelo uses `#facc15`, vermelho uses `#f87171` — all maintaining >= 3:1 contrast ratio against dark surface (`#1e1e2e` or equivalent)
**And** contrast ratios are validated using `color2k` (per Epic 12 decision) in a unit test that fails if any combination drops below 3:1

**Teste:** Visual regression: screenshot comparison of semáforo in all 3 states × 2 themes (light/dark) × 2 sizes (full/compact). Unit test: `color2k` contrast check for all color/background combinations — must be >= 3:1 (WCAG AA for non-text). Manual screen reader test: VoiceOver + NVDA verify `aria-label` reads correctly and `aria-live` announces transitions. `prefers-reduced-motion` test: enable reduced motion in OS settings → verify no pulse animation, only opacity transition. Automated: axe-core scan of pages containing semáforo — zero violations related to color-only information.

### Story 15.4: Screen Reader — Trilhas, Progresso & Conteúdo (NFR-A4)

As a participant who uses a screen reader,
I want to navigate trails, track my progress, and consume content using assistive technology,
So that I can fully engage in discipleship content regardless of visual ability.

**Acceptance Criteria:**

**Given** a participant using a screen reader accesses the trail listing (`/app/trilhas`)
**When** the page loads
**Then** the page title announces "Trilhas disponíveis" (or "Minhas trilhas" if filtered)
**And** each trail card announces: trail name, description summary, progress percentage, and module count
**And** the list uses `role="list"` with semantic `<ul>/<li>` structure

**Given** a participant navigates inside a trail (`/app/trilhas/{trailId}`)
**When** the trail detail page loads
**Then** the trail name is an `<h1>` and is the first meaningful content
**And** the module list shows progression with each module announcing: "Módulo {n} de {total}: {moduleName} — {status}" where status is "Concluído", "Em andamento", or "Bloqueado"
**And** completed modules have `aria-label` including "Concluído" and a visual checkmark (which has `aria-hidden="true"`)
**And** the overall progress bar uses `role="progressbar"` with `aria-valuenow="{percentage}"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label="Progresso na trilha: {percentage}%"`

**Given** a participant accesses a content module (text/document)
**When** the content renders
**Then** the content uses proper heading hierarchy (`<h2>`, `<h3>`, etc.) for navigability via heading shortcuts
**And** images have descriptive `alt` text (content creators must provide alt text; if missing, `alt="Imagem sem descrição"` as fallback)
**And** when a module is published with missing alt text, a flag `has_missing_alt_text: true` is set on the module record and the module appears in a "Conteúdo com acessibilidade incompleta" list visible to admins at `/app/admin/accessibility-gaps` — so fallbacks don't accumulate silently
**And** links within content have descriptive text (never "clique aqui")

**Given** a participant accesses a video module
**When** the video player renders
**Then** the video player uses Plyr (lightweight, ARIA-native) as the standard player — custom `<video>` controls are NOT implemented from scratch
**And** all player controls have accessible labels: "Reproduzir", "Pausar", "Volume: {n}%", "Tela cheia", "Avançar 10 segundos", "Retroceder 10 segundos" (Plyr provides these natively; this AC validates PT-BR localization is correctly configured)
**And** the current playback position is available via `aria-valuenow` on a `role="slider"` for the progress bar
**And** keyboard shortcuts for the player are documented in an accessible help panel (triggered by "?" key when player is focused)
**And** when the video ends, focus returns to the "Próximo módulo" button (if available) with a polite announcement: "Vídeo concluído. Avance para o próximo módulo."

**Given** a participant completes a module
**When** the completion is registered
**Then** a `role="status"` region announces: "Módulo {moduleName} concluído! Progresso: {newPercentage}%"
**And** the trail listing updates the progress bar `aria-valuenow` accordingly

**Given** a participant accesses the "Meu progresso" overview
**When** the page renders
**Then** each trail shows: trail name, progress bar (with `role="progressbar"`), modules completed out of total
**And** the page provides a summary at the top: "Você está participando de {n} trilhas. {completed} concluídas." via a `role="region"` with `aria-label`

**Teste:** Manual testing with VoiceOver, NVDA, and TalkBack on: trail listing, trail detail (module navigation), text content module, video player controls, progress tracking, completion flow. Automated: axe-core on `/app/trilhas` and `/app/trilhas/{id}` — zero violations. Specific: verify `role="progressbar"` attributes update correctly after module completion. Video player: verify all controls have labels, keyboard shortcuts work, end-of-video focus management. TalkBack-specific: verify touch exploration on video player controls and progress indicators.

---

