/**
 * delete-group-dialog.tsx — Diálogo de confirmação de exclusão de grupo
 *
 * Story 12.2 — US3, FR-009, CL-002
 *
 * A11y (dec-011):
 *   - Usa shadcn/ui Dialog (Radix UI) que fornece focus trap nativo.
 *   - Escape fecha o diálogo e retorna foco ao elemento que o abriu (FR-009).
 *   - Primeiro elemento focável é o botão "Cancelar" (mais seguro para ação
 *     destrutiva — CL-002).
 *   - Tab mantém foco dentro do diálogo (Radix garante por padrão).
 *   - NÃO implementar focus trap manual — Radix Dialog já cobre (dec-011).
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@metanoia/ui";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DeleteGroupDialogProps {
  /** Controla visibilidade do diálogo. */
  open: boolean;
  /** Chamado quando o estado de abertura muda (Escape / clique fora). */
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário confirma a exclusão. */
  onConfirm: () => void;
  /** Nome do grupo a ser excluído — exibido na mensagem de confirmação. */
  groupName: string;
  /** True enquanto a exclusão está sendo processada. */
  pending?: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DeleteGroupDialog({
  open,
  onOpenChange,
  onConfirm,
  groupName,
  pending = false,
}: DeleteGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /**
         * Radix DialogContent já aplica:
         *   - focus trap (FocusScope com loop=true)
         *   - role="dialog" + aria-modal="true"
         *   - restoreFocus ao fechar (retorna ao trigger)
         *   - Escape via onKeyDown nativo
         * Nenhuma implementação adicional necessária (dec-011).
         */
        data-testid="delete-group-dialog"
      >
        <DialogHeader>
          <DialogTitle>Excluir grupo</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o grupo{" "}
            <strong>{groupName}</strong>? Essa ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          {/*
           * CL-002: botão "Cancelar" é o PRIMEIRO elemento focável.
           * Radix move o foco para o primeiro focável ao abrir o diálogo,
           * garantindo que a ação segura receba foco inicial.
           */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            data-testid="delete-group-cancel"
            className={[
              "h-11 rounded-lg border border-[var(--border)] px-4",
              "text-sm font-medium text-[var(--color-text-primary)]",
              "hover:bg-[var(--surface-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-teal)]",
              "disabled:opacity-60",
            ].join(" ")}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid="delete-group-confirm"
            className={[
              "h-11 rounded-lg bg-red-600 px-4",
              "text-sm font-semibold text-white",
              "hover:bg-red-700",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
              "disabled:opacity-60",
            ].join(" ")}
          >
            {pending ? "Excluindo..." : "Excluir grupo"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
