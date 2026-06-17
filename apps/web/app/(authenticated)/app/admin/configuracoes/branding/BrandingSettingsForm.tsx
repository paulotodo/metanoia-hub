'use client';

/**
 * BrandingSettingsForm — Client Component for branding customization.
 *
 * AC8: All inputs have labels (htmlFor + id). Passes jest-axe.
 * AC7: Non-blocking contrast warning when ratio < 4.5:1.
 * Gate FE: logo/color inputs disabled for Free tenants.
 * Constitution V: no TanStack Query in Server Component parent; no Zustand for server state.
 *
 * Story 12.2 — US6, FR-019..FR-021, CL-005
 * Keyboard accessibility:
 *   FR-019: Tab order lógico (visual top-to-bottom).
 *   FR-020: Campo hex alternativo ao color picker visual (acessível em todos os browsers).
 *   FR-021: Upload de logo via <label> focável + ativável por Enter/Space.
 *   CL-005: useAsyncAnnouncer anuncia resultado do save (dec-015: manter foco na origem).
 *
 * CHK024 — Guideline de latência de foco:
 *   Target < 16ms (1 frame a 60 fps) entre evento de teclado e atualização do
 *   foco/estado. Não é um SC automático — documentado aqui como guideline de qualidade.
 *   Monitorar com DevTools > Performance se regressões forem suspeitas.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BrandingResponseSchema,
  type BrandingResponse,
  type UpdateBrandingInput,
} from '@metanoia/types';
import { envelopeClient } from '@/lib/api/envelope';
import { checkBrandContrast } from '@/lib/contrast-checker';
import { useAsyncAnnouncer } from '@/components/a11y/async-announcer';

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

  // CL-005: announcer global para feedback assíncrono (dec-015: manter foco na origem)
  const { announce } = useAsyncAnnouncer();

  // FR-021: ref para o <input type="file"> — label atua como trigger focável
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
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

      // CL-005 / dec-015: manter foco na origem + anunciar via aria-live polite
      // Não mover foco — o botão Salvar mantém o foco onde está.
      announce('Configurações salvas com sucesso.');
    } catch {
      // CL-005: erro anunciado como assertive (interrompe leitor imediatamente)
      announce('Não foi possível salvar. Verifique sua conexão e tente novamente.', {
        politeness: 'assertive',
      });
    }
  };

  const isPending = updateBrandingMutation.isPending || uploadLogoMutation.isPending;
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

  // FR-021: label do logo ativável por teclado (Enter/Space dispara o file picker)
  const handleLogoLabelKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !(!canCustomize || isPending)) {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  // FR-020: validação inline do campo hex (aceita #RRGGBB ou #RGB)
  const handleHexChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setter(value);
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
      {/* ── Logo Upload — FR-021 ─────────────────────────────────────────── */}
      {/* Label é focável (tabIndex=0) e ativável via Enter/Space como alternativa */}
      {/* de teclado ao click. Input type=file recebe o foco nativo normalmente.  */}
      <div className="mb-6">
        <label
          htmlFor="logo-upload"
          tabIndex={canCustomize && !isPending ? 0 : -1}
          onKeyDown={handleLogoLabelKeyDown}
          className="mb-1 block cursor-pointer text-sm font-medium text-[var(--color-text-primary)] focus:outline-2 focus:outline-[var(--color-brand-primary,var(--color-brand-teal))] focus-visible:outline-2"
          aria-disabled={!canCustomize || isPending}
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

        {/* FR-021: input file focável nativamente; label acima é o trigger de teclado */}
        <input
          ref={fileInputRef}
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

      {/* ── Primary Color — FR-019, FR-020 ──────────────────────────────── */}
      {/* FR-019: campo hex (id=primary-color-text) recebe foco antes do picker visual. */}
      {/* FR-020: picker visual (type=color) não é confiável via teclado em todos os */}
      {/*         browsers — o campo hex é a alternativa acessível principal.           */}
      <div className="mb-6">
        <label
          htmlFor="primary-color-text"
          className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Cor Principal
        </label>
        <div className="flex items-center gap-3">
          {/* Picker visual: aria-hidden pois não é confiável via teclado (FR-020) */}
          <input
            id="primary-color-picker"
            type="color"
            aria-hidden="true"
            tabIndex={-1}
            value={primaryColor}
            disabled={!canCustomize || isPending}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border-default)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          {/* Campo hex: alternativa acessível por teclado (FR-020) */}
          <input
            id="primary-color-text"
            type="text"
            value={primaryColor}
            disabled={!canCustomize || isPending}
            onChange={handleHexChange(setPrimaryColor)}
            maxLength={9}
            pattern="^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$"
            autoComplete="off"
            spellCheck={false}
            className="w-32 rounded border border-[var(--color-border-default)] px-2 py-1 text-sm font-mono disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Valor hexadecimal da Cor Principal"
            aria-describedby={contrastResult?.hasWarning ? 'primary-contrast-warning' : undefined}
          />
        </div>

        {/* Non-blocking contrast warning (AC7) */}
        {contrastResult?.hasWarning && (
          <p
            id="primary-contrast-warning"
            className="mt-2 text-xs text-[var(--color-care-attention)]"
            role="alert"
          >
            A cor escolhida pode ter baixo contraste em fundos claros. Considere usar uma cor mais escura para melhor legibilidade.
          </p>
        )}
      </div>

      {/* ── Secondary Color — FR-019, FR-020 ────────────────────────────── */}
      <div className="mb-6">
        <label
          htmlFor="secondary-color-text"
          className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Cor Secundária
        </label>
        <div className="flex items-center gap-3">
          {/* Picker visual: aria-hidden pois não é confiável via teclado (FR-020) */}
          <input
            id="secondary-color-picker"
            type="color"
            aria-hidden="true"
            tabIndex={-1}
            value={secondaryColor}
            disabled={!canCustomize || isPending}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border-default)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          {/* Campo hex: alternativa acessível por teclado (FR-020) */}
          <input
            id="secondary-color-text"
            type="text"
            value={secondaryColor}
            disabled={!canCustomize || isPending}
            onChange={handleHexChange(setSecondaryColor)}
            maxLength={9}
            pattern="^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$"
            autoComplete="off"
            spellCheck={false}
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

      {/* ── Status feedback — substituído por useAsyncAnnouncer (CL-005) ── */}
      {/* O anúncio de sucesso/erro é feito via announce() no handleSave.    */}
      {/* A região aria-live fica no AsyncAnnouncerProvider (layout global). */}
      {/* Exibimos apenas o indicador visual de erro residual abaixo.        */}
      {error && (
        <p className="mb-4 text-sm text-[var(--color-care-urgent)]" role="alert" aria-live="assertive">
          Não foi possível salvar. Verifique sua conexão e tente novamente.
        </p>
      )}

      {/* ── Save button ──────────────────────────────────────────────────── */}
      {/* dec-015: foco permanece neste botão após salvar (não é movido). */}
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
