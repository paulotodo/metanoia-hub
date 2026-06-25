'use client';

import { useAccessibilityGaps } from '../../../../../../src/lib/api/hooks/use-accessibility-gaps';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.admin.accessibilityGaps;

export function AccessibilityGapsList() {
  const { data, isPending, isError } = useAccessibilityGaps();

  if (isPending) {
    return (
      <p className="text-body text-text-secondary" role="status" aria-live="polite">
        {t.loading}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-body text-care-alert" role="alert">
        {t.error}
      </p>
    );
  }

  const lessons = data?.data ?? [];

  if (lessons.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-text-secondary">{t.empty}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        aria-label={t.title}
      >
        <thead>
          <tr className="border-b border-border-default bg-surface-secondary">
            <th
              scope="col"
              className="py-3 px-4 text-left font-semibold text-text-primary"
            >
              {t.columns.lesson}
            </th>
            <th
              scope="col"
              className="py-3 px-4 text-left font-semibold text-text-primary"
            >
              {t.columns.module}
            </th>
            <th
              scope="col"
              className="py-3 px-4 text-left font-semibold text-text-primary"
            >
              {t.columns.trail}
            </th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => (
            <tr
              key={lesson.lessonId}
              className="border-b border-border-default hover:bg-surface-secondary/50 motion-safe:transition-colors"
            >
              <td className="py-3 px-4 text-text-primary">{lesson.lessonName}</td>
              <td className="py-3 px-4 text-text-secondary">{lesson.moduleName}</td>
              <td className="py-3 px-4 text-text-secondary">{lesson.trailName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-secondary">
        {lessons.length} resultado{lessons.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
