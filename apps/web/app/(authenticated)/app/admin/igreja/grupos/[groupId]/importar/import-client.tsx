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
 *  6. Botão "Confirmar Importação" → useImportMembers → resultado (sync 201 | async 202)
 *  7. Resultado exibido em ImportResultSummary; async usa polling via useImportJobStatus
 *
 * Degradação parcial (API-09-G1): se algum batch falhar,
 * `checkResult.partialCheckWarning === true` → banner de aviso não-bloqueante.
 */

import { useState, useCallback, useEffect, useId } from 'react';
import messages from '../../../../../../../../messages/pt-BR.json';
import { parseFile } from '../../../../../../../../src/lib/onboarding/csv-parser';
import { validateCSV } from '../../../../../../../../src/lib/onboarding/csv-validator';
import { useCheckEmails } from '../../../../../../../../src/lib/api/hooks/use-check-emails';
import { useImportMembers, isAsyncResult } from '../../../../../../../../src/lib/api/hooks/use-import-members';
import { useImportJobStatus } from '../../../../../../../../src/lib/api/hooks/use-import-job-status';
import { FileUploadZone } from '../../../../../../../../src/components/onboarding/file-upload-zone';
import { CSVPreviewTable } from '../../../../../../../../src/components/onboarding/csv-preview-table';
import { ImportResultSummary } from '../../../../../../../../src/components/onboarding/import-result-summary';
import type { ParseResult } from '../../../../../../../../src/lib/onboarding/csv-parser';
import type { CSVValidationResult, ImportResultSummary as ImportResultSummaryType } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportClientProps {
  groupId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportClient({ groupId }: ImportClientProps) {
  const t = messages.import;
  const disabledDescId = useId();

  // --- State ---
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);

  // Final result state (after import completes)
  const [finalResult, setFinalResult] = useState<ImportResultSummaryType | null>(null);
  // Async job id for polling
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);
  // Import error message (PlanLimit, etc.)
  const [importError, setImportError] = useState<string | null>(null);

  // Extract emails for check-emails query
  const emails = validationResult?.rows.map((r) => r.email).filter(Boolean) ?? [];
  const checkQuery = useCheckEmails(emails);

  // Import mutation
  const importMutation = useImportMembers(groupId);

  // Poll job status when async
  const jobStatusQuery = useImportJobStatus(asyncJobId);

  // --- File selection handler ---
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setParseError(null);
    setParseResult(null);
    setValidationResult(null);
    setFinalResult(null);
    setAsyncJobId(null);
    setImportError(null);

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

  // When async job completes, promote to finalResult
  useEffect(() => {
    if (!jobStatusQuery.data) return;
    const { status, result } = jobStatusQuery.data;
    if (status === 'completed' && result) {
      setFinalResult(result);
      setAsyncJobId(null);
    }
  }, [jobStatusQuery.data]);

  // --- Derived state ---
  const isChecking = checkQuery.isFetching;
  const partialCheckWarning =
    checkQuery.data?.partialCheckWarning === true ||
    checkQuery.data?.apiUnavailable === true;

  // Valid rows = rows with status !== 'critico' (canProceed from CSVValidationResult)
  const hasValidRows = validationResult?.canProceed === true && (validationResult?.okCount ?? 0) > 0;

  // Is there an async import in flight?
  const isPolling = asyncJobId !== null && jobStatusQuery.data?.status === 'processing';
  const asyncProgress = jobStatusQuery.data?.progress ?? 0;
  const asyncFailed = jobStatusQuery.data?.status === 'failed';
  const asyncFailureReason = jobStatusQuery.data?.failureReason ?? null;

  // --- Confirm import handler ---
  const handleConfirm = useCallback(async () => {
    if (!validationResult || !hasValidRows) return;

    setImportError(null);

    // Build ImportRequest from valid rows
    const validRows = validationResult.rows
      .filter((r) => r.status !== 'critico')
      .map((r) => ({
        nome: r.nome,
        email: r.email,
        telefone: r.telefone ?? undefined,
        papel: r.papel,
        rowIndex: r.rowIndex,
      }));

    try {
      const result = await importMutation.mutateAsync({
        defaultGroupId: groupId,
        rows: validRows,
      });

      if (isAsyncResult(result)) {
        // 202 Accepted — start polling
        setAsyncJobId(result.jobId);
      } else {
        // 201 Created — sync result
        setFinalResult(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar participantes.';
      setImportError(msg);
    }
  }, [validationResult, hasValidRows, importMutation, groupId]);

  const isImporting = importMutation.isPending || isPolling;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10" data-testid="import-client">
      {/* Page heading */}
      <h1 className="text-display mb-2 font-semibold text-text-primary">
        Importar Participantes
      </h1>
      <p className="mb-8 text-sm text-text-secondary">
        Carregue uma planilha CSV ou XLSX para importar participantes para este grupo.
      </p>

      {/* If we have a final result, show it */}
      {finalResult ? (
        <ImportResultSummary summary={finalResult} />
      ) : (
        <>
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
            onProceed={() => void handleConfirm()}
          />

          {/* Confirm import button (shown when validation passed and not yet confirmed) */}
          {validationResult && (
            <div className="mt-6 flex flex-col gap-3">
              {/* Disabled reason text */}
              {!hasValidRows && (
                <p
                  id={disabledDescId}
                  className="text-sm text-text-secondary"
                  role="status"
                  aria-live="polite"
                >
                  {t.confirm?.disabled ?? 'Não há participantes válidos para importar.'}
                </p>
              )}

              <button
                type="button"
                disabled={!hasValidRows || isImporting}
                aria-disabled={!hasValidRows || isImporting}
                aria-describedby={!hasValidRows ? disabledDescId : undefined}
                onClick={() => void handleConfirm()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="confirm-import-btn"
              >
                {isImporting && (
                  <span
                    className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                )}
                {t.confirm?.button ?? 'Confirmar Importação'}
              </button>

              {/* Import error */}
              {importError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  data-testid="import-error"
                >
                  {importError}
                </div>
              )}
            </div>
          )}

          {/* Async progress indicator */}
          {isPolling && (
            <div className="mt-6" aria-live="polite" role="status">
              <p className="mb-2 text-sm text-text-secondary">
                {t.result?.processing ?? 'Importação em andamento…'}
              </p>
              <progress
                role="progressbar"
                aria-valuenow={asyncProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                value={asyncProgress}
                max={100}
                className="h-2 w-full rounded-full"
                aria-label="Progresso da importação"
              >
                {asyncProgress}%
              </progress>
            </div>
          )}

          {/* Async failure */}
          {asyncFailed && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              data-testid="async-import-error"
            >
              {asyncFailureReason ?? 'Falha ao processar a importação. Tente novamente.'}
            </div>
          )}
        </>
      )}
    </main>
  );
}
