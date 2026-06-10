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
  PASTORAL_VOCABULARY,
} from '../vocabulary';

describe('PASTORAL_VOCABULARY snapshot', () => {
  it('freezes the full vocabulary map — silent breaking changes detected', () => {
    expect(PASTORAL_VOCABULARY).toMatchInlineSnapshot(`
      {
        "accompaniment": "acompanhamento",
        "attention": "atenção pastoral",
        "care": "cuidado",
        "careSignal": "sinal de cuidado",
        "journey": "jornada",
        "presence": "presença",
        "semaforo": "semáforo",
        "semaforoStatusLabels": {
          "attention": "Pedem atenção",
          "ok": "Estão bem",
          "urgent": "Precisam de cuidado",
        },
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
