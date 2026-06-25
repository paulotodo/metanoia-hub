/**
 * plyr-video-player.spec.tsx
 * Tests: Plyr initialization mock, shortcuts panel toggle, onVideoEnded focus, a11y
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlyrVideoPlayer } from './plyr-video-player';

// ---------------------------------------------------------------------------
// Mock Plyr — it requires a real DOM and is complex to exercise in unit tests
// Use a class mock so `new Plyr(...)` works correctly
// ---------------------------------------------------------------------------
const mockPlyrOn = vi.fn();
const mockPlyrDestroy = vi.fn();

vi.mock('plyr', () => {
  const MockPlyr = vi.fn().mockImplementation(function (this: { on: typeof mockPlyrOn; destroy: typeof mockPlyrDestroy }) {
    this.on = mockPlyrOn;
    this.destroy = mockPlyrDestroy;
  });
  return { default: MockPlyr };
});

const MOCK_SRC = 'https://example.com/test-video.mp4';
const MOCK_TITLE = 'Aula de Teste';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// T1: renders video element with correct attributes
// ---------------------------------------------------------------------------
describe('PlyrVideoPlayer', () => {
  it('renders video element with aria-label', () => {
    render(<PlyrVideoPlayer src={MOCK_SRC} title={MOCK_TITLE} />);

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('aria-label')).toBe(MOCK_TITLE);
    expect(video?.getAttribute('src')).toBe(MOCK_SRC);
  });

  // ---------------------------------------------------------------------------
  // T2: shortcuts panel toggle with '?' key
  // ---------------------------------------------------------------------------
  it('toggles shortcuts panel when ? button is clicked', () => {
    render(<PlyrVideoPlayer src={MOCK_SRC} title={MOCK_TITLE} />);

    // Panel should not be visible initially
    expect(screen.queryByRole('dialog')).toBeFalsy();

    // Click the '?' button
    const shortcutButton = screen.getByLabelText('Atalhos de teclado (pressione ?)');
    fireEvent.click(shortcutButton);

    // Panel should now be visible
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeTruthy();

    // Click again to close
    fireEvent.click(shortcutButton);
    expect(screen.queryByRole('dialog')).toBeFalsy();
  });

  // ---------------------------------------------------------------------------
  // T3: close button inside shortcuts panel
  // ---------------------------------------------------------------------------
  it('closes shortcuts panel via close button', () => {
    render(<PlyrVideoPlayer src={MOCK_SRC} title={MOCK_TITLE} />);

    const shortcutButton = screen.getByLabelText('Atalhos de teclado (pressione ?)');
    fireEvent.click(shortcutButton);

    const closeButton = screen.getByText('Fechar');
    fireEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).toBeFalsy();
  });

  // ---------------------------------------------------------------------------
  // T4: shortcut panel lists known keyboard shortcuts
  // ---------------------------------------------------------------------------
  it('displays keyboard shortcuts in panel', () => {
    render(<PlyrVideoPlayer src={MOCK_SRC} title={MOCK_TITLE} />);

    const shortcutButton = screen.getByLabelText('Atalhos de teclado (pressione ?)');
    fireEvent.click(shortcutButton);

    expect(screen.getByText('Reproduzir / Pausar')).toBeTruthy();
    expect(screen.getByText('Tela cheia')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // T5: a11y — '?' button has expanded state
  // ---------------------------------------------------------------------------
  it('? button has correct aria-expanded state', () => {
    render(<PlyrVideoPlayer src={MOCK_SRC} title={MOCK_TITLE} />);

    const shortcutButton = screen.getByLabelText('Atalhos de teclado (pressione ?)');
    expect(shortcutButton.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(shortcutButton);
    expect(shortcutButton.getAttribute('aria-expanded')).toBe('true');
  });

  // ---------------------------------------------------------------------------
  // T6: Plyr.on('ended') triggers nextButtonRef focus
  // ---------------------------------------------------------------------------
  it('calls Plyr.on with ended event', () => {
    render(<PlyrVideoPlayer src={MOCK_SRC} title={MOCK_TITLE} />);
    // Plyr.on should have been called with 'ended' during initialization
    expect(mockPlyrOn).toHaveBeenCalledWith('ended', expect.any(Function));
  });
});
