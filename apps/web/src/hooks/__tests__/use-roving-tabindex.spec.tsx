import { renderHook, render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useRovingTabindex } from "../use-roving-tabindex";
import React from "react";

/** Componente auxiliar para testar o hook em contexto DOM real */
function RovingList({
  orientation,
  wrap,
  onItemClick,
}: {
  orientation?: "vertical" | "horizontal" | "both";
  wrap?: boolean;
  onItemClick?: (label: string) => void;
}) {
  const { containerRef, onKeyDown } = useRovingTabindex({ orientation, wrap });

  return (
    <ul
      ref={containerRef as React.RefObject<HTMLUListElement>}
      onKeyDown={onKeyDown}
      role="listbox"
    >
      {["Item 1", "Item 2", "Item 3"].map((label, i) => (
        <li key={label} role="option">
          <button
            tabIndex={i === 0 ? 0 : -1}
            onClick={() => onItemClick?.(label)}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function getUl(container: HTMLElement): HTMLElement {
  const ul = container.querySelector("ul");
  if (!ul) throw new Error("ul not found");
  return ul;
}

describe("useRovingTabindex", () => {
  it("retorna containerRef e onKeyDown", () => {
    const { result } = renderHook(() => useRovingTabindex());
    expect(result.current.containerRef).toBeDefined();
    expect(typeof result.current.onKeyDown).toBe("function");
  });

  it("ArrowDown move foco para próximo item (vertical)", () => {
    const { container } = render(<RovingList orientation="vertical" />);
    const buttons = container.querySelectorAll("button");

    buttons[0].focus();
    fireEvent.keyDown(getUl(container), { key: "ArrowDown" });

    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].getAttribute("tabindex")).toBe("0");
    expect(buttons[0].getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowUp move foco para item anterior (vertical)", () => {
    const { container } = render(<RovingList orientation="vertical" />);
    const buttons = container.querySelectorAll("button");

    buttons[1].focus();
    buttons[0].setAttribute("tabindex", "-1");
    buttons[1].setAttribute("tabindex", "0");

    fireEvent.keyDown(getUl(container), { key: "ArrowUp" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("wrap circular: ArrowDown no último item vai para o primeiro", () => {
    const { container } = render(<RovingList orientation="vertical" wrap={true} />);
    const buttons = container.querySelectorAll("button");

    buttons[2].focus();
    buttons[2].setAttribute("tabindex", "0");
    buttons[0].setAttribute("tabindex", "-1");

    fireEvent.keyDown(getUl(container), { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("sem wrap: ArrowDown no último item permanece no último", () => {
    const { container } = render(<RovingList orientation="vertical" wrap={false} />);
    const buttons = container.querySelectorAll("button");

    buttons[2].focus();
    buttons[2].setAttribute("tabindex", "0");
    buttons[0].setAttribute("tabindex", "-1");

    fireEvent.keyDown(getUl(container), { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("Home foca o primeiro item", () => {
    const { container } = render(<RovingList orientation="vertical" />);
    const buttons = container.querySelectorAll("button");

    buttons[2].focus();
    fireEvent.keyDown(getUl(container), { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("End foca o último item", () => {
    const { container } = render(<RovingList orientation="vertical" />);
    const buttons = container.querySelectorAll("button");

    buttons[0].focus();
    fireEvent.keyDown(getUl(container), { key: "End" });
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("Enter aciona click no item focado", () => {
    const onItemClick = vi.fn();
    const { container } = render(
      <RovingList orientation="vertical" onItemClick={onItemClick} />,
    );
    const buttons = container.querySelectorAll("button");

    buttons[0].focus();
    fireEvent.keyDown(getUl(container), { key: "Enter" });
    expect(onItemClick).toHaveBeenCalledWith("Item 1");
  });

  it("ArrowRight move foco no modo horizontal", () => {
    const { container } = render(<RovingList orientation="horizontal" />);
    const buttons = container.querySelectorAll("button");

    buttons[0].focus();
    fireEvent.keyDown(getUl(container), { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("ArrowDown move foco no modo both", () => {
    const { container } = render(<RovingList orientation="both" />);
    const buttons = container.querySelectorAll("button");

    buttons[0].focus();
    fireEvent.keyDown(getUl(container), { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("wrap circular: ArrowUp no primeiro item vai para o último", () => {
    const { container } = render(<RovingList orientation="vertical" wrap={true} />);
    const buttons = container.querySelectorAll("button");

    buttons[0].focus();
    fireEvent.keyDown(getUl(container), { key: "ArrowUp" });
    expect(document.activeElement).toBe(buttons[2]);
  });
});
