interface SaudacaoContextualProps {
  firstName: string;
  urgentCount: number;
  attentionCount: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getSubtitle(urgentCount: number, attentionCount: number): string {
  if (urgentCount > 0) {
    return `Esta semana, ${urgentCount} ${urgentCount === 1 ? "precisa" : "precisam"} de cuidado`;
  }
  if (attentionCount > 0) {
    return `${attentionCount} ${attentionCount === 1 ? "pessoa merece" : "pessoas merecem"} atenção`;
  }
  return "Seu grupo está bem esta semana";
}

export function SaudacaoContextual({
  firstName,
  urgentCount,
  attentionCount,
}: SaudacaoContextualProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold text-text-primary lg:text-3xl lg:font-bold">
        {getGreeting()}, {firstName}
      </h1>
      <p className="text-sm text-text-secondary lg:text-base">
        {getSubtitle(urgentCount, attentionCount)}
      </p>
    </div>
  );
}
