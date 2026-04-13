"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import {
  mockSignalDetail,
  mockCareActionResponse,
} from "../../../../../../../__mocks__/radar";

type PageState = "form" | "saving" | "confirmation" | "error";

export default function CareActionPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = use(params);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [note, setNote] = useState("");
  const [pageState, setPageState] = useState<PageState>("form");
  const [undoCountdown, setUndoCountdown] = useState(5);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prototype: mock data
  const data = mockSignalDetail;
  const nextMeetingDay = "quinta"; // from mock, will come from API

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!note.trim()) return;

    setPageState("saving");

    // Simulate API call (will be real POST in Session 6)
    await new Promise((resolve) => setTimeout(resolve, 800));
    void mockCareActionResponse; // acknowledge mock usage

    setPageState("confirmation");

    // Start undo countdown
    let count = 5;
    setUndoCountdown(count);
    undoTimerRef.current = setInterval(() => {
      count -= 1;
      setUndoCountdown(count);
      if (count <= 0) {
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        router.push("/app/gestao/radar");
      }
    }, 1000);
  }, [note, router]);

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setPageState("form");
    setUndoCountdown(5);
  }, []);

  const handleBack = useCallback(() => {
    if (note.trim() && pageState === "form") {
      setShowAbandonDialog(true);
    } else {
      router.push(`/app/gestao/radar/${participantId}`);
    }
  }, [note, pageState, participantId, router]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, []);

  // --- Confirmation State ---
  if (pageState === "confirmation") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <CheckCircle
          className="size-16 text-care-ok"
          aria-hidden="true"
        />
        <h1 className="text-xl font-semibold text-text-primary">
          Obrigado. Vemos você {nextMeetingDay}.
        </h1>

        {/* Undo toast */}
        <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-elevated px-4 py-3">
          <span className="text-sm text-text-secondary">
            Desfazer ({undoCountdown}s)
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-sm font-medium text-brand-teal transition-colors hover:text-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
          >
            Desfazer
          </button>
        </div>
      </div>
    );
  }

  // --- Form State ---
  return (
    <div className="space-y-6 py-6">
      {/* Back navigation */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar
      </button>

      {/* Context */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary lg:text-3xl lg:font-bold">
          Registrar cuidado
        </h1>
        <p className="text-sm text-text-muted">
          {data.name} · {data.groupName}
        </p>
      </div>

      {/* Care form */}
      <div className="space-y-2">
        <label
          htmlFor="care-note"
          className="text-sm font-medium text-text-primary"
        >
          O que você vai fazer?
        </label>
        <textarea
          ref={textareaRef}
          id="care-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          rows={4}
          placeholder="Vou mandar uma mensagem perguntando se está tudo bem..."
          disabled={pageState === "saving"}
          className="w-full resize-none rounded-lg border border-border-default bg-surface-elevated px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:border-interactive-focus focus:outline-none focus:ring-2 focus:ring-interactive-focus disabled:opacity-50"
        />
        <div className="flex justify-end">
          <span className="text-xs text-text-muted">
            {note.length}/280
          </span>
        </div>
      </div>

      {/* Error state */}
      {pageState === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-care-urgent/30 bg-care-urgent/5 px-4 py-3 text-sm text-care-urgent"
        >
          Não conseguimos salvar. Tente de novo.
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!note.trim() || pageState === "saving"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-teal px-4 py-3 text-sm font-medium text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:bg-interactive-disabled-bg disabled:text-interactive-disabled-text sm:w-auto"
      >
        {pageState === "saving" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Salvando...
          </>
        ) : (
          "Guardar"
        )}
      </button>

      {/* Abandon dialog */}
      {showAbandonDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="abandon-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-lg bg-surface-elevated p-6 shadow-lg">
            <h2
              id="abandon-title"
              className="text-base font-semibold text-text-primary"
            >
              Sair sem salvar?
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Você começou a escrever algo. Se sair agora, o texto será perdido.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAbandonDialog(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
              >
                Continuar escrevendo
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(`/app/gestao/radar/${participantId}`)
                }
                className="rounded-md bg-care-urgent px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-care-urgent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
