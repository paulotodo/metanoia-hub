## Epic 7: Onboarding Mínimo

Tela de boas-vindas, mensagens de erro acionáveis, dados de demonstração realistas que populam o Radar com cenários ficcionais para validação imediata de valor.

### Story 7.1: Tela de Boas-Vindas Personalizada

As a usuário (Admin/Líder/Participante),
I want a personalized welcome screen on my first access,
So that I understand the platform and know exactly what to do next.

**Acceptance Criteria:**

**Given** I am logging in for the first time
**When** the system detects `onboarding_completed_at` is `null` on my user record (column: `onboarding_completed_at` timestamp nullable in `users` table)
**Then** I see a welcome screen personalized for my role with a placeholder pastoral illustration (shepherd icon or similar) and exactly 1 primary CTA button:
- Admin Tenant: "Bem-vindo! Crie seu primeiro grupo e convide participantes" — CTA: "Criar Grupo"
- Líder: "Bem-vindo! Seu grupo está pronto. Explore o Radar Pastoral" — CTA: "Abrir Radar"
- Participante: "Bem-vindo! Veja seus grupos e comece a participar" — CTA: "Ver Meus Grupos" (not trilhas — Epic 8 not yet available)

**Given** I complete the onboarding flow (click CTA and reach destination)
**When** the onboarding is marked complete
**Then** `onboarding_completed_at` is set to current timestamp (not boolean — enables analytics on when users onboard)
**And** the welcome screen is not shown again on subsequent logins

**Given** the onboarding flow is timed
**When** benchmarked
**Then** Admin completes first group creation ≤ 10 min (NFR-X1), Líder reaches dashboard ≤ 3 min (NFR-X2)
**And** all text uses vocabulary from `vocabulary.ts` (Epic 6, Story 6.1)

### Story 7.2: Dados de Demonstração Realistas

As a novo tenant/líder,
I want realistic demo data pre-populated in my workspace,
So that I can see the Radar Pastoral in action and understand the platform value immediately.

**Acceptance Criteria:**

**Given** a new tenant is provisioned or the admin selects "Quero ver dados de exemplo" during onboarding
**When** the demo seed runs (`pnpm seed:demo`)
**Then** a dedicated demo tenant is created with `is_demo: true` flag on the `tenants` table (not per-record flags — cleanup = delete tenant with cascade)
**And** the seed is idempotent — running 2x does not duplicate data (checks if demo tenant exists before creating)

**Given** demo data is seeded
**When** the data is created
**Then** it includes:
- 1 grupo fictício ("Grupo Esperança") with ~10 participants with realistic Brazilian names (ex: "Maria Santos", "João Oliveira", "Ana Costa") and avatar placeholders with initials
- 3 historical meetings with varied attendance (integral, parcial, ausente) and realistic timestamps (last 3 weeks, not generic dates)
- Radar status distributed: ~4 verde, ~3 amarelo, ~2 vermelho, ~1 novo
- Varied trends: melhorando, estável, declínio
- 2 pastoral care actions registered
- 1 active alert (participant turned vermelho)
**And** all data uses UUID v7 and realistic timestamps
**And** demo data is RLS-isolated (does not contaminate other tenants)

**Given** the demo is seeded and a Líder logs in
**When** they complete onboarding
**Then** a guided demo walkthrough starts: Radar overview → Click a participant → View timeline → Register a care action (tour with 4 steps, skippable)
**And** the líder sees value immediately (pre-mortem gate validated)

### Story 7.3: Mensagens de Erro Acionáveis

As a usuário,
I want clear and actionable error messages,
So that I understand what went wrong and how to fix it.

**Acceptance Criteria:**

**Given** the platform needs consistent error messages
**When** errors are displayed
**Then** all user-facing error messages are centralized in `apps/web/messages/pt-BR.json` with standardized keys: `error.{context}.{action}` (ex: `error.group.create.limit_reached`, `error.auth.permission_denied`)
**And** the backend returns error keys that the frontend maps to localized messages

**Given** an error occurs
**When** the message is displayed
**Then** each error includes: what happened + what to do:
- Permission: "Você não tem permissão para esta ação. Fale com o administrador do seu grupo."
- Plan limit: "Limite do plano atingido (3/3 grupos). Fale com o administrador para upgrade."
- Not found: "Recurso não encontrado. Verifique o endereço ou volte ao início."
**And** no error displays stack traces or technical codes to the user (API format: `{ statusCode, error, message, details? }`)
**And** vocabulary pastoral is used where applicable (via `vocabulary.ts`)

**Given** a network error occurs
**When** the request fails
**Then** a skeleton loading state is shown while retrying with exponential backoff (1s, 2s, 4s — 3 attempts)
**And** after 3 failed attempts, a friendly error message replaces the skeleton: "Não foi possível carregar. Verifique sua conexão e tente novamente." with a retry button

**Given** an unhandled error occurs anywhere in the app
**When** the error propagates
**Then** a global error boundary (`error.tsx` per route segment + root fallback) catches it and displays a friendly message instead of a white screen
**And** the error is reported to Sentry (Epic 1 observability)

---

