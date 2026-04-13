import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TokenErrorState } from "../token-error-state";

describe("TokenErrorState", () => {
  it("renders heading, body and calls onClick when the button is pressed", () => {
    const onClick = vi.fn();
    render(
      <TokenErrorState
        variant="expired"
        heading="Esse link expirou"
        body="Links de convite são válidos por 7 dias."
        action={{ label: "Falar com o suporte", onClick }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Esse link expirou",
    );
    fireEvent.click(screen.getByRole("button", { name: "Falar com o suporte" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an anchor with the given href when action.href is provided", () => {
    render(
      <TokenErrorState
        variant="used"
        heading="Esse convite já foi aceito"
        body="Se você já criou sua conta, entre pelo login."
        action={{ label: "Ir para o login", href: "/login" }}
      />,
    );

    const link = screen.getByRole("link", { name: "Ir para o login" });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("tags the container with the variant for styling hooks", () => {
    const { container } = render(
      <TokenErrorState
        variant="network"
        heading="Não foi possível verificar o convite"
        body="Tente novamente."
        action={{ label: "Tentar novamente" }}
      />,
    );

    expect(
      container.querySelector("[data-variant='network']"),
    ).not.toBeNull();
  });
});
