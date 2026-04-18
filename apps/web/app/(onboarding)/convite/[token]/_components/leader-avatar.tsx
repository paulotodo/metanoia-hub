interface LeaderAvatarProps {
  firstName: string;
  avatarUrl: string | null;
}

/**
 * Spec 06.2-C1 — circular 72px avatar with initials fallback in `bg-brand-teal`.
 * Reused later by 06.5 (leader profile visible to participant).
 */
export function LeaderAvatar({ firstName, avatarUrl }: LeaderAvatarProps) {
  const initials = computeInitials(firstName);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${firstName}`}
        width={72}
        height={72}
        className="size-[72px] rounded-full object-cover"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Iniciais de ${firstName}`}
      className="flex size-[72px] items-center justify-center rounded-full bg-[var(--color-brand-teal)] text-xl font-semibold text-white"
    >
      {initials}
    </div>
  );
}

function computeInitials(firstName: string): string {
  const parts = firstName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}
