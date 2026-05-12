"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MeetingStatus } from "@metanoia/types";
import { MeetingCard } from "@/components/meetings/meeting-card";
import {
  useJoinMeeting,
  useMeetingsList,
} from "@/lib/api/hooks/use-meetings";

const STATUS_OPTIONS: { value: MeetingStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "scheduled", label: "Agendadas" },
  { value: "live", label: "Em andamento" },
  { value: "ended", label: "Encerradas" },
  { value: "cancelled", label: "Canceladas" },
];

export default function ReunioesListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MeetingStatus | "all">("all");
  const perPage = 20;

  const { data, isLoading, isError } = useMeetingsList({
    page,
    perPage,
    ...(status !== "all" ? { status } : {}),
  });

  const join = useJoinMeeting();

  async function handleJoin(meetingId: string) {
    const res = await join.mutateAsync(meetingId);
    if (res?.joinToken) {
      router.push(`/app/gestao/reunioes/${meetingId}/sala`);
    }
  }

  return (
    <section
      aria-labelledby="reunioes-heading"
      className="mx-auto max-w-3xl space-y-6 py-6"
    >
      <header className="space-y-2">
        <h1
          id="reunioes-heading"
          className="text-2xl font-semibold text-text-primary"
        >
          Reuniões
        </h1>
        <p className="text-sm text-text-secondary">
          Encontros agendados dos grupos. Toque em uma reunião ao vivo para
          entrar com um clique.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setStatus(opt.value);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === opt.value
                ? "bg-text-primary text-surface-base"
                : "bg-surface-elevated text-text-secondary"
            }`}
            data-testid={`meetings-filter-${opt.value}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Carregando reuniões...</p>
      ) : null}

      {isError ? (
        <p className="text-sm text-care-alert">
          Não foi possível carregar as reuniões.
        </p>
      ) : null}

      {data?.data && data.data.length === 0 ? (
        <p className="text-sm text-text-muted">
          Nenhuma reunião encontrada para este filtro.
        </p>
      ) : null}

      <ul className="space-y-3" data-testid="meetings-list">
        {data?.data?.map((meeting) => (
          <li key={meeting.id}>
            <MeetingCard
              meeting={meeting}
              onJoin={handleJoin}
              isJoining={join.isPending}
            />
          </li>
        ))}
      </ul>

      {data?.meta && data.meta.totalPages > 1 ? (
        <nav className="flex items-center justify-between pt-4" aria-label="Paginação">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-border-default px-3 py-1 text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs text-text-muted">
            Página {data.meta.page} de {data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border-default px-3 py-1 text-sm disabled:opacity-50"
          >
            Próxima
          </button>
        </nav>
      ) : null}
    </section>
  );
}
