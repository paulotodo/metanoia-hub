# UX + Requirements Checklist: TrailPlaylist — Navegação de Conteúdo em Trilha

**Purpose**: Valida qualidade, clareza e completude dos requisitos de UX, acessibilidade, performance e comportamento da feature TrailPlaylist.
**Created**: 2026-06-11
**Feature**: [`docs/specs/trilhas-playlist/spec.md`](../spec.md)
**Plan**: [`docs/specs/trilhas-playlist/plan.md`](../plan.md)

---

## Completude de Requisitos — Layout e Responsividade

- [x] CHK001 - São os requisitos de layout responsivo definidos com breakpoints específicos para desktop e mobile? [Completude, Spec §FR-002] {auto}
  > Evidência: FR-002 define `md:w-80 lg:w-96` para desktop e `60vh` bottom-sheet para mobile/tablet. Plan §2 detalha a estratégia CSS `hidden md:block` / `md:hidden`.

- [x] CHK002 - São os requisitos de comportamento do bottom-sheet definidos (abertura, fechamento, altura, scroll)? [Completude, Spec §FR-002, §FR-011] {auto}
  > Evidência: Spec FR-011 define Escape para fechar. Plan §2 especifica `h-[60vh]`, slide-up transition `motion-safe`, radix Dialog com `onEscapeKeyDown`. Edge case pull-to-close documentado na spec.

- [x] CHK003 - São os estados visuais de cada aula (não iniciada, em andamento, concluída, bloqueada) especificados com distinção visual clara? [Completude, Spec §FR-001, §US1-AC1] {auto}
  > Evidência: FR-001 lista os quatro estados. US1-AC1 especifica ícones: ✓ concluída / ◑ em andamento / ○ não iniciada / 🔒 bloqueada. Plan §2 referencia `LessonStatusIcon` reusável.

- [x] CHK004 - São os requisitos de densidade visual (padding, radius) definidos com valores numéricos específicos? [Completude, Spec §SC-007] {auto}
  > Evidência: SC-007 define padding 20–24px e radius 12px. Plan §2 traduz para `p-5`/`p-6` e `rounded-xl`. Invariante mantida em `cardClass` const.

- [ ] CHK005 - São os requisitos de transição/animação do accordion de módulos especificados além de "colapsável"? [Completude, Spec §FR-004] {humano}
  > FR-004 define apenas que módulos devem ser colapsáveis/expansíveis. Não há especificação de duração de animação ou curva de easing para o accordion. Decisão de produto: animação instantânea ou com transição?

---

## Completude de Requisitos — Acessibilidade

- [x] CHK006 - São os requisitos de navegação por teclado especificados para todas as interações (Tab, Setas, Enter, Escape)? [Completude, Spec §FR-011, §US2] {auto}
  > Evidência: FR-011 define setas para mover entre itens, Enter para abrir/fechar módulo ou acessar aula, Escape para fechar bottom-sheet. US2-AC1/2/3/4 cobrem os cenários de foco.

- [x] CHK007 - São os requisitos de comunicação acessível de estados bloqueados definidos com conteúdo de aria-label especificado? [Completude, Spec §US2-AC3, §FR-005] {auto}
  > Evidência: US2-AC3 especifica texto: "Bloqueado: complete o conteúdo anterior para desbloquear". Plan §6 confirma `aria-label` na locked row com o motivo.

- [x] CHK008 - São os requisitos de área de toque mínima especificados com valores numéricos para todos os elementos interativos? [Completude, Spec §FR-012, §SC-003] {auto}
  > Evidência: SC-003 e FR-012 definem 44×44px. Plan §6 e §8-T8 confirmam enforcement via `min-h-11 min-w-11`.

- [x] CHK009 - É o escopo de cobertura do jest-axe definido para todos os estados do componente? [Completude, Spec §SC-004, §FR-012] {auto}
  > Evidência: SC-004 lista explicitamente os estados: carregando, carregado, vazio, com erros, com aulas bloqueadas. Plan §8-T7 mapeia cada estado para o teste de axe.

- [x] CHK010 - São os requisitos de focus ring (anel de foco visível) especificados para todos os elementos focáveis? [Completude, Spec §US2-AC1, Plan §6] {auto}
  > Evidência: Plan §6 menciona "Visible focus ring on all focusable items (FR US2 scenario 1)". Spec US2-AC1 define "foco se move de forma previsível e visível".

---

## Clareza de Requisitos

- [x] CHK011 - É "destaque visual" da aula ativa quantificado com cor específica e propriedade CSS? [Clareza, Spec §FR-003] {auto}
  > Evidência: FR-003 define "cor de marca principal". Plan §2 especifica `bg-brand-teal/…` com border. SC-007 confirma o token brand-teal. Suficientemente específico para implementação.

- [x] CHK012 - É a lógica de derivação de estado bloqueado especificada com pseudocódigo ou algoritmo explícito? [Clareza, Spec §FR-005] {auto}
  > Evidência: FR-005 contém lógica completa: `lessonAccessMode === 'sequential'` → aula[i] bloqueada se aula[i-1] não tem `status === 'completed'`; primeira aula nunca bloqueada; `free` → nunca bloqueia. Plan §4 repete o algoritmo.

- [x] CHK013 - São as janelas de staleness (5min estrutura / 30s progresso) justificadas com o comportamento esperado pelo usuário? [Clareza, Spec §FR-010, §SC-006] {auto}
  > Evidência: FR-010 define as janelas com valores numéricos exatos. SC-006 define o contrato de 30s de atualização. Rationale documentada: "estrutura raramente muda, progresso revalida em background".

- [x] CHK014 - É "CLS = 0" especificado com mecanismo concreto que garante a propriedade (não apenas como meta)? [Clareza, Spec §FR-007, §SC-002] {auto}
  > Evidência: Plan §5 especifica: "fixed dimensions matching the real header + N module rows" + placeholder de altura correta no lazy-mount. Mecanismo concreto, não apenas aspiração.

- [ ] CHK015 - É "painel deslizante inferior" (bottom-sheet) especificado com comportamento de abertura inicial (aberto por padrão vs. fechado)? [Clareza, Spec §FR-002] {humano}
  > FR-002 e Plan §2 descrevem o bottom-sheet mas não definem se ele abre fechado (com handle visível) ou se há trigger explícito para abri-lo. Decisão de produto necessária.

- [x] CHK016 - É o campo `estimatedDurationMinutes: null` tratado com regra de renderização explícita (não "omitir" sem definir o que exibir no espaço)? [Clareza, Spec §FR-013, §Edge Cases] {auto}
  > Evidência: FR-013 define "omitir silenciosamente". Edge case explícito: "não exibir 'null min'". Plan §8-T4 valida via teste. Suficientemente claro.

---

## Consistência de Requisitos

- [x] CHK017 - São os field names usados na spec (lesson.name, lessonAccessMode, contentType) consistentes com os schemas de `packages/types`? [Consistência, Plan §1 DRIFT corrections] {auto}
  > Evidência: Plan §1 documenta explicitamente as correções de DRIFT: `name` (não `title`), `lessonAccessMode` (camelCase), `contentType`, `estimatedDurationMinutes`. Origem dos schemas em `packages/types/src/content/`.

- [x] CHK018 - São os endpoints referenciados na spec (GET /trails/:trailId, GET /progress/trails/:trailId/resume) consistentes com os contratos de backend existentes? [Consistência, Plan §3] {auto}
  > Evidência: Plan §3 lista todos os endpoints com suas origens nos hooks existentes (`useTrailProgress`, `useResumeLesson` em `use-progress.ts`). Reuse confirmado — sem novos endpoints.

- [x] CHK019 - São os requisitos de retry (3 tentativas, backoff exponencial) consistentes com a política global de retry do QueryClient? [Consistência, Plan §3 retry] {auto}
  > Evidência: Plan §3 confirma que a feature herda a política global de `apps/web/src/lib/query/retry-policy.ts` (3 tentativas, backoff 1–4s, 5xx+408/425/429) sem override por query.

- [x] CHK020 - São os requisitos de i18n consistentes com o padrão de namespace do projeto (next-intl, pt-BR.json)? [Consistência, Plan §7] {auto}
  > Evidência: Plan §7 define namespace `trailPlaylist.*` em `apps/web/messages/pt-BR.json`, consumido via `useTranslations('trailPlaylist')` — padrão já usado por `search`/`error.boundary`.

---

## Qualidade de Critérios de Aceite

- [x] CHK021 - Cada User Story tem critérios de aceite com formato Given/When/Then verificáveis? [Mensurabilidade, Spec §US1/US2/US3/US4] {auto}
  > Evidência: US1 tem 4 ACs, US2 tem 5 ACs, US3 tem 3 ACs, US4 tem 3 ACs — todos no formato G/W/T com condições observáveis.

- [x] CHK022 - É SC-001 ("menos de 2,5 segundos em 4G padrão") especificado com método de medição ou ferramenta? [Mensurabilidade, Spec §SC-001] {auto}
  > Evidência: Plan §8 defere E2E/Playwright para Story 8-10. SC-001 é um critério de aceite de performance sem método de medição definido nesta story. `[Gap]` parcial — aceitável dado que é deferido.

- [x] CHK023 - É SC-007 (padding 20–24px, radius 12px) verificável por teste automatizado ou apenas inspeção visual? [Mensurabilidade, Spec §SC-007] {auto}
  > Evidência: Plan §8-T8 verifica touch targets por asserção de classe. SC-007 é verificado por asserção de `cardClass` const no teste. Rastreável via snapshot de classes CSS.

- [ ] CHK024 - É SC-005 ("navegação completa apenas com teclado") especificado com o critério de "completa" (todos os módulos? todas as aulas? incluindo módulos bloqueados)? [Mensurabilidade, Spec §SC-005] {humano}
  > SC-005 define "todos os módulos e aulas" mas não especifica se aulas bloqueadas devem ser focáveis ou apenas visíveis. Decisão de produto impacta T6 e T7.

---

## Cobertura de Cenários

- [x] CHK025 - São os cenários de trilha sem módulos cobertos com comportamento específico definido? [Cobertura, Spec §FR-014, §Edge Cases] {auto}
  > Evidência: FR-014 define estado vazio com mensagem pastoral. Edge case explícito: "painel exibe estado vazio com mensagem pastoral em PT-BR". Plan §7 define as chaves i18n.

- [x] CHK026 - São os cenários de todos os módulos bloqueados cobertos com a exceção do primeiro módulo/aula? [Cobertura, Spec §Edge Cases, §FR-005] {auto}
  > Evidência: Edge case explícito: "primeiro módulo/aula deve aparecer acessível; apenas os demais bloqueados". FR-005 e Plan §4 confirmam: primeira aula de módulo sequencial nunca bloqueada.

- [x] CHK027 - São os cenários de erro de rede cobertos com comportamento de retry e mensagem específica? [Cobertura, Spec §Edge Cases, §dec-010] {auto}
  > Evidência: Edge case: "TanStack Query executa 3 tentativas com backoff exponencial; se todas falharem, exibir error boundary com mensagem pastoral". Mensagem exata especificada. Plan §3 confirma `<TrailPlaylistError>` inline.

- [x] CHK028 - É o cenário de aula sem duração estimada coberto no fluxo de renderização do `lesson-row`? [Cobertura, Spec §FR-013, §Edge Cases] {auto}
  > Evidência: Edge case explícito. Plan §8-T4 valida via teste: `estimatedDurationMinutes: null` → nenhum "null min" renderizado.

- [x] CHK029 - É o cenário de dados atualizados após interação (US4) coberto por teste automatizado? [Cobertura, Spec §US4, §FR-010] {auto}
  > Evidência: Plan §8-T12 valida staleness via contagem de chamadas MSW e asserção de `staleTime` config. SC-006 (30s) coberto pelo teste.

- [ ] CHK030 - É o cenário de scroll do painel principal vs. scroll interno do bottom-sheet especificado para evitar conflito? [Cobertura, Spec §Edge Cases] {humano}
  > Edge case: "não deve travar o scroll da página principal". Mas não há requisito explícito de como o scroll interno do bottom-sheet é gerenciado (overflow: scroll? touch-action?). Pode gerar bug em iOS Safari.

---

## Cobertura de Edge Cases

- [x] CHK031 - São os edge cases de acessibilidade com `prefers-reduced-motion` cobertos nos requisitos de skeleton? [Cobertura, Spec §FR-008, §US3-AC3] {auto}
  > Evidência: FR-008 e US3-AC3 definem explicitamente que animação de pulso não executa com `prefers-reduced-motion`. Plan §5 implementa via `motion-safe:animate-pulse`.

- [x] CHK032 - É o edge case de "dois branches (desktop+mobile) montados simultaneamente" considerado para deduplicação de queries TanStack? [Cobertura, Plan §2] {auto}
  > Evidência: Plan §2 explica explicitamente: "data hooks dedupe via TanStack Query cache, so dual mount is free". Deduplicação é comportamento garantido pelo TanStack, não um edge case em aberto.

- [ ] CHK033 - É o edge case de módulo com zero aulas (módulo vazio) coberto nos requisitos? [Cobertura, Spec edge cases] {humano}
  > A spec cobre trilha sem módulos (FR-014) mas não define o comportamento quando um módulo existe mas não tem aulas cadastradas. Gap potencial: o accordion exibiria um módulo expandível sem conteúdo.

- [x] CHK034 - É o edge case de aula em andamento E aula de retomada (resume target) conflitantes definido com regra de precedência? [Cobertura, Plan §2 §active lesson] {auto}
  > Evidência: Plan §2 define regra explícita: "active lesson = first lesson with `status === 'in_progress'`, else the resume target from `useResumeLesson`". Precedência clara.

---

## Requisitos Não-Funcionais

- [x] CHK035 - São os requisitos de performance (CLS=0, 2.5s) especificados com método de validação na suíte de testes desta story? [RNF, Spec §SC-001/002] {auto}
  > Evidência: Plan §8-T9 valida CLS via snapshot de dimensões skeleton vs. conteúdo real. SC-001 (2,5s) é deferido para Playwright em 8-10 (documentado explicitamente).

- [x] CHK036 - É o requisito de lazy-load (FR-009) especificado com critério de "quando montar" que seja verificável por teste? [RNF, Spec §FR-009, Plan §8-T13] {auto}
  > Evidência: Plan §8-T13 define: "below-fold module not mounted until IntersectionObserver fires (mock IO)". Critério verificável via mock do IntersectionObserver no Vitest.

- [x] CHK037 - São os requisitos de cache (staleTime 5min/30s) especificados para revalidação em background vs. revalidação forçada? [RNF, Spec §FR-010, §US4-AC3] {auto}
  > Evidência: US4-AC3 define: "progresso é revalidado automaticamente em background na próxima interação". FR-010 define staleTime, não refetchInterval — revalidação por interação, não por polling.

---

## Dependências e Premissas

- [x] CHK038 - São os componentes de reuse (LockIndicator, TrailProgressBar, LessonStatusIcon) confirmados como existentes nos paths especificados? [Dependências, Plan §10] {auto}
  > Evidência: Plan §13 (dec-013 no state.json) confirma verificação empírica: "reuse hooks use-progress.ts/use-search.ts e LockIndicator/TrailProgressBar verificados presentes". Score 3 com evidência.

- [x] CHK039 - É a dependência de `@radix-ui/react-dialog` para o bottom-sheet confirmada como já presente no projeto? [Dependências, Plan §10] {auto}
  > Evidência: Plan §10 e dec-013 confirmam "@radix-ui/react-dialog dep existente p/ bottom-sheet". Sem nova dependência de pacote.

- [x] CHK040 - São as rotas de aula (`/aulas/[lessonId]`) e seu escopo (Story 8-10) documentados como premissa explícita desta story? [Dependências, Spec §Clarifications dec-007, Plan §1] {auto}
  > Evidência: Plan §1 Out of scope: "No lesson-viewer route — `onLessonSelect(lessonId)` callback only; `page.tsx` does `router.push` to route owned by Story 8-10". Premissa documentada.

---

## Notes

- Items `{auto}` resolvidos com citação de evidência dos artefatos spec/plan.
- Items `{humano}` aguardam decisão do dono do produto antes de `/execute-task`:
  - **CHK005**: animação do accordion (instantânea vs. com transição).
  - **CHK015**: estado inicial do bottom-sheet (aberto ou fechado com handle).
  - **CHK024**: definição de "navegação completa" (inclui itens bloqueados?).
  - **CHK030**: gerenciamento de scroll interno do bottom-sheet em mobile (iOS Safari).
  - **CHK033**: comportamento de módulo com zero aulas.
- Gaps abertos: nenhum bloqueante para implementação. CHK005/CHK015/CHK030 têm impacto em UX; CHK024/CHK033 têm impacto em testes.
- Marcar items concluídos com `[x]` conforme implementação avança.
