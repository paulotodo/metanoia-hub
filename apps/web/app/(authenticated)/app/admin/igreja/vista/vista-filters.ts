import type { GroupCard, PastoralStatus } from '@metanoia/types';

export const VISTA_FILTERS = ['all', 'atencao', 'sem-sinal'] as const;
export type VistaFilter = (typeof VISTA_FILTERS)[number];

export function parseFilter(raw: string | null | undefined): VistaFilter {
  if (raw === 'atencao' || raw === 'sem-sinal') return raw;
  return 'all';
}

const FILTER_STATUS_MAP: Record<VistaFilter, PastoralStatus[] | null> = {
  all: null,
  atencao: ['attention', 'call'],
  'sem-sinal': ['no-signal'],
};

export function filterGroups(
  groups: GroupCard[],
  filter: VistaFilter,
): GroupCard[] {
  const allowed = FILTER_STATUS_MAP[filter];
  if (!allowed) return groups;
  return groups.filter((g) => allowed.includes(g.status));
}
