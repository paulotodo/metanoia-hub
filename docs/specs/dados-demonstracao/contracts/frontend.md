# Frontend Contracts: dados-demonstracao (Story 10-2)

> Stack: Next.js 16.2 App Router, TanStack Query 5, Zustand 5, shadcn/ui, Zod 4.

---

## Zod Schemas (packages/types/src/onboarding.ts — extensão)

### DemoStatusResponseSchema (novo)

```typescript
export const DemoStatusResponseSchema = z.object({
  hasDemoData: z.boolean(),
  hasRealData: z.boolean(),
  nudgeDismissed: z.boolean(),
  demoRecordCount: z.number().int().nonnegative(),
});
export type DemoStatusResponse = z.infer<typeof DemoStatusResponseSchema>;
```

**Snapshot test obrigatório:** `packages/types/src/__tests__/onboarding.spec.ts` — adicionar `expect(DemoStatusResponseSchema.shape).toMatchSnapshot()`.

---

## Hooks (Client Components)

### `useDemoStatus`

```typescript
// apps/web/src/hooks/use-demo-status.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { DemoStatusResponseSchema } from '@metanoia/types';

export function useDemoStatus() {
  return useQuery({
    queryKey: ['demo-status'],
    queryFn: async () => {
      const res = await fetch('/api/v1/onboarding/demo-status');
      if (!res.ok) throw new Error('Failed to fetch demo status');
      const json = await res.json();
      return DemoStatusResponseSchema.parse(json.data);
    },
    staleTime: 30_000,
  });
}
```

### `useDeleteDemoData`

```typescript
// apps/web/src/hooks/use-delete-demo-data.ts
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteDemoData() {
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/v1/onboarding/demo-data', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete demo data');
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['demo-status'] });
    },
  });
}
```

### `useDismissDemoNudge`

```typescript
// apps/web/src/hooks/use-dismiss-demo-nudge.ts
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDismissDemoNudge() {
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/v1/onboarding/demo-nudge-dismiss', { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to dismiss nudge');
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['demo-status'] });
    },
  });
}
```

---

## Componentes

### `DemoOverlay` (novo)

```typescript
// apps/web/src/components/onboarding/demo-overlay.tsx
'use client';

interface DemoOverlayProps {
  isDemoData: boolean;
  children: React.ReactNode;
}
```

Renderiza `children` com wrapper visual (opacidade reduzida ou borda tracejada) quando `isDemoData=true`. Inclui badge shadcn `<Badge variant="outline">Dados de demonstração</Badge>`. Não inclui botão de limpeza (responsabilidade do `DemoCleanupButton`).

### `DemoCleanupButton` (novo)

```typescript
// apps/web/src/components/onboarding/demo-cleanup-button.tsx
'use client';
```

Botão "Limpar dados de demonstração" com `AlertDialog` de confirmação. Usa `useDeleteDemoData()`. Mensagem: "Isso removerá todos os dados de exemplo. Seus dados reais não serão afetados." Visível apenas quando `hasDemoData=true` (condicional via `useDemoStatus`).

### `DemoDataNudge` (novo)

```typescript
// apps/web/src/components/onboarding/demo-data-nudge.tsx
'use client';
```

Banner/toast contextual: "Você já tem dados reais! Deseja remover os dados de demonstração?" Botões: "Remover agora" (→ `useDeleteDemoData`) e "Manter por enquanto" (→ `useDismissDemoNudge`). Exibido quando `hasDemoData=true && hasRealData=true && !nudgeDismissed`. Verificado na página de grupos após criação.

---

## Localização (PT-BR)

Chaves novas em `apps/web/messages/pt-BR.json`:

```json
{
  "demo": {
    "badge": "Dados de demonstração",
    "nudge": {
      "title": "Você já tem dados reais!",
      "description": "Deseja remover os dados de demonstração?",
      "removeNow": "Remover agora",
      "keepForNow": "Manter por enquanto"
    },
    "cleanup": {
      "button": "Limpar dados de demonstração",
      "dialogTitle": "Remover dados de demonstração?",
      "dialogDescription": "Isso removerá todos os dados de exemplo. Seus dados reais não serão afetados.",
      "confirm": "Remover",
      "cancel": "Cancelar"
    }
  }
}
```

---

## Páginas afetadas

| Página | Mudança |
|--------|---------|
| `app/admin/grupos/` | Envolver listagem de grupos demo em `DemoOverlay`. Mostrar `DemoDataNudge` após criar primeiro grupo real. |
| `app/admin/grupos/novo/page.tsx` | Após mutação de criação bem-sucedida, invalidar `['demo-status']` e condicionar exibição do nudge. |
| Configurações (a implementar) | Incluir `DemoCleanupButton` em seção de configurações do tenant. |
| Radar Pastoral | `DemoOverlay` em participantes demo (opcional — badge discreto). |

---

## Convenções de Borda

| Camada | Case style | Validação | Fonte |
|--------|-----------|-----------|-------|
| DB columns | `snake_case` | migration + RLS spec | `prisma/schema.prisma` |
| Backend DTO | `camelCase` | Zod + class-validator via `ZodValidationPipe` | `packages/types/src/onboarding.ts` |
| API payload (response) | `camelCase` | `DemoStatusResponseSchema.parse(json.data)` no fetch | contratos frontend |
| URL paths | `kebab-case` | NestJS router | `/api/v1/onboarding/demo-data` |
| i18n keys | `camelCase` aninhado | — | `apps/web/messages/pt-BR.json` |

**ORM mapping:** Prisma `@map("is_demo_data")` → TypeScript `isDemoData` (camelCase automático). Sem mapper layer adicional.
