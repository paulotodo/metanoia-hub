'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  /** Presigned URL for the video file (4h expiry) */
  signedUrl: string;
  /** Optional accessible title for the video — renders "Vídeo: {title}" se fornecido (FR-009) */
  title?: string;
  /** Callback chamado quando o vídeo termina (para integração com ModuleCompletionAnnounce) */
  onVideoEnded?: () => void;
  /**
   * Ref opcional para o botão "Próximo módulo" — focus move para ele ao fim do vídeo.
   * Botão "Próximo módulo" não existe na UI atual de trilhas (follow-up 15.5).
   * Quando ausente, o foco retorna ao próprio <video> (FR-010).
   */
  nextModuleButtonRef?: React.RefObject<HTMLButtonElement>;
  className?: string;
}

/**
 * VideoPlayer — reprodutor de vídeo inline para aulas de discipulado.
 * Usa elemento <video> nativo para compatibilidade máxima e performance.
 * A URL já deve ser a signed URL (gerada pelo backend, expiração 4h).
 */
export function VideoPlayer({
  signedUrl,
  title,
  onVideoEnded,
  nextModuleButtonRef,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState(false);
  const [endedMessage, setEndedMessage] = useState('');

  useEffect(() => {
    setError(false);
  }, [signedUrl]);

  // Limpar timer de anúncio pendente ao desmontar (evita setState fora de tela)
  useEffect(() => {
    return () => {
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    };
  }, []);

  const handleEnded = useCallback(() => {
    // Mover foco: "Próximo módulo" se existir, senão retornar ao <video> (FR-010)
    // O botão "Próximo módulo" não existe na UI atual de trilhas (follow-up 15.5)
    if (nextModuleButtonRef?.current) {
      nextModuleButtonRef.current.focus();
    } else {
      videoRef.current?.focus();
    }

    // Anúncio polite via região aria-live estática (evita race de montagem condicional)
    setEndedMessage('Vídeo concluído.');

    // Notificar consumidor (ex: ModuleCompletionAnnounce no parent)
    onVideoEnded?.();

    // Limpar anúncio após 3s para evitar re-anúncios em re-renders.
    // Timer em ref + cleanup no unmount evita setState em componente desmontado.
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    endedTimerRef.current = setTimeout(() => setEndedMessage(''), 3000);
  }, [nextModuleButtonRef, onVideoEnded]);

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
    <div className="relative">
      {/* Região aria-live ESTÁTICA — sempre no DOM antes do vídeo terminar (evita race) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {endedMessage}
      </div>

      <video
        ref={videoRef}
        src={signedUrl}
        controls
        preload="metadata"
        aria-label={title ? `Vídeo: ${title}` : 'Vídeo da aula'}
        className={className ?? 'w-full rounded-lg'}
        onError={() => setError(true)}
        onEnded={handleEnded}
        data-testid="video-player"
      >
        <p>Seu navegador não suporta reprodução de vídeo inline.</p>
      </video>
    </div>
  );
}
