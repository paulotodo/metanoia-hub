/**
 * csv-validator.spec.ts
 * Unit tests for validateCSV().
 */

import { describe, it, expect } from 'vitest';
import { validateCSV } from './csv-validator';
import type { RawCSVRow } from './csv-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<RawCSVRow> = {}, rowIndex = 2): RawCSVRow {
  return {
    nome: 'João Silva',
    email: 'joao@ex.com',
    telefone: '11999990001',
    papel: 'participante',
    rowIndex,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Crítico — row-level
// ---------------------------------------------------------------------------

describe('validateCSV — crítico', () => {
  it('marks row crítico when email is missing', () => {
    const rows = [makeRow({ email: undefined })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('critico');
    expect(result.rows[0]?.messages).toContain('E-mail obrigatório não informado');
    expect(result.criticalCount).toBe(1);
    expect(result.canProceed).toBe(false);
  });

  it('marks row crítico when email is empty string', () => {
    const rows = [makeRow({ email: '' })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('critico');
    expect(result.criticalCount).toBe(1);
  });

  it('marks row crítico when email is invalid (RFC)', () => {
    const rows = [makeRow({ email: 'not-an-email' })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('critico');
    expect(result.rows[0]?.messages).toContain('E-mail inválido');
  });

  it('marks row crítico when nome is too short (<2 chars)', () => {
    const rows = [makeRow({ nome: 'J' })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('critico');
    expect(result.rows[0]?.messages).toContain('Nome deve ter pelo menos 2 caracteres');
  });

  it('marks row crítico when nome is undefined', () => {
    const rows = [makeRow({ nome: undefined })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('critico');
  });

  it('canProceed is false when any row is crítico', () => {
    const rows = [
      makeRow({ email: 'valid@ex.com' }, 2),          // ok
      makeRow({ email: undefined }, 3),                 // crítico
    ];
    const result = validateCSV(rows);

    expect(result.canProceed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Aviso — row-level
// ---------------------------------------------------------------------------

describe('validateCSV — aviso', () => {
  it('marks row aviso when papel is unrecognized', () => {
    const rows = [makeRow({ papel: 'desconhecido' })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('aviso');
    expect(result.rows[0]?.messages[0]).toContain('desconhecido');
    expect(result.rows[0]?.papel).toBe('participante'); // defaulted
    expect(result.warningCount).toBe(1);
  });

  it('marks row aviso when email already exists in tenant', () => {
    const rows = [makeRow({ email: 'existing@ex.com' })];
    const result = validateCSV(rows, {
      emailExistenceMap: { 'existing@ex.com': true },
    });

    expect(result.rows[0]?.status).toBe('aviso');
    expect(result.rows[0]?.messages).toContain(
      'Este e-mail já é membro da comunidade',
    );
  });

  it('canProceed is true when only aviso (no crítico)', () => {
    const rows = [makeRow({ papel: 'invalido' })];
    const result = validateCSV(rows);

    expect(result.canProceed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ok
// ---------------------------------------------------------------------------

describe('validateCSV — ok', () => {
  it('marks valid row as ok', () => {
    const rows = [makeRow()];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('ok');
    expect(result.rows[0]?.messages).toHaveLength(0);
    expect(result.okCount).toBe(1);
    expect(result.canProceed).toBe(true);
  });

  it('normalizes lider papel correctly', () => {
    const rows = [makeRow({ papel: 'lider' })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.papel).toBe('lider');
    expect(result.rows[0]?.status).toBe('ok');
  });

  it('allows optional fields (telefone) to be undefined', () => {
    const rows = [makeRow({ telefone: undefined })];
    const result = validateCSV(rows);

    expect(result.rows[0]?.status).toBe('ok');
    expect(result.rows[0]?.telefone).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Missing required column (header-level crítico)
// ---------------------------------------------------------------------------

describe('validateCSV — missing required columns', () => {
  it('escalates all rows to crítico when header is missing required columns', () => {
    const rows = [makeRow({ nome: 'Ana', email: 'ana@ex.com' })];
    const result = validateCSV(rows, {
      missingRequiredColumns: ['email'],
    });

    // Row would be ok individually, but header missing escalates to crítico
    expect(result.rows[0]?.status).toBe('critico');
    expect(result.missingRequiredColumns).toContain('email');
    expect(result.canProceed).toBe(false);
  });

  it('reports missingRequiredColumns in result', () => {
    const rows = [makeRow()];
    const result = validateCSV(rows, {
      missingRequiredColumns: ['nome', 'email'],
    });

    expect(result.missingRequiredColumns).toEqual(['nome', 'email']);
  });
});

// ---------------------------------------------------------------------------
// Summary counters
// ---------------------------------------------------------------------------

describe('validateCSV — counters and sampleSize', () => {
  it('counts crítico, aviso, ok correctly', () => {
    const rows = [
      makeRow({ email: undefined }, 2),              // crítico
      makeRow({ papel: 'invalido' }, 3),              // aviso
      makeRow({}, 4),                                 // ok
    ];
    const result = validateCSV(rows);

    expect(result.criticalCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(result.okCount).toBe(1);
    expect(result.totalRows).toBe(3);
  });

  it('limits rows to 10 (SAMPLE_SIZE) in result', () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      makeRow({ email: `user${i}@ex.com` }, i + 2),
    );
    const result = validateCSV(rows);

    expect(result.rows).toHaveLength(10);
    expect(result.totalRows).toBe(25);
    expect(result.sampleSize).toBe(10);
  });

  it('canProceed is false when totalRows is 0', () => {
    const result = validateCSV([]);
    expect(result.canProceed).toBe(false);
    expect(result.totalRows).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// multiSheetWarning propagation
// ---------------------------------------------------------------------------

describe('validateCSV — multiSheetWarning', () => {
  it('propagates multiSheetWarning from options', () => {
    const rows = [makeRow()];
    const result = validateCSV(rows, { multiSheetWarning: true });

    expect(result.multiSheetWarning).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Email existence map edge cases
// ---------------------------------------------------------------------------

describe('validateCSV — emailExistenceMap edge cases', () => {
  it('only warns (not crítico) when email exists', () => {
    const rows = [makeRow({ email: 'dupe@ex.com' })];
    const result = validateCSV(rows, {
      emailExistenceMap: { 'dupe@ex.com': true },
    });

    // aviso, not crítico — import can still proceed
    expect(result.rows[0]?.status).toBe('aviso');
    expect(result.canProceed).toBe(true);
  });

  it('ignores email existence for invalid email (crítico takes precedence)', () => {
    const rows = [makeRow({ email: 'bad-email' })];
    const result = validateCSV(rows, {
      emailExistenceMap: { 'bad-email': true },
    });

    expect(result.rows[0]?.status).toBe('critico');
  });
});
