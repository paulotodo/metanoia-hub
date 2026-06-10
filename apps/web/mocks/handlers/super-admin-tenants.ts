import { http, HttpResponse } from 'msw';
import type {
  ProvisionStatusResponse,
  ProvisionTenantResponse,
  TenantDetail,
  TenantDetailResponse,
  TenantPatchResponse,
  TenantSummary,
  TenantsListResponse,
} from '@metanoia/types';

const TENANTS: TenantSummary[] = [
  {
    id: '019800a0-0000-7000-8000-000000000001',
    name: 'Igreja Caminho Novo',
    slug: 'igreja-caminho-novo',
    plan: 'pro',
    status: 'active',
    memberCount: 142,
    createdAt: '2026-02-14T12:00:00.000Z',
  },
  {
    id: '019800a0-0000-7000-8000-000000000002',
    name: 'Comunidade Esperança',
    slug: 'comunidade-esperanca',
    plan: 'free',
    status: 'active',
    memberCount: 38,
    createdAt: '2026-03-02T09:30:00.000Z',
  },
  {
    id: '019800a0-0000-7000-8000-000000000003',
    name: 'Igreja Restauração',
    slug: 'igreja-restauracao',
    plan: 'pro',
    status: 'provisioning_failed',
    memberCount: 0,
    createdAt: '2026-04-28T15:11:00.000Z',
  },
  {
    id: '019800a0-0000-7000-8000-000000000004',
    name: 'Comunidade Encontro',
    slug: 'comunidade-encontro',
    plan: 'enterprise',
    status: 'suspended',
    memberCount: 612,
    createdAt: '2026-01-08T10:00:00.000Z',
  },
];

const DETAIL_BY_ID = new Map<string, TenantDetail>(
  TENANTS.map((t) => [
    t.id,
    {
      ...t,
      adminEmail: `admin@${t.slug}.org`,
      inviteStatus: t.status === 'active' ? 'accepted' : 'sent',
      groupCount: t.status === 'active' ? Math.max(1, Math.round(t.memberCount / 12)) : 0,
      leaderCount: t.status === 'active' ? Math.max(1, Math.round(t.memberCount / 30)) : 0,
      // AC#5 residual Story 3-2: PATCH response includes updatedAt and metadata.
      updatedAt: t.createdAt,
      metadata: {},
    } satisfies TenantDetail,
  ]),
);

function paginate(
  arr: TenantSummary[],
  page: number,
  limit: number,
): TenantsListResponse {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const data = arr.slice(start, start + limit);
  return { data, meta: { page: safePage, limit, total, totalPages } };
}

export const superAdminTenantsHandlers = [
  http.get('*/api/v1/admin/super/tenants', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const status = url.searchParams.get('status') ?? '';
    const plan = url.searchParams.get('plan') ?? '';
    const search = (url.searchParams.get('search') ?? '').toLowerCase();

    let filtered = TENANTS.slice();
    if (status) filtered = filtered.filter((t) => t.status === status);
    if (plan) filtered = filtered.filter((t) => t.plan === plan);
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.slug.toLowerCase().includes(search),
      );
    }

    return HttpResponse.json(paginate(filtered, page, limit));
  }),

  http.get('*/api/v1/admin/super/tenants/:id', ({ params }) => {
    const id = String(params.id);
    const detail = DETAIL_BY_ID.get(id);
    if (!detail) {
      return HttpResponse.json(
        { statusCode: 404, error: 'Not Found', message: 'Tenant not found' },
        { status: 404 },
      );
    }
    const body: TenantDetailResponse = { data: detail };
    return HttpResponse.json(body);
  }),

  http.post('*/api/v1/admin/super/tenants', async ({ request }) => {
    const body = (await request.json()) as { slug: string };
    if (TENANTS.some((t) => t.slug === body.slug)) {
      return HttpResponse.json(
        {
          statusCode: 409,
          error: 'Conflict',
          message: 'Slug already exists',
        },
        { status: 409 },
      );
    }
    const newId = '019800a0-0000-7000-8000-0000000000ff';
    const response: ProvisionTenantResponse = {
      data: { tenantId: newId, status: 'provisioning' },
    };
    return HttpResponse.json(response, { status: 202 });
  }),

  http.get(
    '*/api/v1/admin/super/tenants/:id/provision-status',
    ({ params }) => {
      const id = String(params.id);
      const failed = id.endsWith('failed');
      const body: ProvisionStatusResponse = {
        data: failed
          ? {
              step: 2,
              status: 'failed',
              failedAt: 'keycloak',
              error: 'realm creation timed out',
            }
          : {
              step: 3,
              status: 'done',
              failedAt: null,
              error: null,
            },
      };
      return HttpResponse.json(body);
    },
  ),

  http.patch('*/api/v1/admin/super/tenants/:id', async ({ params, request }) => {
    const id = String(params.id);
    const detail = DETAIL_BY_ID.get(id);
    if (!detail) {
      return HttpResponse.json(
        { statusCode: 404, error: 'Not Found', message: 'Tenant not found' },
        { status: 404 },
      );
    }
    const patch = (await request.json()) as {
      name?: string;
      status?: 'active' | 'suspended';
      metadata?: Record<string, unknown>;
    };
    const updated: TenantDetail = {
      ...detail,
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      // metadata: shallow-merge to mirror server behaviour (Story 3-2 AC#5)
      ...(patch.metadata ? { metadata: { ...detail.metadata, ...patch.metadata } } : {}),
      // updatedAt: simulate server updating the timestamp on every PATCH
      updatedAt: new Date().toISOString(),
    };
    DETAIL_BY_ID.set(id, updated);
    const body: TenantPatchResponse = { data: updated };
    return HttpResponse.json(body);
  }),

  http.post('*/api/v1/admin/super/tenants/:id/retry', ({ params }) => {
    const id = String(params.id);
    const response: ProvisionTenantResponse = {
      data: { tenantId: id, status: 'provisioning' },
    };
    return HttpResponse.json(response, { status: 202 });
  }),
];
