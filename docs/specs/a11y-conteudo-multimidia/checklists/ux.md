# UX Checklist: a11y-conteudo-multimidia (Story 15.5)

**Purpose**: Valida a qualidade dos requisitos de UX — hierarquia visual, estados de interação, feedback ao usuário, navegação, responsividade e consistência para as 3 frentes (Lesson Viewer, Plyr, Admin gaps).
**Created**: 2026-06-25
**Feature**: [spec.md](../spec.md)

---

## Hierarquia Visual e Estrutura de Página

- [x] CHK301 - A posição do `<h1>` (nome da aula) como "primeiro conteúdo" da página está especificada? [Completude, Spec §2 Frente A, FR-003] {auto}
  > Evidência: Spec §2 Frente A "h1=nome da aula; hierarquia de headings"; FR-003 "`<h1>` = nome da aula; único por página".

- [ ] CHK302 - Está definida a hierarquia visual entre o `<h1>` da aula, o `<h1>` do player/conteúdo e o botão de navegação — qual é a ordem visual na página? [Completude, Spec §FR-001, Gap] {auto}
  > [Gap]: Spec define que `<h1>` existe e que os ramos de contentType são renderizados, mas não especifica o layout da página de aula: header com h1 no topo, depois o player/conteúdo, depois o botão "Próxima aula"? Ou player em destaque com h1 acima? Sem layout documentado, implementações divergentes são possíveis.

- [x] CHK303 - A tabela admin (`/admin/accessibility-gaps`) tem títulos de coluna definidos em PT-BR? [Completude, Spec §Plan §3.1.4] {auto}
  > Evidência: Plan §3.1.4 `messages/pt-BR.json` com `columns: { lesson: "Aula", module: "Módulo", trail: "Trilha" }`.

---

## Estados e Feedback ao Usuário

- [x] CHK304 - O estado de carregamento da tabela admin está especificado com mensagem PT-BR? [Completude, Spec §Plan §3.1.4] {auto}
  > Evidência: Plan §3.1.4 `messages/pt-BR.json` com `loading: "Carregando..."`.

- [x] CHK305 - O estado de erro da tabela admin está especificado com mensagem PT-BR e ação de retry? [Completude, Spec §Plan §3.1.4] {auto}
  > Evidência: Plan §3.1.4 `messages/pt-BR.json` com `error: "Erro ao carregar dados."`. (Nota: spec/plan não especificam botão de retry — ver CHK306 abaixo.)

- [ ] CHK306 - Está definido se o estado de erro na tabela admin deve ter botão "Tentar novamente" (como em `grupos/page.tsx`) ou apenas mensagem? [Completude, Spec §CA-004.4, Gap] {auto}
  > [Gap]: CA-004.4 define "exibe estado vazio" mas não especifica estado de erro. Plan §3.1.4 tem `error: "Erro ao carregar dados."` mas sem mencionar retry. `grupos/page.tsx` (padrão que a spec instrui espelhar) tem botão "Tentar novamente" — consistência sugere que sim, mas não está documentado.

- [x] CHK307 - O estado vazio da tabela admin ("nenhuma aula com problemas") está especificado com mensagem PT-BR? [Completude, Spec §CA-004.4, Plan §3.1.4] {auto}
  > Evidência: CA-004.4 "exibe estado vazio se nenhuma aula com alt-text ausente"; Plan §3.1.4 `empty: "Nenhuma aula com problemas de acessibilidade encontrada."`.

- [ ] CHK308 - Está definido o estado de feedback do `LessonNavigationButton` quando é a **última aula da trilha** (sem próxima) — botão desaparece, fica desabilitado, ou muda para "Concluir"? [Completude, Spec §FR-004, Plan §3.2, Gap] {auto}
  > [Gap]: Plan §3.2 lista "Concluir trilha" como variante do botão de navegação, mas não especifica se esse estado é diferente visualmente do "Próxima aula", qual é o destino do clique ("Concluir" navega para onde?), ou se o botão deve sumir quando não há próxima aula.

---

## Navegação e Fluxo

- [x] CHK309 - O roteamento do botão de navegação (próxima aula → URL da próxima aula; próximo módulo → URL da primeira aula do próximo módulo) está especificado? [Completude, Spec §FR-004, Plan §3.2] {auto}
  > Evidência: Plan §3.2 "Próxima aula se `nextLesson` no mesmo módulo; Próximo módulo se fim do módulo; Concluir trilha se fim da trilha"; Plan §3.2 "Ref ligado ao `nextModuleButtonRef`".

- [ ] CHK310 - Está especificado se o playlist panel (aside com lista de aulas) permanece visível na página de aula ou é substituído pelo conteúdo da aula? [Completude, Spec §FR-001, Gap] {auto}
  > [Gap]: `trail-playlist-route.tsx` cria um aside fixo com a playlist de aulas. Ao navegar para `/aulas/[lessonId]`, não está definido se esse panel deve continuar visível (para o usuário ver o progresso na trilha) ou se a rota de aula é uma tela standalone. Decisão impacta layout e UX de contexto.

- [x] CHK311 - O clique em aula na playlist que já redireciona para `/aulas/[lessonId]` está documentado como mecanismo existente (não novo)? [Completude, Spec §1, Plan] {auto}
  > Evidência: Spec §1 "trail-playlist-route.tsx já redireciona para ela" — o mecanismo de navegação da playlist para a rota de aula já existe (handleLessonSelect em trail-playlist-route.tsx).

---

## Responsividade

- [ ] CHK312 - Estão definidos os requisitos de layout responsivo para a página de aula (`/aulas/[lessonId]`) — mobile vs. desktop? [Completude, Spec §FR-001, Gap] {auto}
  > [Gap]: A spec não especifica comportamento responsivo da página de aula. O projeto tem pattern mobile-first com breakpoints `md:` e `lg:`. Sem requisito, o implementador pode criar layout apenas desktop.

- [ ] CHK313 - Está especificado o comportamento do player Plyr em telas pequenas (mobile) — controles de tela cheia em fullscreen API, tamanho mínimo do player? [Completude, Spec §FR-005, Gap] {auto}
  > [Gap]: Spec define i18n PT-BR do botão de fullscreen mas não especifica comportamento mobile do Plyr (ex: player ocupa 100% da largura, controles visíveis sem hover em touch screens). Plyr tem comportamento mobile padrão, mas requisitos de customização não estão documentados.

---

## Consistência e Padrões

- [x] CHK314 - Os componentes reutilizados (`PdfViewer`, `ExternalLinkView`) estão identificados como reuso (não reimplementação) no plan? [Completude, Spec §Plan §3.2] {auto}
  > Evidência: Plan §3.2 "switch contentType: `case 'pdf_doc': return <PdfViewer ...>`; `case 'external_link': return <ExternalLinkView ...>`" — reutilização explícita.

- [x] CHK315 - Os textos user-facing em PT-BR estão todos centralizados em `messages/pt-BR.json`? [Completude, Spec §6, FR-017] {auto}
  > Evidência: Spec §6 Convenções "Textos user-facing em `apps/web/messages/pt-BR.json`"; FR-017 "Textos PT-BR em `messages/pt-BR.json` (`admin.accessibilityGaps.*`)".

- [ ] CHK316 - Estão definidos os textos PT-BR do `LessonNavigationButton` ("Próxima aula", "Próximo módulo", "Concluir trilha") em `messages/pt-BR.json`? [Completude, Spec §FR-017, Gap] {auto}
  > [Gap]: FR-017 define `admin.accessibilityGaps.*` em pt-BR.json, mas o botão de navegação da aula também tem textos user-facing ("Próxima aula" / "Próximo módulo" / "Concluir trilha") que precisam de entrada em `messages/pt-BR.json`. Não está especificado em FR-017 nem no plan.

- [ ] CHK317 - Os textos i18n PT-BR do Plyr (`Reproduzir`, `Pausar`, etc.) devem estar em `messages/pt-BR.json` ou são passados diretamente como objeto nas opções do Plyr? [Completude, Spec §FR-005, Ambiguity] {auto}
  > [Ambiguity]: Plan §3.3 define os textos PT-BR do Plyr como objeto literal inline nas opções do Plyr (`i18n: { play: 'Reproduzir', ... }`). Isso diverge da convenção do projeto de centralizar textos em `messages/pt-BR.json`. A spec não esclarece se a convenção se aplica a i18n de bibliotecas externas ou apenas a strings exibidas diretamente na UI.

---

## Notes

- Items `{auto}` resolvidos com `[x]` têm citação de evidência explícita
- **Gaps abertos ([ ] {auto})**: CHK302, CHK306, CHK308, CHK310, CHK312, CHK313, CHK316, CHK317

### Follow-up dos Gaps

| Gap | Destino |
|-----|---------|
| CHK302 — layout da página de aula | Adicionar em spec §FR-001 ou plan §3.2: wireframe/descrição de layout (h1 → conteúdo → nav button) |
| CHK306 — retry no estado de erro admin | Especificar CA-004.4: "estado de erro exibe mensagem + botão Tentar novamente" |
| CHK308 — comportamento última aula | Especificar FR-004: "última aula da trilha: botão muda para 'Concluir trilha', navega para `/app/consumo/trilhas/{trailId}`" |
| CHK310 — playlist panel na rota de aula | Especificar FR-001: "página de aula é standalone; playlist panel não aparece (rota separada)" ou "playlist permanece como aside" |
| CHK312 — responsivo da página de aula | Especificar FR-001: "mobile: player ocupa 100vw, botão de navegação full-width; desktop: conteúdo centralizado max-w-4xl" |
| CHK313 — Plyr mobile | Especificar FR-005: "mobile: player ocupa 100% da largura; controles visíveis em touch (não apenas hover)" |
| CHK316 — textos botão navegação em pt-BR.json | Adicionar à FR-017: "incluir `lesson.navigation.nextLesson`, `lesson.navigation.nextModule`, `lesson.navigation.completeTrail`" |
| CHK317 — i18n Plyr em messages.json ou inline | Especificar FR-005: "textos de i18n do Plyr são passados como objeto inline (biblioteca externa, não diretamente user-facing via i18n framework)" |
