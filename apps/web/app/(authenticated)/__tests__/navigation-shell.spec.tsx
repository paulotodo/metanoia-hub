import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/radar",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { NavigationShell } from "../_components/navigation-shell";
import {
  Radar,
  CalendarDays,
  Route,
  UserCircle,
  MoreHorizontal,
} from "lucide-react";
import type { NavigationItem } from "@metanoia/ui";

const testItems: NavigationItem[] = [
  { key: "radar", label: "Radar", href: "/radar", icon: Radar },
  {
    key: "reunioes",
    label: "Reuniões",
    href: "/reunioes",
    icon: CalendarDays,
  },
  { key: "trilhas", label: "Trilhas", href: "/trilhas", icon: Route },
  { key: "perfil", label: "Perfil", href: "/perfil", icon: UserCircle },
  { key: "mais", label: "Mais", href: "/mais", icon: MoreHorizontal },
];

describe("NavigationShell", () => {
  it("renders both sidebar and bottom tabs navigation regions", () => {
    render(
      <NavigationShell items={testItems}>
        <div>Page content</div>
      </NavigationShell>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation/i });
    expect(navs.length).toBe(2);
  });

  it("renders all 5 navigation labels", () => {
    render(
      <NavigationShell items={testItems}>
        <div>Page content</div>
      </NavigationShell>,
    );
    for (const item of testItems) {
      const labels = screen.getAllByText(item.label);
      expect(labels.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders children in the main content area", () => {
    render(
      <NavigationShell items={testItems}>
        <div data-testid="child-content">Page content</div>
      </NavigationShell>,
    );
    expect(screen.getByTestId("child-content")).toBeTruthy();
  });

  it("wraps content in max-w-7xl container", () => {
    render(
      <NavigationShell items={testItems}>
        <div data-testid="child-content">Page content</div>
      </NavigationShell>,
    );
    const container = screen.getByTestId("child-content").parentElement;
    expect(container?.className).toContain("max-w-7xl");
    expect(container?.className).toContain("mx-auto");
  });

  it("passes accessibility checks", async () => {
    const { container } = render(
      <NavigationShell items={testItems}>
        <h1>Dashboard</h1>
        <p>Content area</p>
      </NavigationShell>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("hides sidebar on mobile via CSS class", () => {
    render(
      <NavigationShell items={testItems}>
        <div>Content</div>
      </NavigationShell>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation/i });
    const sidebar = navs.find((nav) => nav.className.includes("lg:flex"));
    expect(sidebar?.className).toContain("hidden");
  });

  it("hides bottom tabs on desktop via CSS class", () => {
    render(
      <NavigationShell items={testItems}>
        <div>Content</div>
      </NavigationShell>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation/i });
    const bottomTabs = navs.find((nav) => nav.className.includes("lg:hidden"));
    expect(bottomTabs).toBeTruthy();
  });
});
