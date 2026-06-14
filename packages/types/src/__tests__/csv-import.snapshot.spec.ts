import { describe, it, expect } from 'vitest';
import {
  csvRowRoleSchema,
  csvRowStatusSchema,
  CSVRowSchema,
  CSVValidationResultSchema,
  checkEmailsQuerySchema,
  checkEmailsResponseSchema,
} from '../onboarding/csv-import';

// ---------------------------------------------------------------------------
// Story 10-3 — Snapshot tests (gate against silent breaking changes)
// ---------------------------------------------------------------------------

describe('csvRowRoleSchema', () => {
  it('accepts participante', () => {
    expect(csvRowRoleSchema.parse('participante')).toMatchSnapshot();
  });

  it('accepts lider', () => {
    expect(csvRowRoleSchema.parse('lider')).toMatchSnapshot();
  });

  it('rejects unknown role', () => {
    expect(() => csvRowRoleSchema.parse('admin')).toThrow();
  });
});

describe('csvRowStatusSchema', () => {
  it('accepts all valid statuses', () => {
    expect(csvRowStatusSchema.parse('critico')).toMatchSnapshot();
    expect(csvRowStatusSchema.parse('aviso')).toMatchSnapshot();
    expect(csvRowStatusSchema.parse('ok')).toMatchSnapshot();
  });

  it('rejects unknown status', () => {
    expect(() => csvRowStatusSchema.parse('error')).toThrow();
  });
});

describe('CSVRowSchema snapshot', () => {
  it('parses a valid row with all fields', () => {
    const input = {
      nome: 'João Silva',
      email: 'joao@exemplo.com',
      telefone: '11999990000',
      papel: 'participante' as const,
      status: 'ok' as const,
      messages: [],
      rowIndex: 0,
    };
    expect(CSVRowSchema.parse(input)).toMatchSnapshot();
  });

  it('parses a row with null telefone', () => {
    const input = {
      nome: 'Maria Santos',
      email: 'maria@exemplo.com',
      telefone: null,
      papel: 'lider' as const,
      status: 'aviso' as const,
      messages: ['Telefone não informado'],
      rowIndex: 1,
    };
    expect(CSVRowSchema.parse(input)).toMatchSnapshot();
  });

  it('parses a row with critico status and messages', () => {
    const input = {
      nome: 'X',
      email: 'invalido',
      telefone: null,
      papel: 'participante' as const,
      status: 'critico' as const,
      messages: ['Nome muito curto (mínimo 2 caracteres)', 'E-mail inválido'],
      rowIndex: 5,
    };
    expect(CSVRowSchema.parse(input)).toMatchSnapshot();
  });
});

describe('CSVValidationResultSchema snapshot', () => {
  it('parses a valid result with rows', () => {
    const input = {
      rows: [
        {
          nome: 'João Silva',
          email: 'joao@exemplo.com',
          telefone: null,
          papel: 'participante' as const,
          status: 'ok' as const,
          messages: [],
          rowIndex: 0,
        },
      ],
      totalRows: 1,
      criticalCount: 0,
      warningCount: 0,
      okCount: 1,
      sampleSize: 1,
      canProceed: true,
      encoding: 'utf-8' as const,
      multiSheetWarning: false,
      missingRequiredColumns: [],
    };
    expect(CSVValidationResultSchema.parse(input)).toMatchSnapshot();
  });

  it('parses a result with critical errors (canProceed: false)', () => {
    const input = {
      rows: [],
      totalRows: 10,
      criticalCount: 3,
      warningCount: 2,
      okCount: 5,
      sampleSize: 10,
      canProceed: false,
      encoding: 'iso-8859-1' as const,
      multiSheetWarning: false,
      missingRequiredColumns: ['email'],
    };
    expect(CSVValidationResultSchema.parse(input)).toMatchSnapshot();
  });

  it('parses a result with multiSheetWarning', () => {
    const input = {
      rows: [],
      totalRows: 0,
      criticalCount: 0,
      warningCount: 0,
      okCount: 0,
      sampleSize: 0,
      canProceed: true,
      encoding: 'windows-1252' as const,
      multiSheetWarning: true,
      missingRequiredColumns: [],
    };
    expect(CSVValidationResultSchema.parse(input)).toMatchSnapshot();
  });
});

describe('checkEmailsQuerySchema snapshot', () => {
  it('transforms comma-separated emails string into array', () => {
    const result = checkEmailsQuerySchema.parse({
      emails: 'joao@exemplo.com,maria@exemplo.com, pedro@exemplo.com',
    });
    expect(result).toMatchSnapshot();
  });

  it('lowercases and trims emails', () => {
    const result = checkEmailsQuerySchema.parse({
      emails: ' JOAO@Exemplo.com , MARIA@EXEMPLO.COM ',
    });
    expect(result.emails).toEqual(['joao@exemplo.com', 'maria@exemplo.com']);
  });

  it('rejects empty string (min 1)', () => {
    expect(() => checkEmailsQuerySchema.parse({ emails: '' })).toThrow();
  });

  it('rejects invalid email in list', () => {
    expect(() =>
      checkEmailsQuerySchema.parse({ emails: 'invalido,joao@exemplo.com' }),
    ).toThrow();
  });
});

describe('checkEmailsResponseSchema snapshot', () => {
  it('parses a valid response with mixed exists values', () => {
    const input = {
      data: {
        results: [
          { email: 'joao@exemplo.com', exists: true },
          { email: 'novo@exemplo.com', exists: false },
        ],
      },
      meta: {
        checkedCount: 2,
        tenantScoped: true as const,
      },
    };
    expect(checkEmailsResponseSchema.parse(input)).toMatchSnapshot();
  });

  it('rejects response without tenantScoped: true', () => {
    const input = {
      data: { results: [] },
      meta: { checkedCount: 0, tenantScoped: false },
    };
    expect(() => checkEmailsResponseSchema.parse(input)).toThrow();
  });
});
