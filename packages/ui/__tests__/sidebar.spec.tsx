import { render, screen } from "@testing-library/react";
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

describe("Sidebar", () => {
  it("renders all navigation items with labels", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    for (const item of mockItems) {
      expect(screen.getByText(item.label)).toBeTruthy();
    }
  });

  it("renders as a navigation landmark with aria-label", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const nav = screen.getByRole("navigation", { name: /navigation/i });
    expect(nav).toBeTruthy();
  });

  it("marks the active item with aria-current='page'", () => {
    render(<Sidebar items={mockItems} activeKey="settings" />);
    const activeLink = screen.getByText("Settings").closest("a");
    expect(activeLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark inactive items with aria-current", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const inactiveLink = screen.getByText("Settings").closest("a");
    expect(inactiveLink?.hasAttribute("aria-current")).toBe(false);
  });

  it("applies active styling classes to the active item", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const activeLink = screen.getByText("Home").closest("a");
    expect(activeLink?.className).toContain("text-[var(--primary)]");
  });

  it("applies 240px width via w-60 class", () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const aside = screen.getByRole("navigation", { name: /navigation/i });
    expect(aside.className).toContain("w-60");
  });

  it("renders optional header slot", () => {
    render(
      <Sidebar
        items={mockItems}
        activeKey="home"
        header={<div data-testid="sidebar-header">Logo</div>}
      />,
    );
    expect(screen.getByTestId("sidebar-header")).toBeTruthy();
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
      <Sidebar items={mockItems} activeKey="home" renderLink={renderLink} />,
    );
    expect(renderLink).toHaveBeenCalledTimes(mockItems.length);
    expect(screen.getByTestId("custom-home")).toBeTruthy();
  });

  it("passes accessibility checks", async () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("all items are keyboard-focusable", async () => {
    render(<Sidebar items={mockItems} activeKey="home" />);
    const user = userEvent.setup();

    for (const item of mockItems) {
      await user.tab();
      const link = screen.getByText(item.label).closest("a");
      expect(document.activeElement).toBe(link);
    }
  });

  it("applies motion-safe transition classes", () => {
    const { container } = render(
      <Sidebar items={mockItems} activeKey="home" />,
    );
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.className).toContain("motion-safe:transition-colors");
    }
  });

  it("merges custom className", () => {
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
