import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useActiveTenantId } from '../use-active-tenant-id';

const STORAGE_KEY = 'metanoia:activeTenantId';

describe('useActiveTenantId', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads existing value from localStorage on mount', () => {
    window.localStorage.setItem(STORAGE_KEY, 'tenant-abc');
    const { result } = renderHook(() => useActiveTenantId());
    expect(result.current.activeTenantId).toBe('tenant-abc');
  });

  it('sets and persists a new value', () => {
    const { result } = renderHook(() => useActiveTenantId());
    act(() => result.current.setActiveTenantId('tenant-xyz'));
    expect(result.current.activeTenantId).toBe('tenant-xyz');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('tenant-xyz');
  });

  it('clears value when setActiveTenantId(null) is called', () => {
    window.localStorage.setItem(STORAGE_KEY, 'tenant-abc');
    const { result } = renderHook(() => useActiveTenantId());
    act(() => result.current.setActiveTenantId(null));
    expect(result.current.activeTenantId).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
