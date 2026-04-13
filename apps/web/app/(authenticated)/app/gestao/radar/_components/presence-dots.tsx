import { cn } from "@metanoia/ui";
import type { PresenceDot } from "../../../../../../__mocks__/radar";

interface PresenceDotsProps {
  dots: PresenceDot[];
}

const dotStyles: Record<PresenceDot, { bg: string; label: string }> = {
  present: { bg: "bg-care-ok", label: "Presente" },
  absent: { bg: "bg-care-urgent", label: "Ausente" },
  "no-meeting": { bg: "bg-border-default", label: "Sem reunião" },
};

export function PresenceDots({ dots }: PresenceDotsProps) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label="Histórico de presença">
      <span className="text-xs text-text-muted">Presença:</span>
      {dots.map((dot, i) => {
        const style = dotStyles[dot];
        return (
          <span
            key={i}
            className={cn("size-2.5 rounded-full", style.bg)}
            title={style.label}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
