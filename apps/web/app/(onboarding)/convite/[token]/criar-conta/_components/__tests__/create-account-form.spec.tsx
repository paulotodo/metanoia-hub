import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { CreateAccountForm } from "../create-account-form";

describe("CreateAccountForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  function fill(label: RegExp | string, value: string) {
    const input = screen.getByLabelText(label) as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    return input;
  }

  it("renders the four required fields and the Google shortcut", () => {
    render(<CreateAccountForm token="inv_valid_019ABC000001" />);

    expect(screen.getByLabelText("Seu nome")).not.toBeNull();
    expect(screen.getByLabelText("Seu email")).not.toBeNull();
    expect(screen.getByLabelText("Crie uma senha")).not.toBeNull();
    expect(screen.getByLabelText("Nome da sua igreja")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /Continuar com Google/i }),
    ).not.toBeNull();
  });

  it("blocks submit and surfaces inline errors when fields are invalid", () => {
    render(<CreateAccountForm token="inv_valid_019ABC000001" />);

    fill("Seu nome", "A"); // too short
    fill("Seu email", "not-an-email");
    fill("Crie uma senha", "short");
    // churchName left empty

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Esse email não parece válido"),
    ).not.toBeNull();
    expect(
      screen.getByText("A senha precisa ter pelo menos 8 caracteres"),
    ).not.toBeNull();
    expect(
      screen.getByText("Digite o nome da sua igreja"),
    ).not.toBeNull();
  });

  it("navigates to /app/admin/boas-vindas after a valid email+password submit", () => {
    render(<CreateAccountForm token="inv_valid_019ABC000001" />);

    fill("Seu nome", "Pastor Carlos");
    fill("Seu email", "carlos@igreja.com.br");
    fill("Crie uma senha", "senhasegura123");
    fill("Nome da sua igreja", "Igreja Batista Esperança");

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/app/admin/boas-vindas");
  });

  it("after Google OAuth: hides email/password, pre-fills name and only requires church name", async () => {
    render(<CreateAccountForm token="inv_valid_019ABC000001" />);

    fireEvent.click(
      screen.getByRole("button", { name: /Continuar com Google/i }),
    );

    // After the simulated round-trip, name is populated and email/password
    // inputs are gone.
    await waitFor(() => {
      const nameInput = screen.getByLabelText("Seu nome") as HTMLInputElement;
      expect(nameInput.value).toBe("Pastor Carlos Silva");
    });
    expect(screen.queryByLabelText("Seu email")).toBeNull();
    expect(screen.queryByLabelText("Crie uma senha")).toBeNull();

    // Submitting now only needs the church name.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    });
    expect(pushMock).not.toHaveBeenCalled(); // church name still empty

    fill("Nome da sua igreja", "Igreja Esperança");
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(pushMock).toHaveBeenCalledWith("/app/admin/boas-vindas");
  });
});
