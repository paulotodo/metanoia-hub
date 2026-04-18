## Epic 4: Grupos, Membros & Convites

Admin/Líder cria grupos, vincula participantes e líderes, envia convites (email/link), associa trilhas a grupos. Participante vê seus grupos. Líder vê lista de membros com status.

### Story 4.1: CRUD de Grupos

As a Admin/Líder,
I want to create, edit and delete groups within my tenant,
So that I can organize participants into discipleship groups.

**Acceptance Criteria:**

**Given** I am authenticated as Admin or Líder
**When** I create a new group with name and description
**Then** the group is created with the schema: `id` (UUID v7), `tenant_id`, `name` (required), `description` (optional), `status` (enum: `active`, `archived`; default `active`), `created_by` (UUID), `created_at`, `updated_at`
**And** RLS policies ensure the group is only visible within the tenant
**And** the Guard do Epic 3 bloqueia criação se o limite de grupos do plano for atingido (grupos com status `archived` não contam no limite)
**And** the API returns 201 with the created group data

**Given** I am viewing a group I have access to
**When** I edit the group name or description
**Then** the changes are persisted and `updated_at` is refreshed
**And** the API returns 200 with the updated group data

**Given** I want to remove a group
**When** I delete the group
**Then** the group is soft-deleted (status changed to `archived`), not physically removed
**And** archived groups retain their members for historical/pastoral reference
**And** the API returns 200 with confirmation

**Given** groups exist in my tenant
**When** I list groups
**Then** I see a paginated list of active groups (archived excluded by default, filterable)
**And** RLS tests include JOINs and subqueries cross-tenant to verify isolation

### Story 4.2: Vincular Membros & Líderes a Grupo

As a Admin/Líder,
I want to add and remove participants and leaders from a group,
So that each group has the correct members with appropriate roles.

**Acceptance Criteria:**

**Given** I am Admin or Líder of a group
**When** I add a participant or leader to the group
**Then** a record is created in `group_members` with: `id` (UUID v7), `group_id`, `user_id`, `tenant_id`, `role` (enum: `participant`, `leader`), `status` (enum: `active`, `invited`, `inactive`), `joined_at`, `created_at`
**And** `UNIQUE(group_id, user_id)` constraint prevents duplicates — duplicate attempt returns 409 Conflict with descriptive message
**And** the Guard do Epic 3 bloqueia adição se o limite de membros/grupo do plano for atingido

**Given** I am viewing the group member list as Líder
**When** I access the members area
**Then** I see the list of members with name, role (participant/leader), status (active/invited/inactive) and join date (FR25)

**Given** I try to remove the last leader of a group
**When** I submit the removal request
**Then** the API returns 422 with message "Cannot remove the last leader of a group"
**And** the leader remains linked to the group

**Given** I remove a non-last-leader member
**When** I submit the removal request
**Then** the member is unlinked from the group
**And** RLS tests verify cross-group isolation (members of group A cannot see members of group B)

### Story 4.3: Convite via E-mail e Link

As a Admin/Líder,
I want to invite participants via email or shareable link,
So that new members can join groups without manual provisioning.

**Acceptance Criteria:**

**Given** I am Admin or Líder of a group
**When** I generate an invite link for the group
**Then** a unique token is created using `crypto.randomBytes(32).toString('base64url')` (not UUID v7, to prevent enumeration)
**And** the invite is stored in `group_invites` with: `id` (UUID v7), `group_id`, `tenant_id`, `token` (unique), `email` (nullable), `status` (enum: `pending`, `accepted`, `expired`, `revoked`), `expires_at` (7 days from creation), `created_by`, `created_at`

**Given** I send an invite via email
**When** the invite is submitted with a target email address
**Then** the email is enqueued via BullMQ job (stub implementation: logs to console in dev, real provider integration deferred to Epic 12)
**And** rate limit of 50 invites/hour per tenant is enforced via Redis `INCR` with key `rate:invite:{tenantId}` and TTL 3600s

**Given** a person receives an invite link
**When** they access the link
**Then** they are directed to register/login and automatically linked to the group upon authentication
**And** the invite status changes to `accepted`

**Given** I want to cancel a pending invite
**When** I revoke the invite
**Then** the invite status changes to `revoked` and the link becomes invalid
**And** attempting to use a revoked or expired link returns a clear error message

### Story 4.4: Associar Trilhas a Grupo

As a Admin/Líder,
I want to associate content trails to a group,
So that the group's participants have access to the assigned learning content.

**Acceptance Criteria:**

**Given** I am Admin or Líder of a group
**When** I associate one or more trails to the group
**Then** records are created in `group_trails` with: `group_id`, `trail_id`, `tenant_id`, `assigned_by` (UUID), `assigned_at` (timestamp)
**And** the endpoint accepts an array of `trail_ids` for bulk association
**And** if any `trail_id` does not exist, the API returns 422 with the list of invalid IDs (not 404)
**And** RLS ensures associations are isolated per tenant

**Given** I want to remove a trail association
**When** I unlink a trail from the group
**Then** the `group_trails` record is deleted and the API returns 204

**Given** trails do not exist yet (Epic 8)
**When** integration tests run for this story
**Then** tests use seed data with fictional trail records to validate the association flow end-to-end

### Story 4.5: Participante Visualiza Seus Grupos

> **Correction (2026-04-18, WDS Cenário 06 Session 0):** endpoint + route renamed to align with page spec 06.4 + architecture UX-DR22–25. Previous draft used `GET /api/v1/groups/me` + `/groups/me`. Canonical version now uses `GET /api/v1/participant/groups` + `/app/consumo/grupos`. See `_bmad-output/implementation-artifacts/4-5-participante-visualiza-seus-grupos.md` for the full updated story.

As a Participante,
I want to see a list of groups I belong to,
So that I can navigate to my discipleship groups easily.

**Acceptance Criteria:**

**Given** I am authenticated as Participante
**When** I access `GET /api/v1/participant/groups`
**Then** I see a list of my groups — each item carries the group name, the leader's first name, and the next meeting summary (if any)
**And** the response envelope is `{ data: [...], meta: { firstVisit: boolean } }` — no pagination meta in MVP

**Given** I do not belong to any group
**When** I access `GET /api/v1/participant/groups`
**Then** the API returns 200 with `data: []` and `meta.firstVisit` (not 404)

**Given** I belong to groups in my tenant
**When** I access the endpoint
**Then** RLS guarantees I only see groups where I am a member — no cross-tenant or cross-group leakage

**Given** I am authenticated as Participante and I open a specific group
**When** I access `GET /api/v1/participant/groups/:id`
**Then** I see the group detail with leader (first name only), recurrence, next meeting, and other participants (first name only — no avatars, no contact)

