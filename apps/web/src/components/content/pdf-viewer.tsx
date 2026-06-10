'use client';

import { useState } from 'react';

interface PdfViewerProps {
  /** Presigned URL for the PDF/document (4h expiry) */
  signedUrl: string;
  /** Optional accessible title */
  title?: string;
  className?: string;
}

/**
 * PdfViewer — visualização inline de documentos PDF para aulas.
 * Usa iframe para renderização no navegador sem forçar download.
 * Exibe fallback com link direto caso o navegador não suporte.
 */
export function PdfViewer({ signedUrl, title, className }: PdfViewerProps) {
  const [loadError, setLoadError] = useState(false);

  // Append #toolbar=0 to suppress browser PDF toolbar download button
  const iframeSrc = `${signedUrl}#toolbar=0&navpanes=0`;

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted p-8 text-center"
      >
        <p className="text-muted-foreground">
          Não foi possível exibir o documento inline.
        </p>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary hover:text-primary/80"
        >
          Abrir documento em nova aba
        </a>
      </div>
    );
  }

  return (
    <div className={className ?? 'w-full'} data-testid="pdf-viewer">
      <iframe
        src={iframeSrc}
        title={title ?? 'Documento da aula'}
        className="w-full rounded-lg border"
        style={{ minHeight: '600px' }}
        onError={() => setLoadError(true)}
        // Prevent forced download by not setting Content-Disposition header here
      />
    </div>
  );
}
