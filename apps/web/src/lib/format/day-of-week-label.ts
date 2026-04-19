import type { DayOfWeek } from '@metanoia/types';

const PLURAL_PT_BR: Record<DayOfWeek, string> = {
  mon: 'Segundas',
  tue: 'Terças',
  wed: 'Quartas',
  thu: 'Quintas',
  fri: 'Sextas',
  sat: 'Sábados',
  sun: 'Domingos',
};

const SINGULAR_PT_BR: Record<DayOfWeek, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

export function dayOfWeekLabel(
  day: DayOfWeek,
  variant: 'plural' | 'singular' = 'plural',
): string {
  return variant === 'plural' ? PLURAL_PT_BR[day] : SINGULAR_PT_BR[day];
}

export function formatScheduleShort(day: DayOfWeek, time: string): string {
  const [hours, minutes] = time.split(':');
  const hourPart = Number(hours).toString();
  const hasMinutes = minutes && minutes !== '00';
  const timeLabel = hasMinutes ? `${hourPart}h${minutes}` : `${hourPart}h`;
  return `${dayOfWeekLabel(day, 'plural')}, ${timeLabel}`;
}
