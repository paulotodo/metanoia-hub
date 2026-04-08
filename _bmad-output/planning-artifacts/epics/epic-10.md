## Epic 10: Onboarding Avançado & Adoção

Wizard de onboarding guiado para Admin Tenant em 5 passos (perfil, igreja, grupo, líder, radar). Dados de demonstração ficcionais pré-populados para exploração antes de inserir dados reais. Importação em massa de participantes via CSV com validação em 4 etapas (upload, preview, resolução de erros, confirmação). Onboarding é Supporting Subdomain — service direto com Prisma, sem repository pattern.

### Story 10.1: Wizard de Onboarding para Admin Tenant

As a Admin Tenant (novo),
I want a guided 5-step wizard on my first login that walks me through initial platform setup,
So that I can configure my church, create my first group, assign a leader, and understand the pastoral radar in under 10 minutes.

**Acceptance Criteria:**

**Given** a new Admin Tenant logs in for the first time (no groups, no trails exist in the tenant)
**When** the dashboard loads
**Then** the `OnboardingWizard` component is displayed full-screen with 5 steps and a visual progress indicator (step dots + progress bar)
**And** the wizard cannot be dismissed on first login — it must be completed or explicitly skipped (skip records `onboardingSkippedAt` on tenant config)

**Given** Step 1: "Seu Perfil Pastoral"
**When** the admin fills in their profile
**Then** fields are: display name, photo (optional upload via MinIO), role title (e.g., "Pastor", "Coordenador")
**And** the profile is saved via `PATCH /api/v1/users/me`
**And** all labels and micro-copy use pastoral vocabulary from `vocabulary.ts` (UX-DR16) — e.g., "Como seus discípulos te conhecem?" instead of "Display name"

**Given** Step 2: "Sua Comunidade"
**When** the admin configures the church/organization
**Then** fields are: church name (required), denomination (optional), city/state (optional), logo upload (optional via MinIO with storage policy `permanent`)
**And** the tenant's display name, branding logo, and metadata are updated via `PATCH /api/v1/tenants/current`

**Given** Step 3: "Seu Primeiro Grupo de Discipulado"
**When** the admin reaches the group creation step
**Then** two options are presented: "Criar meu primeiro grupo" (form: group name + description) OR "Explorar com dados de demonstração" (skips to Step 5 using demo data from Story 10.2)
**And** if the admin chooses to create a group, it is created via `POST /api/v1/groups` (Epic 4 API) and the admin is automatically assigned as leader
**And** this step is skippable — choosing demo exploration still counts as completing Step 3

**Given** Step 4: "Convide um Líder"
**When** the admin optionally invites a leader
**Then** fields are: leader name, leader email
**And** if provided, an invite is sent via the same mechanism as Epic 4 Story 4.3 (BullMQ job, stub email)
**And** this step is skippable — "Fazer depois" button available
**And** if Step 3 was skipped (demo mode), Step 4 is also skipped automatically

**Given** Step 5: "Conheça o Radar Pastoral"
**When** the admin reaches the final step
**Then** an interactive explanation of the Pastoral Radar is displayed:
  - Visual of the traffic-light semáforo (green/yellow/red) with descriptions
  - Explanation that it's based on participation signals (meetings + trails)
  - Preview using demo data (Story 10.2) if available: "Veja como o radar funciona com dados de exemplo"
**And** a "Concluir Setup" button completes the wizard

**Given** the wizard is completed
**When** the admin clicks "Concluir Setup"
**Then** `onboardingCompletedAt` is recorded on the tenant config
**And** the admin is redirected to the main dashboard
**And** the wizard is NOT shown again on subsequent logins
**And** a "Rever tutorial" link is available in settings to replay the wizard in read-only mode

**Given** the wizard is rendered
**When** the component loads
**Then** the `OnboardingWizard` component uses `Administração` experience density (padding 12-16px, radius 6-8px) per UX-DR03
**And** each step supports keyboard navigation (Tab between fields, Enter to advance, Escape to go back)
**And** the wizard passes jest-axe accessibility tests
**And** state is persisted server-side per step via `onboardingProgress` JSON field on tenant config: `{ currentStep: 3, completedSteps: [1,2], stepData: {...} }` — saved via `PATCH /api/v1/tenants/current` after each step completion. If the browser closes mid-wizard, the admin resumes from the last completed step on next login
**And** each step completion emits a domain event `onboarding.wizard.step_completed` with `{ tenantId, step, stepName, timestamp }` for future adoption analytics (Epic 13)

### Story 10.2: Dados de Demonstração (Seed)

As a Admin Tenant (novo),
I want pre-populated demo data available in my tenant when I first access the platform,
So that I can explore features like groups, trails, meetings, and the pastoral radar with realistic (fictional) data before adding real members.

**Acceptance Criteria:**

**Given** a new tenant is provisioned (Epic 3)
**When** the provisioning process completes
**Then** an idempotent seed function `seedDemoData(tenantId)` is called automatically
**And** the seed creates fictional demo data scoped to this tenant:
  - 1 group: "Grupo Alpha"
  - 1 leader: "Marcos Silva" (fictional, with `isDemoData: true` flag)
  - 3 participants with distinct semáforo states:
    - "Ana Costa" — green (100% meeting attendance, 80% trail progress)
    - "Pedro Santos" — yellow (60% attendance, 40% trail progress, declining trend)
    - "Maria Oliveira" — red (20% attendance, 10% trail progress, 2 missed meetings)
  - 1 trail: "Fundamentos da Fé" with 2 modules, 4 lessons (mix of video stubs and rich text)
  - Trail progress records for each demo participant matching their semáforo state
  - 1 past meeting with presence data in PostgreSQL (`meeting_telemetry` table from Epic 5) simulating 2/3 participants present — NOT in Redis (Redis is for live data only and would be lost on restart)
  - 3 pastoral care actions: 1 completed (Ana), 1 pending (Pedro), 1 urgent (Maria)

**Prerequisite:** Epics 4 (groups), 5 (meetings), 8 (trails) must be complete — seed creates records in tables from all three epics.

**Given** demo data exists in the tenant
**When** the admin navigates to any feature area (groups, trails, radar)
**Then** demo data is displayed with a subtle `DemoOverlay` badge: "Dados de demonstração" with a dismiss button
**And** demo records are visually distinguished (e.g., faded opacity or dotted border) from real data

**Given** the admin starts adding real data
**When** the admin creates their first REAL group (not demo)
**Then** a nudge is displayed: "Você já tem dados reais! Deseja remover os dados de demonstração?" with "Remover agora" and "Manter por enquanto" options
**And** the admin can also remove all demo data at any time via "Limpar dados de demonstração" button in Settings
**And** this button calls `DELETE /api/v1/onboarding/demo-data` which removes all records with `isDemoData: true` for this tenant
**And** a confirmation dialog warns: "Isso removerá todos os dados de exemplo. Seus dados reais não serão afetados."

**Given** the seed function runs
**When** it is called multiple times (e.g., re-provisioning, testing)
**Then** it is idempotent — uses `upsert` to prevent duplicate demo records
**And** all demo records use UUID v7 with `isDemoData: true` flag for easy bulk cleanup
**And** the seed is also available as a Turborepo pipeline command: `pnpm turbo db:seed` (for dev/testing environments)

### Story 10.3: Importação CSV — Upload, Preview & Validação

As a Admin/Líder,
I want to upload a CSV file with participant data and preview it with inline validation before importing,
So that I can bulk-add members to my groups efficiently while catching data errors before they enter the system.

**Acceptance Criteria:**

**Given** I navigate to group management or a dedicated "Importar Participantes" page
**When** the import wizard loads (Step 1: Upload)
**Then** a `FileUploadZone` component is displayed with:
  - Drag & drop area with visual feedback (border highlight on drag-over)
  - "Selecionar arquivo" button as fallback
  - Accepted formats: `.csv` and `.xlsx` (max 5MB)
  - "Baixar template" link that downloads a CSV template with expected columns: `nome`, `email`, `grupo` (optional — defaults to current group), `papel` (optional — defaults to `participante`)
**And** on file selection, the file is parsed client-side (no upload yet) and row count is displayed: "42 linhas detectadas"
**And** the client-side parser auto-detects file encoding (UTF-8, ISO-8859-1, Windows-1252) and normalizes to UTF-8 before preview — critical for Brazilian CSVs exported from Excel where names like "João" and "Conceição" use legacy encoding
**And** XLSX parsing uses a dynamically imported library (`next/dynamic` / `import()`) to avoid bundling the ~300KB parser in the main chunk — loaded only when the user selects an .xlsx file

**Given** the file is parsed (Step 2: Preview & Validation)
**When** the preview screen loads
**Then** a `CSVPreviewTable` component displays the first 10 rows with all columns
**And** inline auto-validation highlights errors per cell:
  - 🔴 Critical (blocks import): invalid email format, duplicate email within file, duplicate email already in tenant (checked via `GET /api/v1/users/check-emails` batch endpoint)
  - 🟡 Warning (allows import): optional field empty (e.g., grupo not specified)
**And** a validation summary counter is displayed: "{N} válidos, {M} com erro"
**And** the "Próximo" button is disabled while any 🔴 critical errors exist

**Given** critical errors exist (Step 3: Error Resolution)
**When** the error resolution screen loads
**Then** a `ValidationErrorList` component groups errors by type (e.g., "3 e-mails inválidos", "2 e-mails duplicados")
**And** each error row supports inline editing: I can correct the email directly in the table
**And** each error row has an "Ignorar esta linha" option to skip it from import
**And** after resolving all 🔴 errors (via edit or ignore), the "Próximo" button is enabled
**And** re-validation runs automatically after each inline edit

**Given** the file is very large
**When** more than 500 rows are detected
**Then** only the first 10 rows are shown in preview, with a note: "Mostrando 10 de {N} linhas. Todas serão validadas."
**And** validation of all rows happens in the background and the summary counter updates progressively

### Story 10.4: Importação CSV — Confirmação & Processamento

As a Admin/Líder,
I want to confirm and execute the CSV import with a clear summary of results,
So that I know exactly how many participants were imported, which ones failed, and can take action on failures.

**Acceptance Criteria:**

**Given** all critical errors are resolved in Step 3
**When** I advance to Step 4 (Confirmation)
**Then** a summary is displayed:
  - Total rows: {N}
  - To be imported: {M} (valid rows)
  - Ignored: {K} (rows marked as ignore)
  - Group assignment: which group(s) will receive the new participants
**And** a "Confirmar Importação" button submits the data

**Given** I click "Confirmar Importação"
**When** the import is submitted via `POST /api/v1/groups/:groupId/members/import` with the validated data
**Then** for datasets ≤ 100 rows, the import is processed synchronously and the result is returned immediately (status 201)
**And** for datasets > 100 rows, the import is processed asynchronously via BullMQ job in `queue:csv-import` and the API returns 202 with `{ "jobId": "<uuid>" }` — client polls `GET /api/v1/import/jobs/:jobId` for status (same pattern as Story 8.7)

**Given** the import completes (sync or async)
**When** results are available
**Then** an `ImportResultSummary` component displays:
  - "✅ {N} importados com sucesso"
  - "⚠️ {M} ignorados" (with reason per row, expandable)
  - "❌ {K} falharam" (with error per row, e.g., "e-mail já cadastrado em outro tenant")
**And** for each successfully imported participant:
  - If the email is new to the platform: a user account is created and added as `participante` to the specified group
  - If the email already exists in ANOTHER tenant (FR03 multi-tenant): the user is NOT auto-linked. Instead, an invite is sent and the user must ACCEPT before being added to this tenant (consent requirement — cannot silently add someone to a new tenant)
  - If the email already exists in THIS tenant: the row is marked as "já existente" (not error, not re-imported)
  - An invite email is enqueued via BullMQ (stub in dev, same pattern as Epic 4 Story 4.3)

**Given** the import includes participants for multiple groups
**When** the CSV has a `grupo` column with different group names
**Then** participants are distributed to their respective groups (groups must already exist in the tenant)
**And** if a group name doesn't match any existing group, those rows are marked as ❌ failed with message: "Grupo '{name}' não encontrado no tenant"

**Given** the import is complete
**When** I want to review what was imported
**Then** a "Baixar relatório" link downloads a CSV with import results: original data + status column (imported/ignored/failed) + error detail
**And** the import event is recorded in the audit log (Epic 9, Story 9.3) with: action `import`, resource `members`, resourceId `groupId`, metadata `{ totalRows, imported, ignored, failed }`
**And** a domain event `onboarding.csv_import.completed` is emitted with `{ tenantId, groupId, totalRows, imported, ignored, failed, timestamp }` for future adoption analytics (Epic 13)

**Given** edge cases
**When** the CSV has no valid rows after error resolution
**Then** the "Confirmar Importação" button is disabled with message: "Nenhuma linha válida para importar"
**And** when all rows are duplicates of existing members, the result shows "0 importados, {N} já existentes" (not treated as error)

---

