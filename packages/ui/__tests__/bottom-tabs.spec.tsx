import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { Home, Settings, User, Bell, Menu } from "lucide-react";
import { BottomTabs } from "../components/bottom-tabs";
import type { NavigationItem } from "../components/navigation-types";

const mockItems: NavigationItem[] = [
  { key: "home", label: "Home", href: "/home", icon: Home },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
  { key: "profile", label: "Profile", href: "/profile", icon: User },
  { key: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
  { key: "more", label: "More", href: "/more", icon: Menu },
];

describe("BottomTabs", () => {
  it("renders all navigation items", () => {
    render(<BottomTabs items={mockItems} activeKey="home" />);
    for (const item of mockItems) {
      expect(screen.getByText(item.label)).toBeTruthy();
    }
  });

  it("renders as a nav element with aria-label", () => {
    render(<BottomTabs items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation", { name: /navigation/i });
    expect(nav).toBeTruthy();
  });

  it("marks the active item with aria-current='page'", () => {
    render(<BottomTabs items={mockItems} activeKey="settings" />);
    const activeLink = screen.getByText("Settings").closest("a");
    expect(activeLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark inactive items with aria-current", () => {
    render(<BottomTabs items={mockItems} activeKey="home" />);
    const inactiveLink = screen.getByText("Settings").closest("a");
    expect(inactiveLink?.hasAttribute("aria-current")).toBe(false);
  });

  it("applies touch target minimum size classes", () => {
    const { container } = render(
      <BottomTabs items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("min-h-[44px]");
      expect(link.className).toContain("min-w-[44px]");
    }
  });

  it("hides inactive labels on small screens via CSS class", () => {
    render(<BottomTabs items={mockItems} activeKey="home" />);
    // Active label should not have the hiding class
    const activeLabel = screen.getByText("Home");
    expect(activeLabel.className).not.toContain("max-[360px]:hidden");

    // Inactive label should have the hiding class
    const inactiveLabel = screen.getByText("Settings");
    expect(inactiveLabel.className).toContain("max-[360px]:hidden");
  });

  it("uses renderLink when provided", () => {
    const renderLink = vi.fn(
      (item: NavigationItem, children: React.ReactNode) => (
        <a href={item.href} data-testid={`custom-${item.key}`}>
          {children}
        </a>
      ),
    );
    render(
      <BottomTabs
        items={mockItems}
        activeKey="home"
        renderLink={renderLink}
      />,
    );
    expect(renderLink).toHaveBeenCalledTimes(mockItems.length);
    expect(screen.getByTestId("custom-home")).toBeTruthy();
  });

  it("passes accessibility checks", async () => {
    const { container } = render(
      <BottomTabs items={mockItems} activeKey="home" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("all items are keyboard-focusable", async () => {
    render(<BottomTabs items={mockItems} activeKey="home" />);
    const user = userEvent.setup();

    // Tab through all items
    for (const item of mockItems) {
      await user.tab();
      const link = screen.getByText(item.label).closest("a");
      expect(document.activeElement).toBe(link);
    }
  });

  it("applies motion-safe transition classes", () => {
    const { container } = render(
      <BottomTabs items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("motion-safe:transition-colors");
    }
  });

  it("merges custom className", () => {
    render(
      <BottomTabs
        items={mockItems}
        activeKey="home"
        className="custom-class"
      />,
    );
    const nav = screen.getByRole("navigation", { name: /navigation/i });
    expect(nav.className).toContain("custom-class");
  });
});

describe("BottomTabs — touch feedback (A.3 / B.2 / T.3 — NFR-A2 / FR-2.1)", () => {
  it("links tem active:opacity-80 para feedback tatil (FR-2.1)", () => {
    const { container } = render(
      <BottomTabs items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("active:opacity-80");
    }
  });

  it("links continuam com min-h-[44px] e min-w-[44px] (WCAG 2.5.5)", () => {
    const { container } = render(
      <BottomTabs items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("min-h-[44px]");
      expect(link.className).toContain("min-w-[44px]");
    }
  });

  it("passa verificacao de acessibilidade com novos estilos", async () => {
    const { container } = render(
      <BottomTabs items={mockItems} activeKey="home" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

