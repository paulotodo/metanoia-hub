'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@metanoia/ui';
import { CreateGroupRequestSchema } from '@metanoia/types';
import type { CreateGroupRequest, DayOfWeek } from '@metanoia/types';
import { useCreateGroup } from '@/lib/api/hooks';
import messages from '../../../../../../../messages/pt-BR.json';

interface CreateGroupFormProps {
  isFirst: boolean;
}

const DAY_OPTIONS: Array<{ value: DayOfWeek; labelKey: keyof typeof messages.group.field.schedule.days }> = [
  { value: 'mon', labelKey: 'monday' },
  { value: 'tue', labelKey: 'tuesday' },
  { value: 'wed', labelKey: 'wednesday' },
  { value: 'thu', labelKey: 'thursday' },
  { value: 'fri', labelKey: 'friday' },
  { value: 'sat', labelKey: 'saturday' },
  { value: 'sun', labelKey: 'sunday' },
];

export function CreateGroupForm({ isFirst }: CreateGroupFormProps) {
  const router = useRouter();
  const t = messages.group;
  const createGroup = useCreateGroup();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateGroupRequest>({
    resolver: zodResolver(CreateGroupRequestSchema),
    defaultValues: {
      name: '',
      dayOfWeek: 'thu',
      time: '20:00',
    },
  });

  async function onSubmit(values: CreateGroupRequest) {
    setSubmitError(null);
    try {
      const created = await createGroup.mutateAsync(values);
      const suffix = isFirst ? '?acabou-de-criar=1&first=1' : '?acabou-de-criar=1';
      router.push(`/app/admin/igreja/grupos/${created.id}${suffix}`);
    } catch {
      setSubmitError(t.error.network.toast);
    }
  }

  const dayDays = t.field.schedule.days;
  const labelClass = 'text-body-sm text-text-secondary mb-1 block font-medium';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <label htmlFor="group-name" className={labelClass}>
          {t.field.name.label}
        </label>
        <Input
          id="group-name"
          type="text"
          placeholder={t.field.name.placeholder}
          aria-invalid={!!form.formState.errors.name}
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <p className="text-caption mt-1 text-state-danger" role="alert">
            {t.field.name.error.required}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="group-day" className={labelClass}>
            {t.field.schedule.label}
          </label>
          <select
            id="group-day"
            className="border-border bg-surface text-text-primary focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            {...form.register('dayOfWeek')}
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {dayDays[opt.labelKey]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="group-time" className={labelClass}>
            {t.field.schedule.timePlaceholder}
          </label>
          <Input
            id="group-time"
            type="time"
            aria-invalid={!!form.formState.errors.time}
            {...form.register('time')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="group-notes" className={labelClass}>
          {t.field.description.label}{' '}
          <span className="text-text-tertiary">{t.field.optional}</span>
        </label>
        <Input
          id="group-notes"
          type="text"
          placeholder={t.field.description.placeholder}
          {...form.register('notes')}
        />
      </div>

      {submitError && (
        <p className="text-body-sm text-state-danger" role="alert">
          {submitError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={createGroup.isPending}>
        {createGroup.isPending ? '...' : t.action.create}
      </Button>
    </form>
  );
}
