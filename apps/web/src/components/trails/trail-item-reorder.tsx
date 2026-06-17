"use client";

/**
 * trail-item-reorder.tsx
 *
 * Story 12.2 — US4, FR-012, FR-013, CL-004
 *
 * Componente com botões "Mover para cima" / "Mover para baixo" SEMPRE
 * visíveis (CL-004: não dependem de hover/focus-within).
 *
 * Decisão dec-014 (operador): botões sempre visíveis — são a alternativa de
 * teclado ao drag-and-drop existente. Drag-and-drop continua funcionando para
 * mouse.
 *
 * Comportamento de foco (FR-013): após ativar um botão, o foco permanece no
 * botão do item que foi movido (não salta para o topo).
 *
 * Anúncio acessível (CHK004): usa `useAsyncAnnouncer` para anunciar a nova
 * posição após reordenação via região ARIA live.
 */

import { useCallback, useRef } from "react";
import { useAsyncAnnouncer } from "@/components/a11y/async-announcer";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TrailItemReorderProps {
  /** Título do item — usado no aria-label dos botões. */
  itemTitle: string;
  /** Índice base-0 do item na lista. */
  index: number;
  /** Total de itens na lista. */
  total: number;
  /**
   * Callback chamado quando o usuário ativa "Mover para cima".
   * Recebe o índice atual do item.
   */
  onMoveUp: (index: number) => void;
  /**
   * Callback chamado quando o usuário ativa "Mover para baixo".
   * Recebe o índice atual do item.
   */
  onMoveDown: (index: number) => void;
  /** Classe CSS adicional para o container dos botões. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Renderiza dois botões de reordenação ("↑" / "↓") para um item de lista.
 *
 * Os botões são SEMPRE visíveis (CL-004), independente de hover ou foco.
 * São desabilitados automaticamente quando o item está no extremo da lista.
 *
 * @example
 * ```tsx
 * <TrailItemReorder
 *   itemTitle="Módulo 1 — Introdução"
 *   index={0}
 *   total={items.length}
 *   onMoveUp={handleMoveUp}
 *   onMoveDown={handleMoveDown}
 * />
 * ```
 */
export function TrailItemReorder({
  itemTitle,
  index,
  total,
  onMoveUp,
  onMoveDown,
  className = "",
}: TrailItemReorderProps) {
  const { announce } = useAsyncAnnouncer();
  const upButtonRef = useRef<HTMLButtonElement>(null);
  const downButtonRef = useRef<HTMLButtonElement>(null);

  const isFirst = index === 0;
  const isLast = index === total - 1;

  /**
   * Mover item para cima.
   *
   * FR-013: após mover, o foco permanece no botão "para cima" do item.
   * Como o índice do item muda de `index` para `index - 1`, o componente
   * será re-renderizado e o foco precisa ser restaurado manualmente via
   * requestAnimationFrame (para aguardar o re-render do React).
   */
  const handleMoveUp = useCallback(() => {
    onMoveUp(index);
    // FR-013: restaurar foco no botão "para cima" após re-render
    requestAnimationFrame(() => {
      upButtonRef.current?.focus();
    });
    // CHK004: anunciar nova posição (posição base-1 para o usuário)
    const newPosition = index; // após mover: estava em index+1, vai para index (base-1)
    announce(`${itemTitle} movido para a posição ${newPosition}.`);
  }, [index, itemTitle, onMoveUp, announce]);

  /**
   * Mover item para baixo.
   *
   * FR-013: após mover, o foco permanece no botão "para baixo" do item.
   */
  const handleMoveDown = useCallback(() => {
    onMoveDown(index);
    // FR-013: restaurar foco no botão "para baixo" após re-render
    requestAnimationFrame(() => {
      downButtonRef.current?.focus();
    });
    // CHK004: anunciar nova posição (posição base-1 para o usuário)
    const newPosition = index + 2; // após mover: estava em index+1, vai para index+2 (base-1)
    announce(`${itemTitle} movido para a posição ${newPosition}.`);
  }, [index, itemTitle, onMoveDown, announce]);

  return (
    <div
      className={`inline-flex flex-col gap-0.5 ${className}`}
      data-testid="trail-item-reorder"
    >
      {/* Botão "Mover para cima" — desabilitado no primeiro item */}
      <button
        ref={upButtonRef}
        type="button"
        onClick={handleMoveUp}
        disabled={isFirst}
        aria-label={`Mover ${itemTitle} para cima`}
        data-testid="trail-item-reorder-up"
        className={[
          "flex h-7 w-7 items-center justify-center rounded",
          "text-sm font-medium leading-none",
          "border border-border bg-background",
          "text-foreground transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-40",
        ].join(" ")}
      >
        {/* Seta para cima — visualmente representada como ↑ */}
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 9.5V2.5M6 2.5L2.5 6M6 2.5L9.5 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Botão "Mover para baixo" — desabilitado no último item */}
      <button
        ref={downButtonRef}
        type="button"
        onClick={handleMoveDown}
        disabled={isLast}
        aria-label={`Mover ${itemTitle} para baixo`}
        data-testid="trail-item-reorder-down"
        className={[
          "flex h-7 w-7 items-center justify-center rounded",
          "text-sm font-medium leading-none",
          "border border-border bg-background",
          "text-foreground transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-40",
        ].join(" ")}
      >
        {/* Seta para baixo — visualmente representada como ↓ */}
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 2.5V9.5M6 9.5L9.5 6M6 9.5L2.5 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
