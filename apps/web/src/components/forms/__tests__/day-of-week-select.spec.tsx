import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayOfWeekSelect } from "../day-of-week-select";

const LABELS = {
  sunday: "Domingo",
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
};

describe("DayOfWeekSelect", () => {
  it("renders every day of the week starting from Sunday", () => {
    render(
      <DayOfWeekSelect
        id="day"
        value=""
        onChange={() => {}}
        labels={LABELS}
        placeholder="Selecione um dia"
      />,
    );

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Selecione um dia",
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ]);
  });

  it("propagates the selected value via onChange", () => {
    const onChange = vi.fn();
    render(
      <DayOfWeekSelect
        id="day"
        value=""
        onChange={onChange}
        labels={LABELS}
        placeholder="—"
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "thursday" },
    });
    expect(onChange).toHaveBeenCalledWith("thursday");
  });
});
