/**
 * lesson-row.spec.tsx — T4, T5, T7-parcial, T8
 * Ref: tasks.md §3.1.11, spec §FR-001, FR-003, FR-005, FR-013.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { LessonRow } from './lesson-row';
import type { LessonResponse } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LESSON_BASE: LessonResponse = {
  id: '019756a1-0000-7000-8000-000000000020',
  tenantId: '019756a1-0000-7000-8000-000000000099',
  moduleId: '019756a1-0000-7000-8000-000000000010',
  name: 'Introdução à Oração',
  contentType: 'video',
  contentUrl: null,
  contentBody: null,
  tags: [],
  originalName: null,
  mimeType: null,
  sizeBytes: null,
  uploadedBy: null,
  uploadedAt: null,
  order: 0,
  estimatedDurationMinutes: 15,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// T4: null duration
// ---------------------------------------------------------------------------

describe('LessonRow — T4 null duration', () => {
  it('does not render duration when estimatedDurationMinutes is null', () => {
    const lesson: LessonResponse = { ...LESSON_BASE, estimatedDurationMinutes: null };
    render(
      <LessonRow
        lesson={lesson}
        isActive={false}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText(/min/i)).toBeNull();
  });

  it('renders duration when estimatedDurationMinutes is provided', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('15 min')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T5: locked state
// ---------------------------------------------------------------------------

describe('LessonRow — T5 locked state', () => {
  it('renders LockIndicator when locked', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason="Complete a aula anterior para prosseguir neste caminho"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId('lock-indicator')).toBeTruthy();
  });

  it('does not call onSelect when locked and clicked', () => {
    const onSelect = vi.fn();
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason="Complete a aula anterior para prosseguir neste caminho"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId('lesson-row'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect when locked and Enter pressed', () => {
    const onSelect = vi.fn();
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason="Complete a aula anterior"
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('lesson-row'), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('T5-aria-label: locked row has aria-label with lesson name and lock reason', () => {
    const lockReason = 'Complete a aula anterior para prosseguir neste caminho';
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason={lockReason}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByTestId('lesson-row');
    expect(row.getAttribute('aria-label')).toContain(LESSON_BASE.name);
    expect(row.getAttribute('aria-label')).toContain(lockReason);
  });

  it('T5-aria-label-fallback: uses default locked.reason when lockReason is null', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByTestId('lesson-row');
    // Should contain the lesson name plus some lock reason text
    expect(row.getAttribute('aria-label')).toContain(LESSON_BASE.name);
    expect(row.getAttribute('aria-label')).toContain('—');
  });

  it('T5-aria-disabled: locked row has aria-disabled=true', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByTestId('lesson-row');
    expect(row.getAttribute('aria-disabled')).toBe('true');
  });

  it('T5-no-lock-indicator-when-unlocked: LockIndicator not shown when unlocked', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('lock-indicator')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T8: touch target 44px (via class assertion — SC-003, SC-007)
// ---------------------------------------------------------------------------

describe('LessonRow — T8 touch target', () => {
  it('has min-h-11 class ensuring 44px touch target', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByTestId('lesson-row');
    expect(row.className).toContain('min-h-11');
  });
});

// ---------------------------------------------------------------------------
// T7-parcial: axe accessibility in locked state
// ---------------------------------------------------------------------------

describe('LessonRow — T7 accessibility (jest-axe)', () => {
  it('has no axe violations in locked state', async () => {
    const { container } = render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={true}
        lockReason="Complete a aula anterior para prosseguir neste caminho"
        onSelect={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in active unlocked state', async () => {
    const { container } = render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={true}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Bonus: active highlight class (FR-003)
// ---------------------------------------------------------------------------

describe('LessonRow — active state', () => {
  it('applies teal highlight classes when isActive', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={true}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByTestId('lesson-row');
    expect(row.className).toContain('bg-brand-teal/10');
    expect(row.className).toContain('border-brand-teal');
  });

  it('calls onSelect with lesson id when unlocked and clicked', () => {
    const onSelect = vi.fn();
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={false}
        lockReason={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId('lesson-row'));
    expect(onSelect).toHaveBeenCalledWith(LESSON_BASE.id);
  });

  it('renders lesson name', () => {
    render(
      <LessonRow
        lesson={LESSON_BASE}
        isActive={false}
        isLocked={false}
        lockReason={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(LESSON_BASE.name)).toBeTruthy();
  });
});
