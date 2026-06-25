import { describe, it, expect } from 'vitest';
import {
  PASTORAL_CARE,
  PASTORAL_ACCOMPANIMENT,
  PASTORAL_PRESENCE,
  PASTORAL_ATTENTION,
  PASTORAL_VISIBILITY,
  PASTORAL_JOURNEY,
  PASTORAL_CARE_SIGNAL,
  SEMAFORO_LABEL,
  SEMAFORO_STATUS_LABELS,
  PASTORAL_TIMELINE_EMPTY_TITLE,
  PASTORAL_TIMELINE_EMPTY_MESSAGE,
  PASTORAL_CARE_HISTORY_LABEL,
  PASTORAL_TIMELINE_EVENT_PRESENCE,
  PASTORAL_TIMELINE_EVENT_ACTION,
  PASTORAL_VOCABULARY,
  SIGNAL_STATUS_LABELS,
} from '../vocabulary';

describe('PASTORAL_VOCABULARY snapshot', () => {
  it('freezes the full vocabulary map — silent breaking changes detected', () => {
    expect(PASTORAL_VOCABULARY).toMatchInlineSnapshot(`
      {
        "accompaniment": "acompanhamento",
        "attention": "atenção pastoral",
        "care": "cuidado",
        "careHistoryLabel": "Histórico de cuidado",
        "careSignal": "sinal de cuidado",
        "celebrationDismiss": "Entendido",
        "celebrationMessage": "{{name}} está melhorando!",
        "celebrationTitle": "Boa notícia!",
        "journey": "jornada",
        "nudgeCtaLabel": "Registrar cuidado",
        "nudgeEmptyState": "Todos os participantes estão em dia.",
        "nudgeSectionTitle": "Sugestões de cuidado",
        "nudgeSuggestionLabels": {
          "call": "Sugestão: ligar para {{name}}",
          "message": "Sugestão: enviar mensagem para {{name}}",
          "visit": "Sugestão: visitar {{name}}",
        },
        "presence": "presença",
        "semaforo": "semáforo",
        "semaforoStatusLabels": {
          "attention": "Pedem atenção",
          "ok": "Estão bem",
          "urgent": "Precisam de cuidado",
        },
        "signalStatusLabels": {
          "care-attention": "Atenção necessária",
          "care-ok": "Bem",
          "care-urgent": "Urgente",
        },
        "timelineEmptyMessage": "Que tal começar com uma mensagem?",
        "timelineEmptyTitle": "Nenhuma ação de cuidado registrada",
        "timelineEventAction": "Ação pastoral",
        "timelineEventPresence": "Reunião",
        "visibility": "visibilidade pastoral",
      }
    `);
  });
});

describe('SEMAFORO_STATUS_LABELS snapshot', () => {
  it('freezes semaforo status labels', () => {
    expect(SEMAFORO_STATUS_LABELS).toMatchInlineSnapshot(`
      {
        "attention": "Pedem atenção",
        "ok": "Estão bem",
        "urgent": "Precisam de cuidado",
      }
    `);
  });
});

describe('individual pastoral term constants', () => {
  it('all constants export correct PT-BR values', () => {
    expect(PASTORAL_CARE).toBe('cuidado');
    expect(PASTORAL_ACCOMPANIMENT).toBe('acompanhamento');
    expect(PASTORAL_PRESENCE).toBe('presença');
    expect(PASTORAL_ATTENTION).toBe('atenção pastoral');
    expect(PASTORAL_VISIBILITY).toBe('visibilidade pastoral');
    expect(PASTORAL_JOURNEY).toBe('jornada');
    expect(PASTORAL_CARE_SIGNAL).toBe('sinal de cuidado');
    expect(SEMAFORO_LABEL).toBe('semáforo');
  });
});

describe('Story 6-4 timeline vocabulary constants', () => {
  it('empty state and timeline labels are correct PT-BR', () => {
    expect(PASTORAL_TIMELINE_EMPTY_TITLE).toBe('Nenhuma ação de cuidado registrada');
    expect(PASTORAL_TIMELINE_EMPTY_MESSAGE).toBe('Que tal começar com uma mensagem?');
    expect(PASTORAL_CARE_HISTORY_LABEL).toBe('Histórico de cuidado');
    expect(PASTORAL_TIMELINE_EVENT_PRESENCE).toBe('Reunião');
    expect(PASTORAL_TIMELINE_EVENT_ACTION).toBe('Ação pastoral');
  });
});

describe('Story 15.3 — SIGNAL_STATUS_LABELS', () => {
  it('freezes per-participant signal status labels snapshot', () => {
    expect(SIGNAL_STATUS_LABELS).toMatchInlineSnapshot(`
      {
        "care-attention": "Atenção necessária",
        "care-ok": "Bem",
        "care-urgent": "Urgente",
      }
    `);
  });

  it('maps all three SignalType values to pastoral PT-BR terms (not corporate terms)', () => {
    expect(SIGNAL_STATUS_LABELS['care-urgent']).toBe('Urgente');
    expect(SIGNAL_STATUS_LABELS['care-attention']).toBe('Atenção necessária');
    expect(SIGNAL_STATUS_LABELS['care-ok']).toBe('Bem');
    // Ensure corporate terms are not used (dec-005)
    const labels = Object.values(SIGNAL_STATUS_LABELS);
    expect(labels).not.toContain('Crítico');
    expect(labels).not.toContain('Ativo');
    expect(labels).not.toContain('Alerta');
  });
});
