/**
 * csv-template.ts
 * Generates a CSV template for member import and triggers a browser download.
 * No network request (FR-04). Runs entirely client-side.
 */

const TEMPLATE_FILENAME = 'template-importacao-participantes.csv';

const TEMPLATE_HEADER = 'nome,email,telefone,papel';
const TEMPLATE_EXAMPLE = 'João Silva,joao@exemplo.com,11999990000,participante';

/**
 * Creates a UTF-8 CSV blob with BOM (so Excel opens it correctly) and
 * triggers a download via a temporary anchor element.
 * Safe to call from any Client Component event handler.
 */
export function downloadTemplate(): void {
  // BOM: ensures Excel reads UTF-8 correctly on Windows
  const bom = '﻿';
  const content = [bom + TEMPLATE_HEADER, TEMPLATE_EXAMPLE].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = TEMPLATE_FILENAME;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release object URL after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { TEMPLATE_FILENAME };
