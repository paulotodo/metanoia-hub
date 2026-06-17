/**
 * invite-members-form.tsx — Formulário de convite de membros com upload CSV
 *
 * Story 12.2 — US3, FR-010
 *
 * A11y:
 *   - Input de email é focável e ativável via Tab normalmente.
 *   - Botão de upload CSV usa padrão <label> + <input type="file"> visível:
 *       * O <label> é renderizado como botão visível e focável (tabIndex={0}).
 *       * Enter e Space ativam o <label> que dispara o input[type="file"].
 *       * Input file real fica visível com opacity-0 para não quebrar
 *         acessibilidade nativa (aria-hidden=false — aria-label explícito).
 *   - Aria-label descritivo presente em todos os controles.
 */

"use client";

import { useRef } from "react";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface InviteMembersFormProps {
  /** Chamado quando um email é submetido para convite. */
  onInviteEmail: (email: string) => void;
  /** Chamado quando arquivo CSV é selecionado. */
  onUploadCsv: (file: File) => void;
  /** Estado de envio. */
  pending?: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function InviteMembersForm({
  onInviteEmail,
  onUploadCsv,
  pending = false,
}: InviteMembersFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Submit do email
  // -------------------------------------------------------------------------

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = (data.get("email") as string)?.trim() ?? "";
    if (email) {
      onInviteEmail(email);
      e.currentTarget.reset();
    }
  }

  // -------------------------------------------------------------------------
  // Upload CSV
  // -------------------------------------------------------------------------

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCsv(file);
      // Limpar o input para permitir novo upload do mesmo arquivo
      e.target.value = "";
    }
  }

  /**
   * Permite ativar o upload via Enter/Space no botão visível.
   * O label html nativo já gerencia o clique; este handler cobre o teclado
   * quando o label é focado diretamente (não via Tab sobre o input).
   */
  function handleUploadKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="invite-members-form"
    >
      {/* Seção 1: Convite por email */}
      <form
        onSubmit={handleEmailSubmit}
        aria-label="Convidar membro por email"
        className="flex flex-col gap-2"
      >
        <label
          htmlFor="invite-email"
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          Convidar por email
        </label>
        <div className="flex gap-2">
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            disabled={pending}
            placeholder="nome@exemplo.com"
            aria-label="Endereço de email do convidado"
            data-testid="invite-email-input"
            className={[
              "h-11 flex-1 rounded-lg border border-[var(--border)]",
              "bg-[var(--card)] px-3 text-sm text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
              "disabled:opacity-60",
            ].join(" ")}
          />
          <button
            type="submit"
            disabled={pending}
            data-testid="invite-email-submit"
            className={[
              "h-11 rounded-lg bg-[var(--color-brand-teal)] px-4",
              "text-sm font-semibold text-white",
              "hover:bg-[var(--color-brand-teal)]/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
              "disabled:opacity-60",
            ].join(" ")}
          >
            Convidar
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-2" aria-hidden="true">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">ou</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {/* Seção 2: Upload CSV
       *
       * Padrão a11y: <label> visível estilizado como botão + <input type="file">
       * associado. O input é posicionado via absolute com opacity-0 sobre o label
       * para que a ativação nativa do label (click/Enter sobre ele) funcione.
       *
       * - Tab alcança o <label> (via tabIndex={0}).
       * - Enter e Space ativam o upload (handleUploadKeyDown).
       * - O aria-label no input descreve o propósito para leitores de tela.
       * - O input NÃO está aria-hidden para que leitores de tela anunciem
       *   quando um arquivo é selecionado.
       */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Importar lista CSV
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          CSV com coluna &quot;email&quot;. Máx. 500 contatos por arquivo.
        </p>
        <div className="relative inline-flex">
          {/* Label visível e focável — age como botão */}
          <span
            role="button"
            tabIndex={pending ? -1 : 0}
            onKeyDown={handleUploadKeyDown}
            aria-disabled={pending}
            data-testid="upload-csv-button"
            className={[
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg",
              "border border-dashed border-[var(--color-brand-teal)] px-4",
              "text-sm font-medium text-[var(--color-brand-teal)]",
              "hover:bg-[var(--color-brand-teal)]/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
              pending ? "pointer-events-none opacity-60" : "",
            ].join(" ")}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 1v9M4 6l4-5 4 5M2 12h12v2H2v-2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Carregar arquivo CSV
          </span>

          {/* Input file real — sobreposição invisível para ativar seletor nativo */}
          <input
            ref={fileInputRef}
            id="upload-csv-input"
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={handleFileChange}
            aria-label="Selecionar arquivo CSV para importar membros"
            data-testid="upload-csv-input"
            className="absolute inset-0 cursor-pointer opacity-0 disabled:pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
