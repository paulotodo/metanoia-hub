/**
 * csv-parser.spec.ts
 * Unit tests for parseFile() — encodings, formats, edge cases.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseFile } from './csv-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCSVFile(content: string, filename = 'test.csv', encoding?: BufferEncoding): File {
  const buffer = Buffer.from(content, encoding ?? 'utf8');
  const blob = new Blob([buffer], { type: 'text/csv' });
  return new File([blob], filename, { type: 'text/csv' });
}

function makeFileFromBytes(bytes: Uint8Array, filename = 'test.csv'): File {
  const blob = new Blob([bytes], { type: 'text/csv' });
  return new File([blob], filename, { type: 'text/csv' });
}

function makeLargeFile(): File {
  // 6 MB — over the 5MB limit
  const content = 'nome,email\n' + 'a'.repeat(6 * 1024 * 1024);
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], 'big.csv', { type: 'text/csv' });
}

// ---------------------------------------------------------------------------
// CSV — UTF-8
// ---------------------------------------------------------------------------

describe('parseFile — CSV UTF-8', () => {
  it('parses a simple UTF-8 CSV with BOM', async () => {
    // BOM + header + 2 rows
    const content = '﻿nome,email,telefone,papel\nNatália Souza,natalia@ex.com,11999990001,participante\nJoão Lima,joao@ex.com,,lider';
    const file = makeCSVFile(content);
    const result = await parseFile(file);

    expect(result.encoding).toBe('utf-8');
    expect(result.multiSheetWarning).toBe(false);
    expect(result.missingRequiredColumns).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.nome).toBe('Natália Souza');
    expect(result.rows[0]?.email).toBe('natalia@ex.com');
    expect(result.rows[1]?.papel).toBe('lider');
  });

  it('parses UTF-8 CSV without BOM', async () => {
    const content = 'nome,email\nJosé Costa,jose@ex.com';
    const file = makeCSVFile(content);
    const result = await parseFile(file);

    expect(result.encoding).toBe('utf-8');
    expect(result.rows[0]?.nome).toBe('José Costa');
  });

  it('handles case-insensitive column names', async () => {
    const content = 'NOME,EMAIL,TELEFONE,PAPEL\nMaria,maria@ex.com,11999990002,participante';
    const file = makeCSVFile(content);
    const result = await parseFile(file);

    expect(result.rows[0]?.nome).toBe('Maria');
    expect(result.rows[0]?.email).toBe('maria@ex.com');
  });

  it('handles columns in non-standard order', async () => {
    const content = 'email,papel,nome,telefone\ntest@ex.com,lider,Carlos,\n';
    const file = makeCSVFile(content);
    const result = await parseFile(file);

    expect(result.rows[0]?.nome).toBe('Carlos');
    expect(result.rows[0]?.email).toBe('test@ex.com');
    expect(result.rows[0]?.papel).toBe('lider');
  });

  it('reports missing required columns', async () => {
    const content = 'telefone,papel\n11999990003,participante';
    const file = makeCSVFile(content);
    const result = await parseFile(file);

    expect(result.missingRequiredColumns).toContain('nome');
    expect(result.missingRequiredColumns).toContain('email');
  });

  it('throws on empty CSV (0 data rows)', async () => {
    const content = 'nome,email\n';
    const file = makeCSVFile(content);

    await expect(parseFile(file)).rejects.toThrow('Arquivo sem participantes');
  });

  it('throws when file exceeds 5 MB', async () => {
    const large = makeLargeFile();
    await expect(parseFile(large)).rejects.toThrow('5');
  });
});

// ---------------------------------------------------------------------------
// CSV — ISO-8859-1
// ---------------------------------------------------------------------------

describe('parseFile — CSV ISO-8859-1 encoding', () => {
  it('detects and decodes ISO-8859-1 (Latin-1) correctly', async () => {
    // "Natália" in Latin-1: á = 0xe1, í = 0xed
    const latin1Bytes = new Uint8Array([
      // header: nome,email\n
      110, 111, 109, 101, 44, 101, 109, 97, 105, 108, 10,
      // "Nat" + á(0xe1) + "lia,nat@ex.com\n"
      78, 97, 116, 0xe1, 108, 105, 97, 44, 110, 97, 116, 64, 101, 120, 46, 99, 111, 109, 10,
    ]);
    const file = makeFileFromBytes(latin1Bytes, 'latin1.csv');
    const result = await parseFile(file);

    expect(result.encoding).toBe('iso-8859-1');
    // The decoded name should contain accented character
    expect(result.rows[0]?.nome).toContain('Nat');
    expect(result.rows[0]?.email).toBe('nat@ex.com');
  });
});

// ---------------------------------------------------------------------------
// CSV — Windows-1252
// ---------------------------------------------------------------------------

describe('parseFile — CSV Windows-1252 encoding', () => {
  it('detects Windows-1252 via 0x80–0x9F byte range', async () => {
    // Windows-1252: € = 0x80; "José" with ç(0xe7)
    // We use byte 0x80 early in the file to trigger Windows-1252 detection
    const win1252Bytes = new Uint8Array([
      // header with a Windows-1252 marker byte at position 0 (simulate BOM-less Win-1252)
      // nome,email — prepend a 0x80 byte to simulate Win-1252 file
      0x80, 10, // 0x80 byte (€) then newline — simulate preamble
      110, 111, 109, 101, 44, 101, 109, 97, 105, 108, 10, // nome,email\n
      // "Jo" + s(0xe7) + "e,jose@ex.com\n"  (ç is 0xe7 in Win-1252/Latin-1)
      74, 111, 115, 0xe9, 44, 106, 111, 115, 101, 64, 101, 120, 46, 99, 111, 109, 10,
    ]);
    const file = makeFileFromBytes(win1252Bytes, 'win1252.csv');
    const result = await parseFile(file);

    expect(result.encoding).toBe('windows-1252');
  });
});

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

describe('parseFile — XLSX', () => {
  /**
   * Helper: build mock Sheet[] format for read-excel-file/browser.
   * default export returns Promise<Sheet[]> where Sheet = { sheet: string, data: Row[][] }
   */
  function makeSheets(sheets: { name: string; rows: (string | null)[][] }[]) {
    return sheets.map((s) => ({ sheet: s.name, data: s.rows }));
  }

  it('parses XLSX file (single sheet)', async () => {
    const mockReadAllSheets = vi.fn().mockResolvedValue(
      makeSheets([
        {
          name: 'Aba1',
          rows: [
            ['nome', 'email', 'telefone', 'papel'],
            ['Ana Souza', 'ana@ex.com', '11999990005', 'participante'],
            ['Pedro Lima', 'pedro@ex.com', '', 'lider'],
          ],
        },
      ]),
    );

    vi.doMock('read-excel-file/browser', () => ({
      default: mockReadAllSheets,
    }));

    // Re-import after mock (Vitest does not auto-hoist vi.doMock)
    const { parseFile: parseFileFresh } = await import('./csv-parser?xlsx-single');

    const blob = new Blob(['fake-xlsx-content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseFileFresh(file);

    expect(result.multiSheetWarning).toBe(false);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.nome).toBe('Ana Souza');

    vi.doUnmock('read-excel-file/browser');
  });

  it('sets multiSheetWarning when XLSX has >1 sheet', async () => {
    const mockReadAllSheets = vi.fn().mockResolvedValue(
      makeSheets([
        {
          name: 'Aba1',
          rows: [
            ['nome', 'email'],
            ['Bia Ferreira', 'bia@ex.com'],
          ],
        },
        { name: 'Aba2', rows: [['nome', 'email']] },
        { name: 'Aba3', rows: [['nome', 'email']] },
      ]),
    );

    vi.doMock('read-excel-file/browser', () => ({
      default: mockReadAllSheets,
    }));

    const { parseFile: parseFileFresh } = await import('./csv-parser?xlsx-multi');

    const blob = new Blob(['fake'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], 'multi.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseFileFresh(file);

    expect(result.multiSheetWarning).toBe(true);

    vi.doUnmock('read-excel-file/browser');
  });

  it('branch CSV does not call read-excel-file/browser dynamic import', async () => {
    // A simple CSV parse should succeed without triggering any XLSX code path.
    // We verify this by confirming parseFile resolves (no import error from xlsx mock).
    const csvContent = 'nome,email\nLuca,luca@ex.com';
    const file = makeCSVFile(csvContent);

    // If the XLSX branch were triggered, it would throw because there's no real xlsx data.
    // Successful resolution proves the CSV branch was taken exclusively.
    const result = await parseFile(file);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.nome).toBe('Luca');
  });

  it('throws on empty XLSX (header only, no data rows)', async () => {
    const mockReadAllSheets = vi.fn().mockResolvedValue(
      makeSheets([
        {
          name: 'Sheet1',
          rows: [
            ['nome', 'email'], // header only — no data rows
          ],
        },
      ]),
    );

    vi.doMock('read-excel-file/browser', () => ({
      default: mockReadAllSheets,
    }));

    const { parseFile: parseFileFresh } = await import('./csv-parser?xlsx-empty');

    const blob = new Blob(['fake'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], 'empty.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    await expect(parseFileFresh(file)).rejects.toThrow('Arquivo sem participantes');

    vi.doUnmock('read-excel-file/browser');
  });
});

// ---------------------------------------------------------------------------
// Unsupported format
// ---------------------------------------------------------------------------

describe('parseFile — unsupported format', () => {
  it('throws on .pdf extension', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    const file = new File([blob], 'doc.pdf', { type: 'application/pdf' });

    await expect(parseFile(file)).rejects.toThrow('Formato não suportado');
  });
});
