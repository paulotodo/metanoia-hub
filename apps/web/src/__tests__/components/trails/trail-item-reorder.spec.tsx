/**
 * trail-item-reorder.spec.tsx — Testes unitários: TrailItemReorder
 *
 * Story 12.2 — US4, FR-012, FR-013, CL-004
 *
 * Cobre:
 *   - Renderização dos botões sempre visíveis (CL-004)
 *   - aria-label descritivo com título do item (FR-012)
 *   - Desabilitação correta nos extremos da lista
 *   - Callbacks onMoveUp / onMoveDown chamados com o índice correto
 *   - Anúncio via useAsyncAnnouncer após ativação (CHK004)
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TrailItemReorder } from "@/components/trails/trail-item-reorder";
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

interface RenderReorderOptions {
  itemTitle?: string;
  index?: number;
  total?: number;
  onMoveUp?: ReturnType<typeof vi.fn>;
  onMoveDown?: ReturnType<typeof vi.fn>;
}

function renderReorder({
  itemTitle = "Módulo 1",
  index = 1,
  total = 3,
  onMoveUp = vi.fn(),
  onMoveDown = vi.fn(),
}: RenderReorderOptions = {}) {
  const result = render(
    <Wrapper>
      <TrailItemReorder
        itemTitle={itemTitle}
        index={index}
        total={total}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </Wrapper>,
  );
  return { ...result, onMoveUp, onMoveDown };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("TrailItemReorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // CL-004: botões sempre visíveis
  // -------------------------------------------------------------------------

  it("CL-004: renderiza ambos os botões no DOM (sempre visíveis)", () => {
    renderReorder();

    const upBtn = screen.getByTestId("trail-item-reorder-up");
    const downBtn = screen.getByTestId("trail-item-reorder-down");

    // Botões existem no DOM sem depender de hover/focus-within
    expect(upBtn).toBeDefined();
    expect(downBtn).toBeDefined();
  });

  it("CL-004: o container data-testid está presente", () => {
    renderReorder();
    expect(screen.getByTestId("trail-item-reorder")).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // FR-012: aria-label descritivo com título do item
  // -------------------------------------------------------------------------

  it("FR-012: aria-label do botão 'para cima' inclui o título do item", () => {
    renderReorder({ itemTitle: "Módulo Introdução" });

    const upBtn = screen.getByRole("button", {
      name: /Mover Módulo Introdução para cima/i,
    });
    expect(upBtn).toBeDefined();
  });

  it("FR-012: aria-label do botão 'para baixo' inclui o título do item", () => {
    renderReorder({ itemTitle: "Lição 3 — Prática" });

    const downBtn = screen.getByRole("button", {
      name: /Mover Lição 3 — Prática para baixo/i,
    });
    expect(downBtn).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Desabilitação nos extremos
  // -------------------------------------------------------------------------

  it("desabilita o botão 'para cima' quando o item é o primeiro (index=0)", () => {
    renderReorder({ index: 0, total: 3 });

    const upBtn = screen.getByTestId("trail-item-reorder-up");
    const downBtn = screen.getByTestId("trail-item-reorder-down");

    expect(upBtn.hasAttribute("disabled")).toBe(true);
    expect(downBtn.hasAttribute("disabled")).toBe(false);
  });

  it("desabilita o botão 'para baixo' quando o item é o último (index=total-1)", () => {
    renderReorder({ index: 2, total: 3 });

    const upBtn = screen.getByTestId("trail-item-reorder-up");
    const downBtn = screen.getByTestId("trail-item-reorder-down");

    expect(upBtn.hasAttribute("disabled")).toBe(false);
    expect(downBtn.hasAttribute("disabled")).toBe(true);
  });

  it("habilita ambos os botões quando o item está no meio da lista", () => {
    renderReorder({ index: 1, total: 3 });

    const upBtn = screen.getByTestId("trail-item-reorder-up");
    const downBtn = screen.getByTestId("trail-item-reorder-down");

    expect(upBtn.hasAttribute("disabled")).toBe(false);
    expect(downBtn.hasAttribute("disabled")).toBe(false);
  });

  it("com apenas 1 item: ambos os botões são desabilitados", () => {
    renderReorder({ index: 0, total: 1 });

    const upBtn = screen.getByTestId("trail-item-reorder-up");
    const downBtn = screen.getByTestId("trail-item-reorder-down");

    expect(upBtn.hasAttribute("disabled")).toBe(true);
    expect(downBtn.hasAttribute("disabled")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  it("chama onMoveUp com o índice correto ao clicar no botão para cima", () => {
    const onMoveUp = vi.fn();
    renderReorder({ index: 1, total: 3, onMoveUp });

    fireEvent.click(screen.getByTestId("trail-item-reorder-up"));

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveUp).toHaveBeenCalledWith(1);
  });

  it("chama onMoveDown com o índice correto ao clicar no botão para baixo", () => {
    const onMoveDown = vi.fn();
    renderReorder({ index: 1, total: 3, onMoveDown });

    fireEvent.click(screen.getByTestId("trail-item-reorder-down"));

    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledWith(1);
  });

  it("não chama onMoveUp quando o botão está desabilitado (index=0)", () => {
    const onMoveUp = vi.fn();
    renderReorder({ index: 0, total: 3, onMoveUp });

    fireEvent.click(screen.getByTestId("trail-item-reorder-up"));

    // Botão desabilitado: callback não deve ser chamado
    expect(onMoveUp).not.toHaveBeenCalled();
  });

  it("não chama onMoveDown quando o botão está desabilitado (índice final)", () => {
    const onMoveDown = vi.fn();
    renderReorder({ index: 2, total: 3, onMoveDown });

    fireEvent.click(screen.getByTestId("trail-item-reorder-down"));

    expect(onMoveDown).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // CHK004: Anúncio via AsyncAnnouncer
  // -------------------------------------------------------------------------

  it("CHK004: anuncia nova posição via região ARIA live ao mover para cima", () => {
    renderReorder({ itemTitle: "Módulo Teste", index: 1, total: 3 });

    act(() => {
      fireEvent.click(screen.getByTestId("trail-item-reorder-up"));
    });

    const polite = screen.getByTestId("async-announcer-polite");
    expect(polite.textContent).toMatch(/Módulo Teste movido para a posição/i);
  });

  it("CHK004: anuncia nova posição via região ARIA live ao mover para baixo", () => {
    renderReorder({ itemTitle: "Módulo Teste", index: 0, total: 3 });

    act(() => {
      fireEvent.click(screen.getByTestId("trail-item-reorder-down"));
    });

    const polite = screen.getByTestId("async-announcer-polite");
    expect(polite.textContent).toMatch(/Módulo Teste movido para a posição/i);
  });

  // -------------------------------------------------------------------------
  // Tipo de botão (type="button") — evita submit indesejado em formulários
  // -------------------------------------------------------------------------

  it("os botões têm type='button' para não disparar submit de formulário", () => {
    renderReorder();

    const upBtn = screen.getByTestId("trail-item-reorder-up");
    const downBtn = screen.getByTestId("trail-item-reorder-down");

    expect(upBtn.getAttribute("type")).toBe("button");
    expect(downBtn.getAttribute("type")).toBe("button");
  });

  // -------------------------------------------------------------------------
  // SVG acessível (aria-hidden nas setas)
  // -------------------------------------------------------------------------

  it("os ícones SVG têm aria-hidden='true' (decorativos)", () => {
    renderReorder();

    const container = screen.getByTestId("trail-item-reorder");
    const svgs = container.querySelectorAll("svg");

    svgs.forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
