"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateReflectionInputSchema,
  type CreateReflectionInput,
} from "@metanoia/types";
import { ReflectionFormField } from "@/components/meetings/reflection-form-field";
import { ConfirmationView } from "@/components/meetings/confirmation-view";
import { mockMeetingAgenda } from "@mocks/meetings";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

type Outcome = "saved" | "skipped";

export default function ReflexaoPage({ params }: PageProps) {
  use(params);
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const form = useForm<CreateReflectionInput>({
    resolver: zodResolver(CreateReflectionInputSchema),
    defaultValues: { text: "" },
    mode: "onChange",
  });

  const text = form.watch("text");

  function handleSkip() {
    setOutcome("skipped");
  }

  function onSubmit(_values: CreateReflectionInput) {
    setOutcome("saved");
  }

  function handleReturn() {
    router.push("/app/gestao/radar");
  }

  if (outcome === "saved") {
    return (
      <ConfirmationView
        heading="Guardado."
        body="Sua reflexão foi registrada."
        actionLabel="Voltar ao radar"
        onAction={handleReturn}
      />
    );
  }

  if (outcome === "skipped") {
    return (
      <ConfirmationView
        heading="Tudo bem."
        body="Você pode voltar quando quiser."
        actionLabel="Voltar ao radar"
        onAction={handleReturn}
      />
    );
  }

  const invalid = !!form.formState.errors.text;
  const submitDisabled = text.length === 0 || text.length > 280;

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <header className="space-y-1">
        <p className="text-sm text-text-muted">
          Sobre o encontro com {mockMeetingAgenda.groupName}
        </p>
        <h1 className="text-xl font-semibold text-text-primary">
          O que vale lembrar?
        </h1>
      </header>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {/* value must come after register(...) so controlled value wins over the ref-based default. */}
        <ReflectionFormField
          label="O que vale lembrar?"
          counterTemplate="{remaining} caracteres"
          placeholder="Um nome, um pedido, um passo pastoral..."
          autoFocus
          invalid={invalid}
          {...form.register("text")}
          value={text}
        />

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitDisabled}
            className="h-12 w-full rounded-lg bg-brand-teal px-4 text-base font-semibold text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="h-10 w-full text-center text-sm font-medium text-text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
          >
            Pular por agora
          </button>
        </div>
      </form>
    </div>
  );
}
