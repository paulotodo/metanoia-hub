# Implementation Plan: Screen Reader — Trilhas, Progresso & Conteúdo

**Feature**: `a11y-screen-reader-trilhas` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

## Summary

Endurecer a acessibilidade para screen readers nas telas de trilhas existentes do frontend. Nenhuma nova rota, nenhum backend, nenhuma migration. O trabalho é puramente ARIA hardening em 8 arquivos existentes + criação de 1 novo componente leve de anúncio (`ModuleCompletionAnnounce`). As mudanças são centradas em: consolidar aria-labels fragmentados nos cards, adicionar padrões de anúncio de posição nos acordeões de módulo, garantir labels contextuais em todas as progressbars, criar um region de summary no "Meu Progresso", e dar ao player de vídeo foco e anúncio corretos no evento `ended`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (Next.js 16.2 App Router)
**Primary Dependencies**: TanStack Query 5.x (Client Components), Tailwind CSS 4.2.2, shadcn/ui — **sem novas dependências**
**Storage**: N/A (feature stateless — só atributos ARIA)
**Testing**: Vitest 4.1.2 + Testing Library + jest-axe (já instalado)
**Target Platform**: Next.js App Router, SSR + CSR híbrido
**Project Type**: Frontend component hardening
**Performance Goals**: Zero layout shift (CLS=0), zero degradação de LCP
**Constraints**: Nenhum import novo de bibliotecas externas; zero mudanças de backend; branch `feat/epic15-15-4-screen-reader-trilhas` sem push
**Scale/Scope**: 8 arquivos modificados + 1 arquivo novo

## Constitution Check

*GATE: Deve passar antes do Phase 0. Re-checar após Phase 1.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | N/A | Feature é FE-only; nenhuma tabela, nenhuma query, nenhum `tenant_id` |
| II. Type-Safety & Identificadores | PASS | Props TypeScript strictas; nenhum `undefined` introduzido; sem `@default(uuid())` |
| III. Idioma & Vocabulário Pastoral | PASS | Strings de anúncio em PT-BR ("Módulo concluído!", vocabulário pastoral preservado); código em inglês |
| IV. Contratos de API Padronizados | N/A | Nenhuma API tocada |
| V. Separação de Estado no Frontend | PASS | `ModuleCompletionAnnounce` é um componente de apresentação puro (sem TanStack Query, sem Zustand); VideoPlayer mantém padrão Client Component existente |
| VI. Qualidade Verificável | PASS | Tests unitários atualizados para cada componente modificado; axe-core gate existente; motion-safe verificado |
| VII. Processo de Entrega Auditável | PASS | Conventional commits em PT-BR; 1 story = 1 branch = 1 PR |

## Project Structure

### Documentation (this feature)

```
docs/specs/a11y-screen-reader-trilhas/
├── spec.md
├── plan.md                    # Este arquivo
├── research.md                # Phase 0 — decisões técnicas
├── quickstart.md              # Cenários de teste manual
├── manual-test-checklist.md   # Roteiro de screen reader para gate humano
└── tasks.md                   # Backlog executável (gerado por /create-tasks)
```

### Source Code (arquivos modificados)

```
apps/web/
├── app/(authenticated)/app/consumo/trilhas/
│   ├── page.tsx                         # MODIFY: garantir <h1> visível em todos os states
│   └── [trailId]/
│       ├── module-accordion-item.tsx    # MODIFY: aria-label padrão "Módulo {n} de {total}: {nome} — {status}"
│       ├── trail-playlist.tsx           # MODIFY: passar moduleIndex + totalModules para ModuleAccordionItem
│       ├── trail-playlist-header.tsx    # MODIFY: label contextual na TrailProgressBar
│       └── progresso/
│           └── trail-progress-view.tsx  # MODIFY: role=region summary + lesson names + labels contextuais
└── src/components/content/
    ├── trail-card.tsx                   # MODIFY: aria-label consolidado no botão
    ├── trail-progress-bar.tsx           # MODIFY: label prop obrigatório (sem default genérico)
    ├── video-player.tsx                 # MODIFY: aria-label contextual + ended focus management
    └── module-completion-announce.tsx   # NEW: role=status aria-live=polite componente
```

```
apps/web/src/components/catalog/
└── trail-card.tsx                       # MODIFY: aria-label simplificado para trilhas sem progresso
```

## Convencoes de Borda

N/A — single-layer (FE-only). Nenhuma borda frontend↔backend introduzida ou modificada por esta feature.

## Plano de Implementação por Componente

### 1. `trail-card.tsx` (content variant) — aria-label consolidado

**Problema**: botão interno tem `aria-label="Abrir trilha: {trail.name}"` — falta status, progresso, moduleCount.

**Solução**: Substituir o aria-label do botão por:
```
`Trilha: ${trail.name}, ${STATUS_LABELS[trail.status]}, ${trail.progressPercent}% concluída, ${trail.moduleCount} módulos`
```

**Impacto em testes existentes**: `trail-card.spec.tsx` L99 usa `getByRole('button', { name: /Abrir trilha/i })` — esse teste vai quebrar. Atualizar para `{ name: /Trilha:/i }` ou regex que corresponda ao novo padrão.

**Gate a11y**: re-rodar os 3 gates após cada mudança de className.

---

### 2. `trail-card.tsx` (catalog variant) — aria-label simplificado

**Problema**: `aria-label` atual é `t.trailCard.activate.replace('{name}', name)` — apenas o nome da trilha.

**Solução**: Atualizar para incluir status e contagem de módulos:
```
`Trilha: ${name}, ${statusLabel}${moduleCount !== undefined ? `, ${moduleCount} módulos` : ''}`
```

**Impacto em testes**: verificar `apps/web/src/components/catalog/trail-card.spec.tsx` se existir.

---

### 3. `trilhas/page.tsx` — título de página

**Problema**: título "Minhas Trilhas" existe no h1 do estado de loading e de error, mas no estado loaded o h1 pode estar ausente ou vazio.

**Solução**: Garantir que `<main>` sempre contenha `<h1>Minhas Trilhas</h1>` visível em todos os estados (loading, error, success). Adicionar `export const metadata = { title: 'Minhas Trilhas | metanoia' }` na versão Server Component (ou no layout).

**Nota**: a página atual é `'use client'` — o `metadata` export não funciona nela. Verificar se há um layout.tsx ou se o título deve ser definido via `useEffect` + `document.title` ou movendo para Server Component shell.

---

### 4. `module-accordion-item.tsx` — aria-label de posição e status do módulo

**Problema**: botão do accordion não tem `aria-label` — só texto visual `module.name`.

**Solução**: Adicionar dois props novos: `moduleIndex: number` e `totalModules: number`. Calcular status do módulo (Concluído/Em andamento/Bloqueado) a partir dos dados de progresso. Adicionar ao botão:
```tsx
aria-label={`Módulo ${moduleIndex} de ${totalModules}: ${module.name} — ${moduleStatus}`}
```

**Lógica de status do módulo**:
- `completionPercent === 100` → "Concluído"
- `completionPercent > 0` → "Em andamento"
- módulo bloqueado (via `deriveLockedLessons`) → "Bloqueado"
- else → "Não iniciado"

**Checkmark icon**: o SVG do chevron já tem `aria-hidden="true"`. Verificar se há ícone de checkmark no módulo concluído — se houver, garantir `aria-hidden="true"`.

**Impacto em testes**: `module-accordion-item.spec.tsx` usa `getByTestId('module-accordion-header')` — adicionar assertion de `aria-label` nos testes existentes. Props `moduleIndex` e `totalModules` devem ser adicionados ao mock nos testes.

---

### 5. `trail-progress-bar.tsx` — label contextual obrigatório

**Problema**: `label` prop é opcional com default `${clampedPercent}% concluído` — genérico quando múltiplas barras coexistem.

**Solução**: Tornar `label` **obrigatório** (remover o `?` do tipo e o default genérico). Todos os call sites devem passar label explícito:
- `TrailPlaylistHeader`: `"Progresso na trilha: {progressPercent}%"`
- `ModuleAccordionItem`: `"Progresso no módulo ${module.name}: ${completionPercent}%"`
- `TrailProgressView` (overall): `"Progresso na trilha: ${data.progressPercent}%"`
- `TrailProgressView` (per-module): `"Progresso no módulo ${mod.moduleName || mod.moduleId}: ${mod.progressPercent}%"`
- `TrailCard` (content): já passa label — atualizar para `"Progresso na trilha: ${trail.progressPercent}%"`

**Nota sobre ModuleProgressDetail**: confirmado por inspeção — `ModuleProgressDetail` em `@metanoia/types` NÃO tem `moduleName` nem `LessonStatusItem` tem `lessonName`. Labels para módulos na progress view usarão `"Módulo {index+1}"` e lições usarão `"Aula {index+1}: {statusLabel}"` como fallback descritivo. Isso é suficiente para screen readers (posição semântica) sem exigir mudança de schema.

---

### 6. `trail-progress-view.tsx` — summary region + lesson names

**Problema**: (a) falta `role="region"` com summary de módulos concluídos no topo; (b) lista de aulas não exibe o nome da aula (só status icon).

**Solução para (a)**: Adicionar no topo do retorno (após loading/error guards):
```tsx
<div
  role="region"
  aria-label={`Resumo do progresso: ${data.completedModules} de ${data.totalModules} módulos concluídos`}
  className="sr-only"
>
  Você tem {data.completedModules} módulos concluídos de {data.totalModules}.
</div>
```
Ou alternativamente: tornar o `<p>` existente ("`{data.completedModules} de {data.totalModules} módulos concluídos`") o conteúdo de uma `role="region"` visível.

**Solução para (b)**: Cada `<li>` da lista de aulas precisa exibir o nome da aula. Verificar se `ModuleProgressDetail.lessons[].lessonName` existe em `@metanoia/types`. Se existir, adicionar ao texto do item. Se não existir, usar o fallback `lesson.lessonId` (menos ideal mas não viola o contrato).

**Impacto em testes**: verificar se há spec para `trail-progress-view.tsx` — se não houver, criar testes básicos junto da mudança.

---

### 7. `video-player.tsx` — aria-label contextual + focus management no ended

**Problema**: (a) `aria-label={title ?? 'Vídeo da aula'}` — sem prefixo "Vídeo:"; (b) sem handler de `ended` para focus management.

**Solução para (a)**:
```tsx
aria-label={title ? `Vídeo: ${title}` : 'Vídeo da aula'}
```

**Solução para (b)**: Adicionar prop opcional `nextModuleButtonRef?: React.RefObject<HTMLButtonElement>` e `onVideoEnded?: () => void`. No `useEffect` que já existe ou num novo handler:
```tsx
const handleEnded = useCallback(() => {
  if (nextModuleButtonRef?.current) {
    nextModuleButtonRef.current.focus();
  } else {
    videoRef.current?.focus();
  }
  onVideoEnded?.(); // dispara anúncio polite no parent
}, [nextModuleButtonRef, onVideoEnded]);
```
Adicionar `onEnded={handleEnded}` ao `<video>`.

**Anúncio polite**: o `onVideoEnded` callback é chamado pelo consumidor do VideoPlayer, que chama `setAnnouncementMessage("Vídeo concluído. Avance para o próximo módulo.")` no `ModuleCompletionAnnounce`.

---

### 8. `ModuleCompletionAnnounce` (novo componente)

**Localização**: `apps/web/src/components/content/module-completion-announce.tsx`

**Interface**:
```tsx
interface ModuleCompletionAnnounceProps {
  message: string; // vazio = sem anúncio ativo
}
```

**Implementação**:
```tsx
export function ModuleCompletionAnnounce({ message }: ModuleCompletionAnnounceProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

**Notas críticas**:
- O container `role="status"` deve estar presente no DOM **antes** de ser preenchido — renderizar no layout pai, não condicional.
- `aria-atomic="true"` garante que o screen reader leia o anúncio completo.
- `className="sr-only"` previne layout shift visual.
- A limpeza do `message` (reset para `""`) deve acontecer após timeout (~3s) para evitar re-anúncios em re-renders.

---

## Ordem de Implementação (por complexidade crescente, menor risco primeiro)

1. `ModuleCompletionAnnounce` (novo componente — sem risco de regressão)
2. `trail-progress-bar.tsx` (tornar label obrigatório — força correção em todos os call sites)
3. `trail-card.tsx` content variant (aria-label consolidado)
4. `trail-card.tsx` catalog variant (aria-label simplificado)
5. `trilhas/page.tsx` (título de página)
6. `trail-progress-view.tsx` (summary region + lesson names)
7. `module-accordion-item.tsx` + `trail-playlist.tsx` (props moduleIndex/totalModules)
8. `video-player.tsx` (focus management + aria-label)

Após cada item: `pnpm turbo lint --force` + `pnpm --filter @metanoia/web test` + 3 gates a11y.

## Complexity Tracking

> Nenhuma violação de Constitution Check. N/A.
