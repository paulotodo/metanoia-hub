import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { TermsPageContent } from "../terms-page-content";

describe("TermsPageContent", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("renders the title, the pastoral summary and the legal sections", () => {
    render(<TermsPageContent token="inv_valid_019ABC000001" />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Termos de uso e privacidade",
    );
    expect(screen.getByText("Em resumo:")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "Termos de Uso" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "Política de Privacidade" }),
    ).not.toBeNull();
  });

  it("keeps the checkbox unchecked by default (LGPD) and highlights the error when the user tries to continue without accepting", () => {
    const { container } = render(
      <TermsPageContent token="inv_valid_019ABC000001" />,
    );

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(pushMock).not.toHaveBeenCalled();

    // error styling is applied on the checkbox wrapper
    expect(
      container.querySelector(".border-\\[var\\(--color-care-urgent\\)\\]"),
    ).not.toBeNull();
  });

  it("navigates to /criar-conta after the checkbox is accepted and the user clicks Continuar", () => {
    render(<TermsPageContent token="inv_valid_019ABC000001" />);

    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      "/convite/inv_valid_019ABC000001/criar-conta",
    );
  });

  it("preserves special characters in the token via encodeURIComponent", () => {
    render(<TermsPageContent token="abc/def 1" />);

    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(pushMock).toHaveBeenCalledWith("/convite/abc%2Fdef%201/criar-conta");
  });
});
