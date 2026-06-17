"use client";

import { cn } from "@metanoia/ui";
import type { RadarGroup } from "../../../../../../__mocks__/radar";

interface GrupoPillProps {
  groups: RadarGroup[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
}

export function GrupoPillFilter({
  groups,
  selectedGroupId,
  onSelect,
}: GrupoPillProps) {
  if (groups.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto" role="radiogroup" aria-label="Filtrar por grupo">
      <button
        type="button"
        role="radio"
        aria-checked={selectedGroupId === null}
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium motion-safe:transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus",
          selectedGroupId === null
            ? "bg-brand-teal text-text-inverse active:opacity-80 active:scale-[0.98]"
            : "border border-border-default bg-surface-base text-text-secondary hover:bg-surface-sunken active:opacity-80 active:scale-[0.98]",
        )}
      >
        Todos
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          role="radio"
          aria-checked={selectedGroupId === group.id}
          onClick={() => onSelect(group.id)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium motion-safe:transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus",
            selectedGroupId === group.id
              ? "bg-brand-teal text-text-inverse"
              : "border border-border-default bg-surface-base text-text-secondary hover:bg-surface-sunken",
          )}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}
