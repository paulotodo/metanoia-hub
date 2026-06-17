'use client';

/**
 * PoliciesPage — tenant behavioural policy toggle configuration (Story 11-3).
 *
 * Client Component: uses TanStack Query (usePolicies / useUpdatePolicies).
 * Constitution V: TanStack Query only in Client Components.
 * ADMIN_TENANT only: enforced at API level (PATCH/GET → 403 for other roles).
 */
import { useState } from 'react';
import type { TenantPolicies } from '@metanoia/types';
import { usePolicies, useUpdatePolicies } from '@/hooks/use-policies';
import { PolicyToggleList } from './_components/policy-toggle-list';

export default function PoliciesPage() {
  const { data: policiesData, isLoading, isError } = usePolicies();
  const updatePolicies = useUpdatePolicies();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleToggle(key: keyof TenantPolicies, value: boolean) {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updatePolicies.mutateAsync({ [key]: value });
      setSuccessMessage('Políticas da comunidade atualizadas com sucesso.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar as políticas. Verifique sua conexão e tente novamente.';
      setErrorMessage(msg);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text-primary,#1a1a1a)]">
        Políticas da Comunidade
      </h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary,#666)]">
        Configure como a sua comunidade participa dos encontros e trilhas de discipulado.
      </p>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando políticas…">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div className="space-y-2">
                <div className="h-4 w-48 motion-safe:animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-72 motion-safe:animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-6 w-11 motion-safe:animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Não foi possível carregar as políticas. Verifique sua conexão e tente novamente.
        </div>
      )}

      {/* Policies list */}
      {policiesData && !isLoading && (
        <>
          <PolicyToggleList
            policies={policiesData.policies}
            tierInfo={policiesData.tierInfo}
            currentPlan="free" // TODO: source from tenant context when available
            isLoading={updatePolicies.isPending}
            onToggle={handleToggle}
          />

          {/* Success message */}
          {successMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              {successMessage}
            </div>
          )}

          {/* Error message (save) */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
