import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoPlayer } from './video-player';

// ---------------------------------------------------------------------------
// VideoPlayer a11y spec — FR-009, FR-010
// Note: jest-axe skipped for <video> element due to JSDOM media API limitations
// (HTMLMediaElement methods hang in JSDOM). Accessibility is validated via the
// axe-quality-gate E2E spec against real browser Chromium.
// ---------------------------------------------------------------------------

describe('VideoPlayer', () => {
  it('renders video element with data-testid', () => {
    render(<VideoPlayer signedUrl="https://example.com/video.mp4" />);
    expect(screen.getByTestId('video-player')).toBeTruthy();
  });

  it('aria-label defaults to "Vídeo da aula" when title is absent (FR-009)', () => {
    render(<VideoPlayer signedUrl="https://example.com/video.mp4" />);
    const video = screen.getByTestId('video-player');
    expect(video.getAttribute('aria-label')).toBe('Vídeo da aula');
  });

  it('aria-label is "Vídeo: {title}" when title is provided (FR-009)', () => {
    render(
      <VideoPlayer signedUrl="https://example.com/video.mp4" title="Introdução à Oração" />,
    );
    const video = screen.getByTestId('video-player');
    expect(video.getAttribute('aria-label')).toBe('Vídeo: Introdução à Oração');
  });

  it('has a static aria-live polite region always in DOM (FR-010)', () => {
    const { container } = render(<VideoPlayer signedUrl="https://example.com/video.mp4" />);
    const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
  });

  it('calls onVideoEnded callback when video ended event fires (FR-010)', () => {
    const onVideoEnded = vi.fn();
    render(
      <VideoPlayer signedUrl="https://example.com/video.mp4" onVideoEnded={onVideoEnded} />,
    );
    const video = screen.getByTestId('video-player');
    fireEvent.ended(video);
    expect(onVideoEnded).toHaveBeenCalledOnce();
  });

  it('video has controls attribute for keyboard navigation', () => {
    render(<VideoPlayer signedUrl="https://example.com/video.mp4" />);
    const video = screen.getByTestId('video-player');
    expect(video.hasAttribute('controls')).toBe(true);
  });
});
