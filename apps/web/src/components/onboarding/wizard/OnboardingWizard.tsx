'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@metanoia/ui';
import { useUpdateTenantProfile } from '@/lib/api/hooks';
import {
  WIZARD_SKIP_LABEL,
  WIZARD_STEP_PROFILE_LABEL,
  WIZARD_STEP_COMMUNITY_LABEL,
  WIZARD_STEP_GROUP_LABEL,
  WIZARD_STEP_INVITE_LABEL,
  WIZARD_STEP_RADAR_LABEL,
} from '@metanoia/types';
import type { OnboardingProgress } from '@metanoia/types';
import messages from '../../../../messages/pt-BR.json';
import { Step1Profile } from './steps/Step1Profile';
import { Step2Community } from './steps/Step2Community';
import { Step3Group } from './steps/Step3Group';
import { Step4Invite } from './steps/Step4Invite';
import { Step5Radar } from './steps/Step5Radar';

const t = messages.onboardingWizard;

const STEP_LABELS = [
  WIZARD_STEP_PROFILE_LABEL,
  WIZARD_STEP_COMMUNITY_LABEL,
  WIZARD_STEP_GROUP_LABEL,
  WIZARD_STEP_INVITE_LABEL,
  WIZARD_STEP_RADAR_LABEL,
];

const TOTAL_STEPS = 5;

interface OnboardingWizardProps {
  initialProgress: OnboardingProgress;
  hasRealGroups: boolean;
  /** Read-only mode — forms disabled, no submissions */
  readOnly?: boolean;
}

export function OnboardingWizard({
  initialProgress,
  hasRealGroups,
  readOnly = false,
}: OnboardingWizardProps) {
  const [progress, setProgress] = useState<OnboardingProgress>(initialProgress);
  const [currentStep, setCurrentStep] = useState(initialProgress.currentStep);
  const [isSkipping, setIsSkipping] = useState(false);

  const { mutateAsync: updateTenant } = useUpdateTenantProfile();

  // Keyboard navigation — arrow left/right between steps (FR-11)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (readOnly) return;
      if (e.key === 'ArrowRight' && currentStep < TOTAL_STEPS) {
        // Only advance if current step is completed
        if (progress.completedSteps.includes(currentStep)) {
          setCurrentStep((s) => s + 1);
        }
      }
      if (e.key === 'ArrowLeft' && currentStep > 1) {
        setCurrentStep((s) => s - 1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, progress.completedSteps, readOnly]);

  function persistProgress(update: Partial<OnboardingProgress>) {
    const next: OnboardingProgress = { ...progress, ...update };
    setProgress(next);
    // Fire-and-forget — update.name must come from tenant context; here we only update progress
    // The caller steps already call updateTenant with full payload.
    return next;
  }

  function advanceStep(nextStep: number) {
    const newProgress = persistProgress({
      currentStep: nextStep,
      completedSteps: [...new Set([...progress.completedSteps, currentStep])],
    });
    setCurrentStep(nextStep);
    return newProgress;
  }

  const handleStep1Complete = useCallback(() => {
    advanceStep(2);
  }, [currentStep, progress]); // currentStep + progress needed by advanceStep

  const handleStep2Complete = useCallback(() => {
    advanceStep(3);
  }, [currentStep, progress]);

  const handleStep3Complete = useCallback((mode: 'create' | 'demo') => {
    const next = persistProgress({
      currentStep: mode === 'demo' ? 5 : 4,
      completedSteps: [...new Set([...progress.completedSteps, 3])],
      stepData: { ...progress.stepData, mode },
    });
    setCurrentStep(mode === 'demo' ? 5 : 4);
    // Persist to server
    void updateTenant({ onboardingProgress: next });
  }, [currentStep, progress]);

  const handleStep4Complete = useCallback((_skipped: boolean) => {
    advanceStep(5);
  }, [currentStep, progress]);

  const handleStep5Complete = useCallback(() => {
    // Navigation handled inside Step5Radar
  }, []);

  async function handleSkip() {
    if (readOnly) return;
    setIsSkipping(true);
    const now = new Date().toISOString();
    const newProgress: OnboardingProgress = {
      ...progress,
      skippedAt: now,
      completedAt: null,
    };
    try {
      await updateTenant({ name: '', onboardingProgress: newProgress });
    } catch {
      // Best-effort
    } finally {
      setIsSkipping(false);
    }
  }

  function goBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  const progressPercent = Math.round((progress.completedSteps.length / TOTAL_STEPS) * 100);
  const isDemoMode = progress.stepData['mode'] === 'demo';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-surface-default"
      role="dialog"
      aria-modal="true"
      aria-label="Configuração inicial"
      data-testid="onboarding-wizard"
    >
      {/* Header with progress indicator */}
      <header className="flex items-center justify-between border-b border-surface-muted px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Back button */}
          {currentStep > 1 && !readOnly && (
            <Button
              type="button"
              variant="ghost"
              className="text-text-secondary"
              onClick={goBack}
              aria-label="Voltar à etapa anterior"
              data-testid="wizard-back"
            >
              ← {t.actions.back}
            </Button>
          )}
        </div>

        {/* Step dots indicator (P1 AC) */}
        <nav aria-label="Progresso do wizard" className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const stepNum = i + 1;
            const isCompleted = progress.completedSteps.includes(stepNum);
            const isCurrent = stepNum === currentStep;
            return (
              <button
                key={stepNum}
                type="button"
                aria-label={`${STEP_LABELS[i]} ${isCompleted ? '(concluído)' : isCurrent ? '(atual)' : '(pendente)'}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`h-2.5 w-2.5 rounded-full motion-safe:transition-colors ${
                  isCompleted
                    ? 'bg-brand-primary'
                    : isCurrent
                      ? 'bg-brand-primary/60 ring-2 ring-brand-primary/30'
                      : 'bg-surface-muted'
                }`}
                onClick={() => {
                  if (readOnly || isCompleted || stepNum === currentStep) {
                    setCurrentStep(stepNum);
                  }
                }}
                disabled={!readOnly && !isCompleted && stepNum !== currentStep}
              />
            );
          })}
        </nav>

        {/* Skip button (P8) */}
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            className="text-sm text-text-secondary"
            onClick={() => { void handleSkip(); }}
            disabled={isSkipping}
            data-testid="wizard-skip"
          >
            {WIZARD_SKIP_LABEL}
          </Button>
        )}

        {/* Read-only banner */}
        {readOnly && (
          <span className="text-sm text-text-secondary">{t.readOnlyBanner}</span>
        )}
      </header>

      {/* Progress bar */}
      <div className="h-1 w-full bg-surface-muted" aria-hidden="true">
        <div
          className="h-1 bg-brand-primary motion-safe:transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-6 py-8">
          {/* Step title */}
          <div className="mb-6 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {t.progress.step
                .replace('{{current}}', String(currentStep))
                .replace('{{total}}', String(TOTAL_STEPS))}
            </p>
            <h1 className="text-xl font-semibold text-text-primary">
              {STEP_LABELS[currentStep - 1]}
            </h1>
          </div>

          {/* Steps */}
          {currentStep === 1 && (
            <Step1Profile
              onComplete={handleStep1Complete}
              readOnly={readOnly}
            />
          )}
          {currentStep === 2 && (
            <Step2Community
              onComplete={handleStep2Complete}
              readOnly={readOnly}
            />
          )}
          {currentStep === 3 && (
            <Step3Group
              currentProgress={progress}
              onComplete={handleStep3Complete}
              readOnly={readOnly}
            />
          )}
          {currentStep === 4 && !isDemoMode && (
            <Step4Invite
              onComplete={handleStep4Complete}
              readOnly={readOnly}
            />
          )}
          {currentStep === 5 && (
            <Step5Radar
              currentProgress={progress}
              hasRealGroups={hasRealGroups}
              onComplete={handleStep5Complete}
              readOnly={readOnly}
            />
          )}
        </div>
      </main>
    </div>
  );
}
