import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import ReflexaoPage from "../page";

async function renderPage(meetingId = "019756c0-0002-7000-8000-000000000101") {
  const params = Promise.resolve({ meetingId });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>loading</div>}>
        <ReflexaoPage params={params} />
      </Suspense>,
    );
    await params;
  });
  return result;
}

describe("ReflexaoPage", () => {
  it("renders header, textarea with counter and both actions", async () => {
    await renderPage();
    expect(await screen.findByText(/Sobre o encontro com/)).toBeTruthy();
    expect(
      await screen.findByRole("heading", { name: "O que vale lembrar?" }),
    ).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pular por agora" })).toBeTruthy();
  });

  it("Salvar is disabled when textarea is empty", async () => {
    await renderPage();
    const btn = screen.getByRole("button", {
      name: "Salvar",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("shows saved confirmation after submit and navigates to radar", async () => {
    push.mockClear();
    await renderPage();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Pedro pediu oração" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Guardado.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao radar" }));
    expect(push).toHaveBeenCalledWith("/app/gestao/radar");
  });

  it("shows skipped confirmation when 'Pular por agora' is pressed", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Pular por agora" }));
    expect(await screen.findByText("Tudo bem.")).toBeTruthy();
    expect(
      screen.getByText("Você pode voltar quando quiser."),
    ).toBeTruthy();
  });

  it("counter decrements as user types in the form", async () => {
    await renderPage();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "a".repeat(50) } });
    expect(screen.getByTestId("reflection-counter").textContent).toBe(
      "230 caracteres",
    );
  });
});
