/**
 * LessonPage — Server Component shell for the lesson viewer.
 * Passes route params to the client-side LessonViewer.
 *
 * Route: /app/consumo/trilhas/[trailId]/aulas/[lessonId]
 * Query param: ?moduleId=<uuid> (passed by playlist on navigation)
 */

import { LessonViewer } from './lesson-viewer';

interface LessonPageProps {
  params: Promise<{ trailId: string; lessonId: string }>;
  searchParams: Promise<{ moduleId?: string }>;
}

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { trailId, lessonId } = await params;
  const { moduleId } = await searchParams;

  return (
    <LessonViewer
      trailId={trailId}
      moduleId={moduleId ?? ''}
      lessonId={lessonId}
    />
  );
}
