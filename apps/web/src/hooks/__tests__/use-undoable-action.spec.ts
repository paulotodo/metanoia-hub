import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoableAction } from '../use-undoable-action';

describe('useUndoableAction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts inactive with full countdown', () => {
    const { result } = renderHook(() => useUndoableAction({ countdownSeconds: 5 }));
    expect(result.current.isActive).toBe(false);
    expect(result.current.countdown).toBe(5);
  });

  it('becomes active after start()', () => {
    const { result } = renderHook(() => useUndoableAction({ countdownSeconds: 5 }));
    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);
    expect(result.current.countdown).toBe(5);
  });

  it('decrements countdown each second', () => {
    const { result } = renderHook(() => useUndoableAction({ countdownSeconds: 5 }));
    act(() => result.current.start());

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.countdown).toBe(4);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.countdown).toBe(2);
  });

  it('calls onCommit and deactivates when countdown reaches 0', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({ countdownSeconds: 3, onCommit }),
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));

    expect(onCommit).toHaveBeenCalledOnce();
    expect(result.current.isActive).toBe(false);
  });

  it('cancel() stops countdown and resets state', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({ countdownSeconds: 5, onCommit }),
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.cancel());

    expect(result.current.isActive).toBe(false);
    expect(result.current.countdown).toBe(5);

    // Advance time: onCommit should NOT be called after cancel
    act(() => vi.advanceTimersByTime(5000));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('start() restarts the countdown if already active', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({ countdownSeconds: 5, onCommit }),
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));

    // Restart — countdown resets to 5
    act(() => result.current.start());
    expect(result.current.countdown).toBe(5);

    // Original timer must not trigger onCommit anymore
    act(() => vi.advanceTimersByTime(3000));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('respects custom countdownSeconds', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({ countdownSeconds: 10, onCommit }),
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(9000));
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
