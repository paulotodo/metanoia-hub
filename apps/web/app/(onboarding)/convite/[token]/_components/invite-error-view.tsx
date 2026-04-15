import {
  TokenErrorState,
  type TokenErrorVariant,
} from "@/components/onboarding";

interface InviteErrorViewProps {
  variant: TokenErrorVariant;
}

/**
 * Localized wrapper around TokenErrorState. Copy comes from spec 05.1
 * (sections "Error & Edge Messages"). Keeps the shared component
 * i18n-agnostic and lets this feature own PT-BR strings until the
 * messages/pt-BR.json pipeline lands in Session 3.
 */
export function InviteErrorView({ variant }: InviteErrorViewProps) {
  const copy = errorCopy[variant];
  return <TokenErrorState variant={variant} {...copy} />;
}

const SUPPORT_HREF = "mailto:suporte@metanoia-hub.com";

const errorCopy: Record<
  TokenErrorVariant,
  { heading: string; body: string; action: { label: string; href?: string } }
> = {
  expired: {
    heading: "Esse link expirou",
    body: "Links de convite são válidos por 7 dias. Entre em contato com o suporte para receber um novo.",
    action: { label: "Falar com o suporte", href: SUPPORT_HREF },
  },
  used: {
    heading: "Esse convite já foi aceito",
    body: "Se você já criou sua conta, entre pelo login.",
    action: { label: "Ir para o login", href: "/login" },
  },
  invalid: {
    heading: "Esse link não parece válido",
    body: "Confira o link do email ou entre em contato com o suporte.",
    action: { label: "Falar com o suporte", href: SUPPORT_HREF },
  },
  network: {
    heading: "Não foi possível verificar o convite",
    body: "Tente novamente em alguns instantes.",
    action: { label: "Tentar novamente" },
  },
};
