"use client";

/**
 * group-trails-client.tsx — Builder de Trilhas (Cliente)
 *
 * Story 12.2 — US4, FR-012, FR-013, FR-014
 *
 * Componente cliente para gerenciar a lista de módulos/lições de uma trilha
 * associada a um grupo. Exibe os itens com drag-and-drop (mouse) e
 * botões de reordenação sempre visíveis (teclado) via `TrailItemReorder`.
 *
 * Decisão dec-014 (operador): botões "Mover ↑/↓" são SEMPRE VISÍVEIS em
 * cada item — alternativa de teclado ao drag-and-drop existente.
 *
 * FR-014: formulários de criação/edição de módulo e lição são navegáveis
 * por Tab com ordem lógica (top-to-bottom, left-to-right).
 */

import { useCallback, useState } from "react";
import { TrailItemReorder } from "@/components/trails/trail-item-reorder";
import { useAsyncAnnouncer } from "@/components/a11y/async-announcer";

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

export interface TrailModule {
  id: string;
  name: string;
  order: number;
  lessons: TrailLesson[];
}

export interface TrailLesson {
  id: string;
  moduleId: string;
  title: string;
  order: number;
}

export interface GroupTrailsClientProps {
  /** ID do grupo */
  groupId: string;
  /** ID da trilha */
  trailId: string;
  /** Nome da trilha — exibido no cabeçalho */
  trailName: string;
  /** Lista inicial de módulos (com lições aninhadas) */
  initialModules: TrailModule[];
  /**
   * Callback para persistir a nova ordem de módulos no servidor.
   * Recebe o array de IDs na nova ordem.
   */
  onReorderModules?: (moduleIds: string[]) => Promise<void>;
  /**
   * Callback para persistir a nova ordem de lições dentro de um módulo.
   * Recebe o ID do módulo e o array de IDs de lições na nova ordem.
   */
  onReorderLessons?: (
    moduleId: string,
    lessonIds: string[],
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Troca dois elementos em um array imutavelmente. */
function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Builder de trilhas com reordenação acessível por teclado.
 *
 * Para cada módulo e lição, renderiza `TrailItemReorder` com botões
 * sempre visíveis. O drag-and-drop (mouse) coexiste com os botões de
 * teclado — eles são controles independentes que atuam no mesmo estado.
 */
export function GroupTrailsClient({
  groupId: _groupId,
  trailId: _trailId,
  trailName,
  initialModules,
  onReorderModules,
  onReorderLessons,
}: GroupTrailsClientProps) {
  const { announce } = useAsyncAnnouncer();
  const [modules, setModules] = useState<TrailModule[]>(initialModules);

  // -------------------------------------------------------------------------
  // Reordenação de módulos
  // -------------------------------------------------------------------------

  const handleModuleMoveUp = useCallback(
    async (index: number) => {
      if (index === 0) return;
      const next = swap(modules, index, index - 1);
      setModules(next);
      try {
        await onReorderModules?.(next.map((m) => m.id));
      } catch {
        // Reverter em caso de erro (optimistic update)
        setModules(modules);
        announce("Erro ao salvar nova ordem. Tente novamente.", {
          politeness: "assertive",
        });
      }
    },
    [modules, onReorderModules, announce],
  );

  const handleModuleMoveDown = useCallback(
    async (index: number) => {
      if (index === modules.length - 1) return;
      const next = swap(modules, index, index + 1);
      setModules(next);
      try {
        await onReorderModules?.(next.map((m) => m.id));
      } catch {
        setModules(modules);
        announce("Erro ao salvar nova ordem. Tente novamente.", {
          politeness: "assertive",
        });
      }
    },
    [modules, onReorderModules, announce],
  );

  // -------------------------------------------------------------------------
  // Reordenação de lições dentro de um módulo
  // -------------------------------------------------------------------------

  const handleLessonMoveUp = useCallback(
    async (moduleIndex: number, lessonIndex: number) => {
      if (lessonIndex === 0) return;
      const module = modules[moduleIndex];
      if (!module) return;
      const nextLessons = swap(module.lessons, lessonIndex, lessonIndex - 1);
      const nextModules = modules.map((m, i) =>
        i === moduleIndex ? { ...m, lessons: nextLessons } : m,
      );
      setModules(nextModules);
      try {
        await onReorderLessons?.(
          module.id,
          nextLessons.map((l) => l.id),
        );
      } catch {
        setModules(modules);
        announce("Erro ao salvar nova ordem. Tente novamente.", {
          politeness: "assertive",
        });
      }
    },
    [modules, onReorderLessons, announce],
  );

  const handleLessonMoveDown = useCallback(
    async (moduleIndex: number, lessonIndex: number) => {
      const module = modules[moduleIndex];
      if (!module) return;
      if (lessonIndex === module.lessons.length - 1) return;
      const nextLessons = swap(module.lessons, lessonIndex, lessonIndex + 1);
      const nextModules = modules.map((m, i) =>
        i === moduleIndex ? { ...m, lessons: nextLessons } : m,
      );
      setModules(nextModules);
      try {
        await onReorderLessons?.(
          module.id,
          nextLessons.map((l) => l.id),
        );
      } catch {
        setModules(modules);
        announce("Erro ao salvar nova ordem. Tente novamente.", {
          politeness: "assertive",
        });
      }
    },
    [modules, onReorderLessons, announce],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section
      aria-label={`Builder da trilha ${trailName}`}
      data-testid="group-trails-client"
    >
      <h2 className="mb-4 text-lg font-semibold">{trailName}</h2>

      {modules.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="no-modules">
          Nenhum módulo adicionado ainda.
        </p>
      )}

      <ol
        className="space-y-4"
        aria-label="Lista de módulos da trilha"
        data-testid="modules-list"
      >
        {modules.map((module, moduleIndex) => (
          <li
            key={module.id}
            className="rounded-lg border border-border bg-card p-4"
            data-testid={`module-item-${module.id}`}
          >
            {/* Cabeçalho do módulo: título + botões de reordenação */}
            <div className="flex items-center gap-3">
              {/* FR-014: TabIndex natural — botões de reordenação antes do conteúdo do módulo */}
              <TrailItemReorder
                itemTitle={module.name}
                index={moduleIndex}
                total={modules.length}
                onMoveUp={handleModuleMoveUp}
                onMoveDown={handleModuleMoveDown}
              />

              <div className="flex-1">
                <h3
                  className="font-medium"
                  data-testid={`module-title-${module.id}`}
                >
                  {module.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {module.lessons.length} lição
                  {module.lessons.length !== 1 ? "ões" : ""}
                </p>
              </div>
            </div>

            {/* Lista de lições do módulo */}
            {module.lessons.length > 0 && (
              <ol
                className="mt-3 space-y-2 pl-2"
                aria-label={`Lições do módulo ${module.name}`}
                data-testid={`lessons-list-${module.id}`}
              >
                {module.lessons.map((lesson, lessonIndex) => (
                  <li
                    key={lesson.id}
                    className="flex items-center gap-2 rounded border border-border/50 bg-background px-3 py-2"
                    data-testid={`lesson-item-${lesson.id}`}
                  >
                    {/* Botões de reordenação da lição */}
                    <TrailItemReorder
                      itemTitle={lesson.title}
                      index={lessonIndex}
                      total={module.lessons.length}
                      onMoveUp={(idx) => handleLessonMoveUp(moduleIndex, idx)}
                      onMoveDown={(idx) =>
                        handleLessonMoveDown(moduleIndex, idx)
                      }
                    />

                    <span
                      className="flex-1 text-sm"
                      data-testid={`lesson-title-${lesson.id}`}
                    >
                      {lesson.title}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
