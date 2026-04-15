import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SalaAoVivoPage from "../page";

async function renderPage(meetingId = "019756c0-0002-7000-8000-000000000103") {
  const params = Promise.resolve({ meetingId });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>loading</div>}>
        <SalaAoVivoPage params={params} />
      </Suspense>,
    );
    await params;
  });
  return result;
}

describe("SalaAoVivoPage", () => {
  it("renders group name, live status bar and end button", async () => {
    await renderPage();
    expect(await screen.findByText("Jovens Adultos")).toBeTruthy();
    expect(await screen.findByText("Reunião em andamento")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Encerrar sala" }),
    ).toBeTruthy();
  });

  it("renders waiting state for 'empty' meetingId", async () => {
    await renderPage("empty");
    expect(
      await screen.findByText("Aguardando participantes entrarem..."),
    ).toBeTruthy();
  });

  it("opens confirm dialog on 'Encerrar sala' press", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar sala" }));
    expect(await screen.findByText("Encerrar a sala?")).toBeTruthy();
  });

  it("navigates to /reflexao after confirming", async () => {
    push.mockClear();
    await renderPage("test-id-xyz");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar sala" }));
    const confirmBtn = await screen.findByRole("button", { name: "Encerrar" });
    fireEvent.click(confirmBtn);
    expect(push).toHaveBeenCalledWith(
      "/app/gestao/reunioes/test-id-xyz/reflexao",
    );
  });
});
