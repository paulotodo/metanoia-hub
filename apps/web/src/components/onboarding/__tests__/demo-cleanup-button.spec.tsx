import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemoCleanupButton } from "../demo-cleanup-button";
import * as onboardingHooks from "@/lib/api/hooks/use-onboarding";

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DemoCleanupButton", () => {
  it("renders nothing when hasDemoData is false", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { hasDemoData: false, hasRealData: true, demoRecordCount: 0, nudgeDismissed: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    const { container } = render(withQuery(<DemoCleanupButton />));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when status is undefined (loading)", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({ data: undefined } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    const { container } = render(withQuery(<DemoCleanupButton />));
    expect(container.firstChild).toBeNull();
  });

  it("renders the cleanup button when hasDemoData is true", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { hasDemoData: true, hasRealData: false, demoRecordCount: 3, nudgeDismissed: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    render(withQuery(<DemoCleanupButton />));
    expect(screen.getByRole("button", { name: "Remover dados de exemplo" })).toBeTruthy();
  });

  it("opens confirmation dialog when button is clicked", () => {
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { hasDemoData: true, hasRealData: false, demoRecordCount: 3, nudgeDismissed: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    render(withQuery(<DemoCleanupButton />));
    fireEvent.click(screen.getByRole("button", { name: "Remover dados de exemplo" }));
    expect(screen.getByText("Remover dados de exemplo?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sim, remover" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("calls deleteDemoData when confirm action is clicked", () => {
    const deleteMutate = vi.fn();
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { hasDemoData: true, hasRealData: false, demoRecordCount: 3, nudgeDismissed: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: deleteMutate, isPending: false } as never);

    render(withQuery(<DemoCleanupButton />));
    fireEvent.click(screen.getByRole("button", { name: "Remover dados de exemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, remover" }));
    expect(deleteMutate).toHaveBeenCalledTimes(1);
  });

  it("closes dialog when 'Cancelar' is clicked without triggering mutation", () => {
    const deleteMutate = vi.fn();
    vi.spyOn(onboardingHooks, "useDemoStatus").mockReturnValue({
      data: { hasDemoData: true, hasRealData: false, demoRecordCount: 3, nudgeDismissed: false },
    } as never);
    vi.spyOn(onboardingHooks, "useDeleteDemoData").mockReturnValue({ mutate: deleteMutate, isPending: false } as never);

    render(withQuery(<DemoCleanupButton />));
    fireEvent.click(screen.getByRole("button", { name: "Remover dados de exemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteMutate).not.toHaveBeenCalled();
  });
});
