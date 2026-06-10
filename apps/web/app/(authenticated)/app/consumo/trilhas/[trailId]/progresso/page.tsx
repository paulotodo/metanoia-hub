import { TrailProgressView } from './trail-progress-view';

interface PageProps {
  params: Promise<{ trailId: string }>;
}

/**
 * Página "Meu Progresso" para uma trilha específica.
 * Route: /app/consumo/trilhas/[trailId]/progresso
 *
 * Layout: Server Component shell → Client Component para dados de progresso
 * (TanStack Query via useTrailProgress).
 */
export default async function TrailProgressPage({ params }: PageProps) {
  const { trailId } = await params;
  return <TrailProgressView trailId={trailId} />;
}
