'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  /** Presigned URL for the video file (4h expiry) */
  signedUrl: string;
  /** Optional accessible title for the video */
  title?: string;
  className?: string;
}

/**
 * VideoPlayer — reprodutor de vídeo inline para aulas de discipulado.
 * Usa elemento <video> nativo para compatibilidade máxima e performance.
 * A URL já deve ser a signed URL (gerada pelo backend, expiração 4h).
 */
export function VideoPlayer({ signedUrl, title, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [signedUrl]);

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center justify-center rounded-lg bg-muted p-8 text-muted-foreground"
      >
        Não foi possível carregar o vídeo. Tente novamente em instantes.
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={signedUrl}
      controls
      preload="metadata"
      aria-label={title ?? 'Vídeo da aula'}
      className={className ?? 'w-full rounded-lg'}
      onError={() => setError(true)}
      data-testid="video-player"
    >
      <p>Seu navegador não suporta reprodução de vídeo inline.</p>
    </video>
  );
}
