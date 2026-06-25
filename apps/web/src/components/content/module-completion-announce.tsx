'use client';

import { useEffect, useRef, useState } from 'react';

interface ModuleCompletionAnnounceProps {
  /** Mensagem a ser anunciada pelo screen reader. Vazio = sem anúncio ativo. */
  message: string;
}

/**
 * ModuleCompletionAnnounce — região aria-live estática para anúncio polite.
 *
 * O container deve estar SEMPRE no DOM antes de ser preenchido (região estática),
 * evitando race de montagem condicional com screen readers.
 *
 * Uso:
 *   const [msg, setMsg] = useState('');
 *   // Ao completar módulo:
 *   setMsg('Módulo Oração concluído! Progresso na trilha: 75%');
 *   // O componente limpa automaticamente após ~3s.
 */
export function ModuleCompletionAnnounce({ message }: ModuleCompletionAnnounceProps) {
  const [live, setLive] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;

    // Injetar mensagem no container estático
    setLive(message);

    // Limpar após 3s para evitar re-anúncios em re-renders
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLive(''), 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {live}
    </div>
  );
}
