const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

function formatScheduledFor(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = DAY_LABELS[d.getDay()] ?? "";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}, ${hours}:${minutes}`;
}

export function MeetingContextCard({
  groupName,
  scheduledFor,
}: {
  groupName: string;
  scheduledFor: string;
}) {
  return (
    <div
      data-testid="meeting-context-card"
      className="rounded-lg border border-border-default bg-surface-elevated p-4"
    >
      <h2 className="text-lg font-semibold text-text-primary">{groupName}</h2>
      <p className="mt-1 text-sm text-text-secondary">
        {formatScheduledFor(scheduledFor)}
      </p>
    </div>
  );
}
