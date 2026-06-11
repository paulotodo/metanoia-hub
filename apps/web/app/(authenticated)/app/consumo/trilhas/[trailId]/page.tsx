/**
 * TrailId page — thin Server Component shell.
 * Delegates all interactivity to TrailPlaylistRoute (Client Component).
 *
 * Ref: dec-007, dec-008 (Server Component thin shell, no data fetching here)
 */

import { TrailPlaylistRoute } from './trail-playlist-route';

interface TrailPageProps {
  params: Promise<{ trailId: string }>;
}

export default async function TrailPage({ params }: TrailPageProps) {
  const { trailId } = await params;
  return <TrailPlaylistRoute trailId={trailId} />;
}
