'use client';

import { useState } from 'react';
import { Button, Input } from '@metanoia/ui';
import { useUpdateTenantProfile } from '@/lib/api/hooks';
import { WIZARD_STEP_COMMUNITY_LABEL, WIZARD_COMMUNITY_NAME_LABEL } from '@metanoia/types';
import type { UpdateTenantProfile } from '@metanoia/types';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.onboardingWizard;

interface Step2CommunityProps {
  initialName?: string;
  initialDenomination?: string;
  initialCity?: string;
  initialState?: string;
  initialLogoUrl?: string | null;
  onComplete: (data: {
    name: string;
    denomination?: string;
    city?: string;
    state?: string;
    logoUrl?: string;
  }) => void;
  readOnly?: boolean;
}

export function Step2Community({
  initialName = '',
  initialDenomination = '',
  initialCity = '',
  initialState = '',
  initialLogoUrl = null,
  onComplete,
  readOnly = false,
}: Step2CommunityProps) {
  const [name, setName] = useState(initialName);
  const [denomination, setDenomination] = useState(initialDenomination);
  const [city, setCity] = useState(initialCity);
  const [stateUf, setStateUf] = useState(initialState);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: updateTenant, isPending } = useUpdateTenantProfile();

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_BYTES_LOGO = 2 * 1024 * 1024;

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(t.errors.uploadInvalidType);
      return;
    }
    if (file.size > MAX_BYTES_LOGO) {
      setUploadError(t.errors.uploadTooLarge.replace('{{maxMb}}', '2'));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/storage/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        setUploadError(t.errors.uploadFailed);
        return;
      }

      const json = (await res.json()) as { data: { url: string } };
      setLogoUrl(json.data.url);
    } catch {
      setUploadError(t.errors.uploadFailed);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!name.trim()) return;

    const payload: UpdateTenantProfile = { name: name.trim() };
    if (denomination.trim()) payload.denomination = denomination.trim();
    if (city.trim()) payload.city = city.trim();
    if (stateUf.trim()) payload.state = stateUf.trim();
    if (logoUrl) payload.logoUrl = logoUrl;

    try {
      await updateTenant(payload);
      onComplete({
        name: name.trim(),
        denomination: denomination.trim() || undefined,
        city: city.trim() || undefined,
        state: stateUf.trim() || undefined,
        logoUrl: logoUrl ?? undefined,
      });
    } catch {
      // Best-effort — advance per FR-13
      onComplete({ name: name.trim() });
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
      <p className="text-sm font-semibold text-text-secondary">{WIZARD_STEP_COMMUNITY_LABEL}</p>

      <div className="space-y-2">
        <label htmlFor="wizard-community-name" className="block text-sm font-medium text-text-primary">
          {WIZARD_COMMUNITY_NAME_LABEL} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="wizard-community-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.step2.namePlaceholder}
          required
          disabled={readOnly || isPending}
          data-testid="step2-community-name"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="wizard-denomination" className="block text-sm font-medium text-text-primary">
          {t.step2.denominationLabel}
        </label>
        <Input
          id="wizard-denomination"
          type="text"
          value={denomination}
          onChange={(e) => setDenomination(e.target.value)}
          placeholder={t.step2.denominationPlaceholder}
          disabled={readOnly || isPending}
          data-testid="step2-denomination"
        />
      </div>

      {/* Task 1.5 — WCAG 1.3.1: fieldset agrupa cidade+estado relacionados */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-text-primary">{t.step2.locationLabel}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="wizard-city" className="block text-sm font-medium text-text-primary">
              {t.step2.cityLabel}
            </label>
            <Input
              id="wizard-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.step2.cityPlaceholder}
              disabled={readOnly || isPending}
              data-testid="step2-city"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="wizard-state" className="block text-sm font-medium text-text-primary">
              {t.step2.stateLabel}
            </label>
            <Input
              id="wizard-state"
              type="text"
              value={stateUf}
              onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
              placeholder={t.step2.statePlaceholder}
              maxLength={2}
              disabled={readOnly || isPending}
              data-testid="step2-state"
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-text-primary">{t.step2.logoLabel}</span>
        <p className="text-xs text-text-secondary">{t.step2.logoHint}</p>

        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo da comunidade"
            className="h-16 w-16 rounded-lg object-contain"
          />
        )}

        {!readOnly && (
          <label className="cursor-pointer">
            <span className="inline-flex items-center rounded-md border border-surface-muted px-3 py-1.5 text-sm text-text-primary hover:bg-surface-subtle">
              {isUploading ? 'Enviando…' : 'Escolher logo'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => { void handleLogoChange(e); }}
              className="sr-only"
              disabled={isUploading || isPending}
              aria-label={messages.form.file.select_community_logo}
              data-testid="step2-logo-input"
            />
          </label>
        )}

        {uploadError && (
          <p role="alert" className="text-sm text-error">
            {uploadError}
          </p>
        )}
      </div>

      {!readOnly && (
        <Button
          type="submit"
          className="w-full"
          disabled={!name.trim() || isPending || isUploading}
          data-testid="step2-submit"
          aria-busy={isPending || undefined}
        >
          {t.actions.next}
        </Button>
      )}
    </form>
  );
}
