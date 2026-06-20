# Spec: Templates de Conteúdo Reutilizáveis (FR42)

**Feature:** templates-conteudo  
**Epic:** 13 — Relatórios Avançados & Analytics (Story 13.5)  
**Prioridade:** Release 2 — implementável independentemente de 13.1–13.4  
**Status:** specify  
**Authored:** 2026-06-20  

---

## Resumo

Permitir que admins de tenant criem, gerenciem e reutilizem templates de estrutura de trilhas de discipulado. Um template é um **snapshot imutável da estrutura** de uma trilha (módulos + lições: apenas nome, ordem e tipo — sem conteúdo real). Plataforma fornece 3 templates pré-carregados legíveis por todos os tenants. Tenants podem criar seus próprios templates a partir de trilhas existentes, com versionamento automático.

---

## User Stories

### US1 — Seed de Templates de Plataforma

**Como** operador da plataforma  
**Quero** que o sistema forneça templates de estrutura pré-construídos acessíveis a todos os tenants  
**Para que** admins possam iniciar trilhas baseadas em estruturas pastoralmente validadas

**Critérios de Aceite:**
- O seed popula 3 registros `ContentTemplate` com `scope = 'platform'` e `tenant_id = NULL`:
  - "Discipulado Básico" — 4 módulos, 12 lições
  - "Estudo Bíblico Temático" — 3 módulos, 9 lições
  - "Acolhimento de Novos Membros" — 2 módulos, 6 lições
- Cada template contém apenas estrutura (`structure` JSONB com nomes de módulos/lições, ordem e tipo de lição); nenhum campo de conteúdo real
- O seed é **idempotente** (pode rodar 2x no CI sem duplicar registros): usa upsert com chave natural ou `ON CONFLICT DO NOTHING`
- Templates de plataforma são visíveis para qualquer tenant autenticado via RLS

---

### US2 — Criar Template a Partir de Trilha Existente

**Como** Admin Tenant  
**Quero** salvar a estrutura de uma trilha como template reutilizável  
**Para que** outras trilhas possam ser iniciadas a partir dessa estrutura comprovada

**Critérios de Aceite:**
- `POST /api/v1/templates` body `{ sourceTrailId, name, description }` → 201
- O sistema lê todos os módulos e lições da trilha origem (excluindo soft-deleted)
- Snapshot captura por módulo: `name`, `order`, `lessonAccessMode`
- Snapshot captura por lição: `name`, `order`, `contentType`
- Campos de conteúdo são explicitamente `null` no snapshot: `contentUrl`, `contentBody`, `originalName`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`
- Se é a 1ª vez que `sourceTrailId` gera um template → `version = 1`
- Chamadas subsequentes com o mesmo `sourceTrailId` → `version = MAX(version) + 1`
- O registro é `scope = 'tenant'`, `tenant_id = <tenant atual>` (via RequestContext/AsyncLocalStorage)
- Guard: `@Roles('admin_tenant')`; resposta 403 para outros papéis
- Resposta inclui `{ data: ContentTemplateResponse }` com todos os campos, incluindo `structure`

---

### US3 — Listar, Visualizar e Gerenciar Templates

**Como** Admin Tenant  
**Quero** gerenciar a biblioteca de templates (plataforma + meus templates)  
**Para que** eu possa explorar, editar e remover templates conforme necessário

**Critérios de Aceite:**
- `GET /api/v1/templates?scope=all` retorna templates de plataforma + templates do tenant (filtrados por RLS)
  - Parâmetros opcionais: `scope` (`platform` | `tenant` | `all`), `search` (busca por `name`), `sort` (`name_asc` | `name_desc` | `created_asc` | `created_desc`)
  - Paginação via `{ data: [], meta: { page, limit, total } }`
  - Apenas a **versão mais recente** de cada `sourceTrailId` por padrão
- `GET /api/v1/templates/:id` retorna detalhes com `structure` completo (árvore módulos → lições)
- `PATCH /api/v1/templates/:id` — editar `name` e/ou `description`; permitido apenas para templates `scope = 'tenant'` do tenant corrente; plataforma retorna 403
- `DELETE /api/v1/templates/:id` — soft delete (`deleted_at = now()`); permitido apenas para templates `scope = 'tenant'` do tenant corrente; plataforma retorna 403; sem cascade em trilhas já criadas
- `GET /api/v1/templates/:id/versions` — lista todas as versões de um `sourceTrailId` (ordenado por `version ASC`)

---

### US4 — Usar Template para Criar Nova Trilha

**Como** Admin Tenant  
**Quero** criar uma nova trilha a partir de um template  
**Para que** eu parta de uma estrutura pronta e foque no conteúdo

**Critérios de Aceite:**
- `POST /api/v1/trails` aceita body alternativo `{ templateId, name, groupId }` (extends fluxo existente)
- O sistema lê `ContentTemplate.structure` e instancia:
  - 1 registro `Trail` com `name` fornecido, status `draft`, sem link ao template
  - N registros `Module` replicando `name`, `order`, `lessonAccessMode` do template
  - M registros `Lesson` por módulo, replicando `name`, `order`, `contentType`; todos os campos de conteúdo com `null`
- `tenant_id` em todos os registros vem de RequestContext (nunca como parâmetro)
- IDs gerados com `uuidv7()` (nunca `@default(uuid())`)
- A trilha criada **não tem referência** ao template (cópia independente — edições no template não propagam)
- Se `groupId` fornecido → cria `GroupTrail` associando a trilha ao grupo (mesma lógica de criação existente)
- Resposta 201 `{ data: TrailResponse }` — mesma forma que criação normal de trilha
- Erros: 404 se `templateId` não encontrado, 403 se template de outro tenant (não plataforma)

---

### US5 — Interface de Biblioteca de Templates

**Como** Admin Tenant  
**Quero** uma página dedicada para explorar e usar templates  
**Para que** eu tenha visibilidade clara das opções disponíveis antes de criar uma trilha

**Critérios de Aceite:**
- Rota: `/app/admin/templates` (área autenticada, Server Component padrão)
- Lista exibe: nome, descrição, escopo (plataforma/tenant), versão, data de criação, contagem de módulos/lições
- Templates de plataforma marcados como "somente leitura" (sem botões Editar/Excluir)
- Busca por nome e filtro por escopo via TanStack Query (Client Component aninhado)
- Preview do template: árvore de estrutura (módulos → lições com tipo)
- Botão "Usar Template" → modal ou redirect para criar trilha com `templateId` preenchido
- Botão "Salvar como Template" na página de detalhe de trilha existente
- Link "Histórico de versões" em templates com múltiplas versões
- Acessibilidade: nasce acessível; reusar `FormField` e classe `text-secondary` (não `text-muted-foreground` — tech debt a11y EP12)

---

## Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| FR-01 | Tabela `content_templates` com campos: `id` (UUIDv7), `tenant_id` (UUID nullable), `scope` (enum `platform`/`tenant`), `source_trail_id` (UUID nullable, FK→trails), `name` (varchar 255), `description` (varchar 1000 nullable), `version` (int default 1), `structure` (JSONB), `created_by` (UUID), `created_at`, `deleted_at` |
| FR-02 | `tenant_id = NULL` para templates de plataforma; `tenant_id = <tenant>` para templates de tenant |
| FR-03 | RLS: `tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` |
| FR-04 | UNIQUE INDEX em `(source_trail_id, version)` como chave lógica de versionamento |
| FR-05 | `@@map("content_templates")` no schema Prisma |
| FR-06 | Seed idempotente de 3 templates de plataforma (estrutura apenas) |
| FR-07 | `POST /api/v1/templates` snapshot da estrutura: módulos+lições com `name`, `order`, `contentType`; campos de conteúdo `null` |
| FR-08 | Versionamento automático: `MAX(version) + 1` por `source_trail_id` |
| FR-09 | `GET /api/v1/templates` com filtros `scope`, `search`, `sort`; padrão mostra versão mais recente por `source_trail_id` |
| FR-10 | `GET /api/v1/templates/:id` retorna estrutura completa |
| FR-11 | `PATCH /api/v1/templates/:id` — apenas `name`/`description`; bloqueado para templates de plataforma (403) |
| FR-12 | `DELETE /api/v1/templates/:id` — soft delete; bloqueado para plataforma (403); sem cascade |
| FR-13 | `GET /api/v1/templates/:id/versions` — histórico de versões por `source_trail_id` |
| FR-14 | `POST /api/v1/trails` com `templateId` instancia Trail + Modules + Lessons com conteúdo vazio |
| FR-15 | Trilha criada de template não tem referência ao template (cópia independente) |
| FR-16 | Guard `@Roles('admin_tenant')` em todos os endpoints de template |
| FR-17 | IDs gerados via `uuidv7()` em todos os novos registros |
| FR-18 | Migration timestamp `>= 20260628000000` (última: `20260627000000_13-4`) |
| FR-19 | Schemas Zod em `packages/types/src/content/template.ts` com snapshot tests |
| FR-20 | UI `/app/admin/templates` acessível (FormField, text-secondary, aria labels) |

---

## Modelo de Dados

### Tabela: `content_templates`

```
id              UUID (PK, UUIDv7)
tenant_id       UUID nullable (FK→tenants, NULL=plataforma)
scope           ENUM('platform', 'tenant') NOT NULL
source_trail_id UUID nullable (FK→trails — trilha de origem do snapshot)
name            VARCHAR(255) NOT NULL
description     VARCHAR(1000) nullable
version         INT NOT NULL DEFAULT 1
structure       JSONB NOT NULL
created_by      UUID NOT NULL (FK→users)
created_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ nullable (soft delete)

UNIQUE INDEX: (source_trail_id, version)
INDEX: (tenant_id)
INDEX: (scope)
INDEX: (source_trail_id)
```

### Estrutura do campo `structure` (JSONB)

```json
{
  "modules": [
    {
      "name": "string (Module.name)",
      "order": 1,
      "lessonAccessMode": "free|sequential",
      "lessons": [
        {
          "name": "string (Lesson.name)",
          "order": 1,
          "contentType": "LessonContentType enum value"
        }
      ]
    }
  ]
}
```

**Mapeamento dos campos do schema Prisma:**

| Campo do snapshot | Campo real em Module/Lesson | Campos explicitamente NULLOS/omitidos |
|-------------------|-----------------------------|---------------------------------------|
| `module.name` | `Module.name` | — |
| `module.order` | `Module.order` | — |
| `module.lessonAccessMode` | `Module.lessonAccessMode` | — |
| `lesson.name` | `Lesson.name` | — |
| `lesson.order` | `Lesson.order` | — |
| `lesson.contentType` | `Lesson.contentType` | — |
| — | `Lesson.contentUrl` | **null** no snapshot |
| — | `Lesson.contentBody` | **null** no snapshot |
| — | `Lesson.originalName` | **null** no snapshot |
| — | `Lesson.mimeType` | **null** no snapshot |
| — | `Lesson.sizeBytes` | **null** no snapshot |
| — | `Lesson.uploadedBy` | **null** no snapshot |
| — | `Lesson.uploadedAt` | **null** no snapshot |
| — | `Lesson.tags` | `[]` (array vazio) ao instanciar |

**Nota de design:** `contentType` é obrigatório em `Lesson` (enum não-nullable). O template preserva esse campo para garantir consistência tipológica ao instanciar a trilha. Admins preencherão o conteúdo real depois, mas o tipo já estará definido.

---

## Arquitetura e Localização dos Artefatos

| Artefato | Caminho |
|----------|---------|
| Migration | `apps/api/prisma/migrations/20260628000000_13-5-add-content-templates/migration.sql` |
| Prisma model | `apps/api/prisma/schema.prisma` — model `ContentTemplate` |
| NestJS module | `apps/api/src/content/templates/` (bounded context content) |
| Seed | `apps/api/prisma/seed/platform-templates.ts` |
| Shared types | `packages/types/src/content/template.ts` |
| Frontend page | `apps/web/app/(authenticated)/admin/templates/page.tsx` |
| Trail creation extension | `apps/api/src/content/content.service.ts` — estender `createTrail` |
| Trail controller | `apps/api/src/content/content.controller.ts` — `POST /api/v1/trails` |

**Padrão arquitetural:** content é core domain. Templates ficam em `apps/api/src/content/templates/` como subdiretório do bounded context existente. Service direto com Prisma (sem repositório separado) é suficiente dado escopo. O `ContentModule` já existente deve importar o novo `TemplatesModule`.

---

## Padrão RLS para `content_templates`

```sql
ALTER TABLE "content_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "content_templates"
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

**Padrão confirmado** a partir das migrations existentes (ex: `20260414120000_add_invites_and_tenant_rls`). O `tenant_id IS NULL` cobre templates de plataforma visíveis a todos. É o mesmo padrão usado em `mv_refresh_log` e `evasion_job_log` (onde NULL indica registro de sistema/plataforma sem tenant específico).

---

## Testes Requeridos

| Tipo | Cenário |
|------|---------|
| Integration | Criar template de trilha com `contentUrl`/`contentBody` preenchidos → verificar snapshot com esses campos `null` |
| Integration | Usar template → Trail + Modules + Lessons criados com estrutura correta e conteúdo vazio |
| Integration | Salvar template 2x da mesma trilha → 2 registros com `version=1` e `version=2` |
| RLS | Admin tenant A não vê templates do tenant B; ambos veem templates de plataforma |
| RLS | Seed roda 2x → sem duplicatas (idempotência) |
| Unit | Versionamento: `getNextVersion(sourceTrailId)` retorna 1 na 1ª chamada, N+1 nas seguintes |
| Unit | Schemas Zod + snapshot tests em `packages/types` |
| E2E | Fluxo completo: busca/filtra biblioteca → preview → cria trilha |
| Edge | Template de trilha sem módulos (0 módulos) |
| Edge | Tentativa de editar/excluir template de plataforma → 403 |

---

## Clarificações para Fase Clarify

As seguintes questões necessitam resolução antes do plano:

**C1 — `estimatedDurationMinutes` no snapshot**  
`Lesson.estimatedDurationMinutes` é informação estrutural (duração estimada) — não conteúdo real. Deve ser capturado no snapshot? Favorece UX de preview (exibe "~X min"). Impacto: adicionar campo ao JSONB e ao schema Zod.

**C2 — `groupId` já existe em `CreateTrailRequest`?**  
A extensão `POST /api/v1/trails { templateId, name, groupId }` precisa saber se `groupId` já está no tipo `CreateTrailRequest` atual ou se precisa ser adicionado. Isso determina se é uma extensão do tipo ou uma adição de campo.

**C3 — Default do parâmetro `scope` em `GET /api/v1/templates`**  
Se `?scope` for omitido, qual é o default: `all` (plataforma + tenant) ou apenas `tenant`? A AC diz que `?scope=all` é possível, mas a UI "Biblioteca" provavelmente quer exibir ambos por padrão.
