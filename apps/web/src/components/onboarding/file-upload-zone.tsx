'use client';

/**
 * file-upload-zone.tsx
 * Drag & drop + click file selector for CSV/XLSX member import.
 *
 * States: idle | dragover | accepted | error-size | error-type | parsing
 *
 * Accessibility (FR-22 / WCAG AA):
 * - The dropzone is a <label> wrapping a visually hidden <input type="file">.
 *   This means Tab focuses the <label>, Space/Enter activate the native file
 *   picker — no custom keyboard handler needed.
 * - Drag & drop is an ENHANCEMENT; the <input> is always the primary path.
 * - role="status" + aria-live on the state message announces changes to AT.
 * - The "Baixar template" button is a regular <button> (Tab-focusable).
 * - No role="article" anti-pattern (gotcha from Story 6-5).
 *
 * Constraints:
 * - Max file size: 5 MB (FR-02)
 * - Accepted MIME/extensions: .csv, .xlsx (FR-03)
 * - Template download is fully client-side, no network (FR-04)
 */

import { useCallback, useRef, useState } from 'react';
import messages from '../../../messages/pt-BR.json';
import { downloadTemplate } from '../../lib/onboarding/csv-template';

const t = messages.import;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadState =
  | 'idle'
  | 'dragover'
  | 'accepted'
  | 'error-size'
  | 'error-type'
  | 'parsing';

export interface FileUploadZoneProps {
  /** Called when a valid file has been selected (not yet parsed). */
  onFileSelected: (file: File) => void;
  /** When true, shows a parsing spinner instead of idle/accepted UI. */
  isParsing?: boolean;
  /** Currently accepted file (for display in accepted state). */
  acceptedFile?: File | null;
  /** Error from external validation (overrides internal state messages). */
  externalError?: string | null;
  /** Additional CSS classes on the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_EXTENSIONS = new Set(['.csv', '.xlsx']);
const ACCEPTED_MIME = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function isAcceptedFile(file: File): boolean {
  const ext = getExtension(file.name);
  return ACCEPTED_EXTENSIONS.has(ext) || ACCEPTED_MIME.has(file.type);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileUploadZone({
  onFileSelected,
  isParsing = false,
  acceptedFile = null,
  externalError = null,
  className = '',
}: FileUploadZoneProps) {
  const [dragover, setDragover] = useState(false);
  const [internalError, setInternalError] = useState<'size' | 'type' | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive display state
  let displayState: UploadState = 'idle';
  if (isParsing) {
    displayState = 'parsing';
  } else if (internalError === 'size') {
    displayState = 'error-size';
  } else if (internalError === 'type') {
    displayState = 'error-type';
  } else if (dragover) {
    displayState = 'dragover';
  } else if (acceptedFile) {
    displayState = 'accepted';
  }

  const processFile = useCallback(
    (file: File) => {
      setInternalError(null);

      if (!isAcceptedFile(file)) {
        setInternalError('type');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setInternalError('size');
        return;
      }

      onFileSelected(file);
    },
    [onFileSelected],
  );

  // --- Drag handlers ---

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragover(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragover(false);

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // --- Input handler ---

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so the same file can be re-selected after an error
      e.target.value = '';
    },
    [processFile],
  );

  // --- State message for aria-live ---
  const stateMessage = (() => {
    switch (displayState) {
      case 'idle':
        return t.dropzone.idle;
      case 'dragover':
        return t.dropzone.dragover;
      case 'accepted':
        return acceptedFile
          ? `${t.dropzone.accepted}: ${acceptedFile.name} (${formatBytes(acceptedFile.size)})`
          : t.dropzone.accepted;
      case 'error-size':
        return externalError ?? t.dropzone.errorSize;
      case 'error-type':
        return externalError ?? t.dropzone.errorType;
      case 'parsing':
        return t.dropzone.parsing;
    }
  })();

  // --- Visual classes ---
  const isError = displayState === 'error-size' || displayState === 'error-type';

  const zoneClasses = [
    'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center motion-safe:transition-colors duration-150 focus-within:ring-2 focus-within:ring-brand-teal/30',
    isError
      ? 'border-care-alert bg-care-alert/5'
      : dragover
        ? 'border-interactive-primary bg-interactive-primary/5'
        : displayState === 'accepted'
          ? 'border-care-positive bg-care-positive/5'
          : 'border-surface-muted bg-surface-subtle hover:border-interactive-primary/50',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inputId = 'file-upload-input';

  return (
    <div
      data-testid="file-upload-zone"
      data-state={displayState}
      className={zoneClasses}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Visually hidden native file input — primary a11y path */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,.xlsx"
        aria-label={t.dropzone.idle}
        className="sr-only"
        onChange={handleInputChange}
        data-testid="file-upload-input"
      />

      {/* State-based content */}
      {displayState === 'parsing' ? (
        <ParseSpinner />
      ) : displayState === 'accepted' && acceptedFile ? (
        <AcceptedContent file={acceptedFile} />
      ) : (
        <IdleContent isError={isError} inputId={inputId} />
      )}

      {/* aria-live region for state changes */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={[
          'text-sm font-medium',
          isError
            ? 'text-care-alert'
            : displayState === 'accepted'
              ? 'text-care-positive'
              : 'text-text-secondary',
        ].join(' ')}
        data-testid="upload-status-message"
      >
        {stateMessage}
      </p>

      {/* Template download button */}
      <button
        type="button"
        onClick={() => downloadTemplate()}
        className="mt-1 text-xs font-medium text-interactive-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 rounded"
        data-testid="download-template-btn"
      >
        {t.template.downloadLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ParseSpinner() {
  return (
    <div
      role="status"
      aria-label={messages.import.dropzone.parsing}
      className="flex flex-col items-center gap-2"
      data-testid="parsing-spinner"
    >
      {/* Accessible spinner: animated ring + sr-only text */}
      <svg
        aria-hidden="true"
        className="h-8 w-8 animate-spin text-interactive-primary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{messages.import.dropzone.parsing}</span>
    </div>
  );
}

function AcceptedContent({ file }: { file: File }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Checkmark icon */}
      <svg
        aria-hidden="true"
        className="h-8 w-8 text-care-positive"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-sm font-semibold text-text-primary">{file.name}</span>
    </div>
  );
}

function IdleContent({
  isError,
  inputId,
}: {
  isError: boolean;
  inputId: string;
}) {
  return (
    <>
      {/* Upload icon */}
      <svg
        aria-hidden="true"
        className={[
          'h-10 w-10',
          isError ? 'text-care-alert' : 'text-text-tertiary',
        ].join(' ')}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>

      {/* Clickable label — activates the file picker */}
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded px-3 py-1.5 text-sm font-semibold text-interactive-primary hover:bg-interactive-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
        data-testid="upload-label"
      >
        {messages.import.dropzone.idle}
      </label>
    </>
  );
}
