import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmedInlineList } from "../confirmed-inline-list";

const participants = [
  {
    participantId: "019756a1-0000-7000-8000-000000000001",
    name: "Pedro",
    response: "yes" as const,
  },
  {
    participantId: "019756a1-0000-7000-8000-000000000002",
    name: "Ana",
    response: "pending" as const,
  },
];

describe("ConfirmedInlineList", () => {
  it("shows only 'yes' responses", () => {
    render(
      <ConfirmedInlineList
        confirmed={participants}
        label="Quem confirmou"
        emptyText="Ninguém respondeu."
      />,
    );
    expect(screen.getByText("Pedro")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("shows empty text when no 'yes' responses", () => {
    render(
      <ConfirmedInlineList
        confirmed={[]}
        label="Quem confirmou"
        emptyText="Ninguém respondeu."
      />,
    );
    expect(screen.getByText("Ninguém respondeu.")).toBeTruthy();
    expect(screen.queryByTestId("confirmed-inline-list")).toBeNull();
  });

  it("renders label as section heading", () => {
    render(
      <ConfirmedInlineList
        confirmed={participants}
        label="Quem confirmou"
        emptyText="Ninguém."
      />,
    );
    expect(screen.getByText("Quem confirmou")).toBeTruthy();
  });
});
