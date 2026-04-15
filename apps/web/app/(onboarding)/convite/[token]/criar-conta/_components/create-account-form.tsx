"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Input, cn } from "@metanoia/ui";
import { OAuthButton, PasswordInputWithToggle } from "@/components/forms";
import { mockGoogleOAuthProfile } from "../../../../../../__mocks__/onboarding";
import { OAuthDivider } from "./oauth-divider";

interface CreateAccountFormProps {
  /** Resolved invite token — preserved across sessions for the eventual API call. */
  token: string;
}

/**
 * 05.3 Criar Conta Admin — Client form.
 *
 * Session 3 scope (stub):
 * - Client-side validation via Zod.
 * - Google OAuth shortcut is simulated locally: clicking the button waits
 *   ~600ms, then fills name+email from `mockGoogleOAuthProfile`, hides the
 *   email/password fields and focuses `churchName`.
 * - On successful submit (or submit after OAuth), navigates to
 *   `/app/admin/boas-vindas`. Session 5 will replace this with a real
 *   mutation against `/api/v1/invites/{token}/create-account` and grab the
 *   session token it returns.
 */
export function CreateAccountForm({ token: _token }: CreateAccountFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>({
    name: "",
    email: "",
    password: "",
    churchName: "",
  });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [oauthState, setOauthState] =
    React.useState<"idle" | "loading" | "success">("idle");
  const [submitting, setSubmitting] = React.useState(false);

  const nameRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const churchRef = React.useRef<HTMLInputElement>(null);

  const usingOAuth = oauthState === "success";

  async function handleGoogleOAuth() {
    if (oauthState !== "idle") return;
    setOauthState("loading");
    // Simulate an OAuth round-trip. Session 5 swaps this for a real popup.
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    setValues((prev) => ({
      ...prev,
      name: mockGoogleOAuthProfile.name,
      email: mockGoogleOAuthProfile.email,
      password: "",
    }));
    setErrors({});
    setOauthState("success");
    // Focus the next field the user needs to fill.
    window.setTimeout(() => churchRef.current?.focus(), 0);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors = validate(values, usingOAuth);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      focusFirstError(fieldErrors, {
        name: nameRef,
        email: emailRef,
        password: passwordRef,
        churchName: churchRef,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    // Session 5 will POST here. For now, just navigate so the caminho feliz
    // is clickable end-to-end.
    router.push("/app/admin/boas-vindas");
  }

  function updateValue<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
    >
      <h1 className="text-center text-2xl font-bold text-[var(--color-text-primary)]">
        Crie sua conta
      </h1>

      <div className="flex flex-col items-center gap-4">
        <OAuthButton
          provider="google"
          label={
            oauthState === "loading"
              ? "Conectando com Google…"
              : oauthState === "success"
                ? "Conectado com Google"
                : "Continuar com Google"
          }
          onClick={handleGoogleOAuth}
          disabled={oauthState !== "idle" || submitting}
          className="h-12 max-w-[320px]"
        />
        {!usingOAuth ? <OAuthDivider /> : null}
      </div>

      <div className="flex flex-col gap-4">
        <Field
          id="account-name"
          label="Seu nome"
          error={errors.name}
        >
          <Input
            ref={nameRef}
            id="account-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Ex: Pastor Carlos Silva"
            value={values.name}
            onChange={(e) => updateValue("name", e.target.value)}
            disabled={usingOAuth || submitting}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "account-name-error" : undefined}
          />
        </Field>

        {!usingOAuth ? (
          <>
            <Field
              id="account-email"
              label="Seu email"
              error={errors.email}
            >
              <Input
                ref={emailRef}
                id="account-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Ex: carlos@igreja.com.br"
                value={values.email}
                onChange={(e) => updateValue("email", e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email ? "account-email-error" : undefined
                }
              />
            </Field>

            <Field
              id="account-password"
              label="Crie uma senha"
              hint="Mínimo 8 caracteres"
              error={errors.password}
            >
              <PasswordInputWithToggle
                ref={passwordRef}
                id="account-password"
                name="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                toggleShowLabel="Mostrar senha"
                toggleHideLabel="Ocultar senha"
                value={values.password}
                onChange={(e) => updateValue("password", e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "account-password-error" : undefined
                }
              />
            </Field>
          </>
        ) : null}

        <Field
          id="account-church"
          label="Nome da sua igreja"
          error={errors.churchName}
        >
          <Input
            ref={churchRef}
            id="account-church"
            name="churchName"
            type="text"
            placeholder="Ex: Igreja Batista Esperança"
            value={values.churchName}
            onChange={(e) => updateValue("churchName", e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.churchName)}
            aria-describedby={
              errors.churchName ? "account-church-error" : undefined
            }
          />
        </Field>
      </div>

      <div className="flex flex-col items-center">
        <Button
          type="submit"
          disabled={submitting}
          className={cn("h-12 w-full max-w-[320px] text-base")}
        >
          {submitting ? "Criando…" : "Criar conta"}
        </Button>
      </div>
    </form>
  );
}

// ---- helpers ---------------------------------------------------------------

type FormValues = {
  name: string;
  email: string;
  password: string;
  churchName: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

// Simple manual validation — keeping the web package free of Zod per the
// repo rule (structural typing via `Schema<T>` instead of importing zod in
// `apps/web`). With 4 fields and stable rules this is strictly simpler than
// pulling in a dependency just for a form.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormValues, usingOAuth: boolean): FormErrors {
  const errors: FormErrors = {};
  const name = values.name.trim();
  if (name.length < 2) errors.name = "Digite seu nome";
  else if (name.length > 100) errors.name = "Nome muito longo";

  if (!usingOAuth) {
    const email = values.email.trim();
    if (!email) errors.email = "Digite seu email";
    else if (!EMAIL_RE.test(email))
      errors.email = "Esse email não parece válido";

    if (!values.password) errors.password = "Crie uma senha";
    else if (values.password.length < 8)
      errors.password = "A senha precisa ter pelo menos 8 caracteres";
  }

  const church = values.churchName.trim();
  if (church.length < 2) errors.churchName = "Digite o nome da sua igreja";
  else if (church.length > 200) errors.churchName = "Nome muito longo";

  return errors;
}

function focusFirstError(
  errors: FormErrors,
  refs: Record<keyof FormValues, React.RefObject<HTMLInputElement | null>>,
) {
  const order: (keyof FormValues)[] = [
    "name",
    "email",
    "password",
    "churchName",
  ];
  for (const key of order) {
    if (errors[key]) {
      refs[key].current?.focus();
      return;
    }
  }
}

// ---- Field wrapper ---------------------------------------------------------

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-[var(--color-text-primary)]"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <span className="text-xs text-[var(--color-text-muted)]">{hint}</span>
      ) : null}
      {error ? (
        <span
          id={`${id}-error`}
          role="alert"
          className="text-xs text-[var(--color-care-urgent)]"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
