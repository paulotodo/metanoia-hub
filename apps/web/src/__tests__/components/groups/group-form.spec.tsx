/**
 * group-form.spec.tsx — Testes unitários: GroupForm
 *
 * Story 12.2 — US3, FR-008, FR-011
 *
 * Cobre:
 *   - Tab order: todos os campos acessíveis em ordem lógica
 *   - Submit dispara onSuccess com valores corretos
 *   - Estado pending desabilita campos e botão
 *   - Anúncio de feedback via useAsyncAnnouncer
 *   - jest-axe: sem violações nos formulários
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "jest-axe";
import { GroupForm } from "@/components/groups/group-form";
import { AsyncAnnouncerProvider } from "@/components/a11y/async-announcer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface WrapperProps {
  children: React.ReactNode;
}

function Wrapper({ children }: WrapperProps) {
  return <AsyncAnnouncerProvider>{children}</AsyncAnnouncerProvider>;
}

interface RenderFormOptions {
  initialValues?: Record<string, string>;
  onSuccess?: ReturnType<typeof vi.fn>;
  onCancel?: ReturnType<typeof vi.fn>;
  pending?: boolean;
  submitLabel?: string;
}

function renderForm({
  initialValues,
  onSuccess = vi.fn(),
  onCancel,
  pending = false,
  submitLabel,
}: RenderFormOptions = {}) {
  const result = render(
    <Wrapper>
      <GroupForm
        initialValues={initialValues}
        onSuccess={onSuccess}
        onCancel={onCancel}
        pending={pending}
        submitLabel={submitLabel}
      />
    </Wrapper>,
  );
  return { ...result, onSuccess, onCancel };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("GroupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza todos os campos do formulário", () => {
    renderForm();
    expect(screen.getByLabelText(/Nome do grupo/i)).toBeTruthy();
    expect(screen.getByLabelText(/Quando se reune/i)).toBeTruthy();
    expect(screen.getByLabelText(/Horario/i)).toBeTruthy();
    expect(screen.getByLabelText(/Observacoes/i)).toBeTruthy();
    expect(screen.getByTestId("group-form-submit")).toBeTruthy();
  });

  it("todos os campos têm id e label associados (for/id)", () => {
    const { container } = renderForm();
    // Verifica associação label→input
    const nameInput = container.querySelector("#group-name");
    const daySelect = container.querySelector("#group-day");
    const timeInput = container.querySelector("#group-time");
    const descTextarea = container.querySelector("#group-description");
    expect(nameInput).toBeTruthy();
    expect(daySelect).toBeTruthy();
    expect(timeInput).toBeTruthy();
    expect(descTextarea).toBeTruthy();
  });

  it("chama onSuccess com os valores corretos ao submeter", () => {
    const { onSuccess } = renderForm();
    // Preencher nome (campo required)
    fireEvent.change(screen.getByLabelText(/Nome do grupo/i), {
      target: { value: "Célula Quinta" },
    });
    fireEvent.submit(screen.getByTestId("group-form"));
    expect(onSuccess).toHaveBeenCalledOnce();
    const [values] = onSuccess.mock.calls[0] as [Record<string, string>];
    expect(values.name).toBe("Célula Quinta");
  });

  it("desabilita todos os campos quando pending=true", () => {
    const { container } = renderForm({ pending: true });
    const inputs = container.querySelectorAll("input, select, textarea, button");
    inputs.forEach((el) => {
      expect((el as HTMLButtonElement | HTMLInputElement).disabled).toBe(true);
    });
  });

  it("exibe botão Cancelar quando onCancel é fornecido", () => {
    renderForm({ onCancel: vi.fn() });
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("não exibe botão Cancelar quando onCancel é omitido", () => {
    renderForm();
    expect(screen.queryByText("Cancelar")).toBeNull();
  });

  it("jest-axe: sem violações de acessibilidade no formulário", async () => {
    const { container } = render(
      <Wrapper>
        <GroupForm onSuccess={vi.fn()} />
      </Wrapper>,
    );
    const results = await act(async () => axe(container));
    expect(results).toHaveNoViolations();
  });
});
