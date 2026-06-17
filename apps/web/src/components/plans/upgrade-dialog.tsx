'use client';

/**
 * UpgradeDialog — Diálogo de upgrade de plano com focus trap (US7)
 *
 * Story 12.2 — US7, FR-024
 * dec-011: usa Radix Dialog (shadcn/ui) — focus trap nativo via @radix-ui/react-dialog
 *
 * Acessibilidade:
 *   - Focus trap automático via Radix Dialog (FR-024)
 *   - Escape cancela e retorna foco ao trigger (FR-024)
 *   - aria-modal="true", role="dialog", aria-labelledby, aria-describedby
 *   - Botões de ação são nativos <button> focáveis via Tab
 *   - onOpenAutoFocus posiciona foco no primeiro elemento interativo
 */
import { useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@metanoia/ui';
import type { PricingPlanId } from '@metanoia/types';

export interface UpgradeDialogProps {
  open: boolean;
  planId: PricingPlanId | null;
  planName: string;
  onConfirm: (planId: PricingPlanId) => void;
  onClose: () => void;
}

const PLAN_LABEL: Record<PricingPlanId, string> = {
  free: 'Gratuito',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export function UpgradeDialog({ open, planId, planName, onConfirm, onClose }: UpgradeDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(() => {
    if (planId) {
      onConfirm(planId);
    }
    onClose();
  }, [planId, onConfirm, onClose]);

  const handleOpenAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    // Posicionar foco no botão de confirmação (primeira ação significativa)
    confirmRef.current?.focus();
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        data-testid="upgrade-dialog"
        aria-describedby="upgrade-dialog-description"
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <DialogHeader>
          <DialogTitle id="upgrade-dialog-title">
            Confirmar upgrade para {planName || (planId ? PLAN_LABEL[planId] : '')}
          </DialogTitle>
          <DialogDescription id="upgrade-dialog-description">
            Ao confirmar, você será redirecionado ao fluxo de pagamento para ativar o
            plano {planName || (planId ? PLAN_LABEL[planId] : '')}. Você pode cancelar
            a qualquer momento pressionando Escape ou o botão Cancelar.
          </DialogDescription>
        </DialogHeader>

        {/* Etapas de confirmação — FR-024 */}
        <div className="py-4">
          <ol className="space-y-2 text-sm text-text-primary" aria-label="Etapas do upgrade">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-text-primary)] text-xs text-white">1</span>
              Confirmar seleção de plano
            </li>
            <li className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border-default)] text-xs">2</span>
              Inserir dados de pagamento
            </li>
            <li className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border-default)] text-xs">3</span>
              Ativação imediata
            </li>
          </ol>
        </div>

        <DialogFooter>
          {/* Cancelar — Escape também fecha (Radix native) */}
          <DialogClose asChild>
            <button
              type="button"
              data-testid="upgrade-dialog-cancel"
              aria-label="Cancelar upgrade e fechar diálogo"
              className="rounded-md border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-text-primary)] hover:bg-gray-50"
            >
              Cancelar
            </button>
          </DialogClose>

          {/* Confirmar */}
          <button
            ref={confirmRef}
            type="button"
            data-testid="upgrade-dialog-confirm"
            aria-label={`Confirmar upgrade para plano ${planName}`}
            className="rounded-md bg-[var(--color-text-primary)] px-4 py-2 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-text-primary)] hover:opacity-90"
            onClick={handleConfirm}
          >
            Confirmar upgrade
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
