import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { resolveInviteFixture } from "../../../../../__mocks__/onboarding/resolve-invite";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map<string, string>([
      ["host", "test.local"],
      ["x-forwarded-proto", "http"],
    ]) as unknown as Headers,
}));

import AceiteConvitePage from "../page";

/**
 * Story 7-5 wired the page to fetch `/api/v1/invites/:token/resolve` from the
 * real backend. These specs intercept `fetch` and replay the legacy fixture
 * shape so the dispatch assertions stay coupled to the FE shape rather than
 * the wire protocol.
 */
function mockResolveFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const match = url.match(/\/api\/v1\/invites\/([^/]+)\/resolve$/);
      if (!match) {
        return new Response("Not Found", { status: 404 });
      }
      const token = decodeURIComponent(match[1] ?? '');
      const fixture = resolveInviteFixture(token);
      return new Response(JSON.stringify({ data: fixture }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

async function renderPage(token: string) {
  const ui = await AceiteConvitePage({ params: Promise.resolve({ token }) });
  return render(ui);
}

describe("/convite/[token] page dispatch", () => {
  beforeEach(() => {
    mockResolveFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    expect(
      getByRole("heading", { level: 1, name: "Bem-vindo ao metanoia-hub" }),
    ).toBeDefined();
    expect(getByRole("link", { name: "Aceitar e começar" })).toBeDefined();
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

  it("renders the invalid error state on a non-OK API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("oops", { status: 500 })),
    );
    const { getByRole } = await renderPage("server-fault");
    expect(
      getByRole("heading", { name: "Esse link não parece válido" }),
    ).toBeDefined();
  });
});
