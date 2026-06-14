'use client';

/**
 * BrandingSettingsForm — Client Component for branding customization.
 *
 * AC8: All inputs have labels (htmlFor + id). Passes jest-axe.
 * AC7: Non-blocking contrast warning when ratio < 4.5:1.
 * Gate FE: logo/color inputs disabled for Free tenants.
 * Constitution V: no TanStack Query in Server Component parent; no Zustand for server state.
 */
import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BrandingResponseSchema,
  type BrandingResponse,
  type UpdateBrandingInput,
} from '@metanoia/types';
import { envelopeClient } from '@/lib/api/envelope';
import { checkBrandContrast } from '@/lib/contrast-checker';

// ---------------------------------------------------------------------------
// Response envelope parsers for client-side parsing
// (use @metanoia/types schemas; zod is not a direct dep of apps/web)
// ---------------------------------------------------------------------------

const BrandingEnvelopeSchema = {
  parse: (data: unknown) => {
    const envelope = data as { data: unknown };
    return { data: BrandingResponseSchema.parse(envelope.data) };
  },
};

const LogoEnvelopeSchema = {
  parse: (data: unknown) => {
    const envelope = data as { data: { logoUrl: string } };
    return { data: { logoUrl: envelope.data.logoUrl } };
  },
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const brandingKeys = {
  all: ['branding'] as const,
  mine: () => [...brandingKeys.all, 'mine'] as const,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BrandingSettingsFormProps {
  initialBranding: BrandingResponse | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandingSettingsForm({ initialBranding }: BrandingSettingsFormProps) {
  const queryClient = useQueryClient();

  const plan = initialBranding?.plan ?? 'free';
  const canCustomize = initialBranding?.canCustomizeBranding ?? false;

  // Local form state (controlled)
  const [primaryColor, setPrimaryColor] = useState<string>(
    initialBranding?.primaryColor ?? '#2b7a78',
  );
  const [secondaryColor, setSecondaryColor] = useState<string>(
    initialBranding?.secondaryColor ?? '#c1666b',
  );
  const [displayName, setDisplayName] = useState<string>(
    initialBranding?.displayName ?? '',
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    initialBranding?.logoUrl ?? null,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Non-blocking contrast warning (AC7)
  const contrastResult = canCustomize ? checkBrandContrast(primaryColor) : null;

  // ── PATCH mutation (colors + displayName) ─────────────────────────────────

  const updateBrandingMutation = useMutation<BrandingResponse, Error, UpdateBrandingInput>({
    mutationFn: async (dto: UpdateBrandingInput): Promise<BrandingResponse> => {
      const envelope = await envelopeClient.patch(
        '/tenants/me/branding',
        dto,
        BrandingEnvelopeSchema,
      );
      return envelope.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: brandingKeys.all });
      // Update local state from server response
      if (data.primaryColor) setPrimaryColor(data.primaryColor);
      if (data.secondaryColor) setSecondaryColor(data.secondaryColor);
      if (data.displayName) setDisplayName(data.displayName);
    },
  });

  // ── POST mutation (logo upload) ───────────────────────────────────────────

  const uploadLogoMutation = useMutation<{ logoUrl: string }, Error, File>({
    mutationFn: async (file: File): Promise<{ logoUrl: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      // Use raw fetch for multipart (envelopeClient uses JSON.stringify)
      const token =
        typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiBase}/tenants/me/branding/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Erro ao fazer upload do logo.');
      }
      const json = (await res.json()) as unknown;
      return LogoEnvelopeSchema.parse(json).data;
    },
    onSuccess: (data) => {
      setLogoPreviewUrl(data.logoUrl);
      void queryClient.invalidateQueries({ queryKey: brandingKeys.all });
    },
  });

  // ── Save handler ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Upload logo if a new file was selected
    if (logoFile) {
      await uploadLogoMutation.mutateAsync(logoFile);
    }

    // Build PATCH payload — only include changed/allowed fields
    const dto: UpdateBrandingInput = { displayName: displayName || undefined };
    if (canCustomize) {
      dto.primaryColor = primaryColor;
      dto.secondaryColor = secondaryColor;
    }

    await updateBrandingMutation.mutateAsync(dto);
  };

  const isPending = updateBrandingMutation.isPending || uploadLogoMutation.isPending;
  const isSuccess = updateBrandingMutation.isSuccess && !uploadLogoMutation.isError;
  const error = updateBrandingMutation.error ?? uploadLogoMutation.error;

  // ── Logo file handler ─────────────────────────────────────────────────────

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    // Inline preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setLogoPreviewUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      aria-label="Identidade Visual da Igreja"
    >
      {/* ── Logo Upload ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <label
          htmlFor="logo-upload"
          className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Logo da Igreja
        </label>
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2 MB. Dimensões: 64×64 a 512×512 pixels.
        </p>

        {/* Logo preview */}
        {logoPreviewUrl && (
          <div className="mb-3">
            <Image
              src={logoPreviewUrl}
              alt="Logo da Igreja"
              width={128}
              height={128}
              className="rounded-md object-contain"
              unoptimized
            />
          </div>
        )}

        <input
          id="logo-upload"
          type="file"
          accept=".png,.jpg,.jpeg,.svg"
          aria-label="Logo da Igreja"
          disabled={!canCustomize || isPending}
          onChange={handleLogoChange}
          className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:rounded file:border-0 file:bg-[var(--color-surface-sunken)] file:px-3 file:py-1 file:text-sm disabled:cursor-not-allowed disabled:opacity-50"
        />

        {!canCustomize && (
          <p className="mt-1 text-xs text-[var(--color-care-attention)]" role="note">
            {plan === 'free'
              ? 'Personalize logo e cores com os planos Pro ou Enterprise. Entre em contato para fazer upgrade.'
              : ''}
          </p>
        )}
      </div>

      {/* ── Primary Color ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <label
          htmlFor="primary-color-text"
          className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Cor Principal
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primary-color-picker"
            type="color"
            aria-label="Seletor de Cor Principal"
            value={primaryColor}
            disabled={!canCustomize || isPending}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border-default)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            id="primary-color-text"
            type="text"
            value={primaryColor}
            disabled={!canCustomize || isPending}
            onChange={(e) => setPrimaryColor(e.target.value)}
            maxLength={9}
            className="w-32 rounded border border-[var(--color-border-default)] px-2 py-1 text-sm font-mono disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Valor hexadecimal da Cor Principal"
          />
        </div>

        {/* Non-blocking contrast warning (AC7) */}
        {contrastResult?.hasWarning && (
          <p className="mt-2 text-xs text-[var(--color-care-attention)]" role="alert">
            A cor escolhida pode ter baixo contraste em fundos claros. Considere usar uma cor mais escura para melhor legibilidade.
          </p>
        )}
      </div>

      {/* ── Secondary Color ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <label
          htmlFor="secondary-color-text"
          className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Cor Secundária
        </label>
        <div className="flex items-center gap-3">
          <input
            id="secondary-color-picker"
            type="color"
            aria-label="Seletor de Cor Secundária"
            value={secondaryColor}
            disabled={!canCustomize || isPending}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border-default)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            id="secondary-color-text"
            type="text"
            value={secondaryColor}
            disabled={!canCustomize || isPending}
            onChange={(e) => setSecondaryColor(e.target.value)}
            maxLength={9}
            className="w-32 rounded border border-[var(--color-border-default)] px-2 py-1 text-sm font-mono disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Valor hexadecimal da Cor Secundária"
          />
        </div>
      </div>

      {/* ── Display Name ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <label
          htmlFor="display-name"
          className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Nome de Exibição
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          disabled={isPending}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
          placeholder="Nome da Igreja"
          className="w-full rounded border border-[var(--color-border-default)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* ── Status feedback ──────────────────────────────────────────────── */}
      {isSuccess && (
        <p className="mb-4 text-sm text-[var(--color-care-ok)]" role="status" aria-live="polite">
          Identidade visual da igreja atualizada com sucesso.
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-[var(--color-care-urgent)]" role="alert" aria-live="assertive">
          Não foi possível salvar. Verifique sua conexão e tente novamente.
        </p>
      )}

      {/* ── Save button ──────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-brand-primary,var(--color-brand-teal))] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Salvando...' : 'Salvar Identidade Visual'}
      </button>
    </form>
  );
}
