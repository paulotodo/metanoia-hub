import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemoDataNudge } from "../demo-data-nudge";
import * as onboardingHooks from "@/lib/api/hooks/use-onboarding";

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

const STATUS_BOTH = {
  hasDemoData: true,
  hasRealData: true,
  demoRecordCount: 5,
  nudgeDismissed: false,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DemoDataNudge", () => {
  it("renders nothing when hasDemoData is false", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { ...STATUS_BOTH, hasDemoData: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.spyOn(onboardingHooks, "useDismissDemoNudge").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    const { container } = render(withQuery(<DemoDataNudge />));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when hasRealData is false", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { ...STATUS_BOTH, hasRealData: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.spyOn(onboardingHooks, "useDismissDemoNudge").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    const { container } = render(withQuery(<DemoDataNudge />));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when nudgeDismissed is true", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { ...STATUS_BOTH, nudgeDismissed: true },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.spyOn(onboardingHooks, "useDismissDemoNudge").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    const { container } = render(withQuery(<DemoDataNudge />));
    expect(container.firstChild).toBeNull();
  });

  it("shows dialog with nudge copy when both datasets present", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: STATUS_BOTH,
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.spyOn(onboardingHooks, "useDismissDemoNudge").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    render(withQuery(<DemoDataNudge />));
    expect(screen.getByText("Voce ja tem participantes reais!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover dados de exemplo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manter por enquanto" })).toBeTruthy();
  });

  it("calls dismissNudge when 'Manter por enquanto' is clicked", () => {
    const dismissMutate = vi.fn();
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({ data: STATUS_BOTH } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.spyOn(onboardingHooks, "useDismissDemoNudge").mockReturnValue({ mutate: dismissMutate, isPending: false } as never);

    render(withQuery(<DemoDataNudge />));
    fireEvent.click(screen.getByRole("button", { name: "Manter por enquanto" }));
    expect(dismissMutate).toHaveBeenCalledTimes(1);
  });

  it("calls deleteDemoData when 'Remover' is clicked", () => {
    const deleteMutate = vi.fn();
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({ data: STATUS_BOTH } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
    vi.spyOn(onboardingHooks, "useDismissDemoNudge").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    render(withQuery(<DemoDataNudge />));
    fireEvent.click(screen.getByRole("button", { name: "Remover dados de exemplo" }));
    expect(deleteMutate).toHaveBeenCalledTimes(1);
  });
});
