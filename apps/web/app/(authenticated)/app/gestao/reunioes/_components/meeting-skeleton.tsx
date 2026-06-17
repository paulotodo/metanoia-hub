"use client";

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded-lg bg-surface-sunken ${className}`}
    />
  );
}

export function MeetingAgendaSkeleton() {
  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <Pulse className="h-5 w-24" />
      <Pulse className="h-7 w-48" />

      {/* Context card */}
      <Pulse className="h-20 w-full" />

      {/* Topic */}
      <div className="space-y-2">
        <Pulse className="h-4 w-40" />
        <Pulse className="h-5 w-full" />
        <Pulse className="h-5 w-3/4" />
      </div>

      {/* Confirmed */}
      <div className="space-y-2">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-5 w-full" />
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-5 w-5/6" />
        <Pulse className="h-5 w-2/3" />
      </div>

      {/* Open room button */}
      <Pulse className="h-14 w-full" />
    </div>
  );
}
