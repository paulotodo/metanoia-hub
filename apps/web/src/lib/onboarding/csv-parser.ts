/**
 * csv-parser.ts
 * Parses .csv and .xlsx files into raw row objects for downstream validation.
 *
 * Design decisions:
 * - CSV: papaparse (bundled — small, no security issues)
 * - XLSX: read-excel-file via dynamic import() — NOT in the initial bundle (FR-06, SC-004)
 * - Encoding auto-detect: UTF-8 → ISO-8859-1 → Windows-1252 (BOM + byte heuristic) (FR-05)
 * - Only first sheet used for XLSX; multiSheetWarning emitted when >1 sheet (FR-07)
 * - Column matching: case-insensitive, by name (FR-08)
 * - Max file size: 5 MB (FR-02 — enforced upstream in FileUploadZone, validated here too)
 */

import Papa from 'papaparse';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB (FR-02)

/** Accepted column aliases (case-insensitive). */
const COLUMN_ALIASES: Record<string, string> = {
  // nome
  nome: 'nome',
  name: 'nome',
  // email
  email: 'email',
  'e-mail': 'email',
  'e_mail': 'email',
  // telefone
  telefone: 'telefone',
  phone: 'telefone',
  celular: 'telefone',
  fone: 'telefone',
  // papel
  papel: 'papel',
  role: 'papel',
  perfil: 'papel',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row extracted from the file — strings only, before Zod validation. */
export interface RawCSVRow {
  nome: string | undefined;
  email: string | undefined;
  telefone: string | undefined;
  papel: string | undefined;
  /** 1-based row index in the original file (header = row 1). */
  rowIndex: number;
}

export interface ParseResult {
  rows: RawCSVRow[];
  encoding: 'utf-8' | 'iso-8859-1' | 'windows-1252';
  multiSheetWarning: boolean;
  /** Missing required column names (if any). */
  missingRequiredColumns: string[];
}

// ---------------------------------------------------------------------------
// Encoding detection
// ---------------------------------------------------------------------------

/**
 * Detects encoding from raw bytes using BOM markers and byte pattern heuristics.
 * Priority: BOM → UTF-8 validity check → Windows-1252 heuristic → ISO-8859-1 heuristic → UTF-8 default.
 *
 * Key insight: UTF-8 multi-byte sequences follow strict continuation patterns (0x80–0xBF after
 * a lead byte). Latin-1/Windows-1252 files use high bytes (≥0x80) in non-UTF-8 positions.
 * We try UTF-8 decode first (fatal:false) and check for replacement chars (U+FFFD); if none,
 * the file is valid UTF-8.
 */
function detectEncoding(
  bytes: Uint8Array,
): 'utf-8' | 'iso-8859-1' | 'windows-1252' {
  // UTF-8 BOM: EF BB BF
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }

  // Check for Windows-1252 specific code-points FIRST (0x80–0x9F range — invalid in ISO-8859-1 Latin-1).
  // CP1252 chars: € (0x80), „ (0x84), … (0x85), † (0x86), Š (0x8A), Œ (0x8C), etc.
  // Do this BEFORE UTF-8 validity check because Win-1252 files often fail UTF-8 decode anyway.
  const sample = bytes.slice(0, Math.min(bytes.length, 4096));
  for (const b of sample) {
    if (b >= 0x80 && b <= 0x9f) {
      return 'windows-1252';
    }
  }

  // Try UTF-8 decode: if the string contains no replacement character (U+FFFD),
  // the bytes are valid UTF-8 (covers accented chars like é=c3a9, ã=c3a3, ç=c3a7).
  try {
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!decoded.includes('�')) {
      return 'utf-8';
    }
  } catch {
    // TextDecoder unavailable — fall through
  }

  // If high bytes (0xa0–0xff) are present and UTF-8 decode failed → ISO-8859-1 (Latin-1)
  for (const b of sample) {
    if (b >= 0xa0) {
      return 'iso-8859-1';
    }
  }

  return 'utf-8';
}

/**
 * Decodes a buffer to a string using the detected encoding.
 * Falls back to UTF-8 if TextDecoder rejects the label.
 */
function decodeBuffer(
  bytes: Uint8Array,
  encoding: 'utf-8' | 'iso-8859-1' | 'windows-1252',
): string {
  const encodingLabel =
    encoding === 'windows-1252' ? 'windows-1252' : encoding;
  try {
    const decoder = new TextDecoder(encodingLabel);
    return decoder.decode(bytes);
  } catch {
    // Fallback: try UTF-8
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// ---------------------------------------------------------------------------
// Column normalization
// ---------------------------------------------------------------------------

function normalizeColumnName(col: string): string {
  const lower = col.trim().toLowerCase();
  return COLUMN_ALIASES[lower] ?? lower;
}

function mapRow(
  rawRecord: Record<string, string>,
  normalizedHeaders: Map<string, string>,
  rowIndex: number,
): RawCSVRow {
  const get = (canonical: string): string | undefined => {
    const originalKey = normalizedHeaders.get(canonical);
    if (originalKey === undefined) return undefined;
    const val = rawRecord[originalKey];
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  };

  return {
    nome: get('nome'),
    email: get('email'),
    telefone: get('telefone'),
    papel: get('papel'),
    rowIndex,
  };
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCSVText(text: string): Omit<ParseResult, 'encoding'> {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(), // keep original casing for mapping
    transform: (v) => v.trim(),
  });

  const originalHeaders: string[] = result.meta.fields ?? [];

  // Build canonical → original mapping (case-insensitive, first match wins)
  const normalizedHeaders = new Map<string, string>();
  for (const h of originalHeaders) {
    const canonical = normalizeColumnName(h);
    if (!normalizedHeaders.has(canonical)) {
      normalizedHeaders.set(canonical, h);
    }
  }

  const missingRequiredColumns: string[] = [];
  for (const required of ['nome', 'email']) {
    if (!normalizedHeaders.has(required)) {
      missingRequiredColumns.push(required);
    }
  }

  const rows: RawCSVRow[] = result.data.map((record, i) =>
    mapRow(record, normalizedHeaders, i + 2), // +2: header=1, data starts at 2
  );

  return { rows, multiSheetWarning: false, missingRequiredColumns };
}

// ---------------------------------------------------------------------------
// XLSX parsing (dynamic import — excluded from initial bundle, FR-06)
// ---------------------------------------------------------------------------

async function parseXLSXBuffer(
  buffer: ArrayBuffer,
): Promise<Omit<ParseResult, 'encoding'>> {
  // Dynamic import using the browser subpath — excluded from initial bundle (SC-004, FR-06).
  // read-excel-file default export returns Promise<Sheet[]> where Sheet = { sheet: string, data: Row[][] }.
  const { default: readAllSheets } = await import('read-excel-file/browser');

  // read-excel-file accepts a File/Blob; wrap ArrayBuffer
  const blob = new Blob([buffer]);

  // readAllSheets returns ALL sheets — use this to detect multi-sheet (FR-07)
  const allSheets = await readAllSheets(blob as File);

  const multiSheetWarning = allSheets.length > 1;

  // Use only the first sheet's data
  const firstSheet = allSheets[0];
  if (!firstSheet || firstSheet.data.length === 0) {
    return { rows: [], multiSheetWarning, missingRequiredColumns: ['nome', 'email'] };
  }

  const sheetData = firstSheet.data;

  // First row is the header
  const headerRow = sheetData[0];
  if (!headerRow) {
    return { rows: [], multiSheetWarning, missingRequiredColumns: ['nome', 'email'] };
  }

  const originalHeaders: string[] = headerRow.map((cell) =>
    typeof cell === 'string' ? cell.trim() : String(cell ?? '').trim(),
  );

  const normalizedHeaders = new Map<string, string>();
  for (const h of originalHeaders) {
    const canonical = normalizeColumnName(h);
    if (!normalizedHeaders.has(canonical)) {
      normalizedHeaders.set(canonical, h);
    }
  }

  const missingRequiredColumns: string[] = [];
  for (const required of ['nome', 'email']) {
    if (!normalizedHeaders.has(required)) {
      missingRequiredColumns.push(required);
    }
  }

  // Build rows from data rows (skip header)
  const rows: RawCSVRow[] = sheetData.slice(1).map((row, i) => {
    const record: Record<string, string> = {};
    originalHeaders.forEach((h, idx) => {
      const cell = row[idx];
      record[h] = cell !== null && cell !== undefined ? String(cell).trim() : '';
    });
    return mapRow(record, normalizedHeaders, i + 2);
  });

  return { rows, multiSheetWarning, missingRequiredColumns };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a CSV or XLSX file and returns raw rows for downstream validation.
 *
 * @throws {Error} if the file exceeds 5 MB, is empty, or has an unsupported format.
 */
export async function parseFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Arquivo excede o limite de ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = await file.arrayBuffer();
    const partial = await parseXLSXBuffer(buffer);

    if (partial.rows.length === 0 && partial.missingRequiredColumns.length === 0) {
      throw new Error('Arquivo sem participantes');
    }

    return { ...partial, encoding: 'utf-8' };
  }

  if (extension === 'csv' || extension === 'txt') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const encoding = detectEncoding(bytes);
    const text = decodeBuffer(bytes, encoding);

    const partial = parseCSVText(text);

    if (partial.rows.length === 0) {
      throw new Error('Arquivo sem participantes');
    }

    return { ...partial, encoding };
  }

  throw new Error(
    `Formato não suportado: .${extension ?? 'desconhecido'}. Use .csv ou .xlsx.`,
  );
}
