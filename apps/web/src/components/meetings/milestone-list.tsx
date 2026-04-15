"use client";

import { useId } from "react";
import type { MeetingMilestone } from "@metanoia/types";

export function MilestoneList({
  milestones,
  label,
}: {
  milestones: MeetingMilestone[];
  label: string;
}) {
  const labelId = useId();
  if (milestones.length === 0) return null;

  return (
    <section aria-labelledby={labelId} className="space-y-2">
      <h3 id={labelId} className="text-sm font-medium text-text-secondary">
        {label}
      </h3>
      <ul className="space-y-1.5">
        {milestones.map((m) => (
          <li key={m.id} className="flex gap-2 text-sm text-text-primary">
            <span aria-hidden="true" className="text-brand-teal">
              •
            </span>
            <span>{m.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
