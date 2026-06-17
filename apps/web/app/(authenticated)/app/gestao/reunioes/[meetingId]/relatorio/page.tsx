/**
 * Página de relatório pós-reunião — FR63 (Story 13-1)
 *
 * Server Component: não usa TanStack Query nem Zustand (App Router pattern).
 * O componente PostMeetingReport (Client Component) faz o fetch via hook.
 *
 * Rotas:
 *   /app/gestao/reunioes/:meetingId/relatorio
 *
 * Acesso:
 *   - LIDER / ADMIN_TENANT → view completa FR63 (métricas + tabela + CTA pastoral)
 *   - PARTICIPANTE → view pessoal (linha de presença própria)
 */

import { PostMeetingReport } from '@/components/meetings/post-meeting-report';
import messages from '@/../messages/pt-BR.json';

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

const t = messages.meetingLeaderReport;

export default async function RelatorioDaReuniaoPage({ params }: PageProps) {
  const { meetingId } = await params;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t.title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t.subtitle}</p>
      </header>

      {/* Client Component that fetches and renders the report */}
      <PostMeetingReport meetingId={meetingId} />
    </main>
  );
}
