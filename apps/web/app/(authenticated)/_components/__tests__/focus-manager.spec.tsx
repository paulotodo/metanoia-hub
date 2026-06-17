import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FocusManager } from "../focus-manager";

// Mock do hook para testar integração de props
vi.mock("@/hooks/use-focus-on-route-change", () => ({
  useFocusOnRouteChange: vi.fn(),
}));

import { useFocusOnRouteChange } from "@/hooks/use-focus-on-route-change";

describe("FocusManager", () => {
  it("não renderiza nenhum elemento DOM visível", () => {
    const { container } = render(<FocusManager />);
    expect(container.firstChild).toBeNull();
  });

  it("invoca useFocusOnRouteChange sem seletor por padrão", () => {
    render(<FocusManager />);
    expect(useFocusOnRouteChange).toHaveBeenCalledWith({
      selector: undefined,
    });
  });

  it("repassa o seletor customizado para o hook", () => {
    render(<FocusManager selector="#main-content" />);
    expect(useFocusOnRouteChange).toHaveBeenCalledWith({
      selector: "#main-content",
    });
  });
});
