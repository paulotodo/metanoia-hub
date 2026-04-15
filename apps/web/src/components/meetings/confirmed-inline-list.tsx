"use client";

import { useId } from "react";
import type { ConfirmedParticipant } from "@metanoia/types";

export function ConfirmedInlineList({
  confirmed,
  label,
  emptyText,
}: {
  confirmed: ConfirmedParticipant[];
  label: string;
  emptyText: string;
}) {
  const labelId = useId();
  const yesList = confirmed.filter((c) => c.response === "yes");

  return (
    <section aria-labelledby={labelId} className="space-y-2">
      <h3 id={labelId} className="text-sm font-medium text-text-secondary">
        {label}
      </h3>
      {yesList.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyText}</p>
      ) : (
        <ul
          data-testid="confirmed-inline-list"
          className="flex flex-wrap gap-x-3 gap-y-1.5"
        >
          {yesList.map((p) => (
            <li
              key={p.participantId}
              className="flex items-center gap-1.5 text-sm text-text-primary"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-care-ok"
              />
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
