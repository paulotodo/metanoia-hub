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
// Empty state pastoral — timeline individual de cuidado (Story 6-4)
// ---------------------------------------------------------------------------

/** Título do empty state quando não há ações de cuidado registradas */
export const PASTORAL_TIMELINE_EMPTY_TITLE =
  'Nenhuma ação de cuidado registrada' as const;

/** Mensagem de convite no empty state da timeline pastoral */
export const PASTORAL_TIMELINE_EMPTY_MESSAGE =
  'Que tal começar com uma mensagem?' as const;

/** Rótulo da seção de histórico de cuidado na timeline individual */
export const PASTORAL_CARE_HISTORY_LABEL = 'Histórico de cuidado' as const;

/** Rótulo de evento de presença na timeline mesclada */
export const PASTORAL_TIMELINE_EVENT_PRESENCE = 'Reunião' as const;

/** Rótulo de evento de ação pastoral na timeline mesclada */
export const PASTORAL_TIMELINE_EVENT_ACTION = 'Ação pastoral' as const;

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
  timelineEmptyTitle: PASTORAL_TIMELINE_EMPTY_TITLE,
  timelineEmptyMessage: PASTORAL_TIMELINE_EMPTY_MESSAGE,
  careHistoryLabel: PASTORAL_CARE_HISTORY_LABEL,
  timelineEventPresence: PASTORAL_TIMELINE_EVENT_PRESENCE,
  timelineEventAction: PASTORAL_TIMELINE_EVENT_ACTION,
} as const;

export type PastoralVocabulary = typeof PASTORAL_VOCABULARY;
