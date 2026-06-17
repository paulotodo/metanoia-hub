/**
 * sidebar.spec.tsx — Testes unitários do componente Sidebar
 *
 * Story 12.2 — US1, FR-003, FR-004, FR-005, CL-003, CHK009
 *
 * Cobre:
 * - Renderização e ARIA (aria-label, aria-current)
 * - Roving tabindex: apenas item ativo tem tabindex=0 inicialmente
 * - Arrow Up/Down navega entre itens
 * - Home vai ao primeiro; End vai ao último
 * - CHK009: wrap circular (Arrow Down no último → primeiro; Arrow Up no primeiro → último)
 * - jest-axe: sem violações na sidebar isolada
 */

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { Home, Settings, User, Bell, Menu } from "lucide-react";
import { Sidebar } from "../components/sidebar";
import type { NavigationItem } from "../components/navigation-types";

const mockItems: NavigationItem[] = [
  { key: "home", label: "Home", href: "/home", icon: Home },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
  { key: "profile", label: "Profile", href: "/profile", icon: User },
  { key: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
  { key: "more", label: "More", href: "/more", icon: Menu },
];

describe("Sidebar — renderização e ARIA", () => {
  it("renderiza todos os itens de navegação com labels", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    for (const item of mockItems) {
      expect(screen.getByText(item.label)).toBeTruthy();
    }
  });

  it("renderiza landmark de navegação com aria-label", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation", { name: /navigation/i });
    expect(nav).toBeTruthy();
  });

  it("marca o item ativo com aria-current='page'", () => {
    render(<Sidebar items={mockItems} activeKey="settings" />);
    const activeLink = screen.getByText("Settings").closest("a");
    expect(activeLink?.getAttribute("aria-current")).toBe("page");
  });

  it("não marca itens inativos com aria-current", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const inactiveLink = screen.getByText("Settings").closest("a");
    expect(inactiveLink?.hasAttribute("aria-current")).toBe(false);
  });

  it("aplica classes de estilo ativo no item ativo", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const activeLink = screen.getByText("Home").closest("a");
    expect(activeLink?.className).toContain("text-[var(--primary)]");
  });

  it("aplica largura 240px via classe w-60", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation", { name: /navigation/i });
    expect(nav.className).toContain("w-60");
  });

  it("renderiza slot de header opcional", () => {
    render(
      <Sidebar
        items={mockItems}
        activeKey="home"
        header={<div data-testid="sidebar-header">Logo</div>}
      />,
    );
    expect(screen.getByTestId("sidebar-header")).toBeTruthy();
  });

  it("usa renderLink quando fornecido", () => {
    const renderLink = vi.fn(
      (item: NavigationItem, children: React.ReactNode) => (
        <a href={item.href} data-testid={`custom-${item.key}`}>
          {children}
        </a>
      ),
    );
    render(
      <Sidebar items={mockItems} activeKey="home" renderLink={renderLink} />,
    );
    expect(renderLink).toHaveBeenCalledTimes(mockItems.length);
    expect(screen.getByTestId("custom-home")).toBeTruthy();
  });

  it("aplica classes de transição motion-safe", () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("motion-safe:transition-colors");
    }
  });

  it("mescla className personalizado", () => {
    render(
      <Sidebar
        items={mockItems}
        activeKey="home"
        className="custom-class"
      />,
    );
    const nav = screen.getByRole("navigation", { name: /navigation/i });
    expect(nav.className).toContain("custom-class");
  });
});

describe("Sidebar — roving tabindex (US1, FR-004, CHK009)", () => {
  it("item ativo tem tabindex=0; demais têm tabindex=-1", () => {
    render(<Sidebar items={mockItems} activeKey="settings" />);
    // useLayoutEffect inicializa o tabindex
    const links = screen.getAllByRole("link");
    const activeLink = screen.getByText("Settings").closest("a");
    expect(activeLink?.getAttribute("tabindex")).toBe("0");
    // todos os outros devem ter -1
    for (const link of links) {
      if (link !== activeLink) {
        expect(link.getAttribute("tabindex")).toBe("-1");
      }
    }
  });

  it("Tab entra na sidebar pelo item com tabindex=0", async () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const user = userEvent.setup();
    await user.tab();
    const homeLink = screen.getByText("Home").closest("a");
    expect(document.activeElement).toBe(homeLink);
  });

  it("Arrow Down move foco para o próximo item", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation");
    const homeLink = screen.getByText("Home").closest("a") as HTMLElement;
    homeLink.focus();

    fireEvent.keyDown(nav, { key: "ArrowDown" });

    expect(document.activeElement).toBe(
      screen.getByText("Settings").closest("a"),
    );
  });

  it("Arrow Up move foco para o item anterior", () => {
    render(<Sidebar items={mockItems} activeKey="settings" />);
    const nav = screen.getByRole("navigation");
    const settingsLink = screen.getByText("Settings").closest("a") as HTMLElement;
    settingsLink.focus();

    fireEvent.keyDown(nav, { key: "ArrowUp" });

    expect(document.activeElement).toBe(
      screen.getByText("Home").closest("a"),
    );
  });

  it("Home vai ao primeiro item (CHK009)", () => {
    render(<Sidebar items={mockItems} activeKey="more" />);
    const nav = screen.getByRole("navigation");
    const moreLink = screen.getByText("More").closest("a") as HTMLElement;
    moreLink.focus();

    fireEvent.keyDown(nav, { key: "Home" });

    expect(document.activeElement).toBe(
      screen.getByText("Home").closest("a"),
    );
  });

  it("End vai ao último item (CHK009)", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation");
    const homeLink = screen.getByText("Home").closest("a") as HTMLElement;
    homeLink.focus();

    fireEvent.keyDown(nav, { key: "End" });

    expect(document.activeElement).toBe(
      screen.getByText("More").closest("a"),
    );
  });

  it("Arrow Down no último item vai ao primeiro — wrap circular (CHK009)", () => {
    render(<Sidebar items={mockItems} activeKey="more" />);
    const nav = screen.getByRole("navigation");
    const moreLink = screen.getByText("More").closest("a") as HTMLElement;
    moreLink.focus();

    fireEvent.keyDown(nav, { key: "ArrowDown" });

    expect(document.activeElement).toBe(
      screen.getByText("Home").closest("a"),
    );
  });

  it("Arrow Up no primeiro item vai ao último — wrap circular (CHK009)", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation");
    const homeLink = screen.getByText("Home").closest("a") as HTMLElement;
    homeLink.focus();

    fireEvent.keyDown(nav, { key: "ArrowUp" });

    expect(document.activeElement).toBe(
      screen.getByText("More").closest("a"),
    );
  });
});

describe("Sidebar — acessibilidade (jest-axe)", () => {
  it("passa verificação de acessibilidade sem violações", async () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Sidebar — touch targets (A.3 / T.3 — NFR-A2 / FR-1.1 / dec-008)", () => {
  it("links de navegacao tem min-h-[44px] (WCAG 2.5.5 mobile)", () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("min-h-[44px]");
    }
  });

  it("links tem active:opacity-80 para feedback tatil (FR-2.1)", () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("active:opacity-80");
    }
  });

  it("passa verificacao de acessibilidade com novos estilos", async () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

