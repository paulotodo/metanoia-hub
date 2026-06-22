'use client';

import { useState, useId } from 'react';
import type { IntegrationHealthHistoryPoint } from '@metanoia/types';

interface LatencySparklineProps {
  data: IntegrationHealthHistoryPoint[];
  integrationName: string;
  /** Altura do SVG em pixels (default: 40) */
  height?: number;
  /** Largura do SVG em pixels (default: 120) */
  width?: number;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: '#10b981',   // green-500
  degraded: '#f59e0b',  // yellow-500
  unhealthy: '#ef4444', // red-500
};

/**
 * LatencySparkline — sparkline SVG inline de latência 24h.
 *
 * Story 14-4 §FR-010, §D-006.
 * Acessibilidade:
 *  - role="img" + aria-label (CHK076)
 *  - <title> como primeiro filho do SVG (CHK076)
 *  - Tooltip com teclado: Tab/focus + Enter/Space (CHK077)
 *  - Empty state quando data.length === 0 (CHK088)
 *  - motion-safe nas transições (CHK075)
 *  - focus-ring ring-brand-teal/30 (design system)
 */
export function LatencySparkline({
  data,
  integrationName,
  height = 40,
  width = 120,
}: LatencySparklineProps) {
  const titleId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // ---- Empty state -------------------------------------------------------
  if (data.length === 0) {
    return (
      <p role="status" className="text-xs text-muted-foreground italic">
        Sem histórico de latência disponível
      </p>
    );
  }

  // ---- Normalização das coordenadas Y ------------------------------------
  const latencies = data
    .map((p) => p.latencyMs)
    .filter((v): v is number => v !== null);

  const maxLatency = Math.max(...latencies, 1);
  const points = data.slice(0, 288); // máximo 288 pontos (24h * 12/h)

  const xStep = width / Math.max(points.length - 1, 1);

  function toX(i: number): number {
    return i * xStep;
  }

  function toY(latencyMs: number | null): number {
    if (latencyMs === null) return height; // ponto no fundo (timeout)
    return height - (latencyMs / maxLatency) * (height - 4) - 2;
  }

  // Polyline path
  const polylinePoints = points
    .map((p, i) => `${toX(i).toFixed(1)},${toY(p.latencyMs).toFixed(1)}`)
    .join(' ');

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;
  const hoveredStatus = hovered?.status ?? 'healthy';
  const hoveredColor = STATUS_COLORS[hoveredStatus] ?? STATUS_COLORS['healthy'];

  return (
    <div className="relative inline-block">
      <svg
        role="img"
        aria-labelledby={titleId}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 rounded"
        tabIndex={0}
        onKeyDown={(e) => {
          // CHK077: navegação por teclado entre pontos
          if (e.key === 'ArrowRight') {
            setHoveredIndex((prev) =>
              prev === null ? 0 : Math.min(prev + 1, points.length - 1),
            );
          } else if (e.key === 'ArrowLeft') {
            setHoveredIndex((prev) =>
              prev === null ? points.length - 1 : Math.max(prev - 1, 0),
            );
          } else if (e.key === 'Escape') {
            setHoveredIndex(null);
          }
        }}
        onBlur={() => setHoveredIndex(null)}
      >
        {/* CHK076: <title> como primeiro filho obrigatório para leitores de tela */}
        <title id={titleId}>
          {integrationName}: histórico de latência 24h — {points.length} pontos
        </title>

        {/* Linha do sparkline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="motion-safe:transition-all"
        />

        {/* Pontos interativos */}
        {points.map((p, i) => {
          const cx = toX(i);
          const cy = toY(p.latencyMs);
          const color = STATUS_COLORS[p.status] ?? STATUS_COLORS['healthy'];
          const isHovered = hoveredIndex === i;

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={isHovered ? 4 : 2}
              fill={color}
              className="motion-safe:transition-all cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              role="presentation"
            />
          );
        })}
      </svg>

      {/* Tooltip: visível em hover ou foco por teclado (CHK077) */}
      {hovered && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-md pointer-events-none"
          style={{ borderColor: hoveredColor }}
        >
          <span className="font-medium" style={{ color: hoveredColor }}>
            {hovered.status}
          </span>
          {' · '}
          {hovered.latencyMs !== null ? `${hovered.latencyMs}ms` : 'timeout'}
          {' · '}
          {new Date(hovered.checkedAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
}
