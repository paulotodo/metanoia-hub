# Plan — a11y-conteudo-multimidia (Story 15.5)
# Conteúdo Multimídia Acessível — Follow-up Epic 15

**Status**: rascunho  
**Versão**: 1.0.0  
**Data**: 2026-06-25  

---

## 1. Visão Geral

Implementação full-stack de 3 frentes paralelas (zero acoplamento entre A, B e C):

| Frente | Escopo | Risco |
|--------|--------|-------|
| A — Lesson Viewer | Rota `/aulas/[lessonId]` + `lesson-viewer.tsx` | Baixo (FE puro) |
| B — Plyr | Player de vídeo acessível com i18n PT-BR | Baixo (lib bem estabelecida) |
| C — Governança alt-text | Migration + validador + endpoint admin + página admin | Médio (migration em Postgres local) |

**Sequência de execução**: C → endpoint+admin-FE → A → B → gates finais.
Isola o risco da migration (Frente C) na primeira fase antes de qualquer FE.

---

## 2. Decisões Arquiteturais (clarify)

| ID | Decisão | Referência |
|----|---------|-----------|
| dec-007 | SC `page.tsx` busca dados via fetch nativo; `lesson-viewer.tsx` recebe como props | CLAUDE.md, P1 |
| dec-008 | Módulo NestJS novo `admin-accessibility/` (controller+service+repository) | spec FR-014, P2 |
| dec-009 | `AltTextValidator` síncrono in-memory (boolean, não Promise) | spec FR-012, P3 |
| dec-012 | Guard `@Roles(Role.ADMIN_TENANT)` somente — NFR-S2 | spec NFR-S2, P4 |
| dec-013 | CSS Plyr importado no layout global autenticado | spec Frente B, P5 |

---

## 3. Arquitetura por Frente

### 3.1 Frente C — Backend (Migration + Validador + Endpoint + Admin FE)

#### 3.1.1 Migration Prisma

**Arquivo**: `apps/api/prisma/migrations/20260625000000_15-5-alt-text-governance/migration.sql`

```sql
ALTER TABLE "lessons"
  ADD COLUMN "has_missing_alt_text" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "lessons_tenant_id_has_missing_alt_text_idx"
  ON "lessons" ("tenant_id", "has_missing_alt_text");
```

**Schema Prisma** (`apps/api/prisma/schema.prisma`, modelo Lesson — após `updatedAt`):
```prisma
hasMissingAltText Boolean @default(false) @map("has_missing_alt_text")
```

**RLS**: campo `has_missing_alt_text` herda `rls_lessons_tenant_isolation` existente
(política `USING (tenant_id = current_setting('app.tenant_id')::uuid)` já cobre todo SELECT/UPDATE).
Rodar RLS test 2× (idempotente): `pnpm --filter @metanoia/api exec prisma migrate dev`, depois
`apps/api/test/rls/lessons-rls.spec.ts`.

#### 3.1.2 AltTextValidator

**Arquivo**: `apps/api/src/content/alt-text.validator.ts`

```typescript
/**
 * AltTextValidator — parser síncrono de <img> sem alt em contentBody HTML.
 * Detecção: img tag sem atributo alt ou com alt="" (vazio).
 * Síncrono (boolean) conforme FR-012 e CA-005.1 (consistência imediata).
 */
export class AltTextValidator {
  /** Retorna true se houver ≥1 <img> sem alt ou com alt vazio no HTML. */
  static hasInvalidImgs(html: string | null | undefined): boolean {
    if (!html) return false;
    // Regex: <img tags que NÃO têm alt="non-empty-value"
    // Captura: <img...> sem alt, <img... alt=""> com alt vazio, <img... alt= sem valor
    const imgTagRegex = /<img\b[^>]*>/gi;
    const altWithValueRegex = /\balt\s*=\s*(?:"[^"]+"|'[^']+'|\S+)/i;
    let match: RegExpExecArray | null;
    while ((match = imgTagRegex.exec(html)) !== null) {
      if (!altWithValueRegex.test(match[0])) {
        return true;
      }
    }
    return false;
  }
}
```

**Integração em `ContentService`**:
- Após qualquer operação que toca `contentBody`, calcular:
  `hasMissingAltText: AltTextValidator.hasInvalidImgs(data.contentBody)`
- Passar para o repository (UPDATE `has_missing_alt_text`).

#### 3.1.3 Módulo `admin-accessibility/`

**Estrutura** (espelha `admin-users/`):
```
apps/api/src/admin-accessibility/
  admin-accessibility.controller.ts  # GET /api/v1/admin/accessibility-gaps
  admin-accessibility.service.ts     # listGaps(page, pageSize)
  admin-accessibility.repository.ts  # findLessonsWithMissingAlt()
  admin-accessibility.module.ts      # importa ContentModule ou PrismaModule
```

**Endpoint**: `GET /api/v1/admin/accessibility-gaps?page=1&pageSize=20`  
Guard: `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN_TENANT)`  
Resposta: `{ data: LessonAccessibilityGap[], meta: { total, page, pageSize } }`  
Isolamento: `tenant_id` via `RequestContext` (AsyncLocalStorage) — nunca parâmetro.

**Schema Zod** (`packages/types/src/content/accessibility.schema.ts`):
```typescript
export const LessonAccessibilityGapSchema = z.object({
  lessonId: z.string().uuid(),
  lessonName: z.string(),
  moduleName: z.string(),
  trailName: z.string(),
  tenantId: z.string().uuid(),
});
export const AccessibilityGapsResponseSchema = z.object({
  data: z.array(LessonAccessibilityGapSchema),
  meta: z.object({ total: z.number().int(), page: z.number().int(), pageSize: z.number().int() }),
});
```

**Seed demo** (`apps/api/prisma/seeds/demo-seed.ts`):
- 2 lessons com `contentBody` contendo `<img src="..." />` (sem alt) — UUID v7 fixo, `is_demo_data=true`.
- Idempotente: `upsert` por `id`.

#### 3.1.4 Página Admin FE

**Estrutura**:
```
apps/web/app/(authenticated)/app/admin/
  accessibility-gaps/
    page.tsx              # Server Component shell (verifica role via cookie/session)
    _components/
      accessibility-gaps-list.tsx  # Client Component (TanStack Query)
src/lib/api/hooks/
  use-accessibility-gaps.ts        # Hook TanStack Query
```

**Textos PT-BR** (`apps/web/messages/pt-BR.json`):
```json
"admin": {
  "accessibilityGaps": {
    "title": "Conteúdo com Acessibilidade Incompleta",
    "description": "Aulas com imagens sem texto alternativo (alt-text) detectadas automaticamente.",
    "empty": "Nenhuma aula com problemas de acessibilidade encontrada.",
    "columns": {
      "lesson": "Aula",
      "module": "Módulo",
      "trail": "Trilha"
    },
    "loading": "Carregando...",
    "error": "Erro ao carregar dados."
  }
}
```

---

### 3.2 Frente A — Lesson Viewer (FE)

**Estrutura** (nova rota Next.js App Router):
```
apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/
  aulas/
    [lessonId]/
      layout.tsx          # CSS scope (não precisa; Plyr CSS vai no layout global)
      page.tsx            # Server Component: busca dados da aula via fetch nativo
      lesson-viewer.tsx   # Client Component: switch por contentType
      lesson-viewer.spec.tsx
```

**`page.tsx`** (Server Component):
- Fetch `/api/v1/content/trails/{trailId}/modules/{moduleId}/lessons/{lessonId}` via fetch nativo.
- Busca também `nextLesson` (próxima aula/módulo por ordem+1) na mesma resposta ou fetch separado.
- Passa dados como props para `<LessonViewer>`.
- `<h1>` = nome da aula (para SEO e a11y).

**`lesson-viewer.tsx`** (Client Component):
```typescript
// Switch por contentType
switch (lesson.contentType) {
  case 'video':      return <PlyrVideoPlayer ... nextModuleButtonRef={...} />
  case 'rich_text':  return <RichTextContent contentBody={...} />
  case 'pdf_doc':    return <PdfViewer signedUrl={...} title={...} />
  case 'external_link': return <ExternalLinkView url={...} title={...} />
}
```

**Botão navegação** (`LessonNavigationButton`):
- "Próxima aula" se `nextLesson` no mesmo módulo.
- "Próximo módulo" se fim do módulo.
- "Concluir trilha" se fim da trilha.
- Ref ligado ao `nextModuleButtonRef` do `PlyrVideoPlayer` (foco automático pós-fim de vídeo).
- Aria-label descritivo; focus-ring; motion-safe em transições.

---

### 3.3 Frente B — Plyr Video Player (FE)

**Estrutura**:
```
apps/web/src/components/content/
  plyr-video-player.tsx       # Wrapper Plyr (substitui video-player.tsx no lesson viewer)
  plyr-video-player.spec.tsx  # Testes unitários (mock do Plyr)
```

**Instalação**: `pnpm --filter @metanoia/web add plyr`

**CSS**: importar em `apps/web/app/(authenticated)/layout.tsx`:
```typescript
import 'plyr/dist/plyr.css';
```

**PlyrVideoPlayer**:
- Props: `signedUrl`, `title?`, `onVideoEnded?`, `nextModuleButtonRef?`, `className?`.
- Reaproveitar `use-video-progress.ts` (attach `videoRef` ao elemento de vídeo interno do Plyr).
- i18n PT-BR via opções do Plyr:
  ```typescript
  i18n: {
    play: 'Reproduzir', pause: 'Pausar', mute: 'Mudo',
    unmute: 'Ativar som', volume: 'Volume',
    fullscreen: 'Tela cheia', exitFullscreen: 'Sair da tela cheia',
    seek: 'Avançar/Retroceder', seekLabel: '{currentTime} de {duration}',
    forward: 'Avançar 10 segundos', rewind: 'Retroceder 10 segundos',
  }
  ```
- Painel de atalhos (tecla "?"): `<dialog>` com `<table>` acessível, controlado por estado.
- `role="slider"` + `aria-valuenow`: fornecidos nativamente pelo Plyr (não adicionar markup manual).
- `onVideoEnded`: mover foco para `nextModuleButtonRef.current` se presente.

---

## 4. Validation Gates

### 4.1 Gates por fase

| Fase | Gate | Critério de bloqueio |
|------|------|---------------------|
| C-backend | Postgres local `db:migrate` | migration executa sem erro |
| C-backend | RLS test 2× | `lessons-rls.spec.ts` passa 2 vezes |
| C-backend | `pnpm --filter @metanoia/api test` | todos os testes passam |
| C-backend | `pnpm --filter @metanoia/types test` | schema Zod não quebra |
| Endpoint + boot | `pnpm turbo build` (api+web) | sem erro TypeScript |
| Endpoint + boot | `start:e2e` + `curl /api/health` | onModuleInit do novo controller OK |
| A (Lesson Viewer) | `pnpm --filter @metanoia/web test` | `lesson-viewer.spec.tsx` passa |
| B (Plyr) | `pnpm --filter @metanoia/web test` | `plyr-video-player.spec.tsx` passa |
| Gates finais | `pnpm turbo lint` | zero erros |
| Gates finais | 3 gates a11y hard (focus-ring, contrast, motion-safe) | zero violations |
| Gates finais | axe-core `pnpm --filter @metanoia/web exec playwright test axe` | zero serious/critical |

### 4.2 OWASP Gate (endpoint admin novo)

Superfície de ataque do `GET /api/v1/admin/accessibility-gaps`:

| OWASP | Risco | Mitigação |
|-------|-------|-----------|
| A01 — Broken Access Control | IDOR cross-tenant | `tenant_id` via `RequestContext`; RLS no Postgres |
| A01 — Broken Access Control | Escalada de privilégio | Guard `@Roles(Role.ADMIN_TENANT)` + `RolesGuard` |
| A07 — Auth Failures | Acesso sem token | `KeycloakAuthGuard` como primeiro guard |
| A03 — Injection | Parâmetros `page`/`pageSize` | Validação Zod (int positivo) + Prisma parameterizado |
| A02 — Cryptographic Failures | Info-disclosure | Resposta inclui apenas `lessonId`, nomes e `tenantId` (não `contentBody`) |

**Resultado esperado: 0 high/critical** — endpoint é GET com apenas guards de auth/authz já padronizados no projeto.

---

## 5. Arquivos a Criar/Modificar

### Criar (novos)
| Arquivo | Tipo | Frente |
|---------|------|--------|
| `apps/api/prisma/migrations/20260625000000_15-5-alt-text-governance/migration.sql` | SQL | C |
| `apps/api/src/content/alt-text.validator.ts` | TS | C |
| `apps/api/src/content/alt-text.validator.spec.ts` | test | C |
| `apps/api/src/admin-accessibility/admin-accessibility.controller.ts` | TS | C |
| `apps/api/src/admin-accessibility/admin-accessibility.service.ts` | TS | C |
| `apps/api/src/admin-accessibility/admin-accessibility.repository.ts` | TS | C |
| `apps/api/src/admin-accessibility/admin-accessibility.module.ts` | TS | C |
| `packages/types/src/content/accessibility.schema.ts` | Zod | C |
| `apps/web/app/(authenticated)/app/admin/accessibility-gaps/page.tsx` | TSX | C |
| `apps/web/app/(authenticated)/app/admin/accessibility-gaps/_components/accessibility-gaps-list.tsx` | TSX | C |
| `apps/web/src/lib/api/hooks/use-accessibility-gaps.ts` | TS | C |
| `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/aulas/[lessonId]/page.tsx` | TSX | A |
| `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/aulas/[lessonId]/lesson-viewer.tsx` | TSX | A |
| `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/aulas/[lessonId]/lesson-viewer.spec.tsx` | test | A |
| `apps/web/src/components/content/plyr-video-player.tsx` | TSX | B |
| `apps/web/src/components/content/plyr-video-player.spec.tsx` | test | B |
| `docs/specs/a11y-conteudo-multimidia/manual-test-checklist.md` | MD | gates |

### Modificar (existentes)
| Arquivo | Mudança | Frente |
|---------|---------|--------|
| `apps/api/prisma/schema.prisma` | Adicionar `hasMissingAltText` ao modelo Lesson | C |
| `apps/api/src/content/content.service.ts` | Injetar `AltTextValidator` em createLesson/updateLesson | C |
| `apps/api/src/content/content.module.ts` | Exportar para uso no admin-accessibility (se necessário) | C |
| `apps/api/src/app.module.ts` | Importar `AdminAccessibilityModule` | C |
| `packages/types/src/content/index.ts` | Exportar `AccessibilityGapsResponseSchema` | C |
| `packages/types/src/index.ts` | Re-exportar accessibility schema | C |
| `packages/types/src/content/lesson.schema.ts` | Adicionar `hasMissingAltText` ao `LessonResponseSchema` | C |
| `apps/web/messages/pt-BR.json` | Adicionar `admin.accessibilityGaps.*` | C |
| `apps/web/app/(authenticated)/layout.tsx` | Importar `plyr/dist/plyr.css` | B |
| `apps/api/prisma/seeds/demo-seed.ts` | Adicionar 2 lessons demo com img sem alt | C |

---

## 6. Sequência de Tarefas (tasks.md)

### Fase 1 — Backend (Migration + Validador + Seed)
- 1.1 Escrever migration SQL (`20260625000000_15-5-alt-text-governance`)
- 1.2 Atualizar schema Prisma (modelo Lesson + `hasMissingAltText`)
- 1.3 Executar `pnpm --filter @metanoia/api db:migrate` e validar Postgres local
- 1.4 Criar `AltTextValidator` + testes (`alt-text.validator.spec.ts`, 3 cenários)
- 1.5 Integrar `AltTextValidator` no `ContentService.createLesson`/`updateLesson`
- 1.6 Atualizar `LessonResponseSchema` em `packages/types` para incluir `hasMissingAltText`
- 1.7 Adicionar seed demo (2 lessons com img sem alt, UUID v7 fixo)
- 1.8 Rodar RLS test 2× (`lessons-rls.spec.ts`)
- 1.9 `pnpm --filter @metanoia/api test` + `pnpm --filter @metanoia/types test`

### Fase 2 — Endpoint + Admin FE
- 2.1 Criar schema Zod `accessibility.schema.ts` em packages/types
- 2.2 Criar `AdminAccessibilityRepository` (query Prisma por `has_missing_alt_text=true` + JOINs module/trail)
- 2.3 Criar `AdminAccessibilityService` (paginação, resposta `{data,meta}`)
- 2.4 Criar `AdminAccessibilityController` (`GET /api/v1/admin/accessibility-gaps`, guards)
- 2.5 Criar `AdminAccessibilityModule` + registrar em `app.module.ts`
- 2.6 `pnpm turbo build` (api+web) — verificar onModuleInit + TypeScript
- 2.7 Boot real (`start:e2e` + `curl /api/health`)
- 2.8 Criar hook `use-accessibility-gaps.ts` (TanStack Query)
- 2.9 Criar `AccessibilityGapsList` Client Component
- 2.10 Criar página `/app/admin/accessibility-gaps/page.tsx`
- 2.11 Adicionar textos PT-BR (`admin.accessibilityGaps.*`)

### Fase 3 — Lesson Viewer
- 3.1 Criar `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/aulas/[lessonId]/page.tsx`
- 3.2 Criar `lesson-viewer.tsx` (switch contentType, reutiliza PdfViewer + ExternalLinkView existentes)
- 3.3 Implementar `LessonNavigationButton` (próxima aula / próximo módulo / concluir)
- 3.4 Ligar `nextModuleButtonRef` entre VideoPlayer e botão de navegação
- 3.5 a11y check: h1, hierarquia headings, links descritivos, fallback alt
- 3.6 Criar `lesson-viewer.spec.tsx` (4 contentTypes, botão navegação, a11y básico)
- 3.7 `pnpm --filter @metanoia/web test`

### Fase 4 — Plyr
- 4.1 `pnpm --filter @metanoia/web add plyr`
- 4.2 Importar `plyr/dist/plyr.css` em `apps/web/app/(authenticated)/layout.tsx`
- 4.3 Criar `plyr-video-player.tsx` (i18n PT-BR, painel atalhos "?", `onVideoEnded` → foco)
- 4.4 Integrar `use-video-progress.ts` no `PlyrVideoPlayer`
- 4.5 Criar `plyr-video-player.spec.tsx` (mock Plyr, i18n, painel atalhos)
- 4.6 `pnpm --filter @metanoia/web test`

### Fase 5 — Gates Finais
- 5.1 `pnpm turbo lint` (zero erros)
- 5.2 `pnpm turbo build` final (api+web)
- 5.3 3 gates a11y hard (focus-ring, contrast, motion-safe — todos os novos componentes)
- 5.4 axe-core Playwright nas novas rotas (lesson viewer + admin/accessibility-gaps)
- 5.5 Criar `manual-test-checklist.md` (Plyr: teclado/atalhos; lesson viewer; admin gaps)
- 5.6 Commit por fase, PR para dev

---

## 7. Decisões Técnicas Pendentes

Nenhuma. Todas as ambiguidades foram resolvidas no clarify (dec-007 a dec-014).

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Migration falha em Postgres local | Baixa | Médio | Validar localmente antes de qualquer PR; RLS test 2× |
| CSS Plyr conflita com Tailwind | Média | Baixo | Escopo Plyr por seletor `.plyr` (não global); testar build |
| Plyr não mountar em SSR (Next.js) | Alta | Médio | Importar Plyr com `dynamic import { ssr: false }` dentro do Client Component |
| `use-video-progress.ts` não compatível com Plyr videoRef | Baixa | Baixo | Plyr expõe `player.elements.container` → `querySelector('video')` |
| `onModuleInit` do novo controller quebra boot | Baixa | Alto | Lição Epic 14: rodar `start:e2e` + health antes do PR |
| next-env.d.ts commitado | Baixa | Baixo | Regra inegociável: NÃO commitar `next-env.d.ts` |
