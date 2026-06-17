'use client';

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded-lg bg-surface-sunken ${className}`}
    />
  );
}

export function RadarPageSkeleton() {
  return (
    <div className="space-y-6 py-6">
      {/* Greeting */}
      <Pulse className="h-8 w-48" />
      <Pulse className="h-5 w-64" />

      {/* Semaforo pills */}
      <div className="flex gap-2">
        <Pulse className="h-10 w-24" />
        <Pulse className="h-10 w-24" />
        <Pulse className="h-10 w-24" />
      </div>

      {/* Group filter */}
      <div className="flex gap-2">
        <Pulse className="h-8 w-16" />
        <Pulse className="h-8 w-20" />
        <Pulse className="h-8 w-24" />
      </div>

      {/* Cards */}
      <div className="space-y-3">
        <Pulse className="h-24 w-full" />
        <Pulse className="h-24 w-full" />
        <Pulse className="h-24 w-full" />
      </div>
    </div>
  );
}

export function SignalDetailSkeleton() {
  return (
    <div className="space-y-6 py-6">
      <Pulse className="h-4 w-16" />
      <div className="space-y-1">
        <Pulse className="h-7 w-40" />
        <Pulse className="h-4 w-24" />
      </div>
      <Pulse className="h-20 w-full" />
      <Pulse className="h-16 w-full" />
      <Pulse className="h-8 w-full" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 py-6">
      <Pulse className="h-4 w-24" />
      <div className="space-y-1">
        <Pulse className="h-7 w-40" />
        <Pulse className="h-4 w-24" />
      </div>
      <Pulse className="h-8 w-full" />
      <div className="space-y-3">
        <Pulse className="h-20 w-full" />
        <Pulse className="h-20 w-full" />
        <Pulse className="h-20 w-full" />
      </div>
    </div>
  );
}
