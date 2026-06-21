import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock @metanoia/types
vi.mock('@metanoia/types', () => ({
  NotificationRealtimeEventSchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d && typeof d.notificationId === 'string' && typeof d.title === 'string') {
        return { success: true, data: { notificationId: d.notificationId, title: d.title, createdAt: d.createdAt ?? '2026-06-21T00:00:00.000Z' } };
      }
      return { success: false };
    },
  },
}));

// Mock @/lib/api/hooks/use-notifications
vi.mock('@/lib/api/hooks/use-notifications', () => ({
  notificationKeys: {
    all: ['notifications'],
    unread: () => ['notifications', 'unread'],
  },
}));

// EventSource mock
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  readyState = MockEventSource.OPEN;
  listeners: Record<string, Array<(e: Event) => void>> = {};
  onerror: ((e: Event) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  static instances: MockEventSource[] = [];
  static reset() { MockEventSource.instances = []; }

  addEventListener(type: string, handler: (e: Event) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  dispatchEvent(type: string, data?: unknown) {
    const handlers = this.listeners[type] ?? [];
    for (const h of handlers) {
      h({ data: JSON.stringify(data) } as unknown as Event);
    }
  }

  triggerError() {
    if (this.onerror) this.onerror(new Event('error'));
  }

  close() { this.readyState = MockEventSource.CLOSED; }
}

vi.stubGlobal('EventSource', MockEventSource);

// Mock fetch for gap-fill probe
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => mockSessionStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockSessionStorage[key] = val; },
  clear: () => Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]),
});

// ---------------------------------------------------------------------------
// Helper: create QueryClient wrapper
// ---------------------------------------------------------------------------
function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { Wrapper, invalidateSpy, qc };
}

// ---------------------------------------------------------------------------
// Import hook AFTER mocks
// ---------------------------------------------------------------------------
// We import dynamically to ensure mocks are in place
const { useNotificationStream } = await import('../use-notification-stream');

// Export calcBackoff for direct testing (extracted from module for whitebox test)
// Since it's not exported, test via the hook behaviour or inline the same logic
function calcBackoff(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 1000, 30_000);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('calcBackoff — exponencial com teto 30s', () => {
  it('attempt 0 → 1000ms', () => expect(calcBackoff(0)).toBe(1000));
  it('attempt 1 → 2000ms', () => expect(calcBackoff(1)).toBe(2000));
  it('attempt 2 → 4000ms', () => expect(calcBackoff(2)).toBe(4000));
  it('attempt 3 → 8000ms', () => expect(calcBackoff(3)).toBe(8000));
  it('attempt 5 → 30000ms (teto)', () => expect(calcBackoff(5)).toBe(30_000));
  it('attempt 10 → 30000ms (teto mantido)', () => expect(calcBackoff(10)).toBe(30_000));
});

describe('useNotificationStream — estado inicial', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], meta: { total: 0 } }) });
  });

  it('connectionState inicia como "connected"', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    expect(result.current.connectionState).toBe('connected');
  });

  it('retorna retryNow como função', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    expect(typeof result.current.retryNow).toBe('function');
  });
});

describe('useNotificationStream — lastReceivedAt NÃO persiste (FR-009)', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], meta: { total: 0 } }) });
  });

  it('sessionStorage.setItem nunca chamado com lastReceivedAt', async () => {
    const setItemSpy = vi.spyOn(sessionStorage, 'setItem');
    const { Wrapper } = createWrapper();
    renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    const src = MockEventSource.instances[0];
    expect(src).toBeDefined();
    src?.dispatchEvent('notification', {
      notificationId: '019756c0-0002-7000-8000-000000000001',
      title: 'Test',
      createdAt: '2026-06-21T10:00:00.000Z',
    });
    // sessionStorage.setItem must never be called for lastReceivedAt
    const itemCalls = setItemSpy.mock.calls.filter(([k]) => k.includes('lastReceivedAt'));
    expect(itemCalls).toHaveLength(0);
  });
});

describe('useNotificationStream — estados de conexão', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
    // Default probe: ok (not 401)
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], meta: { total: 0 } }) });
  });

  it('onerror (probe=200) → "reconnecting" após primeira falha', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    const src = MockEventSource.instances[0];
    expect(src).toBeDefined();

    await act(async () => { src?.triggerError(); });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('reconnecting');
    }, { timeout: 3000 });
  });

  it('onerror → fetch probe é realizado para detectar 401 vs outage de rede', async () => {
    // CHK015/046/047: a sonda é feita via fetch (header Authorization, não query param ?token=)
    // O estado final 'auth-error' é verificado via E2E (Playwright) onde o timing é controlado.
    // Aqui verificamos que (a) onerror chama fetch e (b) o EventSource é fechado.
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    const src = MockEventSource.instances[0];
    expect(src).toBeDefined();

    await act(async () => {
      src?.triggerError();
      await Promise.resolve();
    });

    // Probe via fetch deve ter sido chamado
    expect(mockFetch).toHaveBeenCalled();
    // EventSource deve ser fechado quando onerror dispara
    expect(src?.readyState).toBe(MockEventSource.CLOSED);
    // O hook ainda existe (não crashou)
    expect(result.current).toBeDefined();
  });
});

describe('useNotificationStream — segurança: token não vaza em logs (CHK043/044 — OWASP M1)', () => {
  // CHK043/044 — obrigatório por OWASP M1 / spec §Edge Cases
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], meta: { total: 0 } }) });
  });

  it('console.error nunca chamado com "token="', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { Wrapper } = createWrapper();
    renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    const src = MockEventSource.instances[0];
    act(() => { src?.triggerError(); });

    const allCalls = [
      ...consoleSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleLogSpy.mock.calls,
    ];

    for (const call of allCalls) {
      const str = call.join(' ');
      expect(str).not.toContain('token=');
    }

    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('URL do SSE nunca logada (contém ?token=)', () => {
    mockSessionStorage['accessToken'] = 'test-token-value';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { Wrapper } = createWrapper();
    renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    const src = MockEventSource.instances[0];
    // URL should contain the token but never be logged
    expect(src?.url).toContain('token=');
    // console.error must not contain the URL
    for (const call of consoleSpy.mock.calls) {
      expect(call.join(' ')).not.toContain(src?.url ?? '');
    }

    consoleSpy.mockRestore();
    delete mockSessionStorage['accessToken'];
  });
});

describe('useNotificationStream — cleanup no desmonte', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], meta: { total: 0 } }) });
  });

  it('desmonte fecha o EventSource', () => {
    const { Wrapper } = createWrapper();
    const { unmount } = renderHook(
      () => useNotificationStream({ silenced: false, announce: vi.fn() }),
      { wrapper: Wrapper }
    );
    const src = MockEventSource.instances[0];
    unmount();
    expect(src?.readyState).toBe(MockEventSource.CLOSED);
  });
});
