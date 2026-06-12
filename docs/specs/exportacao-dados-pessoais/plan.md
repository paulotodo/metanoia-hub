# Plano: exportacao-dados-pessoais

**Feature:** Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD
**Epic:** 9 (LGPD/Privacidade)
**Data:** 2026-06-12
**Status:** plan concluído

---

## Summary

Implementar o direito de portabilidade de dados (LGPD art. 18) via export assíncrono de todos os dados pessoais do usuário em JSON ou PDF. O export agrega dados de 7 módulos (Users, Groups, Meetings, Trails, Pastoral, Consent, Audit) por tenant, gera arquivo no MinIO e entrega signed URL via polling.

**Abordagem técnica:**
- Estender `apps/api/src/privacy/` com `PrivacyExportService` + `PrivacyExportProcessor`
- BullMQ worker privilegiado (sem RLS, query direta com `userId` + `tenantId` explícitos)
- Padrão idêntico ao `reports.service.ts` (template validado na Story 8-7)
- `exportUserData(userId, tenantId)` adicionado a 7 serviços existentes
- UI: seção "Meus Exports" na página `/app/consumo/perfil/privacidade/page.tsx` existente
- Instalar `pdfkit@0.15.x` em `apps/api` (único pré-requisito ausente)

---

## Constitution Check

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | PASS | `privacy_export_jobs` tem `tenant_id` + RLS. Worker bypassa RLS propositalmente (job privilegiado documentado) com filtro explícito `userId + tenantId`. Toda migration acompanha RLS isolation test. |
| II. Type-Safety & IDs | PASS | `uuidv7()` para todos os IDs. Datas como ISO 8601. Zod schemas explícitos para todos os contratos. |
| III. Idioma & Vocabulário | PASS | Código em inglês. UI PT-BR em `pt-BR.json`. Vocabulário pastoral ("meus dados", não "export record"). |
| IV. Contratos de API Padronizados | PASS | POST→202, ZodValidationPipe próprio. `{ data: {...} }`. Schemas Zod em `packages/types`. Snapshot tests obrigatórios. |
| V. Separação Frontend State | PASS | `usePrivacyExport` hook Client Component com TanStack Query. Página de privacidade pode ter parte SSR (lista de exports) e parte CSR (polling). |
| VI. Qualidade Verificável | PASS | Unit tests por serviço, integration test de completude, RLS isolation spec, snapshot Zod. CI verde obrigatório. |
| VII. Processo de Entrega | PASS | 1 story = 1 branch = 1 PR. Conventional commits PT-BR. |

**Gate: PASS — prosseguir para implementação.**

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript 5.x (strict: true) |
| Runtime Backend | NestJS 11.1.17, Node.js |
| ORM | Prisma v7 (PrismaPg adapter) |
| Queue | BullMQ (via `BullMqService.createWorker`) |
| Cache/Status | Redis (`cache:privacy:export-job:<jobId>`) |
| Storage | MinIO via `StorageService` (`apps/api/src/storage/storage.service.ts`) |
| PDF | `pdfkit@0.15.x` (a instalar em `apps/api`) |
| Tipos compartilhados | `packages/types/src/privacy/export.ts` |
| Frontend | Next.js 16.2 App Router, TanStack Query 5.96.2 |
| Tela alvo | `apps/web/app/(authenticated)/app/consumo/perfil/privacidade/page.tsx` |
| Módulo a estender | `apps/api/src/privacy/` (já existe — Story 9-4) |
| Template de job | `apps/api/src/reports/reports.service.ts` |
| Template de processor | `apps/api/src/reports/reports.processor.ts` |

---

## Convencoes de Borda

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration + Prisma `@map` | `apps/api/prisma/schema.prisma` |
| Backend DTO (NestJS) | camelCase | Zod `ZodValidationPipe` | `packages/types/src/privacy/export.ts` |
| Frontend DTO (Next.js) | camelCase | Zod parse no hook | `packages/types/src/privacy/export.ts` (re-export) |
| API payload (req/res) | camelCase | Zod em ambos os lados | `docs/specs/exportacao-dados-pessoais/contracts/api.md` |
| URL path params | lowercase uuid | NestJS router | `privacy.controller.ts` |

**Mapper layer (DB → DTO):** inline nos métodos de `PrivacyExportService`; padrão `record.createdAt.toISOString()`.

**Zod compartilhado:** sim — `packages/types/src/privacy/export.ts` é a fonte única. FE e BE importam do mesmo pacote.

---

## Project Structure

### Artefatos de documentação
```
docs/specs/exportacao-dados-pessoais/
  spec.md              ✓ (gerado no specify + clarify)
  research.md          ✓ (gerado no plan Phase 0)
  data-model.md        ✓ (gerado no plan Phase 1)
  quickstart.md        ✓ (gerado no plan Phase 1)
  contracts/
    api.md             ✓ (gerado no plan Phase 1)
  plan.md              ← este arquivo
```

### Artefatos de código a criar/modificar

```
packages/types/src/privacy/
  export.ts                           CRIAR — todos os schemas Zod + constantes

apps/api/
  package.json                        MODIFICAR — adicionar pdfkit@0.15.x + @types/pdfkit

  prisma/
    schema.prisma                     MODIFICAR — model PrivacyExportJob
    migrations/<ts>_add_privacy_export_jobs/
      migration.sql                   CRIAR

  src/privacy/
    privacy.module.ts                 MODIFICAR — importar BullMqModule, StorageModule, RedisModule, ConsentModule
    privacy.controller.ts             MODIFICAR — 2 novos endpoints (POST + GET)
    privacy-export.service.ts         CRIAR — lógica de criação de job + polling
    privacy-export.processor.ts       CRIAR — BullMQ worker (modo privilegiado)
    dto/
      privacy-export.dto.ts           CRIAR — tipos internos NestJS (não duplicar Zod)
    __tests__/
      privacy-export.spec.ts          CRIAR — unit tests
      privacy-export.integration-spec.ts  CRIAR — teste de completude (todos os módulos)

  src/users/
    users.service.ts                  MODIFICAR — + exportUserData(userId, tenantId)
    __tests__/users.export.spec.ts    CRIAR — unit test do método

  src/groups/
    group-members/
      group-members.service.ts        VERIFICAR PATH — + exportUserData(userId, tenantId)
    __tests__/groups.export.spec.ts   CRIAR

  src/meetings/
    meetings.service.ts               MODIFICAR — + exportUserData(userId, tenantId)
    __tests__/meetings.export.spec.ts CRIAR

  src/content/
    trail-progress.service.ts         VERIFICAR PATH — + exportUserData(userId, tenantId)
    __tests__/trails.export.spec.ts   CRIAR

  src/pastoral/
    pastoral.service.ts               MODIFICAR — + exportUserData(userId, tenantId)
    __tests__/pastoral.export.spec.ts CRIAR

  src/audit/
    audit.service.ts                  MODIFICAR — + exportUserData(userId, tenantId)
    __tests__/audit.export.spec.ts    CRIAR

  src/consent/
    consent.service.ts                MODIFICAR — + exportConsentData(userId, tenantId)
    (usa ConsentRepository existente)

  test/rls/
    privacy-export-jobs.rls.spec.ts   CRIAR — isolamento RLS obrigatório

apps/web/
  app/(authenticated)/app/consumo/perfil/privacidade/
    page.tsx                          MODIFICAR — + seção "Meus Exports"
    hooks/
      use-privacy-export.ts           CRIAR — hook TanStack Query + polling 5s
  messages/
    pt-BR.json                        MODIFICAR — + chaves privacy.export.*
  mocks/
    handlers/privacy.ts               MODIFICAR — + handlers export (MSW)
```

---

## Sequência de Implementação

### Fase 1: Tipos e Schema (sem dependências de runtime)
1. `packages/types/src/privacy/export.ts` — schemas Zod + constantes + snapshot tests
2. `apps/api/prisma/schema.prisma` — model `PrivacyExportJob`
3. `apps/api/package.json` — instalar pdfkit
4. Migration `add_privacy_export_jobs` + RLS spec

### Fase 2: Backend Core (exportUserData por módulo)
5. `users.service.ts` + `exportUserData` — profile + tenants
6. `group-members.service.ts` (ou equivalente) + `exportUserData` — memberships
7. `meetings.service.ts` + `exportUserData` — attendance + participantRecords
8. `trail-progress.service.ts` (ou equivalente) + `exportUserData` — trailProgress + lessonProgress
9. `pastoral.service.ts` + `exportUserData` — alertsAboutMe + notesAboutMe
10. `consent.service.ts` + `exportConsentData` — via ConsentRepository
11. `audit.service.ts` + `exportUserData` — events

### Fase 3: Worker e Serviço de Export
12. `privacy-export.service.ts` — createJob, getJobStatus, createExportFile (JSON + PDF)
13. `privacy-export.processor.ts` — BullMQ worker (orquestra todos os exportUserData)
14. `privacy.module.ts` — importar módulos necessários
15. `privacy.controller.ts` — endpoints POST + GET

### Fase 4: Frontend
16. `pt-BR.json` — chaves i18n `privacy.export.*`
17. `use-privacy-export.ts` — hook TanStack Query + polling
18. `privacy/page.tsx` — seção "Meus Exports" + botão "Exportar meus dados"
19. MSW handlers

### Fase 5: Testes de Integração e E2E
20. Integration test de completude (todos os módulos, dados verificados)
21. RLS isolation spec `privacy-export-jobs`
22. Snapshot tests dos schemas Zod

---

## Detalhes de Implementação Críticos

### exportUserData — Contrato de Módulo

Cada método segue este contrato:
```typescript
// NUNCA lança — retorna arrays vazios se sem dados
async exportUserData(userId: string, tenantId: string): Promise<XxxExportData> {
  const records = await this.prisma.client.xxxModel.findMany({
    where: { userId, tenantId },   // sem withTenantTx (worker privilegiado)
    select: { ... }
  });
  return {
    fieldName: records.map(r => ({ ...mapFields }))
  };
}
```

**Exceção para Pastoral:** `pastoral_alerts` usa `participantId`, não `userId` — verificar nome do campo no schema.

**Exceção para Audit:** `userId` nullable no `AuditEvent` — filtrar por `userId: userId` (null-safe).

### Worker — Modo Privilegiado

```typescript
// privacy-export.processor.ts
@Injectable()
export class PrivacyExportProcessor implements OnModuleInit {
  onModuleInit() {
    this.bullMqService.createWorker(PRIVACY_EXPORT_QUEUE_NAME, async (job) => {
      if (job.name === 'export-personal-data') {
        await this.privacyExportService.processExportJob(job.data);
      }
    });
  }
}
```

```typescript
// privacy-export.service.ts — processExportJob
async processExportJob(payload: PrivacyExportJobPayload): Promise<void> {
  // 1. UPDATE status=processing
  // 2. Para cada tenantId em payload.allTenantIds:
  const tenantData = await Promise.all(payload.allTenantIds.map(async (tenantId) => ({
    tenantId,
    users: await this.usersService.exportUserData(payload.userId, tenantId),
    groups: await this.groupMembersService.exportUserData(payload.userId, tenantId),
    meetings: await this.meetingsService.exportUserData(payload.userId, tenantId),
    trails: await this.trailProgressService.exportUserData(payload.userId, tenantId),
    pastoral: await this.pastoralService.exportUserData(payload.userId, tenantId),
    consent: await this.consentService.exportConsentData(payload.userId, tenantId),
    audit: await this.auditService.exportUserData(payload.userId, tenantId),
  })));
  // 3. Gerar buffer (JSON.stringify ou pdfkit)
  // 4. StorageService.upload(objectKey, buffer, mimeType)
  // 5. StorageService.getSignedUrl(objectKey, PRIVACY_EXPORT_SIGNED_URL_SECONDS)
  // 6. UPDATE privacy_export_jobs SET status=completed, ...
  // 7. Redis SET cache:privacy:export-job:<jobId> { status: 'completed', signedUrl, expiresAt }
  // 8. queue.add(NOTIFICATIONS_QUEUE, { type: 'privacy-export-ready', ... }) [stub]
}
```

### Verificação de job ativo (409)

```typescript
// POST handler — antes de criar job
const activeJob = await this.prisma.client.privacyExportJob.findFirst({
  where: {
    userId,
    tenantId,
    status: { in: ['accepted', 'processing'] }
  }
});
if (activeJob) throw new ConflictException('Export em andamento.');
```

**Nota:** a query usa `tenantId` (tenant ativo no contexto da request via `getRequestContext()`) — comportamento LGPD-correto: um job por tenant. O worker exporta todos os tenants do usuário a partir do `allTenantIds` do payload.

### PDF via pdfkit

```typescript
// Geração simples — tabelas por seção, sem layout visual complexo (spec §5.2)
import PDFDocument from 'pdfkit';

function generatePdf(payload: FullExportPayload): Buffer {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {});

  doc.fontSize(16).text('Exportação de Dados Pessoais', { align: 'center' });
  doc.moveDown();
  // ... iterar sobre tenants e módulos

  doc.end();
  return Buffer.concat(chunks);
}
```

**Nota:** pdfkit é síncrono; envolver em Promise ou usar buffer diretamente (non-streaming para arquivos de tamanho esperado — dados pessoais de 1 usuário são pequenos).

---

## Riscos e Mitigações (do plan)

| Risco | Mitigação | Owner |
|-------|-----------|-------|
| `pastoral_alerts.participantId` vs `userId` — campo diverge do padrão | Verificar nome exato no schema antes de implementar | Fase 2, passo 9 |
| `AuditEvent.userId` é nullable | Filtrar com `userId: { equals: userId }` (Prisma null-safe) | Fase 2, passo 11 |
| `group-members` path real no codebase | Verificar: `src/groups/group-members/` ou `src/participant-groups/` | Fase 2, passo 6 |
| `trail-progress` path real | Verificar: `src/content/my-trails/` ou `src/content/progress/` | Fase 2, passo 8 |
| pdfkit build no Docker/CI | Verificar que `pdfkit` não exige fontes nativas; usar embedding | Fase 1, passo 3 |
| Timeout do worker para usuário com muitos dados | NFR-P1: benchmark com 5 tenants antes de declarar done | Fase 5 |
| Signed URL na resposta API de polling vaza para logs | Remover signed URL de qualquer `Logger.log` — apenas `Logger.debug` | Fase 3 |

---

## Complexity Tracking

Nenhuma violação de constitution detectada. Plano dentro do blast radius esperado.

**Exceção documentada ao padrão Multi-tenancy:** worker usa `prisma.client` diretamente (sem `withTenantTx`) no contexto de job BullMQ privilegiado. Justificativa: job roda fora de HTTP request; sem RequestContext disponível. Mitigação: toda query filtra `userId` AND `tenantId` explicitamente. Padrão idêntico ao super-admin e ao `reports.service.ts`.

---

## Artefatos Gerados

| Arquivo | Status |
|---------|--------|
| `docs/specs/exportacao-dados-pessoais/spec.md` | Atualizado (CL-02 integrado) |
| `docs/specs/exportacao-dados-pessoais/research.md` | Criado |
| `docs/specs/exportacao-dados-pessoais/data-model.md` | Criado |
| `docs/specs/exportacao-dados-pessoais/contracts/api.md` | Criado |
| `docs/specs/exportacao-dados-pessoais/quickstart.md` | Criado |
| `docs/specs/exportacao-dados-pessoais/plan.md` | Criado (este arquivo) |

**Constitution:** PASS
**NEEDS CLARIFICATION restantes:** 0

### Próximos Passos

1. `/checklist` — quality gate antes de implementar
2. `/create-tasks` — decompor plano em backlog executável
