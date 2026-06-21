import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationSilence } from '../use-notification-silence';

const SILENCE_KEY = 'metanoia:notificationSilence';

describe('useNotificationSilence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts as false when localStorage is empty', () => {
    const { result } = renderHook(() => useNotificationSilence());
    expect(result.current.silenced).toBe(false);
  });

  it('starts as true when localStorage has true', () => {
    localStorage.setItem(SILENCE_KEY, 'true');
    const { result } = renderHook(() => useNotificationSilence());
    expect(result.current.silenced).toBe(true);
  });

  it('setSilenced(true) updates state and localStorage', () => {
    const { result } = renderHook(() => useNotificationSilence());
    act(() => {
      result.current.setSilenced(true);
    });
    expect(result.current.silenced).toBe(true);
    expect(localStorage.getItem(SILENCE_KEY)).toBe('true');
  });

  it('setSilenced(false) updates state and localStorage', () => {
    localStorage.setItem(SILENCE_KEY, 'true');
    const { result } = renderHook(() => useNotificationSilence());
    act(() => {
      result.current.setSilenced(false);
    });
    expect(result.current.silenced).toBe(false);
    expect(localStorage.getItem(SILENCE_KEY)).toBe('false');
  });

  it('toggle false→true→false', () => {
    const { result } = renderHook(() => useNotificationSilence());
    expect(result.current.silenced).toBe(false);
    act(() => result.current.setSilenced(true));
    expect(result.current.silenced).toBe(true);
    act(() => result.current.setSilenced(false));
    expect(result.current.silenced).toBe(false);
  });

  it('syncs cross-tab via storage event', () => {
    const { result } = renderHook(() => useNotificationSilence());
    expect(result.current.silenced).toBe(false);

    act(() => {
      // Simulate another tab setting silence=true
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SILENCE_KEY,
          newValue: 'true',
          oldValue: 'false',
          storageArea: localStorage,
        }),
      );
    });

    expect(result.current.silenced).toBe(true);
  });
});
