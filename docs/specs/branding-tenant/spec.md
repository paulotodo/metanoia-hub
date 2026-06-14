# Spec: Branding Customizado do Tenant (Story 11-2)

**short_name:** branding-tenant  
**epic:** 11 — Planos, Limites & Feature Gating  
**status:** draft  
**data:** 2026-06-14  

---

## 1. Objetivo

Como Admin Tenant, customizar o branding da instância da minha igreja:
- Upload de logo (MinIO + sharp resize síncrono)
- Cores brand primary / secondary como CSS custom props
- Display name customizado

Gate por tier: Free → só display name; Pro+ → logo + cores + display name.

---

## 2. Contexto arquitetural

### 2.1 O que já existe

| Artefato | Caminho | Nota |
|---|---|---|
| Controller tenants | `apps/api/src/tenants/tenants.controller.ts` | tem `GET me` + `PATCH me`; rota base `api/v1/tenants` |
| Service tenants | `apps/api/src/tenants/tenants.service.ts` | `findMine()`, `updateProfile()` |
| Module tenants | `apps/api/src/tenants/tenants.module.ts` | imports `PrismaModule`; exports `TenantsService` |
| StorageService | `apps/api/src/storage/storage.service.ts` | `upload(key, buffer, mime): Promise<string>`, `getSignedUrl(key, exp=14400): Promise<string>` |
| RedisService | `apps/api/src/redis/redis.service.ts` | `@Global()` — injetável sem importar módulo; padrão: `redis.set(key, val, 'EX', ttl)` / `redis.get(key)` |
| PlanLimitsService | `apps/api/src/common/plan-limits/plan-limits.service.ts` | `getLimits(tenantId)`, `hasCapacity(...)`, `getPlan(...)` |
| PlanLimitsModule | `apps/api/src/common/plan-limits/plan-limits.module.ts` | exporta `PlanLimitsService` + `PlanLimitsGuard` |
| Tenant schema | `apps/api/prisma/schema.prisma` linha ~264 | tem `plan`, `logoUrl`, `planLimitsOverride`; **faltam** `brand_primary_color`, `brand_secondary_color`, `display_name` |
| FileInterceptor pattern | `apps/api/src/content/upload/upload.controller.ts` | `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile() file: MulterFile` |
| packages/types | `packages/types/src/tenant.ts` | adicionar `BrandingSchema` aqui ou em `packages/types/src/tenants/branding.ts` |
| TenantPlanSchema | `packages/types/src/super-admin-tenant.ts` | `z.enum(['free','pro','enterprise'])` |

### 2.2 O que NÃO existe ainda

- Colunas `brand_primary_color`, `brand_secondary_color`, `display_name` na tabela `tenants`
- Dependência `sharp` em `apps/api` (só no pnpm store como órfão — NUNCA como dep direta)
- Endpoints `GET /api/v1/tenants/me/branding` e `PATCH /api/v1/tenants/me/branding`
- `BrandingSchema` em `packages/types`
- Tela `apps/web/src/app/(authenticated)/admin/settings/branding/page.tsx`
- Utilitário `apps/web/src/lib/contrast-checker.ts`

---

## 3. Decisões fixadas (não reabrir)

| ID | Decisão | Racional |
|---|---|---|
| D1 | Colunas na tabela `tenants` (não tabela TenantBranding 1:1) | Evita JOIN extra; schema mais simples; precedência §4 reconciliação |
| D2 | Rota `/me/branding` (não `/current/branding`) | Convenção do repo: `GET me`, `PATCH me` — consistência |
| D3 | `sharp` como dep direta de `apps/api` | `pnpm why sharp` = vazio; bug que só CI pega; DEVE ser adicionado explicitamente |
| D4 | Cache Redis `cache:branding:{tenantId}` WRITE-THROUGH (SET no PATCH, não só DEL) | Evita cache stale; padrão do projeto (`cache:plan-limits:*` escreve no PATCH) |
| D5 | Gate por tenant.plan via leitura direta do Prisma (não PlanLimitsGuard — esse é para capacidade de recursos, não feature flags) | PlanLimitsService.hasCapacity é para contagem de recursos; branding é feature flag binária por tier |
| D6 | Testes de integração no nível SERVICE (não HTTP/supertest) | KeycloakAuthGuard override não funciona em Vitest; padrão estabelecido no projeto |
| D7 | `import sharp from 'sharp'` (default, não `* as sharp`) | esModuleInterop:true; libs CJS sob Vitest exigem import default |
| D8 | SubscriptionPlan.features JSONB não tem campo `branding` pré-definido — usar `tenant.plan` direto | Não há seed de features.branding; gate simples por enum do plan |

---

## 4. Requisitos funcionais

### RF-01: Obter branding do tenant
- `GET /api/v1/tenants/me/branding` — autenticado (qualquer role do tenant)
- Retorna `{ data: BrandingResponseDto }` com campos atuais do tenant
- Cache Redis `cache:branding:{tenantId}` — lê do cache se disponível; cold = DB + write Redis

### RF-02: Atualizar branding do tenant
- `PATCH /api/v1/tenants/me/branding` — `@Roles(Role.ADMIN_TENANT)` obrigatório
- Body JSON: `{ primaryColor?, secondaryColor?, displayName? }` (logo via endpoint separado RF-03)
- Gate: Free → aceita só `displayName`; Pro/Enterprise → aceita tudo
- Free tentando passar `primaryColor` ou `secondaryColor` → 403 com mensagem acionável
- Persiste via `withTenantTx` (AsyncLocalStorage — nunca tenant_id como parâmetro)
- WRITE-THROUGH: SET Redis `cache:branding:{tenantId}` TTL 1h após salvar

### RF-03: Upload de logo
- `POST /api/v1/tenants/me/branding/logo` — `@Roles(Role.ADMIN_TENANT)` obrigatório
- Gate: Free → 403 acionável
- Aceita multipart `file` (PNG/JPG/SVG, ≤2MB)
- Valida dimensões: mín 64×64, máx 512×512 (verificação síncrona com sharp)
- Processa com `sharp`: gera 128×128 (navegação) e 64×64 (favicon)
- Salva no MinIO via `StorageService.upload()`, chave: `tenants/{tenantId}/logo-nav.{ext}` e `tenants/{tenantId}/logo-fav.{ext}`
- Atualiza `tenants.logo_url` com URL assinada (4h) via `StorageService.getSignedUrl()`
- WRITE-THROUGH Redis `cache:branding:{tenantId}` com signed URL (TTL 1h)
- Retorna `{ data: { logoUrl, logoNavUrl, logoFavUrl } }`

### RF-04: Injeção de CSS custom props no frontend
- Root layout autenticado injeta `--color-brand-primary` e `--color-brand-secondary` via style inline quando tenant tem branding configurado
- Override: se não configurado, usa defaults de `tailwind.preset.ts`

### RF-05: Tela de settings de branding
- Rota: `/admin/settings/branding`
- Server Component (fetch SSR do `GET /api/v1/tenants/me/branding`)
- Client Component filho para interações: upload logo (preview imediato), color pickers hex, display name, botão salvar
- Aviso de contraste não-bloqueante se ratio < 4.5:1 contra `#FAFAF8` (surface-base) ou `#FFFFFF` (surface-elevated)
- Gate FE: se `plan === 'free'` → logo e color pickers desabilitados + upgrade prompt; display name sempre editável
- Hook TanStack: `useMutation<BrandingResponse, Error, UpdateBrandingInput>` com `async/await` e retorno explícito; `staleTime: 30 * 60 * 1000`

---

## 5. Contrato Zod (`packages/types`)

### 5.1 BrandingSchema

Localização: `packages/types/src/tenant.ts` (adicionar ao arquivo existente) **ou** `packages/types/src/tenants/branding.ts` (novo arquivo, preferível para organização).

```typescript
// Hex color: #RGB, #RRGGBB, #RRGGBBAA
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export const BrandingColorSchema = z.string().regex(HEX_COLOR_REGEX).max(9);

export const UpdateBrandingSchema = z.object({
  primaryColor: BrandingColorSchema.optional(),
  secondaryColor: BrandingColorSchema.optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
});
export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>;

export const BrandingResponseSchema = z.object({
  primaryColor: BrandingColorSchema.nullable(),
  secondaryColor: BrandingColorSchema.nullable(),
  displayName: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  canCustomizeBranding: z.boolean(), // false quando Free
});
export type BrandingResponse = z.infer<typeof BrandingResponseSchema>;
```

Exportar de `packages/types/src/index.ts`.

### 5.2 Snapshot test

```typescript
// packages/types/src/__tests__/branding.spec.ts
it('BrandingResponseSchema snapshot', () => {
  expect(BrandingResponseSchema.shape).toMatchSnapshot();
});
```

---

## 6. Migration Prisma

### 6.1 Colunas novas em `tenants`

```prisma
// Adicionar ao model Tenant (após logoUrl):
brandPrimaryColor   String?  @map("brand_primary_color") @db.VarChar(9)
brandSecondaryColor String?  @map("brand_secondary_color") @db.VarChar(9)
displayName         String?  @map("display_name") @db.VarChar(100)
```

### 6.2 Migration SQL gerada (aditiva, nullable)

```sql
ALTER TABLE tenants ADD COLUMN brand_primary_color VARCHAR(9);
ALTER TABLE tenants ADD COLUMN brand_secondary_color VARCHAR(9);
ALTER TABLE tenants ADD COLUMN display_name VARCHAR(100);
```

**ATENÇÃO CI:** NÃO adicionar trigger `trigger_set_timestamp()` — o projeto usa `@updatedAt` do Prisma para `updated_at`. Qualquer tentativa de criar esse trigger quebra CI (lição da 11-1).

### 6.3 RLS

A tabela `tenants` já tem RLS policy com `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`. Colunas de branding entram protegidas pela policy existente. **Não criar RLS spec nova** — colunas adicionadas a tabela já protegida.

---

## 7. Backend — implementação

### 7.1 Dependência sharp

```bash
# OBRIGATÓRIO — executar antes de qualquer implementação
pnpm add sharp --filter @metanoia/api
pnpm install
# Commitar pnpm-lock.yaml junto com a migration
```

TypeScript types: `pnpm add -D @types/sharp --filter @metanoia/api` (se não incluídos no pacote).

### 7.2 TenantsModule — novos imports

```typescript
// apps/api/src/tenants/tenants.module.ts — adicionar:
import { StorageModule } from '../storage/storage.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';

@Module({
  imports: [PrismaModule, StorageModule, PlanLimitsModule],
  // ...
})
```

**DI gotcha:** TenantsService precisará injetar `StorageService` e `PlanLimitsService` — seus módulos devem estar importados em TenantsModule ou ser `@Global()`. RedisModule é `@Global()` e não precisa de import explícito, mas por defesa em profundidade (padrão da 11-1), adicionar `RedisModule` ao imports também.

### 7.3 TenantsService — novos métodos

```typescript
// apps/api/src/tenants/tenants.service.ts

async getBranding(): Promise<BrandingResponse> {
  // 1. Cache hit: redis.get(`cache:branding:${tenantId}`)
  // 2. Cold: withTenantTx → prisma.tenant.findUniqueOrThrow({ select: { plan, logoUrl, brandPrimaryColor, brandSecondaryColor, displayName } })
  // 3. Write-through: redis.set(key, JSON.stringify(result), 'EX', 3600)
  // 4. Retornar { primaryColor, secondaryColor, displayName, logoUrl, plan, canCustomizeBranding: plan !== 'free' }
}

async updateBranding(dto: UpdateBrandingInput): Promise<BrandingResponse> {
  // 1. Obter tenantId via AsyncLocalStorage (withTenantTx já injeta)
  // 2. Verificar tenant.plan; se 'free' e dto inclui primaryColor/secondaryColor → throw ForbiddenException(msg acionável)
  // 3. withTenantTx → prisma.tenant.update({ data: { brandPrimaryColor: dto.primaryColor, ... } })
  // 4. WRITE-THROUGH: redis.set(`cache:branding:${tenantId}`, JSON.stringify(result), 'EX', 3600)
  // 5. Retornar BrandingResponse
}

async uploadLogo(file: MulterFile): Promise<{ logoUrl: string }> {
  // 1. Gate Free → ForbiddenException
  // 2. Validar size ≤ 2MB; mimetype ∈ PNG/JPG/SVG
  // 3. import sharp from 'sharp' — processar síncrono:
  //    a. metadata = await sharp(file.buffer).metadata()
  //    b. Validar width/height: mín 64, máx 512
  //    c. navBuffer = await sharp(file.buffer).resize(128, 128).toBuffer()
  //    d. favBuffer = await sharp(file.buffer).resize(64, 64).toBuffer()
  // 4. StorageService.upload(`tenants/${tenantId}/logo-nav.png`, navBuffer, 'image/png')
  // 5. StorageService.upload(`tenants/${tenantId}/logo-fav.png`, favBuffer, 'image/png')
  // 6. signedUrl = await StorageService.getSignedUrl(`tenants/${tenantId}/logo-nav.png`, 3600)
  // 7. prisma.tenant.update({ data: { logoUrl: signedUrl } }) via withTenantTx
  // 8. WRITE-THROUGH Redis
  // 9. Retornar { logoUrl: signedUrl }
}
```

### 7.4 TenantsController — novos endpoints

```typescript
// Adicionar ao TenantsController:

@Get('me/branding')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN_TENANT)
async getBranding() {
  return { data: await this.service.getBranding() };
}

@Patch('me/branding')
@HttpCode(HttpStatus.OK)
@UseGuards(RolesGuard)
@Roles(Role.ADMIN_TENANT)
@UsePipes(new ZodValidationPipe(UpdateBrandingSchema))
@UseInterceptors(ScrubPiiInterceptor)
@ApiOperation({ summary: 'Update tenant branding (colors + display name)' })
async updateBranding(@Body() dto: UpdateBrandingInput) {
  return { data: await this.service.updateBranding(dto) };
}

@Post('me/branding/logo')
@HttpCode(HttpStatus.OK)
@UseGuards(RolesGuard)
@Roles(Role.ADMIN_TENANT)
@UseInterceptors(FileInterceptor('file'))
@ApiOperation({ summary: 'Upload tenant logo (PNG/JPG/SVG ≤2MB)' })
async uploadLogo(@UploadedFile() file: MulterFile | undefined) {
  if (!file) throw new BadRequestException('Arquivo não recebido. Envie o logo no campo "file".');
  return { data: await this.service.uploadLogo(file) };
}
```

---

## 8. Testes de integração (backend)

**Padrão:** service-level (TestingModule isolado + Prisma/Redis reais). Sem HTTP/guards.

### 8.1 Setup obrigatório

```typescript
// ConfigModule.forRoot({ isGlobal: true }) — obrigatório no TestingModule
// Tenant-scoped: rodar via withTenantTx (tenantId real do seed)
// Conexão privilegiada (DATABASE_URL) para seed/cleanup — não app role
```

### 8.2 Cenários mínimos

| Cenário | Resultado esperado |
|---|---|
| GET branding — cache miss → DB | retorna campos + write-through Redis |
| GET branding — cache hit | retorna sem hit no DB |
| PATCH branding — Pro tenant, cores válidas | persiste + invalida cache (write-through) |
| PATCH branding — Free tenant, tenta setar primaryColor | lança ForbiddenException |
| PATCH branding — Free tenant, só displayName | persiste |
| PATCH branding — cor inválida (não-hex) | lança ValidationException (Zod) |
| POST logo — arquivo válido 200×200 PNG | gera 128×128 + 64×64, salva MinIO, retorna URL |
| POST logo — arquivo > 2MB | lança BadRequestException |
| POST logo — dimensão < 64×64 | lança BadRequestException |
| POST logo — Free tenant | lança ForbiddenException |

---

## 9. Frontend

### 9.1 Utilitário de contraste

**Arquivo:** `apps/web/src/lib/contrast-checker.ts`

```typescript
// Implementa fórmula WCAG 2.1 contrast ratio
// relativeLuminance(hexColor: string): number
// contrastRatio(hex1: string, hex2: string): number
// checkBrandContrast(primaryHex: string): { surfaceBase: number; surfaceElevated: number; hasWarning: boolean }
// Surface references: surface-base = '#FAFAF8', surface-elevated = '#FFFFFF'
// hasWarning = true se qualquer ratio < 4.5
```

### 9.2 Tela de settings

**Arquivo:** `apps/web/src/app/(authenticated)/admin/settings/branding/page.tsx`

- Server Component: busca `GET /api/v1/tenants/me/branding` via `fetch` nativo com `next: { revalidate: 1800 }` (30min)
- Client Component filho `BrandingSettingsForm`: 
  - Upload logo: `<input type="file" accept=".png,.jpg,.jpeg,.svg">` + preview `<Image>`
  - Color pickers: `<input type="color">` para primary e secondary + display do valor hex
  - Display name: `<input type="text">`
  - Botão salvar: `isPending` state do `useMutation`
  - Aviso contraste: não-bloqueante, exibe se `hasWarning === true`
- Hook mutations:
  ```typescript
  const updateBranding = useMutation<BrandingResponse, Error, UpdateBrandingInput>({
    mutationFn: async (data) => {
      const res = await fetch('/api/v1/tenants/me/branding', { method: 'PATCH', ... });
      return res.json();
    },
  });
  const uploadLogo = useMutation<{ logoUrl: string }, Error, File>({...});
  ```
- Gate FE: `plan === 'free'` → `disabled` em logo + color pickers + tooltip upgrade prompt; display name sempre editável

### 9.3 CSS custom props — injeção no layout

**Arquivo:** `apps/web/src/app/(authenticated)/layout.tsx` (ou componente Provider)

```tsx
// Busca GET /api/v1/tenants/me/branding no layout autenticado (SSR)
// Se tenant tem primaryColor/secondaryColor configurados:
<body style={{
  '--color-brand-primary': branding.primaryColor ?? undefined,
  '--color-brand-secondary': branding.secondaryColor ?? undefined,
} as React.CSSProperties}>
```

Override em `tailwind.preset.ts`: usar `--color-brand-primary` como valor de `theme.colors.brand.primary` via `var(--color-brand-primary, <default-fallback>)`.

### 9.4 i18n PT-BR (chaves mínimas)

```json
// apps/web/messages/pt-BR.json — adicionar em seção "settings.branding":
{
  "settings": {
    "branding": {
      "title": "Identidade Visual da Igreja",
      "logoLabel": "Logo da Igreja",
      "logoHint": "PNG, JPG ou SVG — mínimo 64×64px, máximo 512×512px, até 2MB",
      "primaryColorLabel": "Cor Principal",
      "secondaryColorLabel": "Cor Secundária",
      "displayNameLabel": "Nome de Exibição",
      "saveButton": "Salvar Identidade Visual",
      "contrastWarning": "Atenção: o contraste desta cor pode dificultar a leitura.",
      "upgradePlan": "Disponível no plano Pro. Faça upgrade para personalizar logo e cores.",
      "saveSuccess": "Identidade visual atualizada com sucesso.",
      "saveError": "Não foi possível salvar. Tente novamente."
    }
  }
}
```

### 9.5 Testes de acessibilidade (jest-axe)

**Gate real de a11y** — executar no componente:
- Labels associados a todos os inputs (`htmlFor` + `id`)
- Upload input com `aria-label` ou `aria-labelledby`
- Preview de logo com `alt` descritivo
- Sem `role="article"` em elementos `<a>` (lição da 11-1)
- Color picker acessível (não confiar só no `type="color"`)

---

## 10. Guardrails de CI (lições críticas)

| Risco | Mitigação |
|---|---|
| `sharp` não instalado | `pnpm add sharp --filter @metanoia/api` + commit lock antes de qualquer código |
| trigger `set_timestamp` | NÃO criar — projeto usa `@updatedAt` Prisma; zero triggers no schema |
| RLS spec duplicada | `tenants` já tem policy; colunas entram cobertas; não criar spec nova para branding |
| DI crash no boot | StorageModule + PlanLimitsModule + RedisModule (defesa) em TenantsModule.imports |
| `import * as sharp` | Usar `import sharp from 'sharp'` (esModuleInterop) |
| jest-axe falha a11y | Todos inputs com labels; sem roles inválidos em `<a>` |
| ConfigModule ausente no TestingModule | `ConfigModule.forRoot({ isGlobal: true })` obrigatório |
| Cache só DEL (não write-through) | Sempre SET no PATCH — padrão do projeto |

---

## 11. Critérios de aceitação

| # | Critério | Verificação |
|---|---|---|
| AC1 | Admin Tenant Pro/Enterprise pode salvar logo + cores + display name | Teste service + FE manual |
| AC2 | Free → só display name; logo/cores retornam 403 acionável | Teste service ForbiddenException |
| AC3 | Logo validado: ≤2MB, dims 64-512px, formatos aceitos | Teste service uploadLogo |
| AC4 | Resize 128×128 e 64×64 gerados e salvos no MinIO | Teste service + MinIO mock |
| AC5 | Cache Redis write-through no GET (cold → SET) e no PATCH (SET) | Teste service redis spy |
| AC6 | CSS custom props `--color-brand-primary`/`--color-brand-secondary` injetados no layout | Inspecionar DOM no teste E2E ou Playwright |
| AC7 | Aviso de contraste não-bloqueante quando ratio < 4.5:1 | Teste unitário `contrast-checker.ts` |
| AC8 | Tela passa jest-axe (labels, roles, alt text) | Teste a11y automático |
| AC9 | `BrandingResponseSchema` tem snapshot test | Teste snapshot em `packages/types` |
| AC10 | `pnpm build` verde com `sharp` como dep direta de `@metanoia/api` | CI build |

---

## 12. Arquivos a criar / modificar

### Novos
- `docs/specs/branding-tenant/spec.md` (este arquivo)
- `apps/api/prisma/migrations/<timestamp>_add_branding_columns.sql`
- `packages/types/src/tenants/branding.ts` (ou adicionar em `tenant.ts`)
- `packages/types/src/__tests__/branding.spec.ts`
- `apps/api/src/tenants/branding.service.ts` (ou métodos em `tenants.service.ts`)
- `apps/api/src/tenants/__tests__/branding.service.spec.ts`
- `apps/web/src/lib/contrast-checker.ts`
- `apps/web/src/lib/__tests__/contrast-checker.spec.ts`
- `apps/web/src/app/(authenticated)/admin/settings/branding/page.tsx`
- `apps/web/src/app/(authenticated)/admin/settings/branding/BrandingSettingsForm.tsx`

### Modificar
- `apps/api/prisma/schema.prisma` — 3 colunas em model `Tenant`
- `apps/api/package.json` — adicionar `sharp`
- `pnpm-lock.yaml` — regenerado pelo `pnpm install`
- `apps/api/src/tenants/tenants.module.ts` — adicionar imports StorageModule, PlanLimitsModule, RedisModule
- `apps/api/src/tenants/tenants.controller.ts` — 3 novos endpoints
- `apps/api/src/tenants/tenants.service.ts` — 3 novos métodos
- `packages/types/src/index.ts` — exportar BrandingSchema
- `apps/web/src/app/(authenticated)/layout.tsx` — injetar CSS custom props
- `apps/web/messages/pt-BR.json` — chaves `settings.branding.*`

---

## 13. Dependências de outras features

| Feature | Status | Uso aqui |
|---|---|---|
| Story 11-1 (Planos & Limites) | DONE (PR #148) | `tenant.plan` disponível; `PlanLimitsService` disponível |
| Story 3-3 (PlanLimitsGuard) | DONE | Disponível; não usado diretamente (gate simples por plan enum) |
| StorageService (Story 8-2) | DONE | Reusar sem modificar |

---

## Clarifications

### Session 2026-06-14

- Q: O GET /me/branding deve expor somente `logoUrl` (nav 128×128) ou também `logoFavUrl` (64×64) separadamente no BrandingResponseSchema? → A: Apenas `logoUrl` (nav 128×128). O `BrandingResponseSchema` (§5.1) define apenas `logoUrl: z.string().url().nullable()`, consistente com RF-01 e `uploadLogo` em §7.3 step 9 que retorna `{ logoUrl: signedUrl }`. Favicon é resolvido internamente pelo layout via CSS/HTML com a mesma URL.
- Q: Deve existir uma forma de remover o logo customizado (voltar ao default) nesta story? → A: Fora de escopo desta story. Remoção pode ser feita futuramente via `PATCH /me/branding` com `{ logoUrl: null }`. Nenhum AC (AC1-AC10) nem §12 lista endpoint de remoção; PRs devem ser focados (Constitution VII).
- Q: No cache miss do GET branding, o service deve regenerar a signed URL (nova chamada StorageService.getSignedUrl) ou retornar a URL armazenada no DB como está? → A: Retornar a URL do DB como está. O cold path de RF-01 é "DB + write Redis" sem nova chamada ao StorageService. §7.3 `getBranding()` steps 1-4 confirmam isso. Signed URL TTL 4h vs cache TTL 1h cobre a janela de expiração de forma aceitável para MVP.
