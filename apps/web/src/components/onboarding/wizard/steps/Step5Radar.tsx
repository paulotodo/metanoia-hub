'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@metanoia/ui';
import { useDemoRadar, useUpdateTenantProfile } from '@/lib/api/hooks';
import { WIZARD_COMPLETE_BUTTON, WIZARD_DEMO_PREVIEW_LABEL } from '@metanoia/types';
import type { OnboardingProgress } from '@metanoia/types';
import { DemoOverlay } from '../../demo-overlay';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.onboardingWizard;

interface Step5RadarProps {
  currentProgress: OnboardingProgress;
  hasRealGroups: boolean;
  onComplete: () => void;
  readOnly?: boolean;
}

const SIGNAL_LABELS: Record<string, string> = {
  'care-urgent': t.step5.signalRed,
  'care-attention': t.step5.signalYellow,
  'care-ok': t.step5.signalGreen,
};

const SIGNAL_COLORS: Record<string, string> = {
  'care-urgent': 'bg-red-100 text-red-800 border-red-200',
  'care-attention': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'care-ok': 'bg-green-100 text-green-800 border-green-200',
};

export function Step5Radar({
  currentProgress,
  hasRealGroups,
  onComplete,
  readOnly = false,
}: Step5RadarProps) {
  const router = useRouter();
  const { mutateAsync: updateTenant, isPending } = useUpdateTenantProfile();
  const isDemoMode = currentProgress.stepData['mode'] === 'demo';
  const { data: demoData, error: demoError } = useDemoRadar();

  async function handleComplete() {
    if (readOnly) return;

    const now = new Date().toISOString();
    const newProgress: OnboardingProgress = {
      ...currentProgress,
      currentStep: 5,
      completedSteps: [...new Set([...currentProgress.completedSteps, 5])],
      completed: true,
      completedAt: now,
      skippedAt: null,
    };

    try {
      await updateTenant({ onboardingProgress: newProgress });
    } catch {
      // Best-effort — redirect anyway per FR-13
    }

    onComplete();
    router.push('/app/admin/grupos');
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">{t.step5.description}</p>

      {/* Semaphore legend */}
      <div className="space-y-2">
        {Object.entries(SIGNAL_COLORS).map(([signal, colorClass]) => (
          <div key={signal} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${colorClass}`}>
            <span aria-hidden="true">●</span>
            <span>{SIGNAL_LABELS[signal]}</span>
          </div>
        ))}
      </div>

      {/* Radar preview */}
      {isDemoMode || !hasRealGroups ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {WIZARD_DEMO_PREVIEW_LABEL}
          </p>
          {demoData && !demoError ? (
            <DemoOverlay>
              <div className="space-y-2 p-4">
                <p className="font-medium text-text-primary">{demoData.groupName}</p>
                <p className="text-sm text-text-secondary">{demoData.message}</p>
                <ul className="space-y-1">
                  {demoData.participants.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          p.signalType === 'care-urgent'
                            ? 'bg-red-500'
                            : p.signalType === 'care-attention'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-text-secondary">— {p.contextPhrase}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </DemoOverlay>
          ) : (
            <div className="rounded-md border border-surface-muted p-4">
              <p className="text-sm text-text-secondary">{t.step5.waitingDataDescription}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-surface-muted p-4">
          <p className="text-sm font-medium text-text-primary">{t.step5.realDataLabel}</p>
          <p className="mt-1 text-sm text-text-secondary">{t.step5.waitingDataDescription}</p>
        </div>
      )}

      {!readOnly && (
        <Button
          type="button"
          className="w-full"
          onClick={() => { void handleComplete(); }}
          disabled={isPending}
          data-testid="step5-complete"
        >
          {WIZARD_COMPLETE_BUTTON}
        </Button>
      )}
    </div>
  );
}
