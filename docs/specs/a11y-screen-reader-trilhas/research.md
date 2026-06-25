# Research: a11y-screen-reader-trilhas

Documento produzido no Phase 0 do `/plan`. Feature é FE-only a11y hardening — sem backend, sem Prisma.
Todos os unknowns resolvidos por inspeção direta do codebase.

## Decision 1: Ponto de engate do anúncio de conclusão de módulo

**Decision**: O `ModuleCompletionAnnounce` component é entregue pronto (com `role="status"` e prop `message`). O engate live acontece no `VideoPlayer` via o callback `onEnded` do `<video>` element. O `use-video-progress.ts` já tem `handleEnded` (L130) que chama `recordSnapshot()`. A wiring do anúncio ocorre no `VideoPlayer`: ao receber o evento `ended`, disparar a prop `onComplete()` se fornecida, e o consumidor (página de aula quando existir) chama `setAnnouncementMessage(...)`.

**Rationale**: Inspeção de `apps/web/src/lib/api/hooks/use-progress.ts` confirma que `useReportProgress` existe mas não está conectado a nenhum componente de trilha. Não há hook de conclusão de módulo ativo no client. Entregar o componente desacoplado (pronto para ligar) sem criar acoplamento ao backend é a abordagem correta dada a decisão de escopo sÓ-a11y.

**Alternatives considered**: Conectar `useReportProgress` diretamente no VideoPlayer — rejeitado porque cria dependência de backend e muda o comportamento existente, ultrapassando o escopo de a11y hardening.

---

## Decision 2: Renderer de conteúdo/imagem nas telas em escopo

**Decision**: Não existe renderer de rich-text/markdown/`<img>` nas telas de trilha em escopo. A rota `/aulas/[lessonId]` não existe. Conteúdo de aula = vídeo exclusivamente via `VideoPlayer`. A parte "headings/alt-text" do story original é 100% OUT → Story 15.5.

**Rationale**: `find apps/web/app/(authenticated)/app/consumo -type d` confirma que não há diretório `aulas/` nem `lessons/`. `grep -r "markdown|MarkdownRenderer|dangerouslySetInnerHTML" apps/web/app/(authenticated)/app/consumo/trilhas` retorna zero resultados.

**Alternatives considered**: Implementar fallback `alt="Imagem sem descrição"` preventivamente — rejeitado porque não há `<img>` a proteger nas telas em escopo.

---

## Decision 3: Estratégia de aria-label para trail-card (content variant vs catalog variant)

**Decision**: As duas variantes (`src/components/content/trail-card.tsx` e `src/components/catalog/trail-card.tsx`) têm props diferentes. O content card usa `MyTrailItem` (tem `progressPercent`, `status`, `moduleCount`). O catalog card usa `CatalogTrailCardProps` (pode não ter `progressPercent`). O aria-label do catalog card é simplificado: `"Trilha: {name}, {statusLabel}, {n} módulos"` — sem percentual se não disponível.

**Rationale**: O catalog card representa trilhas ainda não iniciadas (catálogo de descoberta), sem progresso. O aria-label completo é relevante apenas para trilhas já em andamento (content card / Minhas Trilhas).

**Alternatives considered**: Unificar os dois cards — rejeitado porque têm contextos de uso distintos e props divergentes.

---

## Decision 4: Estratégia de moduleCount para aria-label no ModuleAccordionItem

**Decision**: O `ModuleAccordionItem` recebe `module` e `trailId` mas não recebe `moduleIndex` nem `totalModules`. Para produzir "Módulo {n} de {total}", dois novos props são necessários: `moduleIndex: number` e `totalModules: number`. O `TrailPlaylist` (que mapeia os módulos) passa esses valores.

**Rationale**: O `TrailPlaylist` já tem `modules.length` e usa `.map((mod, index) => ...)` no seu render. Adicionar `moduleIndex={index + 1}` e `totalModules={modules.length}` é minimal e não quebra a interface existente (novos campos opcionais com fallback).

**Alternatives considered**: Derivar índice de `module.order` — rejeitado porque `order` pode ter gaps (ex: 0, 2, 5 após deleções).

---

## Decision 5: Localização do `ModuleCompletionAnnounce` no DOM

**Decision**: O componente é renderizado no nível da `TrailPlaylistRoute` (ou `trail-playlist.tsx`), fora do flow visual das aulas, para evitar layout shift. Usa `aria-live="polite"` e `role="status"`. Quando `message` é vazio, renderiza `<div role="status" className="sr-only" aria-live="polite" />` (aria-live container sempre presente no DOM para garantia cross-browser do live region).

**Rationale**: Live regions devem estar presentes no DOM antes de serem preenchidas — adicionar dinamicamente o elemento junto com o conteúdo pode fazer alguns screen readers ignorarem o anúncio.

**Alternatives considered**: Renderizar inline perto do vídeo — rejeitado porque pode causar layout shift e o componente deve ser agnóstico ao layout.
