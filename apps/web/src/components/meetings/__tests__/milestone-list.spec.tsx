import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MilestoneList } from "../milestone-list";

const milestones = [
  {
    id: "019756c0-0002-7000-8000-000000000201",
    text: "Retiro de homens dia 20/04",
  },
  {
    id: "019756c0-0002-7000-8000-000000000202",
    text: "Aniversário da Ana na quinta",
  },
];

describe("MilestoneList", () => {
  it("renders all milestones as list items", () => {
    render(<MilestoneList milestones={milestones} label="Marcos da semana" />);
    expect(screen.getByText("Retiro de homens dia 20/04")).toBeTruthy();
    expect(screen.getByText("Aniversário da Ana na quinta")).toBeTruthy();
  });

  it("renders nothing when milestones array is empty", () => {
    const { container } = render(
      <MilestoneList milestones={[]} label="Marcos" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label", () => {
    render(<MilestoneList milestones={milestones} label="Marcos da semana" />);
    expect(screen.getByText("Marcos da semana")).toBeTruthy();
  });
});
