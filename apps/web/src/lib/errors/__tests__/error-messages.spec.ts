import { describe, it, expect } from 'vitest';
import { resolveError } from '../error-messages';
import { ApiError } from '../../api/client';

describe('resolveError', () => {
  // FASE-2.2: corrected — uses canonical English resource key as the backend sends
  it('uses details.errorKey when present (plan.limit.groups)', () => {
    const err = new ApiError(403, 'Forbidden', 'irrelevant', {
      errorKey: 'plan.limit.groups',
      current: 2,
      limit: 3,
    });

    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limit.groups');
    expect(r.message).toContain('2');
    expect(r.message).toContain('3');
    expect(r.message).toContain('comunidades de cuidado');
    expect(r.message).not.toContain('{');
    expect(r.message).toContain('ampliar o plano');
  });

  // FASE-2.2: corrected — resource must be canonical English ('groups'), not PT
  it('maps groups → plan.limit.groups with PT-BR pastoral message', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'plan exceeded', {
      resource: 'groups',
      plan: 'starter',
      current: 3,
      limit: 3,
    });

    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limit.groups');
    expect(r.message).toContain('3');
    expect(r.message).toContain('comunidades de cuidado');
    expect(r.message).not.toContain('{');
    expect(r.message).not.toContain('groups'); // never expose technical term
  });

  // FASE-2.2: corrected — fallback key is now 'plan.limitGeneric'
  it('falls back to plan.limitGeneric when details lack resource', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'plan exceeded');
    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limitGeneric');
    expect(r.message).not.toContain('{');
  });

  // FASE-2.2: per-resource tests
  it('maps membersPerGroup → PT-BR pastoral message', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'plan exceeded', {
      resource: 'membersPerGroup',
      plan: 'starter',
      current: 30,
      limit: 30,
    });

    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limit.membersPerGroup');
    expect(r.message).toContain('30');
    expect(r.message).toContain('participantes do grupo');
    expect(r.message).not.toContain('{');
    expect(r.message).not.toContain('membersPerGroup');
  });

  it('maps leadersPerTenant → PT-BR pastoral message', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'plan exceeded', {
      resource: 'leadersPerTenant',
      plan: 'starter',
      current: 5,
      limit: 5,
    });

    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limit.leadersPerTenant');
    expect(r.message).toContain('5');
    expect(r.message).toContain('pastores/líderes ativos');
    expect(r.message).not.toContain('{');
    expect(r.message).not.toContain('leadersPerTenant');
  });

  it('maps known error names to keys', () => {
    expect(resolveError(new ApiError(403, 'Forbidden', 'no')).errorKey).toBe(
      'permission.denied',
    );
    expect(resolveError(new ApiError(404, 'NotFound', 'no')).errorKey).toBe(
      'notFound.generic',
    );
    expect(
      resolveError(new ApiError(403, 'ConsentRequired', 'no')).errorKey,
    ).toBe('conflict.consentRequired');
  });

  it('produces actionable permission message', () => {
    const r = resolveError(new ApiError(403, 'Forbidden', 'denied'));
    expect(r.message).toMatch(/permissão/i);
    expect(r.message).toMatch(/administrador/i);
  });

  it('produces actionable not-found message', () => {
    const r = resolveError(new ApiError(404, 'NotFound', 'gone'));
    expect(r.message).toMatch(/não encontrado/i);
    expect(r.message).toMatch(/volte ao início/i);
  });

  it('falls back to network for TypeError (fetch failures)', () => {
    const r = resolveError(new TypeError('Failed to fetch'));
    expect(r.errorKey).toBe('network.failed');
    expect(r.message).toMatch(/conexão/i);
  });

  it('falls back to unknown for arbitrary errors', () => {
    const r = resolveError(new Error('something else'));
    expect(r.errorKey).toBe('unknown.generic');
    expect(r.message).toMatch(/imprevisto/i);
  });

  it('falls back to unknown for unmapped ApiError name', () => {
    const r = resolveError(new ApiError(418, 'Teapot', 'rfc 2324'));
    expect(r.errorKey).toBe('unknown.generic');
  });

  it('preserves statusCode in the result', () => {
    const r = resolveError(new ApiError(429, 'TooManyRequests', 'slow down'));
    expect(r.statusCode).toBe(429);
  });

  it('never echoes the raw backend message (no stack/technical leak)', () => {
    const err = new ApiError(500, 'InternalServerError', 'TypeError at line 42');
    const r = resolveError(err);
    expect(r.message).not.toContain('TypeError');
    expect(r.message).not.toContain('line 42');
  });

  // FASE-2.3: fallback coverage for absent/unknown resource
  it('falls back to limitGeneric when resource field is absent', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'exceeded', {
      current: 1,
      limit: 1,
    });
    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limitGeneric');
    expect(r.message).not.toContain('{');
  });

  it('falls back to limitGeneric when resource is an unknown value', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'exceeded', {
      resource: 'trailsPerTenant', // future value not yet mapped
      current: 5,
      limit: 3,
    });
    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limitGeneric');
    expect(r.message).not.toContain('{');
    expect(r.message).not.toContain('trailsPerTenant');
  });

  it('falls back to limitGeneric when PlanLimitReached has no details', () => {
    const err = new ApiError(403, 'PlanLimitReached', 'exceeded');
    const r = resolveError(err);
    expect(r.errorKey).toBe('plan.limitGeneric');
    expect(r.message).not.toContain('{');
  });
});

// FASE-2.4: snapshot regression for all 3 pastoral messages
describe('RESOURCE_TO_KEY pastoral mapping (snapshot)', () => {
  const resources = ['groups', 'membersPerGroup', 'leadersPerTenant'] as const;

  it.each(resources)('resource %s → distinct PT-BR pastoral message', (resource) => {
    const err = new ApiError(403, 'PlanLimitReached', 'exceeded', {
      resource,
      plan: 'starter',
      current: 2,
      limit: 5,
    });
    const r = resolveError(err);
    expect(r.message).toMatchSnapshot();
    expect(r.message).not.toContain('{');
    expect(r.message).not.toContain(resource); // never display technical value
    expect(r.message).toContain('2'); // interpolates current
    expect(r.message).toContain('5'); // interpolates limit
  });

  it('three resources produce three distinct messages', () => {
    const msgs = resources.map((resource) =>
      resolveError(
        new ApiError(403, 'PlanLimitReached', 'exceeded', {
          resource,
          current: 1,
          limit: 1,
        }),
      ).message,
    );
    expect(new Set(msgs).size).toBe(3);
  });
});
