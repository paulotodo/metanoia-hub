/**
 * csv-validator.ts
 * Validates raw rows from csv-parser against business rules.
 *
 * Classification:
 *   🔴 crítico  — blocks import (canProceed: false when any exist) (FR-15)
 *   🟡 aviso    — warnings, import can proceed
 *   ✅ ok       — no issues
 *
 * Pastoral vocabulary is in pt-BR.json under `import.error.*` / `import.warning.*`.
 * Here we use message keys so consumers can look up translations; raw PT-BR strings
 * are also returned for convenience (used in pre-component validation before i18n loads).
 */

import type { RawCSVRow } from './csv-parser';
import type { CSVValidationResult, CSVRow } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid `papel` values. Unknown values get defaulted to 'participante' (aviso). */
const VALID_ROLES = new Set(['participante', 'lider']);

/** RFC 5322 simplified — sufficient for human-facing import validation. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Maximum preview rows shown in the UI (FR-16). */
const SAMPLE_SIZE = 10;

// ---------------------------------------------------------------------------
// Message helpers (PT-BR pastoral)
// ---------------------------------------------------------------------------

const MESSAGES = {
  emailMissing: 'E-mail obrigatório não informado',
  emailInvalid: 'E-mail inválido',
  nameTooShort: 'Nome deve ter pelo menos 2 caracteres',
  columnMissing: (col: string) => `Coluna obrigatória ausente: ${col}`,
  roleInvalid: (role: string) =>
    `Papel "${role}" não reconhecido — será tratado como "participante"`,
  emailExists: 'Este e-mail já é membro da comunidade',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-email existence result from the API hook. */
export interface EmailExistenceMap {
  [email: string]: boolean;
}

// ---------------------------------------------------------------------------
// Row-level validation
// ---------------------------------------------------------------------------

function validateRow(
  raw: RawCSVRow,
  emailExistenceMap: EmailExistenceMap,
): CSVRow {
  const messages: string[] = [];
  let status: 'critico' | 'aviso' | 'ok' = 'ok';

  const bump = (level: 'critico' | 'aviso', message: string) => {
    messages.push(message);
    if (level === 'critico') {
      status = 'critico';
    } else if (status === 'ok') {
      status = 'aviso';
    }
  };

  // --- nome ---
  const nome = raw.nome?.trim() ?? '';
  if (nome.length < 2) {
    bump('critico', MESSAGES.nameTooShort);
  }

  // --- email ---
  const email = raw.email?.trim() ?? '';
  if (!email) {
    bump('critico', MESSAGES.emailMissing);
  } else if (!EMAIL_REGEX.test(email)) {
    bump('critico', MESSAGES.emailInvalid);
  } else {
    // Email exists check (aviso — duplicate) — only when API result is available
    if (emailExistenceMap[email.toLowerCase()] === true) {
      bump('aviso', MESSAGES.emailExists);
    }
  }

  // --- papel ---
  const rawPapel = raw.papel?.trim().toLowerCase() ?? '';
  let papel: 'participante' | 'lider' = 'participante';
  if (rawPapel && !VALID_ROLES.has(rawPapel)) {
    bump('aviso', MESSAGES.roleInvalid(rawPapel));
  } else if (rawPapel === 'lider') {
    papel = 'lider';
  }

  return {
    nome,
    email,
    telefone: raw.telefone?.trim() ?? null,
    papel,
    status,
    messages,
    rowIndex: raw.rowIndex,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates all parsed rows and returns a `CSVValidationResult`.
 *
 * @param rawRows       - Output of `csv-parser.parseFile()`
 * @param options       - Additional context for validation
 */
export function validateCSV(
  rawRows: RawCSVRow[],
  options: {
    missingRequiredColumns?: string[];
    multiSheetWarning?: boolean;
    encoding?: 'utf-8' | 'iso-8859-1' | 'windows-1252';
    emailExistenceMap?: EmailExistenceMap;
  } = {},
): CSVValidationResult {
  const {
    missingRequiredColumns = [],
    multiSheetWarning = false,
    encoding = 'utf-8',
    emailExistenceMap = {},
  } = options;

  // If required columns are missing, all rows are critical (FR-10)
  // We still process rows but mark them critical via the column-missing message
  const headerCritical = missingRequiredColumns.length > 0;

  const validatedRows: CSVRow[] = rawRows.map((raw) => {
    const row = validateRow(raw, emailExistenceMap);
    if (headerCritical && row.status !== 'critico') {
      // Escalate to critical if header is missing required columns
      return {
        ...row,
        status: 'critico' as const,
        messages: [
          ...row.messages,
          ...missingRequiredColumns.map(MESSAGES.columnMissing),
        ],
      };
    }
    return row;
  });

  // If there are no rows but header was present, still report no data
  const criticalCount =
    validatedRows.filter((r) => r.status === 'critico').length +
    (headerCritical && rawRows.length === 0 ? 1 : 0);
  const warningCount = validatedRows.filter((r) => r.status === 'aviso').length;
  const okCount = validatedRows.filter((r) => r.status === 'ok').length;

  return {
    rows: validatedRows.slice(0, SAMPLE_SIZE),
    totalRows: rawRows.length,
    criticalCount,
    warningCount,
    okCount,
    sampleSize: Math.min(rawRows.length, SAMPLE_SIZE),
    canProceed: criticalCount === 0 && rawRows.length > 0,
    encoding,
    multiSheetWarning,
    missingRequiredColumns,
  };
}
