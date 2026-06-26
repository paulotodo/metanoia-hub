'use client';

/**
 * PlyrVideoPlayer — accessible video player built on Plyr.
 *
 * Features:
 * - PT-BR i18n via Plyr's i18n config
 * - Keyboard shortcuts panel (toggle with '?' key)
 * - Accessible controls with aria-labels
 * - Focus management on video end (→ nextButtonRef)
 * - useVideoProgress tracking (reuse hook)
 * - motion-safe: no animations added (reduces vestibular risk)
 *
 * Note: this component is imported via dynamic() with { ssr: false }
 * because Plyr requires the DOM to be available.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Plyr from 'plyr';
import { useVideoProgress } from '../../hooks/use-video-progress';

// ---------------------------------------------------------------------------
// PT-BR i18n for Plyr controls
// ---------------------------------------------------------------------------
const PLYR_I18N_PT_BR = {
  restart: 'Reiniciar',
  rewind: 'Voltar {seektime}s',
  play: 'Reproduzir',
  pause: 'Pausar',
  fastForward: 'Avançar {seektime}s',
  seek: 'Seek',
  seekLabel: '{currentTime} de {duration}',
  played: 'Reproduzido',
  buffered: 'Carregado',
  currentTime: 'Tempo atual',
  duration: 'Duração',
  volume: 'Volume',
  mute: 'Silenciar',
  unmute: 'Ativar som',
  enableCaptions: 'Ativar legendas',
  disableCaptions: 'Desativar legendas',
  download: 'Baixar',
  enterFullscreen: 'Tela cheia',
  exitFullscreen: 'Sair da tela cheia',
  frameTitle: 'Player para {title}',
  captions: 'Legendas',
  settings: 'Configurações',
  pip: 'PiP',
  menuBack: 'Voltar ao menu',
  speed: 'Velocidade',
  normal: 'Normal',
  quality: 'Qualidade',
  loop: 'Repetir',
  start: 'Início',
  end: 'Fim',
  all: 'Todos',
  reset: 'Redefinir',
  disabled: 'Desativado',
  enabled: 'Ativado',
  advertisement: 'Anúncio',
  qualityBadge: {
    2160: '4K',
    1440: 'HD',
    1080: 'HD',
    720: 'HD',
    576: 'SD',
    480: 'SD',
  },
};

// ---------------------------------------------------------------------------
// Keyboard shortcuts for the '?' panel
// ---------------------------------------------------------------------------
const KEYBOARD_SHORTCUTS = [
  { key: 'Espaço / K', action: 'Reproduzir / Pausar' },
  { key: '← / →', action: 'Voltar / Avançar 10s' },
  { key: '↑ / ↓', action: 'Volume +10% / -10%' },
  { key: 'F', action: 'Tela cheia' },
  { key: 'M', action: 'Silenciar / Ativar som' },
  { key: 'C', action: 'Legendas' },
  { key: '?', action: 'Mostrar / Ocultar atalhos' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface PlyrVideoPlayerProps {
  /** Video source URL */
  src: string;
  /** Accessible title for the player */
  title: string;
  /** Total video duration in seconds (for progress tracking) */
  durationSeconds?: number;
  /** Called when progress updates with unique watched % */
  onProgress?: (percent: number) => void;
  /** Ref to "Next lesson" button — receives focus when video ends */
  nextButtonRef?: React.RefObject<HTMLAnchorElement | HTMLButtonElement | null>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PlyrVideoPlayer({
  src,
  title,
  durationSeconds = 0,
  onProgress,
  nextButtonRef,
  className,
}: PlyrVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsPanelId = 'plyr-shortcuts-panel';

  // Video progress tracking (reuse hook)
  const { videoRef: progressVideoRef } = useVideoProgress({
    totalDurationSeconds: durationSeconds,
    onProgress: (percent) => onProgress?.(percent),
  });

  // Sync progress hook ref with our video ref
  useEffect(() => {
    if (videoRef.current) {
      // Type cast: useVideoProgress's videoRef accepts HTMLVideoElement | null
      (progressVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current =
        videoRef.current;
    }
  }, [progressVideoRef]);

  // Initialize Plyr
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const player = new Plyr(video, {
      i18n: PLYR_I18N_PT_BR,
      controls: [
        'play-large',
        'play',
        'rewind',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'captions',
        'settings',
        'fullscreen',
      ],
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
    });

    plyrRef.current = player;

    // Focus next button on video end
    player.on('ended', () => {
      const ref = nextButtonRef?.current;
      if (ref) {
        ref.focus();
      }
    });

    return () => {
      player.destroy();
      plyrRef.current = null;
    };
  }, [src, nextButtonRef]);

  // Keyboard shortcut: '?' toggles shortcut panel
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '?') {
      e.preventDefault();
      setShowShortcuts((v) => !v);
    }
    if (e.key === 'Escape' && showShortcuts) {
      setShowShortcuts(false);
    }
  }, [showShortcuts]);

  return (
    <div
      className={`relative ${className ?? ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Native video element — Plyr enhances it */}
      <video
        ref={videoRef}
        src={src}
        aria-label={title}
        className="w-full rounded-lg"
        playsInline
      />

      {/* Shortcut hint button */}
      <button
        type="button"
        aria-expanded={showShortcuts}
        aria-controls={shortcutsPanelId}
        aria-label="Atalhos de teclado (pressione ?)"
        onClick={() => setShowShortcuts((v) => !v)}
        className="absolute top-2 right-2 z-20 rounded bg-black/60 px-2 py-1 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-safe:transition-opacity"
      >
        ?
      </button>

      {/* Keyboard shortcuts panel */}
      {showShortcuts && (
        <div
          id={shortcutsPanelId}
          role="dialog"
          aria-label="Atalhos de teclado"
          aria-modal="false"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 rounded-lg"
        >
          <div className="bg-surface-primary rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-lg font-bold text-text-primary mb-4">Atalhos de teclado</h2>
            <dl className="space-y-2">
              {KEYBOARD_SHORTCUTS.map(({ key, action }) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt>
                    <kbd className="rounded border border-border-default bg-surface-secondary px-2 py-0.5 text-xs font-mono text-text-primary">
                      {key}
                    </kbd>
                  </dt>
                  <dd className="text-sm text-text-secondary">{action}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="mt-4 w-full rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 motion-safe:transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
