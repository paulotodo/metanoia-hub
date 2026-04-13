import { cn } from "@metanoia/ui";
import type { SignalType } from "../../../../../../__mocks__/radar";

interface SectionDividerProps {
  signalType: SignalType;
  id: string;
}

const sectionLabels: Record<SignalType, string> = {
  "care-urgent": "Precisam de cuidado",
  "care-attention": "Atenção",
  "care-ok": "Estão bem",
};

const sectionColors: Record<SignalType, string> = {
  "care-urgent": "text-care-urgent",
  "care-attention": "text-care-attention",
  "care-ok": "text-care-ok",
};

export function SectionDivider({ signalType, id }: SectionDividerProps) {
  return (
    <h2
      id={id}
      className={cn(
        "text-sm font-semibold lg:text-2xl lg:font-semibold",
        sectionColors[signalType],
      )}
    >
      {sectionLabels[signalType]}
    </h2>
  );
}
