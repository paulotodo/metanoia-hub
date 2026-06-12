import type { Metadata } from 'next';
import type { DataProcessingRegistryItem } from '@metanoia/types';
import { DataProcessingRegistryResponseSchema } from '@metanoia/types';

export const metadata: Metadata = {
  title: 'Bases Legais para Tratamento de Dados — Metanoia Hub',
  description:
    'Em cumprimento à LGPD (Lei nº 13.709/2018), detalhamos as bases legais e finalidades do tratamento de dados pessoais na plataforma Metanoia Hub.',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const LEGAL_BASIS_LABELS: Record<string, string> = {
  consent: 'Consentimento (Art. 7º, I)',
  contract: 'Execução de Contrato (Art. 7º, IV)',
  legal_obligation: 'Obrigação Legal (Art. 7º, II)',
  legitimate_interest: 'Legítimo Interesse (Art. 7º, IX)',
};

async function fetchDataProcessingRegistry(): Promise<DataProcessingRegistryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/privacy/data-processing`, {
      next: { revalidate: 3600 }, // cache 1h — public, rarely changes
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    const parsed = DataProcessingRegistryResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data.data : [];
  } catch {
    return [];
  }
}

/**
 * Bases Legais para Tratamento de Dados — SSR public page.
 * Route: /privacidade/bases-legais
 *
 * Fetches GET /api/v1/privacy/data-processing (public endpoint, no auth).
 */
export default async function BasesLegaisPage() {
  const items = await fetchDataProcessingRegistry();

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 md:py-20">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Bases Legais para Tratamento de Dados
        </h1>
        <p className="mt-4 text-base text-[var(--color-text-muted)]">
          Em cumprimento à Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018),
          detalhamos abaixo as bases legais e finalidades do tratamento de seus dados
          pessoais na plataforma Metanoia Hub.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="mt-10 text-sm text-gray-500">
          Informações temporariamente indisponíveis. Consulte novamente em instantes.
        </p>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <caption className="sr-only">
              Tabela de bases legais para tratamento de dados pessoais na plataforma
              Metanoia Hub, conforme LGPD Art. 9º
            </caption>
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Operação
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Base Legal
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Finalidade
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Retenção
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Compartilhamento
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.operationName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {LEGAL_BASIS_LABELS[item.legalBasis] ?? item.legalBasis}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.purpose}</td>
                  <td className="px-4 py-3 text-gray-600">{item.retentionPeriod}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.thirdPartySharing ?? 'Não compartilhado'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
