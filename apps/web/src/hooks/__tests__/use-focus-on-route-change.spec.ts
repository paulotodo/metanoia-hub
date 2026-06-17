import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFocusOnRouteChange } from "../use-focus-on-route-change";

// Mock next/navigation para controlar usePathname
const mockPathname = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
}));

function setPathname(path: string) {
  mockPathname.value = path;
}

describe("useFocusOnRouteChange", () => {
  let focusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    focusMock = vi.fn();
    mockPathname.value = "/dashboard";
    // Limpar DOM
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("não dispara foco no mount inicial", () => {
    const h1 = document.createElement("h1");
    h1.focus = focusMock;
    document.body.appendChild(h1);

    renderHook(() => useFocusOnRouteChange());

    expect(focusMock).not.toHaveBeenCalled();
  });

  it("move foco para h1 após mudança de pathname (fallback CHK007 passo 3)", async () => {
    const h1 = document.createElement("h1");
    h1.focus = focusMock;
    document.body.appendChild(h1);

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    // Simular navegação
    setPathname("/groups");
    act(() => {
      rerender();
    });

    expect(focusMock).toHaveBeenCalledTimes(1);
    expect(focusMock).toHaveBeenCalledWith({ preventScroll: false });
  });

  it("prefere [data-autofocus] sobre h1 (fallback CHK007 passo 2)", async () => {
    const h1 = document.createElement("h1");
    h1.focus = focusMock;
    document.body.appendChild(h1);

    const autoFocusEl = document.createElement("div");
    const autoFocusMock = vi.fn();
    autoFocusEl.focus = autoFocusMock;
    autoFocusEl.setAttribute("data-autofocus", "");
    document.body.appendChild(autoFocusEl);

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    setPathname("/trails");
    act(() => {
      rerender();
    });

    expect(autoFocusMock).toHaveBeenCalledTimes(1);
    expect(focusMock).not.toHaveBeenCalled();
  });

  it("prefere seletor customizado quando fornecido (fallback CHK007 passo 1)", async () => {
    const customEl = document.createElement("div");
    customEl.id = "custom-target";
    const customFocusMock = vi.fn();
    customEl.focus = customFocusMock;
    document.body.appendChild(customEl);

    const h1 = document.createElement("h1");
    h1.focus = focusMock;
    document.body.appendChild(h1);

    const { rerender } = renderHook(() =>
      useFocusOnRouteChange({ selector: "#custom-target" }),
    );

    setPathname("/catalog");
    act(() => {
      rerender();
    });

    expect(customFocusMock).toHaveBeenCalledTimes(1);
    expect(focusMock).not.toHaveBeenCalled();
  });

  it("usa #conteudo com tabIndex=-1 injetado quando h1 ausente (fallback CHK007 passo 4)", async () => {
    const main = document.createElement("main");
    main.id = "conteudo";
    const mainFocusMock = vi.fn();
    main.focus = mainFocusMock;
    document.body.appendChild(main);

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    setPathname("/settings");
    act(() => {
      rerender();
    });

    expect(main.getAttribute("tabindex")).toBe("-1");
    expect(mainFocusMock).toHaveBeenCalledTimes(1);
  });

  it("não injeta tabIndex=-1 se #conteudo já possui tabindex", async () => {
    const main = document.createElement("main");
    main.id = "conteudo";
    main.setAttribute("tabindex", "0");
    const mainFocusMock = vi.fn();
    main.focus = mainFocusMock;
    document.body.appendChild(main);

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    setPathname("/plans");
    act(() => {
      rerender();
    });

    expect(main.getAttribute("tabindex")).toBe("0"); // preservado
    expect(mainFocusMock).toHaveBeenCalledTimes(1);
  });

  it("não dispara foco quando pathname não muda", () => {
    const h1 = document.createElement("h1");
    h1.focus = focusMock;
    document.body.appendChild(h1);

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    // Mesmo pathname
    setPathname("/dashboard");
    act(() => {
      rerender();
    });

    expect(focusMock).not.toHaveBeenCalled();
  });

  it("não lança erro quando nenhum candidato de foco existe (fail-silent)", () => {
    // DOM vazio — sem h1, sem [data-autofocus], sem #conteudo
    document.body.innerHTML = "";

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    setPathname("/empty");
    expect(() => {
      act(() => {
        rerender();
      });
    }).not.toThrow();
  });

  it("detecta múltiplas mudanças de rota sequenciais", () => {
    const h1 = document.createElement("h1");
    h1.focus = focusMock;
    document.body.appendChild(h1);

    const { rerender } = renderHook(() => useFocusOnRouteChange());

    setPathname("/groups");
    act(() => rerender());

    setPathname("/trails");
    act(() => rerender());

    setPathname("/settings");
    act(() => rerender());

    expect(focusMock).toHaveBeenCalledTimes(3);
  });
});
