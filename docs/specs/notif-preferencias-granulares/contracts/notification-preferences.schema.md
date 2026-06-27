# Schema Contract — packages/types/src/notifications/preferences.ts

Deriva dos enums REAIS de `packages/types/src/notification.ts`
(`NotificationTypeSchema`, `NotificationChannelSchema`) — reuso, não
redefinição. Snapshot test obrigatório (gate FR-011).

```ts
import { z } from 'zod';
import { NotificationTypeSchema } from '../notification';

// Canais lógicos do recurso (mapeiam para channel='in_app'|'email')
export const NotificationPreferenceChannelsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
});
export type NotificationPreferenceChannels =
  z.infer<typeof NotificationPreferenceChannelsSchema>;

// Objeto completo: uma entrada por NotificationType (os 7), todos presentes
// na resposta GET/PATCH (defaults resolvidos). Construído a partir do enum
// real para nunca divergir.
const _typeKeys = NotificationTypeSchema.options; // 7 valores
export const NotificationPreferencesSchema = z.object(
  Object.fromEntries(
    _typeKeys.map((t) => [t, NotificationPreferenceChannelsSchema]),
  ) as Record<(typeof _typeKeys)[number], typeof NotificationPreferenceChannelsSchema>,
);
export type NotificationPreferences =
  z.infer<typeof NotificationPreferencesSchema>;

// PATCH: parcial em ambos os níveis (tipo opcional, canal opcional).
// .strict() rejeita chaves fora do enum (FR-004).
export const UpdateNotificationPreferencesSchema = z
  .object(
    Object.fromEntries(
      _typeKeys.map((t) => [
        t,
        NotificationPreferenceChannelsSchema.partial().strict(),
      ]),
    ),
  )
  .partial()
  .strict();
export type UpdateNotificationPreferences =
  z.infer<typeof UpdateNotificationPreferencesSchema>;
```

> Nota de implementação: a forma exata (object-from-enum vs. enum literal
> explícito) pode ser ajustada na execução desde que: (1) cobre os 7 tipos
> reais, (2) `.strict()` rejeita tipo/canal fora do enum, (3) PATCH é parcial,
> (4) há snapshot test. O contrato é o COMPORTAMENTO acima.

## Job payload (aditivo)

`NotificationJobPayloadSchema` ganha `type: NotificationTypeSchema` (campo
aditivo, snapshot atualizado) para o worker checar preferência sem SELECT
extra. Jobs antigos sem `type` → fallback SELECT defensivo.
