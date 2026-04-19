interface LeaderAvatarProps {
  firstName: string;
  avatarUrl: string | null;
  size?: 64 | 72;
}

export function LeaderAvatar({
  firstName,
  avatarUrl,
  size = 72,
}: LeaderAvatarProps) {
  const initials = computeInitials(firstName);
  const sizeClass = size === 64 ? "size-[64px]" : "size-[72px]";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${firstName}`}
        width={size}
        height={size}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Iniciais de ${firstName}`}
      className={`${sizeClass} flex items-center justify-center rounded-full bg-[var(--color-brand-teal)] text-xl font-semibold text-white`}
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
