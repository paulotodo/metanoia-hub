import { cn } from "@metanoia/ui";
import type { DayOfWeek } from "../../../__mocks__/onboarding";

interface DayOfWeekSelectProps {
  id: string;
  value: DayOfWeek | "";
  onChange: (value: DayOfWeek | "") => void;
  /** PT-BR labels injected by the page so the component stays i18n-agnostic. */
  labels: Record<DayOfWeek, string>;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
}

const ORDER: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Native <select> for recurring meeting day (spec 05.5).
 * Kept native for accessibility; styled to match shared Input height.
 */
export function DayOfWeekSelect({
  id,
  value,
  onChange,
  labels,
  placeholder,
  disabled,
  className,
  'aria-required': ariaRequired,
  'aria-invalid': ariaInvalid,
}: DayOfWeekSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-required={ariaRequired}
      aria-invalid={ariaInvalid}
      onChange={(event) => onChange(event.target.value as DayOfWeek | "")}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {ORDER.map((day) => (
        <option key={day} value={day}>
          {labels[day]}
        </option>
      ))}
    </select>
  );
}
