import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AttendanceLiveEvent } from "@metanoia/types";
import { LiveAttendancePanel } from "../live-attendance-panel";

const MEETING = "019756c0-0002-7000-8000-000000000002";

interface FakeEventSource {
  url: string;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: (() => void) | null;
  close: () => void;
}

let currentSource: FakeEventSource | null = null;

class FakeEventSourceCtor implements FakeEventSource {
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    setCurrent(this);
  }
  close() {
    this.closed = true;
  }
}

function setCurrent(s: FakeEventSourceCtor): void {
  currentSource = s;
}

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSourceCtor);
  currentSource = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function emit(event: AttendanceLiveEvent) {
  act(() => {
    currentSource?.onmessage?.({ data: JSON.stringify(event) });
  });
}

describe("LiveAttendancePanel", () => {
  it("renders empty state before any SSE event arrives", () => {
    render(<LiveAttendancePanel meetingId={MEETING} />);
    expect(screen.getByText(/Aguardando participantes/i)).toBeTruthy();
  });

  it("renders participants from the initial snapshot", () => {
    render(<LiveAttendancePanel meetingId={MEETING} />);
    emit({
      type: "snapshot",
      meetingId: MEETING,
      capturedAt: "2026-04-20T19:35:00.000Z",
      participants: [
        {
          userId: "u-1",
          name: "Ana",
          status: "na-sala",
          currentDurationSeconds: 180,
          cameraOn: true,
          joinedAt: "2026-04-20T19:32:00.000Z",
          leftAt: null,
        },
      ],
    });
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText(/Na sala · Câmera ligada/i)).toBeTruthy();
    expect(screen.getByText(/^3m$/)).toBeTruthy();
  });

  it("applies participant.joined delta after snapshot", () => {
    render(<LiveAttendancePanel meetingId={MEETING} />);
    emit({
      type: "snapshot",
      meetingId: MEETING,
      capturedAt: "2026-04-20T19:35:00.000Z",
      participants: [],
    });
    emit({
      type: "participant.joined",
      meetingId: MEETING,
      userId: "u-2",
      timestamp: "2026-04-20T19:36:00.000Z",
    });
    expect(screen.getByText("u-2")).toBeTruthy();
  });

  it("marks participant as 'saiu' on participant.left delta", () => {
    render(<LiveAttendancePanel meetingId={MEETING} />);
    emit({
      type: "snapshot",
      meetingId: MEETING,
      capturedAt: "2026-04-20T19:35:00.000Z",
      participants: [
        {
          userId: "u-1",
          name: "Ana",
          status: "na-sala",
          currentDurationSeconds: 60,
          cameraOn: true,
          joinedAt: "2026-04-20T19:34:00.000Z",
          leftAt: null,
        },
      ],
    });
    emit({
      type: "participant.left",
      meetingId: MEETING,
      userId: "u-1",
      timestamp: "2026-04-20T19:36:00.000Z",
    });
    expect(screen.getByText(/Saiu · /i)).toBeTruthy();
  });

  it("shows error message on SSE failure (server returned 403 or network down)", () => {
    render(<LiveAttendancePanel meetingId={MEETING} />);
    act(() => {
      currentSource?.onerror?.();
    });
    expect(screen.getByTestId("live-attendance-error")).toBeTruthy();
  });
});
