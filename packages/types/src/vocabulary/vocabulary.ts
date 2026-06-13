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
// NudgePastoral — sugestões proativas de cuidado (Story 6-5)
// ---------------------------------------------------------------------------

/** Título da seção de sugestões pastorais proativas */
export const PASTORAL_NUDGE_SECTION_TITLE = 'Sugestões de cuidado' as const;

/** Mensagem quando não há sugestões de cuidado no momento */
export const PASTORAL_NUDGE_EMPTY_STATE = 'Todos os participantes estão em dia.' as const;

/** Texto do CTA de nudge: registrar ação pastoral */
export const PASTORAL_NUDGE_CTA_LABEL = 'Registrar cuidado' as const;

/** Mapa de sugestão de nudge → texto pastoral para o líder */
export const PASTORAL_NUDGE_SUGGESTION_LABELS = {
  call: 'Sugestão: ligar para {{name}}',
  visit: 'Sugestão: visitar {{name}}',
  message: 'Sugestão: enviar mensagem para {{name}}',
} as const;

export type NudgeSuggestionKey = keyof typeof PASTORAL_NUDGE_SUGGESTION_LABELS;

// ---------------------------------------------------------------------------
// CelebrationBanner — transições positivas de status (Story 6-5)
// ---------------------------------------------------------------------------

/** Título do banner de celebração de melhoria de status */
export const PASTORAL_CELEBRATION_TITLE = 'Boa notícia!' as const;

/** Mensagem do banner de celebração — {{name}} é substituído pelo nome */
export const PASTORAL_CELEBRATION_MESSAGE = '{{name}} está melhorando!' as const;

/** Texto do botão de fechar o banner de celebração */
export const PASTORAL_CELEBRATION_DISMISS = 'Entendido' as const;

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
  nudgeSectionTitle: PASTORAL_NUDGE_SECTION_TITLE,
  nudgeEmptyState: PASTORAL_NUDGE_EMPTY_STATE,
  nudgeCtaLabel: PASTORAL_NUDGE_CTA_LABEL,
  nudgeSuggestionLabels: PASTORAL_NUDGE_SUGGESTION_LABELS,
  celebrationTitle: PASTORAL_CELEBRATION_TITLE,
  celebrationMessage: PASTORAL_CELEBRATION_MESSAGE,
  celebrationDismiss: PASTORAL_CELEBRATION_DISMISS,
} as const;

export type PastoralVocabulary = typeof PASTORAL_VOCABULARY;

// ---------------------------------------------------------------------------
// Wizard de Onboarding — 5 etapas pastorais (CHK017, Story 10-1)
// Labels user-facing em PT-BR; código/logs em inglês.
// ---------------------------------------------------------------------------

/** Step 1 — profile setup */
export const WIZARD_STEP_PROFILE_LABEL = 'Seu Perfil Pastoral' as const;
/** Step 2 — community setup */
export const WIZARD_STEP_COMMUNITY_LABEL = 'Sua Comunidade' as const;
/** Step 3 — first discipleship group */
export const WIZARD_STEP_GROUP_LABEL = 'Seu Primeiro Grupo de Discipulado' as const;
/** Step 4 — invite a leader */
export const WIZARD_STEP_INVITE_LABEL = 'Convide um Líder' as const;
/** Step 5 — discover pastoral radar */
export const WIZARD_STEP_RADAR_LABEL = 'Conheça o Radar Pastoral' as const;

/** Prompt asking how disciples know the pastor (Step 1 display name) */
export const WIZARD_DISPLAY_NAME_QUESTION = 'Como seus discípulos te conhecem?' as const;
/** Label for the pastoral title field (Step 1) */
export const WIZARD_ROLE_TITLE_LABEL = 'Seu título pastoral' as const;
/** Label for the community name field (Step 2) */
export const WIZARD_COMMUNITY_NAME_LABEL = 'Nome da sua comunidade' as const;

/** Primary CTA — conclude the wizard (Step 5) */
export const WIZARD_COMPLETE_BUTTON = 'Concluir Setup' as const;
/** Secondary action — skip entire wizard setup */
export const WIZARD_SKIP_LABEL = 'Pular configuração' as const;
/** Inline skip — defer a non-critical step */
export const WIZARD_SKIP_LATER_LABEL = 'Fazer depois' as const;
/** Navigation link to replay the wizard in read-only mode */
export const WIZARD_REPLAY_LABEL = 'Rever tutorial' as const;
/** Label for the demo radar preview in Step 5 */
export const WIZARD_DEMO_PREVIEW_LABEL = 'Exemplo de como o radar funciona' as const;
