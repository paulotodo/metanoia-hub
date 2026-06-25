# Epic 15 — Follow-up Story 15.5 (itens diferidos)

Status: backlog (não iniciado)
Origem: descopo da Story 15.4 (decisão do operador, 2026-06-25) — manter a 15.4 como
a11y-hardening de FE de baixo risco, sem migration em produção.

## Contexto
O host de `/var/lib/metanoia-hub` É o servidor de produção. A Story 15.4, como
especificada, exigia migration Prisma + backend novo + página admin + troca de player.
Para evitar risco em produção e manter o Epic 15 focado em acessibilidade de FE, os
itens full-stack foram diferidos para esta story de follow-up.

## Itens diferidos (a implementar na 15.5)

### 1. Player de vídeo — Plyr
- Instalar `plyr` + criar wrapper `PlyrVideoPlayer` substituindo o `video-player.tsx` custom.
- Localização PT-BR de todos os controles (Reproduzir/Pausar/Volume/Tela cheia/Avançar/Retroceder).
- `role="slider"` + `aria-valuenow` no scrubber (Plyr fornece nativamente).
- Painel acessível de atalhos de teclado (tecla "?").
- Reaproveitar `use-video-progress.ts` (analytics) na integração.

### 2. Governança de alt-text (backend + admin)
- Migration Prisma: campo `has_missing_alt_text Boolean @default(false) @map(...)` no modelo de Lesson/módulo.
  - RLS test obrigatório; validar localmente em Postgres ANTES (lição dos Epics 13/14).
  - Aplicar em prod via profile `migrate` do compose (deploy manual).
- Endpoint `GET /api/v1/admin/accessibility-gaps` (role admin) + service.
- Validador de alt-text (parser de `<img>` sem `alt`) disparado na publicação do conteúdo, setando o flag.
- Página `/app/admin/accessibility-gaps` ("Conteúdo com acessibilidade incompleta") + seed demo.

### 3. Navegação "Próximo módulo"
- O `video-player.tsx` já expõe a prop `nextModuleButtonRef` e move foco para ela ao fim do
  vídeo, MAS o botão "Próximo módulo" não existe na UI atual de trilhas. Criar o botão de
  navegação sequencial entre módulos/aulas e ligar o ref (FR-010 da 15.4 completo).

### 4. Rota de consumo de aula (se aplicável)
- Verificar se há rota dedicada de aula (`/app/consumo/trilhas/[trailId]/aulas/[lessonId]`)
  para renderizar conteúdo rich-text/imagem com hierarquia de headings + fallback de alt.
  Se o conteúdo for inline no accordion, ajustar o escopo.

## Não bloqueia o Epic 15
O Epic 15 está `done` quanto à acessibilidade de FE (NFR-A4/A5, UX-DR20). Estes itens são
melhorias incrementais (player premium + governança de conteúdo) que não impedem o uso por
tecnologia assistiva das telas entregues.
