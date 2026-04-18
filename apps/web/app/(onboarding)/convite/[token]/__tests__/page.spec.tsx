import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import AceiteConvitePage from "../page";

async function renderPage(token: string) {
  const ui = await AceiteConvitePage({ params: Promise.resolve({ token }) });
  return render(ui);
}

describe("/convite/[token] page dispatch", () => {
  it("dispatches kind=participant to ParticipantWelcomeView", async () => {
    const { getByRole } = await renderPage("participant-valid");
    expect(
      getByRole("heading", {
        level: 1,
        name: /^O Marcos te convidou pro grupo Fundamentos da Fé$/,
      }),
    ).toBeDefined();
    expect(
      getByRole("button", { name: "Continuar com Google" }),
    ).toBeDefined();
  });

  it("preserves admin-tenant flow: kind=admin-tenant still renders the 05.1 WelcomeView", async () => {
    const { getByRole } = await renderPage("admin-tenant-valid");
    // Copy from welcome-view.tsx (05.1) — guardrail against accidental refactor.
    expect(
      getByRole("heading", { level: 1, name: "Bem-vindo ao metanoia-hub" }),
    ).toBeDefined();
    expect(
      getByRole("link", { name: "Aceitar e começar" }),
    ).toBeDefined();
  });

  it("renders the expired error state for participant-expired token", async () => {
    const { getByRole } = await renderPage("participant-expired");
    expect(
      getByRole("heading", { name: "Esse link expirou" }),
    ).toBeDefined();
  });

  it("renders the used error state for participant-used token", async () => {
    const { getByRole } = await renderPage("participant-used");
    expect(
      getByRole("heading", { name: "Esse convite já foi aceito" }),
    ).toBeDefined();
  });

  it("falls back to invalid for unknown tokens", async () => {
    const { getByRole } = await renderPage("totally-unknown-token");
    expect(
      getByRole("heading", { name: "Esse link não parece válido" }),
    ).toBeDefined();
  });
});
