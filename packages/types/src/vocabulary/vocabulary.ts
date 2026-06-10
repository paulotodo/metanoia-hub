/**
 * Vocabulário Pastoral Centralizado
 *
 * Fonte única de termos pastorais para toda a plataforma.
 * Todos os textos user-facing relacionados a acompanhamento e cuidado
 * DEVEM referenciar estas constantes em vez de usar strings hardcoded.
 *
 * @see packages/config/eslint/no-surveillance-terms.js — regra que bloqueia
 *   o uso de termos de vigilância fora deste vocabulário.
 */

// ---------------------------------------------------------------------------
// Termos de ação pastoral (verbos / substantivos de cuidado)
// ---------------------------------------------------------------------------
export const PASTORAL_CARE = 'cuidado' as const;
export const PASTORAL_ACCOMPANIMENT = 'acompanhamento' as const;
export const PASTORAL_PRESENCE = 'presença' as const;
export const PASTORAL_ATTENTION = 'atenção pastoral' as const;
export const PASTORAL_VISIBILITY = 'visibilidade pastoral' as const;
export const PASTORAL_JOURNEY = 'jornada' as const;
export const PASTORAL_CARE_SIGNAL = 'sinal de cuidado' as const;

// ---------------------------------------------------------------------------
// Termos do sistema de semáforo de cuidado
// ---------------------------------------------------------------------------
export const SEMAFORO_LABEL = 'semáforo' as const;

/** Rótulos de status do semáforo — uso em UI e acessibilidade */
export const SEMAFORO_STATUS_LABELS = {
  urgent: 'Precisam de cuidado',
  attention: 'Pedem atenção',
  ok: 'Estão bem',
} as const;

export type SemaforoStatus = keyof typeof SEMAFORO_STATUS_LABELS;
export type SemaforoStatusLabel = (typeof SEMAFORO_STATUS_LABELS)[SemaforoStatus];

// ---------------------------------------------------------------------------
// Mapa completo de termos pastorais (para referência e snapshot)
// ---------------------------------------------------------------------------
export const PASTORAL_VOCABULARY = {
  care: PASTORAL_CARE,
  accompaniment: PASTORAL_ACCOMPANIMENT,
  presence: PASTORAL_PRESENCE,
  attention: PASTORAL_ATTENTION,
  visibility: PASTORAL_VISIBILITY,
  journey: PASTORAL_JOURNEY,
  careSignal: PASTORAL_CARE_SIGNAL,
  semaforo: SEMAFORO_LABEL,
  semaforoStatusLabels: SEMAFORO_STATUS_LABELS,
} as const;

export type PastoralVocabulary = typeof PASTORAL_VOCABULARY;
