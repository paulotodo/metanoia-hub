'use client';

import { useState } from 'react';
import { Button, Input } from '@metanoia/ui';
import { useUpdateUserProfile } from '@/lib/api/hooks';
import { WIZARD_DISPLAY_NAME_QUESTION, WIZARD_ROLE_TITLE_LABEL } from '@metanoia/types';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.onboardingWizard;

interface Step1ProfileProps {
  /** Initial name from session/profile */
  initialName?: string;
  /** Initial role title */
  initialRoleTitle?: string;
  /** Initial photo URL */
  initialPhotoUrl?: string | null;
  /** Called after successful save */
  onComplete: (data: { name: string; roleTitle?: string; profilePhotoUrl?: string }) => void;
  /** Read-only mode — no submissions to backend */
  readOnly?: boolean;
}

export function Step1Profile({
  initialName = '',
  initialRoleTitle = '',
  initialPhotoUrl = null,
  onComplete,
  readOnly = false,
}: Step1ProfileProps) {
  const [name, setName] = useState(initialName);
  const [roleTitle, setRoleTitle] = useState(initialRoleTitle);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: updateProfile, isPending } = useUpdateUserProfile();

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_BYTES = 5 * 1024 * 1024;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(t.errors.uploadInvalidType);
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(t.errors.uploadTooLarge.replace('{{maxMb}}', '5'));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'photo');

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
      setPhotoUrl(json.data.url);
    } catch {
      setUploadError(t.errors.uploadFailed);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    const payload: { name?: string; roleTitle?: string; profilePhotoUrl?: string } = {};
    if (name.trim()) payload.name = name.trim();
    if (roleTitle.trim()) payload.roleTitle = roleTitle.trim();
    if (photoUrl) payload.profilePhotoUrl = photoUrl;

    if (Object.keys(payload).length === 0) {
      // Nothing to save — advance anyway
      onComplete({ name: name.trim(), roleTitle: roleTitle.trim() || undefined });
      return;
    }

    try {
      await updateProfile(payload);
      onComplete({
        name: name.trim(),
        roleTitle: roleTitle.trim() || undefined,
        profilePhotoUrl: photoUrl ?? undefined,
      });
    } catch {
      // Error handled by mutation — advance not blocked per FR-13
      onComplete({ name: name.trim(), roleTitle: roleTitle.trim() || undefined });
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="wizard-name" className="block text-sm font-medium text-text-primary">
          {WIZARD_DISPLAY_NAME_QUESTION}
        </label>
        <Input
          id="wizard-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.step1.namePlaceholder}
          disabled={readOnly || isPending}
          aria-required="true"
          data-testid="step1-name"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="wizard-role-title" className="block text-sm font-medium text-text-primary">
          {WIZARD_ROLE_TITLE_LABEL}
        </label>
        <Input
          id="wizard-role-title"
          type="text"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder={t.step1.roleTitlePlaceholder}
          disabled={readOnly || isPending}
          data-testid="step1-role-title"
        />
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-text-primary">{t.step1.photoLabel}</span>
        <p className="text-xs text-text-secondary">{t.step1.photoHint}</p>

        {photoUrl && (
          <img
            src={photoUrl}
            alt="Foto de perfil"
            className="h-16 w-16 rounded-full object-cover"
          />
        )}

        {!readOnly && (
          <label className="cursor-pointer">
            <span className="inline-flex items-center rounded-md border border-surface-muted px-3 py-1.5 text-sm text-text-primary hover:bg-surface-subtle">
              {isUploading ? 'Enviando…' : t.step1.photoChangeButton}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => { void handlePhotoChange(e); }}
              className="sr-only"
              disabled={isUploading || isPending}
              data-testid="step1-photo-input"
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
          disabled={isPending || isUploading}
          data-testid="step1-submit"
        >
          {t.actions.next}
        </Button>
      )}
    </form>
  );
}
