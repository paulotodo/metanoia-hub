'use client';

import { useState } from 'react';
import { Button, Input } from '@metanoia/ui';
import { useCreateGroup, useDemoStatus, useUpdateTenantProfile } from '@/lib/api/hooks';
import type { OnboardingProgress } from '@metanoia/types';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.onboardingWizard;

type GroupMode = 'create' | 'demo' | null;

// Day-of-week options mapped to display labels in PT-BR
const DAY_OPTIONS = [
  { value: 'mon', label: 'Segunda-feira' },
  { value: 'tue', label: 'Terça-feira' },
  { value: 'wed', label: 'Quarta-feira' },
  { value: 'thu', label: 'Quinta-feira' },
  { value: 'fri', label: 'Sexta-feira' },
  { value: 'sat', label: 'Sábado' },
  { value: 'sun', label: 'Domingo' },
] as const;

type DayOfWeek = (typeof DAY_OPTIONS)[number]['value'];

interface Step3GroupProps {
  currentProgress: OnboardingProgress;
  onComplete: (mode: 'create' | 'demo', groupId?: string) => void;
  readOnly?: boolean;
}

export function Step3Group({ currentProgress, onComplete, readOnly = false }: Step3GroupProps) {
  const [mode, setMode] = useState<GroupMode>(
    (currentProgress.stepData['mode'] as GroupMode) ?? null,
  );
  const [groupName, setGroupName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('thu');
  const [time, setTime] = useState('19:00');
  const [groupError, setGroupError] = useState<string | null>(null);

  const { mutateAsync: createGroup, isPending: isCreating } = useCreateGroup();
  const { mutateAsync: updateTenant } = useUpdateTenantProfile();
  const { data: demoStatus } = useDemoStatus();

  const hasDemoData = demoStatus?.hasDemoData ?? false;

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setGroupError(null);

    try {
      const group = await createGroup({
        name: groupName.trim(),
        dayOfWeek,
        time,
      });
      onComplete('create', group.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('conflict')) {
        setGroupError(t.errors.groupDuplicate);
      } else {
        setGroupError(t.errors.groupCreateFailed);
      }
    }
  }

  async function handleDemoMode() {
    if (readOnly) return;
    // Save stepData.mode='demo' and skip to step 5
    try {
      const newProgress: OnboardingProgress = {
        ...currentProgress,
        currentStep: 5,
        completedSteps: [...new Set([...currentProgress.completedSteps, 3])],
        stepData: { ...currentProgress.stepData, mode: 'demo' },
      };
      await updateTenant({ onboardingProgress: newProgress });
    } catch {
      // Best-effort — advance per FR-13
    }
    onComplete('demo');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3" role="radiogroup" aria-label="Opção para o primeiro grupo">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name="group-mode"
            value="create"
            checked={mode === 'create'}
            onChange={() => setMode('create')}
            disabled={readOnly}
            data-testid="step3-mode-create"
          />
          <span className="text-sm font-medium text-text-primary">{t.step3.createGroupOption}</span>
        </label>

        {hasDemoData && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="group-mode"
              value="demo"
              checked={mode === 'demo'}
              onChange={() => setMode('demo')}
              disabled={readOnly}
              data-testid="step3-mode-demo"
            />
            <span className="text-sm font-medium text-text-primary">{t.step3.demoOption}</span>
          </label>
        )}
      </div>

      {mode === 'create' && (
        <form onSubmit={(e) => { void handleCreateGroup(e); }} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="wizard-group-name" className="block text-sm font-medium text-text-primary">
              {t.step3.groupNameLabel} <span aria-hidden="true">*</span>
            </label>
            <Input
              id="wizard-group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t.step3.groupNamePlaceholder}
              required
              disabled={readOnly || isCreating}
              data-testid="step3-group-name"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="wizard-group-day" className="block text-sm font-medium text-text-primary">
              Dia da semana <span aria-hidden="true">*</span>
            </label>
            <select
              id="wizard-group-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
              disabled={readOnly || isCreating}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="step3-group-day"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="wizard-group-time" className="block text-sm font-medium text-text-primary">
              Horário <span aria-hidden="true">*</span>
            </label>
            <Input
              id="wizard-group-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              disabled={readOnly || isCreating}
              data-testid="step3-group-time"
            />
          </div>

          {groupError && (
            <p role="alert" className="text-sm text-error">
              {groupError}
            </p>
          )}

          {!readOnly && (
            <Button
              type="submit"
              className="w-full"
              disabled={!groupName.trim() || isCreating}
              data-testid="step3-create-submit"
            >
              {t.step3.createButton}
            </Button>
          )}
        </form>
      )}

      {mode === 'demo' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{t.step3.demoModeNote}</p>
          {!readOnly && (
            <Button
              type="button"
              className="w-full"
              onClick={() => { void handleDemoMode(); }}
              data-testid="step3-demo-submit"
            >
              {t.actions.next}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
