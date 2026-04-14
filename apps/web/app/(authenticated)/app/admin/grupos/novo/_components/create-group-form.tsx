'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  toast,
} from '@metanoia/ui';
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

  const form = useForm<CreateGroupRequest>({
    resolver: zodResolver(CreateGroupRequestSchema),
    defaultValues: {
      name: '',
      dayOfWeek: 'thu',
      time: '20:00',
    },
  });

  async function onSubmit(values: CreateGroupRequest) {
    try {
      await createGroup.mutateAsync(values);
      toast.success(isFirst ? t.success.toast : t.success.toastNormal);
      router.push('/app/gestao/radar?acabou-de-criar=1');
    } catch {
      toast.error(t.error.network.toast);
    }
  }

  const dayDays = t.field.schedule.days;
  const dayValue = form.watch('dayOfWeek');

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <Label htmlFor="group-name">{t.field.name.label}</Label>
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
          <Label htmlFor="group-day">{t.field.schedule.label}</Label>
          <Select
            value={dayValue}
            onValueChange={(v) => form.setValue('dayOfWeek', v as DayOfWeek)}
          >
            <SelectTrigger id="group-day">
              <SelectValue placeholder={t.field.schedule.dayPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {dayDays[opt.labelKey]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="group-time">{t.field.schedule.timePlaceholder}</Label>
          <Input
            id="group-time"
            type="time"
            aria-invalid={!!form.formState.errors.time}
            {...form.register('time')}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="group-notes">
          {t.field.description.label}{' '}
          <span className="text-text-tertiary">{t.field.optional}</span>
        </Label>
        <Input
          id="group-notes"
          type="text"
          placeholder={t.field.description.placeholder}
          {...form.register('notes')}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={createGroup.isPending}
      >
        {createGroup.isPending ? '...' : t.action.create}
      </Button>
    </form>
  );
}
