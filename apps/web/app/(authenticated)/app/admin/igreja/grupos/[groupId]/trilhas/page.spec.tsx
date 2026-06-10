import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock TanStack Query hooks — isolates page rendering from network
// ---------------------------------------------------------------------------
vi.mock('../../../../../../../../src/lib/api/hooks', () => ({
  useGroupTrails: vi.fn(),
  useAssociateTrails: vi.fn(),
  useUnassignTrail: vi.fn(),
}));

import {
  useGroupTrails,
  useAssociateTrails,
  useUnassignTrail,
} from '../../../../../../../../src/lib/api/hooks';
import { GroupTrailsClient } from './group-trails-client';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const GROUP_ID = '019756c0-0001-7000-8000-000000000070';

const mockTrail = {
  id: '019756c0-0001-7000-8000-000000000060',
  tenantId: '019756c0-0001-7000-8000-000000000002',
  groupId: GROUP_ID,
  trailId: '019756c0-0001-7000-8000-000000000010',
  assignedBy: '019756c0-0001-7000-8000-000000000003',
  assignedAt: '2026-06-10T10:00:00.000Z',
};

describe('GroupTrailsClient', () => {
  beforeEach(() => {
    vi.mocked(useGroupTrails).mockReturnValue({
      data: { data: [mockTrail], meta: { total: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useGroupTrails>);

    vi.mocked(useAssociateTrails).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: [mockTrail], meta: { created: 1 } }),
      isPending: false,
    } as unknown as ReturnType<typeof useAssociateTrails>);

    vi.mocked(useUnassignTrail).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as unknown as ReturnType<typeof useUnassignTrail>);
  });

  it('renders the page heading and trail list', () => {
    renderWithClient(<GroupTrailsClient groupId={GROUP_ID} />);

    expect(screen.getByRole('heading', { name: /trilhas do grupo/i })).toBeTruthy();
    expect(screen.getByText(new RegExp(mockTrail.trailId, 'i'))).toBeTruthy();
  });

  it('renders empty state when no trails', () => {
    vi.mocked(useGroupTrails).mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useGroupTrails>);

    renderWithClient(<GroupTrailsClient groupId={GROUP_ID} />);
    expect(screen.getByText(/nenhuma trilha/i)).toBeTruthy();
  });

  it('renders loading skeleton without crashing', () => {
    vi.mocked(useGroupTrails).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useGroupTrails>);

    renderWithClient(<GroupTrailsClient groupId={GROUP_ID} />);
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.queryByText(/nenhuma trilha/i)).toBeNull();
  });

  it('shows error state and retry button', () => {
    vi.mocked(useGroupTrails).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as ReturnType<typeof useGroupTrails>);

    renderWithClient(<GroupTrailsClient groupId={GROUP_ID} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy();
  });

  it('submits the associate form', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      data: [mockTrail],
      meta: { created: 1 },
    });
    vi.mocked(useAssociateTrails).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useAssociateTrails>);

    renderWithClient(<GroupTrailsClient groupId={GROUP_ID} />);

    const input = screen.getByLabelText(/cole os ids/i);
    const button = screen.getByRole('button', { name: /^associar$/i });

    fireEvent.change(input, { target: { value: mockTrail.trailId } });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      trailIds: [mockTrail.trailId],
    });
  });

  it('remove button is present for each trail', () => {
    renderWithClient(<GroupTrailsClient groupId={GROUP_ID} />);
    const removeBtn = screen.getByRole('button', {
      name: new RegExp(`Remover trilha ${mockTrail.trailId}`, 'i'),
    });
    expect(removeBtn).toBeTruthy();
  });
});
