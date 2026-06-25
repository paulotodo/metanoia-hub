# Data Model: Semáforo Multimodal (Story 15.3)

**Feature**: `a11y-semaforo-multimodal`

> Esta feature é puramente de UI/acessibilidade — não introduz tabelas, migrations, schemas Prisma nem entidades de domínio persistidas. As "entidades" abaixo são constantes de apresentação (vocabulary) e tipos de componente.

## Constantes de vocabulário (packages/types)

### SIGNAL_STATUS_LABELS (novo — FR-014)

Fonte única dos rótulos de status por-participante. Centraliza as duplicatas atuais.

```
SIGNAL_STATUS_LABELS: Record<SignalType, string> = {
  'care-urgent':    'Urgente',
  'care-attention': 'Atenção necessária',
  'care-ok':        'Bem',
}
```

- Tipo `SignalType` já existe em `packages/types/src/radar.ts` (`z.enum(['care-urgent','care-attention','care-ok'])`).
- Valores **idênticos** aos atuais em `participant-card.tsx:13` e `use-participant-status-announcer.ts:7` — garante que o teste `"João — Urgente"` da 15.2 continue verde.
- Coexiste com `SEMAFORO_STATUS_LABELS` (rótulos de seção/bucket: "Precisam de cuidado"/"Pedem atenção"/"Estão bem"), que permanece inalterado.

### Snapshot

Se `vocabulary.snapshot.spec.ts` cobrir o mapa `PASTORAL_VOCABULARY`, adicionar `signalStatusLabels: SIGNAL_STATUS_LABELS` ao mapa e atualizar o snapshot via `pnpm --filter @metanoia/types test -u`.

## Tipos de componente (apps/web)

### SemaforoStatusBadgeProps

```
interface SemaforoStatusBadgeProps {
  signalType: SignalType;       // estado pastoral
  participantName?: string;     // compõe aria-label quando presente
  compact?: boolean;            // modo compacto (default false)
  animatePulse?: boolean;       // aciona pulso 1s (default false)
}
```

### Mapeamento de ícones (constante interna do componente)

```
SIGNAL_ICON: Record<SignalType, LucideIcon> = {
  'care-urgent':    AlertCircle,
  'care-attention': AlertTriangle,
  'care-ok':        CheckCircle2,
}
```

## Tokens de cor (referência, sem mudança)

| Status | Light | Dark | Surface dark | Alvo color2k |
|--------|-------|------|--------------|--------------|
| care-urgent | #c1666b | #d4918a | #1a1a1a / #2a2a2a | ≥ 3:1 (non-text) |
| care-attention | #d4a24c | #e0bd7a | #1a1a1a / #2a2a2a | ≥ 3:1 (non-text) |
| care-ok | #7ba38a | #96bda4 | #1a1a1a / #2a2a2a | ≥ 3:1 (non-text) |

Nenhum token novo é criado — apenas consumidos via classes Tailwind `text-care-*`.
