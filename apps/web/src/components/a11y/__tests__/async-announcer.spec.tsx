import {
  render,
  screen,
  act,
  renderHook,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  AsyncAnnouncerProvider,
  useAsyncAnnouncer,
} from "../async-announcer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <AsyncAnnouncerProvider>{children}</AsyncAnnouncerProvider>;
}

// ---------------------------------------------------------------------------
// Testes do Provider
// ---------------------------------------------------------------------------

describe("AsyncAnnouncerProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza as regiões ARIA live polite e assertive ocultas", () => {
    render(
      <AsyncAnnouncerProvider>
        <div>conteúdo</div>
      </AsyncAnnouncerProvider>,
    );

    const polite = screen.getByTestId("async-announcer-polite");
    const assertive = screen.getByTestId("async-announcer-assertive");

    expect(polite).toBeDefined();
    expect(polite.getAttribute("role")).toBe("status");
    expect(polite.getAttribute("aria-live")).toBe("polite");
    expect(polite.getAttribute("aria-atomic")).toBe("true");

    expect(assertive).toBeDefined();
    expect(assertive.getAttribute("role")).toBe("alert");
    expect(assertive.getAttribute("aria-live")).toBe("assertive");
    expect(assertive.getAttribute("aria-atomic")).toBe("true");
  });

  it("anuncia mensagem polite na região correta", () => {
    function TestComponent() {
      const { announce } = useAsyncAnnouncer();
      return (
        <button onClick={() => announce("Salvo com sucesso")}>Salvar</button>
      );
    }

    render(
      <AsyncAnnouncerProvider>
        <TestComponent />
      </AsyncAnnouncerProvider>,
    );

    act(() => {
      screen.getByRole("button").click();
    });

    const polite = screen.getByTestId("async-announcer-polite");
    expect(polite.textContent).toBe("Salvo com sucesso");
  });

  it("anuncia mensagem assertive na região correta", () => {
    function TestComponent() {
      const { announce } = useAsyncAnnouncer();
      return (
        <button
          onClick={() =>
            announce("Erro crítico!", { politeness: "assertive" })
          }
        >
          Ação
        </button>
      );
    }

    render(
      <AsyncAnnouncerProvider>
        <TestComponent />
      </AsyncAnnouncerProvider>,
    );

    act(() => {
      screen.getByRole("button").click();
    });

    const assertive = screen.getByTestId("async-announcer-assertive");
    expect(assertive.textContent).toBe("Erro crítico!");
  });

  it("limpa a mensagem polite após clearAfterMs (padrão 3000ms)", () => {
    function TestComponent() {
      const { announce } = useAsyncAnnouncer();
      return (
        <button
          onClick={() =>
            announce("Mensagem temporária", { clearAfterMs: 3000 })
          }
        >
          Ação
        </button>
      );
    }

    render(
      <AsyncAnnouncerProvider>
        <TestComponent />
      </AsyncAnnouncerProvider>,
    );

    act(() => {
      screen.getByRole("button").click();
    });

    const polite = screen.getByTestId("async-announcer-polite");
    expect(polite.textContent).toBe("Mensagem temporária");

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.getByTestId("async-announcer-polite").textContent).toBe("");
  });

  it("renderiza os filhos normalmente", () => {
    render(
      <AsyncAnnouncerProvider>
        <p data-testid="child">conteúdo filho</p>
      </AsyncAnnouncerProvider>,
    );
    const child = screen.getByTestId("child");
    expect(child).toBeDefined();
    expect(child.textContent).toBe("conteúdo filho");
  });

  it("politeness padrão é polite quando não especificado", () => {
    function TestComponent() {
      const { announce } = useAsyncAnnouncer();
      return (
        <button onClick={() => announce("Mensagem padrão")}>Ação</button>
      );
    }

    render(
      <AsyncAnnouncerProvider>
        <TestComponent />
      </AsyncAnnouncerProvider>,
    );

    act(() => {
      screen.getByRole("button").click();
    });

    expect(screen.getByTestId("async-announcer-polite").textContent).toBe(
      "Mensagem padrão",
    );
    // assertive permanece vazio
    expect(screen.getByTestId("async-announcer-assertive").textContent).toBe(
      "",
    );
  });
});

// ---------------------------------------------------------------------------
// Testes do hook useAsyncAnnouncer
// ---------------------------------------------------------------------------

describe("useAsyncAnnouncer", () => {
  it("retorna announce quando dentro do provider", () => {
    const { result } = renderHook(() => useAsyncAnnouncer(), { wrapper });
    expect(typeof result.current.announce).toBe("function");
  });

  it("lança erro quando usado fora do provider", () => {
    // Suprimir console.error do React
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAsyncAnnouncer());
    }).toThrow("[useAsyncAnnouncer] deve ser usado dentro de");

    spy.mockRestore();
  });
});
