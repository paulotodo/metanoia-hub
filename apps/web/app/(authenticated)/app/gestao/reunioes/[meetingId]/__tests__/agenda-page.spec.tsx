import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back }),
}));

import AgendaDoGrupoPage from "../page";

async function renderPage(meetingId = "019756c0-0002-7000-8000-000000000101") {
  const params = Promise.resolve({ meetingId });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>loading</div>}>
        <AgendaDoGrupoPage params={params} />
      </Suspense>,
    );
    await params;
  });
  return result;
}

describe("AgendaDoGrupoPage", () => {
  it("renders heading, group name and open room button", async () => {
    await renderPage();
    expect(await screen.findByText("Agenda do grupo")).toBeTruthy();
    expect(await screen.findByText("Jovens Adultos")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Abrir sala" }),
    ).toBeTruthy();
  });

  it("renders topic empty-state for 'empty' meetingId", async () => {
    await renderPage("empty");
    expect(
      await screen.findByText("Sem tópico definido para esta semana."),
    ).toBeTruthy();
    expect(
      await screen.findByText("Ninguém respondeu ainda."),
    ).toBeTruthy();
  });

  it("navigates to /sala when 'Abrir sala' is pressed", async () => {
    push.mockClear();
    await renderPage("test-id-123");
    const btn = await screen.findByRole("button", { name: "Abrir sala" });
    fireEvent.click(btn);
    expect(push).toHaveBeenCalledWith(
      "/app/gestao/reunioes/test-id-123/sala",
    );
  });

  it("calls router.back() when 'Voltar' is pressed", async () => {
    back.mockClear();
    await renderPage();
    const btn = await screen.findByRole("button", { name: "← Voltar" });
    fireEvent.click(btn);
    expect(back).toHaveBeenCalled();
  });
});
