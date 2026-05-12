import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useFocusHeartbeat } from "../use-focus-heartbeat";

const MEETING = "019756c0-0002-7000-8000-000000000002";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useFocusHeartbeat", () => {
  it("is a no-op when enabled=false (toggle OFF, NFR-L4)", () => {
    renderHook(() =>
      useFocusHeartbeat({
        meetingId: MEETING,
        enabled: false,
        bannerShown: true,
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is a no-op when bannerShown=false (privacy gate, AC2)", () => {
    renderHook(() =>
      useFocusHeartbeat({
        meetingId: MEETING,
        enabled: true,
        bannerShown: false,
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fires one heartbeat immediately when enabled+banner shown", () => {
    renderHook(() =>
      useFocusHeartbeat({
        meetingId: MEETING,
        enabled: true,
        bannerShown: true,
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const firstCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!firstCall) throw new Error('fetch was not called');
    const [url, init] = firstCall;
    expect(url).toContain(`/meetings/${MEETING}/focus-heartbeat`);
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.visible).toBe(true);
    expect(typeof body.timestamp).toBe("string");
  });

  it("fires another heartbeat after 30s interval", () => {
    renderHook(() =>
      useFocusHeartbeat({
        meetingId: MEETING,
        enabled: true,
        bannerShown: true,
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stops firing when unmounted", () => {
    const { unmount } = renderHook(() =>
      useFocusHeartbeat({
        meetingId: MEETING,
        enabled: true,
        bannerShown: true,
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
