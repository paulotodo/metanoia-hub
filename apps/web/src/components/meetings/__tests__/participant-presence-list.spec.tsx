import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParticipantPresenceList } from "../participant-presence-list";

const participants = [
  {
    participantId: "019756a1-1001-7000-8000-000000000001",
    name: "Pedro",
    joinedAt: "2026-04-16T22:31:12.000Z",
    leftAt: null,
  },
  {
    participantId: "019756a1-1002-7000-8000-000000000002",
    name: "Ana",
    joinedAt: null,
    leftAt: null,
  },
  {
    participantId: "019756a1-1003-7000-8000-000000000003",
    name: "Lucas",
    joinedAt: "2026-04-16T22:33:18.000Z",
    leftAt: "2026-04-16T22:58:02.000Z",
  },
];

const labels = {
  label: "Na sala agora",
  connectedLabel: "Entrou",
  notJoinedLabel: "Ainda não entrou",
  leftLabel: "Saiu",
  waitingLabel: "Aguardando participantes entrarem...",
};

describe("ParticipantPresenceList", () => {
  it("renders each participant with the correct state label", () => {
    render(
      <ParticipantPresenceList participants={participants} {...labels} />,
    );

    expect(screen.getByText("Pedro")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Lucas")).toBeTruthy();
    expect(screen.getByText("Entrou")).toBeTruthy();
    expect(screen.getByText("Saiu")).toBeTruthy();
    expect(screen.getByText("Ainda não entrou")).toBeTruthy();
  });

  it("shows connected count in the header", () => {
    render(
      <ParticipantPresenceList participants={participants} {...labels} />,
    );
    expect(screen.getByTestId("participant-count").textContent).toBe("1");
  });

  it("sorts connected participants before left and not-joined", () => {
    render(
      <ParticipantPresenceList participants={participants} {...labels} />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain("Pedro");
    expect(items[1]?.textContent).toContain("Lucas");
    expect(items[2]?.textContent).toContain("Ana");
  });

  it("renders waiting state when list is empty", () => {
    render(<ParticipantPresenceList participants={[]} {...labels} />);
    expect(
      screen.getByText("Aguardando participantes entrarem..."),
    ).toBeTruthy();
  });
});
