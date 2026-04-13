import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/gestao/radar",
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

// Mock navigation config with simple span icons (no lucide functions in test)
vi.mock("../../../config/navigation", () => {
  const MockIcon = () => <span data-testid="mock-icon" />;
  return {
    navigationItems: [
      { key: "radar", label: "Radar", href: "/app/gestao/radar", icon: MockIcon },
      { key: "reunioes", label: "Reuniões", href: "/app/gestao/reunioes", icon: MockIcon },
      { key: "trilhas", label: "Trilhas", href: "/app/gestao/trilhas", icon: MockIcon },
      { key: "perfil", label: "Perfil", href: "/app/perfil", icon: MockIcon },
      { key: "mais", label: "Mais", href: "/app/mais", icon: MockIcon },
    ],
  };
});

import { NavigationShell } from "../_components/navigation-shell";

const expectedLabels = ["Radar", "Reuniões", "Trilhas", "Perfil", "Mais"];

describe("NavigationShell", () => {
  it("renders both sidebar and bottom tabs navigation regions", () => {
    render(
      <NavigationShell>
        <div>Page content</div>
      </NavigationShell>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation/i });
    expect(navs.length).toBe(2);
  });

  it("renders all 5 navigation labels", () => {
    render(
      <NavigationShell>
        <div>Page content</div>
      </NavigationShell>,
    );
    for (const label of expectedLabels) {
      const labels = screen.getAllByText(label);
      expect(labels.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders children in the main content area", () => {
    render(
      <NavigationShell>
        <div data-testid="child-content">Page content</div>
      </NavigationShell>,
    );
    expect(screen.getByTestId("child-content")).toBeTruthy();
  });

  it("wraps content in max-w-7xl container", () => {
    render(
      <NavigationShell>
        <div data-testid="child-content">Page content</div>
      </NavigationShell>,
    );
    const container = screen.getByTestId("child-content").parentElement;
    expect(container?.className).toContain("max-w-7xl");
    expect(container?.className).toContain("mx-auto");
  });

  it("passes accessibility checks", async () => {
    const { container } = render(
      <NavigationShell>
        <h1>Dashboard</h1>
        <p>Content area</p>
      </NavigationShell>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("hides sidebar on mobile via CSS class", () => {
    render(
      <NavigationShell>
        <div>Content</div>
      </NavigationShell>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation/i });
    const sidebar = navs.find((nav) => nav.className.includes("lg:flex"));
    expect(sidebar?.className).toContain("hidden");
  });

  it("hides bottom tabs on desktop via CSS class", () => {
    render(
      <NavigationShell>
        <div>Content</div>
      </NavigationShell>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation/i });
    const bottomTabs = navs.find((nav) => nav.className.includes("lg:hidden"));
    expect(bottomTabs).toBeTruthy();
  });
});
