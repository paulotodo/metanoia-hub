/**
 * group-form.tsx — Formulário de criar/editar grupo
 *
 * Story 12.2 — US3, FR-008, FR-011
 *
 * A11y:
 *   - Tab navega todos os campos em ordem visual (top-to-bottom): Nome → Dia
 *     da semana → Horário → Observações → Botão de ação.
 *   - useAsyncAnnouncer anuncia resultado da ação para leitores de tela.
 *   - Após criação, o pai é responsável por retornar foco ao elemento correto
 *     (ver onSuccess callback com focusTargetRef).
 */

"use client";

import { useRef } from "react";
import { useAsyncAnnouncer } from "@/components/a11y/async-announcer";
import messages from "../../../messages/pt-BR.json";

const t = messages.group;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface GroupFormValues {
  name: string;
  dayOfWeek: string;
  time: string;
  description: string;
}

export interface GroupFormProps {
  /** Valores iniciais (modo edição). Omitido = criação. */
  initialValues?: Partial<GroupFormValues>;
  /** Chamado após submit bem-sucedido com foco de destino sugerido. */
  onSuccess: (values: GroupFormValues, focusTarget?: HTMLElement | null) => void;
  /** Chamado quando o usuário cancela. */
  onCancel?: () => void;
  /** Estado de envio (desabilita botão e campos). */
  pending?: boolean;
  /** Rótulo do botão de submit. */
  submitLabel?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function GroupForm({
  initialValues = {},
  onSuccess,
  onCancel,
  pending = false,
  submitLabel,
}: GroupFormProps) {
  const { announce } = useAsyncAnnouncer();

  // Ref para o botão de submit — usado pelo pai para restaurar foco
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const label = submitLabel ?? t.action.create;

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values: GroupFormValues = {
      name: (data.get("name") as string) ?? "",
      dayOfWeek: (data.get("dayOfWeek") as string) ?? "",
      time: (data.get("time") as string) ?? "",
      description: (data.get("description") as string) ?? "",
    };
    // Announce será feito pelo pai após a ação assíncrona completar;
    // aqui apenas delegamos.
    onSuccess(values, submitButtonRef.current);
    // Anunciar para leitores de tela que o formulário foi enviado
    announce("Formulário enviado. Processando...");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={label}
      data-testid="group-form"
      className="flex flex-col gap-4"
    >
      {/* 1. Nome do grupo — primeiro campo no tab order */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="group-name"
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {t.field.name.label}
          <span className="ml-1 text-[var(--color-text-muted)] font-normal" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="group-name"
          name="name"
          type="text"
          required
          autoComplete="off"
          defaultValue={initialValues.name ?? ""}
          placeholder={t.field.name.placeholder}
          disabled={pending}
          aria-required="true"
          aria-describedby="group-name-error"
          className={[
            "h-11 w-full rounded-lg border border-[var(--border)]",
            "bg-[var(--card)] px-3 text-sm text-[var(--color-text-primary)]",
            "placeholder:text-[var(--color-text-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
            "disabled:opacity-60",
          ].join(" ")}
        />
        <span id="group-name-error" role="alert" className="sr-only" />
      </div>

      {/* 2. Dia da semana */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="group-day"
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {t.field.schedule.label}
          <span className="ml-1 text-[var(--color-text-muted)] font-normal">
            {t.field.optional}
          </span>
        </label>
        <div className="flex gap-2">
          <select
            id="group-day"
            name="dayOfWeek"
            defaultValue={initialValues.dayOfWeek ?? ""}
            disabled={pending}
            className={[
              "h-11 flex-1 rounded-lg border border-[var(--border)]",
              "bg-[var(--card)] px-3 text-sm text-[var(--color-text-primary)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
              "disabled:opacity-60",
            ].join(" ")}
          >
            <option value="">{t.field.schedule.dayPlaceholder}</option>
            <option value="monday">{t.field.schedule.days.monday}</option>
            <option value="tuesday">{t.field.schedule.days.tuesday}</option>
            <option value="wednesday">{t.field.schedule.days.wednesday}</option>
            <option value="thursday">{t.field.schedule.days.thursday}</option>
            <option value="friday">{t.field.schedule.days.friday}</option>
            <option value="saturday">{t.field.schedule.days.saturday}</option>
            <option value="sunday">{t.field.schedule.days.sunday}</option>
          </select>

          {/* 3. Horário — na mesma linha mas na sequência lógica de tab */}
          <input
            id="group-time"
            name="time"
            type="time"
            defaultValue={initialValues.time ?? ""}
            disabled={pending}
            placeholder={t.field.schedule.timePlaceholder}
            aria-label={t.field.schedule.timePlaceholder}
            className={[
              "h-11 w-32 rounded-lg border border-[var(--border)]",
              "bg-[var(--card)] px-3 text-sm text-[var(--color-text-primary)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
              "disabled:opacity-60",
            ].join(" ")}
          />
        </div>
      </div>

      {/* 4. Observações */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="group-description"
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {t.field.description.label}
          <span className="ml-1 text-[var(--color-text-muted)] font-normal">
            {t.field.optional}
          </span>
        </label>
        <textarea
          id="group-description"
          name="description"
          defaultValue={initialValues.description ?? ""}
          disabled={pending}
          placeholder={t.field.description.placeholder}
          rows={3}
          className={[
            "w-full rounded-lg border border-[var(--border)]",
            "bg-[var(--card)] px-3 py-2 text-sm text-[var(--color-text-primary)]",
            "placeholder:text-[var(--color-text-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
            "resize-y disabled:opacity-60",
          ].join(" ")}
        />
      </div>

      {/* 5. Ações — último no tab order */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={[
              "h-11 rounded-lg border border-[var(--border)] px-4",
              "text-sm font-medium text-[var(--color-text-primary)]",
              "hover:bg-[var(--surface-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
              "disabled:opacity-60",
            ].join(" ")}
          >
            Cancelar
          </button>
        )}
        <button
          ref={submitButtonRef}
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          data-testid="group-form-submit"
          className={[
            "h-11 rounded-lg bg-[var(--color-brand-teal)] px-6",
            "text-sm font-semibold text-white",
            "hover:bg-[var(--color-brand-teal)]/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
            "disabled:opacity-60",
          ].join(" ")}
        >
          {pending ? "Salvando..." : label}
        </button>
      </div>
    </form>
  );
}
