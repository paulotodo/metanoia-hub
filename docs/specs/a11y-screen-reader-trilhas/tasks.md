# Tasks: Screen Reader — Trilhas, Progresso & Conteúdo (NFR-A4)

**Feature**: `a11y-screen-reader-trilhas` | **Story**: Epic 15 — Story 15.4
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Created**: 2026-06-25 | **Branch**: `feat/epic15-15-4-screen-reader-trilhas`

## Legenda

- `[crit]` — task crítica (bloqueante para SC-004 / gates de CI)
- `[a11y]` — task de acessibilidade (bloqueante para SC-001 / axe-core gate)
- `[test]` — atualização de teste obrigatória
- `[doc]` — documentação / artefato

## Escopo Coberto

- `apps/web/src/components/content/trail-card.tsx` — aria-label consolidado
- `apps/web/src/components/catalog/trail-card.tsx` — aria-label simplificado
- `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx` — document.title
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/module-accordion-item.tsx` — aria-label posição+status
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/trail-playlist.tsx` — props moduleIndex/totalModules
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/trail-playlist-header.tsx` — label contextual
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/progresso/trail-progress-view.tsx` — region summary + lesson aria-labels
- `apps/web/src/components/content/trail-progress-bar.tsx` — label obrigatório
- `apps/web/src/components/content/video-player.tsx` — aria-label contextual + ended focus
- `apps/web/src/components/content/module-completion-announce.tsx` — NOVO componente role=status

## Escopo Excluído

- Qualquer arquivo em `apps/api/` — ZERO backend
- Prisma schema / migrations
- Instalação de Plyr
- Criação do botão "Próximo módulo" (UI inexistente → follow-up 15.5)
- Admin page `/app/admin/accessibility-gaps`
- `next-env.d.ts` — NÃO commitar

## Resumo de Implementação

8 arquivos modificados + 1 arquivo novo. Ordem: menor risco primeiro.
Após cada task: `pnpm turbo lint --force` + `pnpm --filter @metanoia/web test` + 3 gates a11y.

## Matriz de Dependências

```
FASE1 (1.1) → FASE2 (2.1) → FASE3 (3.1, 3.2) → FASE4 (4.1) → FASE5 (5.1, 5.2) → FASE6 (6.1) → FASE7 (7.1) → FASE8 (8.1)
                                                              ↓
                                                           FASE5 requer FASE4 (label obrigatório força todos call sites)
```

---

## FASE 1 — Novo componente ModuleCompletionAnnounce

### 1.1 Criar `module-completion-announce.tsx` [crit] [a11y]

- [ ] Criar `apps/web/src/components/content/module-completion-announce.tsx`
  - `role="status"` + `aria-live="polite"` + `aria-atomic="true"`
  - `className="sr-only"` (evita layout shift)
  - prop `message: string` — vazio = sem anúncio ativo
  - Container SEMPRE no DOM (estático, não condicional)
  - Reset do `message` para `""` após ~3s via `useEffect` + `setTimeout`
- [ ] Criar `apps/web/src/components/content/module-completion-announce.spec.tsx`
  - Testa renderização com message vazia
  - Testa anúncio com message preenchida
  - Testa que `role="status"` + `aria-live="polite"` estão presentes
  - Teste jest-axe no componente
- [ ] Executar gates: `pnpm turbo lint --force` + `pnpm --filter @metanoia/web test` + 3 gates a11y hard

---

## FASE 2 — TrailProgressBar label obrigatório

### 2.1 Tornar `label` obrigatório em `trail-progress-bar.tsx` [crit] [a11y]

- [ ] Remover `?` do tipo e o default genérico de `label` em `TrailProgressBarProps`
- [ ] TypeScript vai reportar erros em todos os call sites sem label — corrigir TODOS:
  - `trail-card.tsx` (content): `label="Progresso na trilha: ${trail.progressPercent}%"`
  - `trail-playlist-header.tsx`: `label="Progresso na trilha: ${progressData?.data.progressPercent ?? 0}%"`
  - `module-accordion-item.tsx`: `label="Progresso no módulo ${module.name}: ${completionPercent}%"`
  - `trail-progress-view.tsx` (overall): `label="Progresso na trilha: ${data.progressPercent}%"`
  - `trail-progress-view.tsx` (per-module): `label="Módulo ${index + 1}: ${mod.progressPercent}% concluído"`
- [ ] Executar gates: lint + test + 3 gates a11y hard

---

## FASE 3 — TrailCard aria-label consolidado

### 3.1 `trail-card.tsx` (content variant) — aria-label consolidado [a11y]

- [ ] Substituir `aria-label={`Abrir trilha: ${trail.name}`}` por:
  `aria-label={`Trilha: ${trail.name}, ${STATUS_LABELS[trail.status]}, ${trail.progressPercent}% concluída, ${trail.moduleCount} módulos`}`
- [ ] Atualizar `trail-card.spec.tsx` L (botão com `{ name: /Abrir trilha/i }`) para `{ name: /Trilha:/i }`
- [ ] Executar gates: lint + test + 3 gates a11y hard

### 3.2 `trail-card.tsx` (catalog variant) — aria-label com status e módulos [a11y]

- [ ] Atualizar `aria-label` em `apps/web/src/components/catalog/trail-card.tsx`:
  ```
  `Trilha: ${name}, ${statusLabel}${moduleCount !== undefined ? `, ${moduleCount} módulos` : ''}`
  ```
- [ ] Remover o `aria-label` duplicado no `<span>` de status (já está no link `<a>`)
- [ ] Executar gates: lint + test + 3 gates a11y hard

---

## FASE 4 — document.title na página de listagem

### 4.1 Página `trilhas/page.tsx` — document.title via useEffect [a11y]

- [ ] Adicionar `useEffect(() => { document.title = 'Minhas Trilhas | metanoia'; }, [])` no componente `MinhasTrilhasPage`
  - Import `useEffect` já presente na página (IntersectionObserver)
  - Padrão JÁ usado em `apps/web/app/(authenticated)/app/gestao/radar/page.tsx`
- [ ] Verificar que `<h1 className="... text-foreground">Minhas Trilhas</h1>` está presente em TODOS os estados (loading, error, success) — já está, confirmar
- [ ] Executar gates: lint + test + 3 gates a11y hard

---

## FASE 5 — TrailProgressView summary region + lesson aria-labels

### 5.1 `trail-progress-view.tsx` — role=region summary [a11y]

- [ ] Adicionar `role="region"` + `aria-label` no `<section aria-labelledby="trail-progress-heading">` existente,
  ou envolver o `<p>` de contagem em um `<div role="region" aria-label="...">` visível no topo da seção:
  ```tsx
  <div
    role="region"
    aria-label={`Resumo: ${data.completedModules} de ${data.totalModules} módulos concluídos`}
  >
  ```
- [ ] Executar gates: lint + test + 3 gates a11y hard

### 5.2 `trail-progress-view.tsx` — lesson items com aria-label [a11y]

- [ ] Adicionar `aria-label` em cada `<li>` da lista de aulas via `LessonStatusIcon`:
  - Confirmar que `LessonStatusItem` NÃO tem `lessonName` (já confirmado)
  - Usar fallback: `aria-label={`Aula ${index + 1}: ${STATUS_LABELS_PT[lesson.status]}`}`
  - Documentar no código: `// lessonName indisponível no contrato — usar posição + status como fallback (follow-up 15.5)`
- [ ] Executar gates: lint + test + 3 gates a11y hard

---

## FASE 6 — ModuleAccordionItem aria-label posição + status

### 6.1 `module-accordion-item.tsx` + `trail-playlist.tsx` — aria-label "Módulo N de T: Nome — Status" [a11y]

- [ ] Adicionar props `moduleIndex: number` e `totalModules: number` em `ModuleAccordionItemProps`
- [ ] Calcular `moduleStatus`:
  - `completionPercent === 100` → "Concluído"
  - módulo bloqueado (via `deriveLockedLessons` em nível de módulo, ou lógica da primeira aula) → "Bloqueado"
  - `completionPercent > 0` → "Em andamento"
  - else → "Não iniciado"
- [ ] Adicionar `aria-label` no `<button>` do accordion:
  ```tsx
  aria-label={`Módulo ${moduleIndex} de ${totalModules}: ${module.name} — ${moduleStatus}`}
  ```
- [ ] Verificar ícones de checkmark no módulo concluído → garantir `aria-hidden="true"` (chevron já tem)
- [ ] Em `trail-playlist.tsx`: passar `moduleIndex={index + 1}` e `totalModules={modules.length}` para `<ModuleAccordionItem>`
- [ ] Atualizar `module-accordion-item.spec.tsx`: adicionar `moduleIndex={1}` + `totalModules={3}` em TODOS os renders do mock; adicionar assertion de `aria-label` no header
- [ ] Executar gates: lint + test + 3 gates a11y hard

---

## FASE 7 — VideoPlayer aria-label contextual + ended focus

### 7.1 `video-player.tsx` — aria-label "Vídeo: {title}" + ended handler [a11y]

- [ ] Atualizar `aria-label`:
  ```tsx
  aria-label={title ? `Vídeo: ${title}` : 'Vídeo da aula'}
  ```
- [ ] Adicionar props opcionais:
  ```tsx
  nextModuleButtonRef?: React.RefObject<HTMLButtonElement>
  onVideoEnded?: () => void
  ```
- [ ] Adicionar `handleEnded` com `useCallback`:
  ```tsx
  const handleEnded = useCallback(() => {
    // Botão "Próximo módulo" não existe na UI atual (follow-up 15.5)
    // Fallback: foco retorna ao próprio <video>
    videoRef.current?.focus();
    // Anúncio polite via callback do consumidor
    onVideoEnded?.();
  }, [onVideoEnded]);
  ```
- [ ] Adicionar região aria-live ESTÁTICA dentro do componente para o anúncio de conclusão:
  ```tsx
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" ref={announceLiveRef}>
    {endedMessage}
  </div>
  ```
  - `endedMessage` = `"Vídeo concluído."` (sem "Avance para o próximo módulo" pois o botão não existe)
  - Injetado quando `ended` dispara; limpo após ~3s
- [ ] Adicionar `onEnded={handleEnded}` ao `<video>`
- [ ] Adicionar testes em `video-player.spec.tsx` (criar se não existir):
  - Testa `aria-label` com título e sem título
  - Testa que o elemento `<video>` tem `data-testid="video-player"`
  - Teste jest-axe
- [ ] Executar gates: lint + test + 3 gates a11y hard

---

## FASE 8 — Gates finais e commit

### 8.1 Gates finais e commit [crit] [doc]

- [ ] Rodar `pnpm turbo lint --force` — zero erros/warnings
- [ ] Rodar `pnpm --filter @metanoia/web test` — todos os testes passando
- [ ] Rodar `pnpm turbo build --filter=@metanoia/web` — build limpo
- [ ] Confirmar os 3 gates a11y hard (focus-ring, contrast, motion-safe):
  - `grep -r "transition-\|animate-" apps/web/src/components/content/module-completion-announce.tsx apps/web/src/components/content/video-player.tsx` — nenhum resultado sem `motion-safe:`
  - Revisar todos os arquivos modificados nesta feature por `transition-` / `animate-` sem `motion-safe:`
- [ ] Commit: `feat(a11y): screen reader hardening nas telas de trilhas (Story 15.4) [epic15]`
  - NÃO incluir `next-env.d.ts`
