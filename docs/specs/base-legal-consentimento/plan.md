# Plan: Base Legal & Histórico de Consentimento (Story 9-4)

**Feature**: `base-legal-consentimento`
**Epic**: 9 — LGPD & Privacidade
**Story**: 9.4
**Branch**: `feat/story-9-4-base-legal-consentimento`
**Status**: ready-for-implementation
**Data**: 2026-06-11

---

## Visão Geral

Story 9-4 implementa dois fluxos LGPD complementares:
1. **Inventário público de bases legais** (`data_processing_registry`) — transparência ativa Art. 9º
2. **Histórico + revogação de consentimentos** — direito do titular Art. 18º III+IX

A implementação **estende** o módulo `consent/` existente e cria um módulo `privacy/` novo
para o endpoint público. O módulo `audit/` (9-3) é reutilizado para log de revogação.

---

## Sessões de Implementação

### Session 0 — Contracts, tipos Zod e migration

**Objetivo**: infraestrutura de tipos e base de dados. Nenhum código de domínio ainda.

#### 0.1 — Zod em `packages/types/src/consent.ts`

Adicionar aos exports existentes (não substituir):
- `ConsentTypeSchema` (enum com `terms_of_service | privacy_policy | focus_monitoring`)
- `LegalBasisSchema` (enum)
- `DataProcessingRegistryItemSchema` + `DataProcessingRegistryResponseSchema`
- `ConsentRecordSchema`
- `ConsentHistoryItemSchema` + `ConsentHistoryResponseSchema`
- `ConsentStatusBadgeSchema`
- `WithdrawConsentInputSchema` + `WithdrawConsentResponseSchema`

Exportar tudo via `packages/types/src/index.ts`.

#### 0.2 — Snapshot tests (`packages/types/src/__tests__/consent.snap.spec.ts`)

Teste para cada schema novo. `expect(schema.parse(validInput)).toMatchSnapshot()`.

#### 0.3 — MSW handlers (`apps/web/src/mocks/handlers/`)

Arquivo novo `consent-privacy.ts`:
- `GET /api/v1/privacy/data-processing`
- `GET /api/v1/consent/history`
- `PATCH /api/v1/consent/:consentType/withdraw`

Importar nos handlers principais (`apps/web/src/mocks/handlers/index.ts`).

#### 0.4 — Migration `20260618000000_9-4-base-legal-consentimento`

Arquivo: `apps/api/prisma/migrations/20260618000000_9-4-base-legal-consentimento/migration.sql`

Contém em ordem:
1. `CREATE TABLE "data_processing_registry"` (global, sem tenant_id, sem RLS)
2. `CREATE TABLE "consent_records"` + FK `consent_records_user_id_fkey`
3. Indexes: `consent_records_user_consent_idx`, `consent_records_tenant_idx`
4. RLS em `consent_records` (NULLIF pattern — 2 policies: SELECT + INSERT)
5. `INSERT INTO "data_processing_registry"` com 10 operações (ON CONFLICT DO NOTHING)

#### 0.5 — Prisma schema (`apps/api/prisma/schema.prisma`)

Adicionar após `model Consent`:
- `model DataProcessingRegistry { ... @@map("data_processing_registry") }`
- `model ConsentRecord { ... @@map("consent_records") }`
- Em `model User`: adicionar `consentRecords ConsentRecord[]`

Após edição: `pnpm --filter @metanoia/api exec prisma generate`.

#### 0.6 — Teste RLS isolation (`apps/api/test/rls/consent-records.rls-spec.ts`)

Padrão: 2 tenants (A e B), INSERT de registros com tenantId A e B, verificar
isolamento em SELECT, UPDATE (proibido), DELETE (proibido). Registros com
`tenantId = null` são visíveis para ambos os tenants (comportamento esperado).

---

### Session 1 — Backend: módulo privacy/ (endpoint público)

**Objetivo**: `GET /api/v1/privacy/data-processing` público funcional.

#### 1.1 — `PrivacyService` (`apps/api/src/privacy/privacy.service.ts`)

```typescript
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async listDataProcessingRegistry(): Promise<DataProcessingRegistryResponse> {
    const rows = await this.prisma.client.dataProcessingRegistry.findMany({
      orderBy: { operationName: 'asc' },
    });
    return { data: rows.map(toDto) };
  }
}
```

`toDto` mapeia `Date` → ISO string; snake_case → camelCase já feito pelo Prisma.

#### 1.2 — `PrivacyController` (`apps/api/src/privacy/privacy.controller.ts`)

```typescript
@Controller('api/v1/privacy')
export class PrivacyController {
  @Get('data-processing')
  @Public()
  async getDataProcessingRegistry(): Promise<DataProcessingRegistryResponse> {
    return this.service.listDataProcessingRegistry();
  }
}
```

Sem `@UseGuards`. `@Public()` compatível com `KeycloakAuthGuard` global (permite bypass).

#### 1.3 — `PrivacyModule` (`apps/api/src/privacy/privacy.module.ts`)

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
```

Importar em `AppModule`.

#### 1.4 — Testes unitários (`apps/api/src/privacy/__tests__/privacy.service.spec.ts`)

Mockar `PrismaService.client.dataProcessingRegistry.findMany`. Verificar que
retorna `DataProcessingRegistryResponse` com `data: []` quando vazio.

---

### Session 2 — Backend: extensão do módulo consent/ (history + withdrawal)

**Objetivo**: `GET /api/v1/consent/history` e `PATCH /api/v1/consent/:consentType/withdraw`.

#### 2.1 — `ConsentRepository` — novos métodos

```typescript
// Todos os aceites do user (tabela consents)
async findAllAcceptancesByUser(userId: string): Promise<Consent[]>

// Todos os withdrawals do user+tenant (tabela consent_records)
async findWithdrawalsByUser(userId: string, tenantId: string | null): Promise<ConsentRecord[]>

// Criar withdrawal
async createWithdrawal(input: {
  id: string;
  userId: string;
  tenantId: string | null;
  consentType: ConsentType;
  action: 'withdrawn';
}): Promise<ConsentRecord>
```

`createWithdrawal` usa `withTenantTx(this.prisma, fn)` para escrita tenant-scoped.

#### 2.2 — `ConsentService` — novos métodos

```typescript
async getHistory(userId: string, tenantId: string | null): Promise<ConsentHistoryResponse>
async withdrawConsent(
  userId: string,
  tenantId: string | null,
  consentType: ConsentType,
  meta: { ipAddress: string; userAgent: string },
): Promise<WithdrawConsentResponse>
```

`withdrawConsent`:
1. Validar que `consentType` não é mandatório (`terms_of_service`, `privacy_policy`) → lança `BadRequestException` com mensagem PT-BR.
2. `this.repo.createWithdrawal(...)` — dentro de `withTenantTx`.
3. `this.auditService.createEvent({ action: 'update', resource: 'consent', resourceId: consentType, ... })`.
4. Retorna `WithdrawConsentResponse`.

`ConsentModule` importa `AuditModule` e injeta `AuditService` em `ConsentService`.

#### 2.3 — `ConsentController` — novos endpoints

```typescript
// Adicionar ao ConsentController existente (preservar GET /status e POST /accept)

@Get('history')
@SkipConsent()
async history() {
  const { userId, tenantId } = getRequestContext();
  return this.service.getHistory(userId ?? '', tenantId ?? null);
}

@Patch(':consentType/withdraw')
@SkipConsent()
async withdraw(
  @Param('consentType') consentType: string,
  @Ip() ipAddress: string,
  @Headers('user-agent') userAgent: string | undefined,
) {
  // Validar consentType via ZodValidationPipe ou manual parse
  const parsed = ConsentTypeSchema.safeParse(consentType);
  if (!parsed.success) throw new BadRequestException('Tipo de consentimento inválido');
  const { userId, tenantId } = getRequestContext();
  return this.service.withdrawConsent(
    userId ?? '', tenantId ?? null, parsed.data,
    { ipAddress: ipAddress || '0.0.0.0', userAgent: userAgent ?? 'unknown' },
  );
}
```

#### 2.4 — Testes (`apps/api/src/consent/__tests__/consent.service.spec.ts`)

Estender spec existente com casos:
- `getHistory` retorna merged de aceites + withdrawals
- `withdrawConsent` para `focus_monitoring` persiste `consent_records` + chama `auditService`
- `withdrawConsent` para `terms_of_service` lança `BadRequestException`

---

### Session 3 — Backend: integração FR-11 (focus heartbeat)

**Objetivo**: withdrawal de `focus_monitoring` desabilita coleta de heartbeat para o user.

#### 3.1 — `ConsentRepository` — método de verificação

```typescript
async hasWithdrawn(
  userId: string,
  consentType: ConsentType,
): Promise<boolean>
```

Usa `this.prisma.client.consentRecord.findFirst({ where: { userId, consentType, action: 'withdrawn' } })`.
**Sem RLS** (leitura via `prisma.client` não-extendido) — esta consulta é por userId global,
não por tenant (evita acoplamento de contexto RLS dentro do TelemetryService).

#### 3.2 — `TelemetryService.recordFocusHeartbeat` — gate de consentimento

Injetar `ConsentRepository` no `MeetingsModule` (importar `ConsentModule` no
`MeetingsModule`). Modificar:

```typescript
async recordFocusHeartbeat(
  tenantId: string | null, meetingId: string, userId: string, visible: boolean,
): Promise<void> {
  // Gate: verificar revogação antes de persistir
  const revoked = await this.consentRepo.hasWithdrawn(userId, 'focus_monitoring');
  if (revoked) return; // silencioso — não é erro

  // ... lógica existente de persistência ...
}
```

#### 3.3 — Teste de integração FR-11

Arquivo: `apps/api/src/meetings/telemetry/__tests__/focus-heartbeat-consent.integration-spec.ts`

Cenário:
1. User A revoga `focus_monitoring` (INSERT em `consent_records`)
2. User A e User B enviam heartbeat para o mesmo meeting
3. Verificar que apenas User B tem registro persistido em `meeting_telemetry` (Redis mock)

---

### Session 4 — Frontend: tela Privacidade & Consentimento

**Objetivo**: tela CSR no perfil + página SSR pública de bases legais.

#### 4.1 — i18n PT-BR (`apps/web/messages/pt-BR.json`)

Adicionar chaves no namespace `privacy`:
```json
{
  "privacy": {
    "title": "Privacidade e Consentimento",
    "mandatory_tooltip": "Este consentimento é necessário para usar o serviço. Para revogá-lo, exclua sua conta.",
    "withdraw_confirm": "Ao revogar, o monitoramento de atenção será desativado imediatamente para você.",
    "status_accepted": "Aceito",
    "status_withdrawn": "Revogado",
    "status_pending": "Pendente",
    "data_processing_title": "Bases Legais de Tratamento de Dados",
    "legal_basis_consent": "Consentimento",
    "legal_basis_legitimate_interest": "Legítimo interesse",
    "legal_basis_legal_obligation": "Obrigação legal",
    "legal_basis_contract_execution": "Execução de contrato"
  }
}
```

#### 4.2 — Hooks CSR

`apps/web/src/hooks/use-consent-history.ts`:
```typescript
export function useConsentHistory() {
  return useQuery<ConsentHistoryResponse>({
    queryKey: ['consent', 'history'],
    queryFn: () => apiFetch('/api/v1/consent/history'),
  });
}
```

`apps/web/src/hooks/use-withdraw-consent.ts`:
```typescript
export function useWithdrawConsent() {
  const qc = useQueryClient();
  return useMutation<undefined, Error, { consentType: ConsentType }>({
    mutationFn: async ({ consentType }) => {
      await apiFetch(`/api/v1/consent/${consentType}/withdraw`, { method: 'PATCH' });
      return undefined;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consent', 'history'] }); },
  });
}
```

#### 4.3 — Componente `PrivacidadeConsentimentoPage`

Rota: `apps/web/src/app/(app)/perfil/privacidade/page.tsx` (nova rota).
`'use client'` — CSR com TanStack Query.

Renderiza lista de `ConsentHistoryItem` com:
- Badge de status (`Aceito` / `Revogado` / `Pendente`) em cores semânticas
- Toggle: `disabled={item.isMandatory}` com `title={t('privacy.mandatory_tooltip')}`
- `onClick` → `withdrawConsent.mutate({ consentType: item.consentType })`

#### 4.4 — Página pública `BasesLegaisPage`

Rota: `apps/web/src/app/(marketing)/privacidade/bases-legais/page.tsx` (nova rota).
Server Component — `fetch('/api/v1/privacy/data-processing')` direto.
Renderiza tabela com `operationName`, `legalBasis`, `purpose`, `retentionPeriod`, `thirdPartySharing`.

#### 4.5 — Testes FE

- `apps/web/src/hooks/__tests__/use-consent-history.spec.tsx` (MSW mock)
- `apps/web/src/hooks/__tests__/use-withdraw-consent.spec.tsx` (MSW mock)
- `apps/web/src/app/(app)/perfil/privacidade/__tests__/page.spec.tsx` (RTL + MSW)

---

### Session 5 — Closeout (a11y, review checklist, integração E2E)

**Objetivo**: validação final + checklist de entrega.

#### 5.1 — A11y audit

- Toggles têm `aria-label` descritivo (não apenas ícone)
- Tooltips acessíveis via `aria-describedby`
- Tabela de bases legais tem `<caption>` e headers `scope`

#### 5.2 — Checklist story-9-4

Arquivo: `docs/specs/base-legal-consentimento/9-4-validation-checklist.md`

Colunas: Item | Status | Notas

Itens obrigatórios:
- [ ] Migration applied sem errors
- [ ] Seed: 10 operações em `data_processing_registry`
- [ ] RLS isolation test verde (2 tenants)
- [ ] Snapshot tests Zod passando
- [ ] `GET /api/v1/privacy/data-processing` sem auth → 200
- [ ] `GET /api/v1/consent/history` autenticado → 200
- [ ] `PATCH /api/v1/consent/focus_monitoring/withdraw` → 200 + audit event
- [ ] `PATCH /api/v1/consent/terms_of_service/withdraw` → 400
- [ ] Heartbeat após withdrawal não persiste (integration test verde)
- [ ] Toggle mandatório desabilitado na UI
- [ ] Tela pública SSR renderiza sem auth
- [ ] CI verde: `turbo build && turbo lint && turbo test`

---

## Ordem de Dependência

```
Session 0 (migration + types)
    ↓
Session 1 (privacy endpoint)   Session 2 (consent history/withdrawal)
                                      ↓
                               Session 3 (FR-11 telemetry gate)
    ↓
Session 4 (frontend)
    ↓
Session 5 (closeout)
```

Sessions 1 e 2 podem rodar em paralelo após Session 0.
Session 3 depende de Session 2 (ConsentRepository.hasWithdrawn).
Session 4 pode iniciar em paralelo com Sessions 2+3 usando MSW.

---

## Constitution Check

| Princípio | Compliance |
|-----------|-----------|
| I. Multi-tenancy Absoluto | `consent_records` tem `tenant_id` + RLS NULLIF. `data_processing_registry` é global (exceção documentada). |
| II. Type-Safety | UUID v7 via `generateId()`. ISO 8601. `null` explícito. Sem `undefined` em JSON. |
| III. Idioma & Vocabulário | Código inglês. UI PT-BR + vocabulário pastoral ("Consentimento de monitoramento", não "tracking"). |
| IV. Contratos de API | Zod em `packages/types`. Snapshot tests. Padrão `{ data: ... }`. `DELETE`→204 não aplicável (PATCH). |
| V. Separação de Estado FE | Tela privacidade: CSR + TanStack Query. Bases legais: Server Component + fetch. |
| VI. Qualidade Verificável | Unit + integration + RLS specs + a11y + CI verde. |
