# Epic 15 — Gate de Teste Manual com Screen Readers (DoD transversal)

> **Este é o único item do Epic 15 que NÃO pode ser automatizado.** A pipeline entregou
> código ARIA/semântico + axe-core verde no CI + roteiros por story. Falta a execução
> humana com leitores de tela reais. Sem isso, o DoD do épico não está 100% fechado.

## O que o DoD exige (epic-15.md)
Relatório de teste manual com **pelo menos 3 screen readers**:
- **VoiceOver** (macOS/Safari e/ou iOS)
- **NVDA** (Windows/Chrome ou Firefox)
- **TalkBack** (Android/Chrome) — ou **JAWS** (Windows) como terceira opção

Documentar por área: o que foi testado, issues encontradas, issues corrigidas. **Nenhum
blocker crítico** (conteúdo inacessível) remanescente. Designar um "accessibility champion"
responsável por validar e manter o checklist.

**Baseline axe-core:** já coberto e verde no CI (job E2E + A11y Checks) em todas as rotas
críticas; o gate ratchet de páginas autenticadas permanece em `baseline` (ver nota abaixo).

## Roteiros por story (executar cada um com os 3 leitores)
| Story | Roteiro | Áreas |
|-------|---------|-------|
| 15.1 | `docs/specs/a11y-screen-reader-auth/manual-test-checklist.md` | Login, registro, recuperação de senha, navegação global, landmarks, onboarding |
| 15.2 | `docs/specs/a11y-screen-reader-dashboard/manual-test-checklist.md` | Dashboard líder, radar, listas de participantes, ParticipantCard, SSE aria-live (batch/reconexão/silenciar) |
| 15.3 | `docs/specs/a11y-semaforo-multimodal/manual-test-checklist.md` | Semáforo: daltonismo (ícone+texto sem cor), prefers-reduced-motion, dark mode, anúncio de transição |
| 15.4 | `docs/specs/a11y-screen-reader-trilhas/manual-test-checklist.md` | Trilhas (listagem/detalhe/progresso), "Módulo N de T", progressbar, player de vídeo (teclado, foco fim de vídeo) |

## Atenção a pontos levantados na review (validar manualmente)
- **15.2/15.3** — confirmar **ausência de duplo-anúncio** do nome no ParticipantCard / badge do semáforo (o nome já está no `<h3>`; o badge/aria-label não deve repetir de forma confusa).
- **15.1/15.3** — landmarks `<header>/<footer>` foram adicionados (alguns vazios nas páginas auth): avaliar se o "banner/contentinfo" vazio atrapalha a navegação por landmarks.
- **15.3** — confirmar que **forma do ícone** (não a cor) distingue os 3 estados do semáforo; e que o pulso de transição respeita prefers-reduced-motion. (Nota: o pulso por SSE ainda não é acionado automaticamente — ver follow-up.)
- **15.4** — player de vídeo é o `<video>` nativo endurecido (Plyr fica para a 15.5); validar controles nativos por teclado e o anúncio "Vídeo concluído".

## Débito conhecido (não-bloqueante, documentado)
- **Ratchet axe autenticado**: `dashboard-lider`, `radar-pastoral`, `trilhas-discipulado`
  permanecem em modo `baseline` no `a11y-pages.json` (axe já dá 0 violações, mas o gate não
  é bloqueante por causa de flake de load autenticado em CI). Promover a `hard` num follow-up
  após estabilizar o carregamento autenticado no E2E.
- **Contraste `text-care-*`**: tokens pastorais com contraste 2.2–3.7:1 (uso sistêmico
  pré-existente no radar) — candidato a revisão de design-system separada.
- **Follow-up 15.5**: Plyr, governança de alt-text (flag + admin), botão "Próximo módulo".
  Ver `_bmad-output/implementation-artifacts/epic-15-followup-15-5.md`.

## Como registrar o resultado
Após executar, preencher os checklists por story (marcar PASS/FAIL por cenário) e anexar um
resumo aqui (data, leitores usados, issues abertas). Issues críticas viram correções antes
de considerar o épico plenamente fechado; issues menores viram backlog.
