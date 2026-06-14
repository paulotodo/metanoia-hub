'use client';

/**
 * import-client.tsx
 * Client Component orquestrador do fluxo de importação CSV/XLSX.
 *
 * Fluxo:
 *  1. Usuário seleciona arquivo → FileUploadZone.onFileSelected
 *  2. parseFile(file) → ParseResult (rawRows + multiSheetWarning + encoding)
 *  3. validateCSV(rawRows, ...) → CSVValidationResult
 *  4. useCheckEmails(emails) → EmailCheckResult[] (TanStack Query, batching ≤500)
 *  5. CSVPreviewTable exibe resultado + partialCheckWarning se API parcialmente indisponível
 *
 * Degradação parcial (API-09-G1): se algum batch falhar,
 * `checkResult.partialCheckWarning === true` → banner de aviso não-bloqueante.
 */

import { useState, useCallback, useEffect } from 'react';
import messages from '../../../../../../../../messages/pt-BR.json';
import { parseFile } from '../../../../../../../../src/lib/onboarding/csv-parser';
import { validateCSV } from '../../../../../../../../src/lib/onboarding/csv-validator';
import { useCheckEmails } from '../../../../../../../../src/lib/api/hooks/use-check-emails';
import { FileUploadZone } from '../../../../../../../../src/components/onboarding/file-upload-zone';
import { CSVPreviewTable } from '../../../../../../../../src/components/onboarding/csv-preview-table';
import type { ParseResult } from '../../../../../../../../src/lib/onboarding/csv-parser';
import type { CSVValidationResult } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportClientProps {
  groupId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportClient({ groupId: _groupId }: ImportClientProps) {
  const t = messages.import;

  // --- State ---
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [validationResult, setValidationResult] =
    useState<CSVValidationResult | null>(null);

  // Extract emails for check-emails query
  const emails =
    validationResult?.rows.map((r) => r.email).filter(Boolean) ?? [];

  const checkQuery = useCheckEmails(emails);

  // --- File selection handler ---
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setParseError(null);
    setParseResult(null);
    setValidationResult(null);

    try {
      const result = await parseFile(selectedFile);
      setParseResult(result);

      const validation = validateCSV(result.rows, {
        missingRequiredColumns: result.missingRequiredColumns,
        multiSheetWarning: result.multiSheetWarning,
        encoding: result.encoding,
      });
      setValidationResult(validation);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Erro ao processar arquivo.',
      );
    } finally {
      setIsParsing(false);
    }
  }, []);

  // Re-run validation when email existence data arrives
  useEffect(() => {
    if (!parseResult || !checkQuery.data) return;

    const existenceMap: Record<string, boolean> = {};
    for (const r of checkQuery.data.results) {
      existenceMap[r.email] = r.exists;
    }

    const revalidated = validateCSV(parseResult.rows, {
      missingRequiredColumns: parseResult.missingRequiredColumns,
      multiSheetWarning: parseResult.multiSheetWarning,
      encoding: parseResult.encoding,
      emailExistenceMap: existenceMap,
    });
    setValidationResult(revalidated);
  }, [parseResult, checkQuery.data]);

  // --- Derived state ---
  const isChecking = checkQuery.isFetching;
  const partialCheckWarning =
    checkQuery.data?.partialCheckWarning === true ||
    checkQuery.data?.apiUnavailable === true;

  // --- Proceed handler (placeholder — wiring for next story) ---
  // TODO: Story 10-4 will wire actual import submission
  const handleProceed = useCallback(() => {
    void validationResult;
  }, [validationResult]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10" data-testid="import-client">
      {/* Page heading */}
      <h1 className="text-display mb-2 font-semibold text-text-primary">
        {t.dropzone.idle ? 'Importar Participantes' : 'Importar'}
      </h1>
      <p className="mb-8 text-sm text-text-secondary">
        Carregue uma planilha CSV ou XLSX para importar participantes para este grupo.
      </p>

      {/* Upload zone */}
      <FileUploadZone
        onFileSelected={handleFileSelected}
        isParsing={isParsing}
        acceptedFile={file}
        externalError={parseError}
        className="mb-6"
      />

      {/* Partial check warning banner (API-09-G1) */}
      {partialCheckWarning && !isChecking && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          data-testid="partial-check-warning"
        >
          {checkQuery.data?.apiUnavailable
            ? t.warning.apiUnavailable
            : t.warning.partialCheck}
        </div>
      )}

      {/* Preview table */}
      <CSVPreviewTable
        result={validationResult}
        isChecking={isChecking}
        onProceed={handleProceed}
      />
    </main>
  );
}
