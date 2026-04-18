import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import type { InviteResolveParticipant } from "@metanoia/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { ParticipantWelcomeView } from "../participant-welcome-view";

expect.extend(toHaveNoViolations);

const baseInvite: InviteResolveParticipant = {
  kind: "participant",
  leader: { firstName: "Marcos", avatarUrl: null },
  tenant: {
    id: "019756b0-1000-7000-8000-000000000001",
    name: "Igreja Demo",
  },
  group: {
    id: "019756c0-2000-7000-8000-000000000001",
    name: "Fundamentos da Fé",
  },
};

describe("ParticipantWelcomeView (06.2)", () => {
  it("renders the canonical heading with leader firstName and group name in teal", () => {
    const { getByRole, getByText } = render(
      <ParticipantWelcomeView invite={baseInvite} token="participant-valid" />,
    );

    const heading = getByRole("heading", {
      level: 1,
      name: /^O Marcos te convidou pro grupo Fundamentos da Fé$/,
    });
    expect(heading).toBeDefined();

    const groupName = getByText("Fundamentos da Fé");
    expect(groupName.className).toContain("brand-teal");
  });

  it("renders both auth buttons (Google + email/senha)", () => {
    const { getByRole } = render(
      <ParticipantWelcomeView invite={baseInvite} token="participant-valid" />,
    );
    expect(
      getByRole("button", { name: "Continuar com Google" }),
    ).toBeDefined();
    expect(getByRole("button", { name: "Usar email e senha" })).toBeDefined();
  });

  it("renders the LGPD terms notice with link to /termos", () => {
    const { getByRole } = render(
      <ParticipantWelcomeView invite={baseInvite} token="abc-123" />,
    );
    const link = getByRole("link", { name: "termos de uso" });
    expect(link.getAttribute("href")).toBe("/convite/abc-123/termos");
  });

  it("falls back to leader initials when avatarUrl is null", () => {
    const { getByLabelText } = render(
      <ParticipantWelcomeView invite={baseInvite} token="participant-valid" />,
    );
    const avatar = getByLabelText("Iniciais de Marcos");
    expect(avatar.textContent).toBe("M");
  });

  it("renders the leader photo when avatarUrl is present", () => {
    const { getByAltText } = render(
      <ParticipantWelcomeView
        invite={{
          ...baseInvite,
          leader: {
            firstName: "Marcos",
            avatarUrl: "https://cdn.example/avatar.jpg",
          },
        }}
        token="participant-valid"
      />,
    );
    const img = getByAltText("Foto de Marcos") as HTMLImageElement;
    expect(img.src).toContain("cdn.example/avatar.jpg");
  });

  it("passes jest-axe accessibility checks", async () => {
    const { container } = render(
      <ParticipantWelcomeView invite={baseInvite} token="participant-valid" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
