# Spec: a11y-touch-motion
## Touch Targets, Reduced Motion & Mobile Feedback (Story 12.4)

**Status:** clarificado  
**NFR:** NFR-A2 (Acessibilidade), UX-DR19  
**Referência autoritativa:** `_bmad-output/implementation-artifacts/12-4-touch-targets-reduced-motion-mobile-feedback-nfr-a2-ux-.md`  
**Depende de:** Story 12.1 (teclado público), 12.2 (teclado autenticado), 12.3 (contraste/focus)  
**Epic:** Epic 12 — Acessibilidade

---

## Objetivo

Garantir que todos os elementos interativos da aplicação sejam operáveis por toque em dispositivos móveis com tamanhos de alvo adequados (WCAG 2.5.x), que animações e transições respeitem a preferência de sistema `prefers-reduced-motion`, e que haja feedback visual/tátil imediato ao toque — sem depender exclusivamente de estados `hover`.

---

## User Stories

### US-1 — Tamanhos mínimos de touch target

**Como** usuário de dispositivo móvel (iOS/Android),  
**Quero** que todos os controles interativos tenham área de toque de no mínimo 44x44 CSS px com espaçamento mínimo de 8 px entre alvos adjacentes,  
**Para que** eu possa acionar botões, links e controles com facilidade, sem errar o toque ou ativar o elemento errado.

**Contexto:** Cobre botões, links, inputs, checkboxes, radio buttons, tabs de navegação (bottom-nav e sidebar), ítens de menu e cards com área de CTA. Aplica-se primariamente ao viewport mobile (< md); em desktop, o tamanho mínimo é 24x24 px (WCAG 2.5.8 AA) com espaçamento compensatório.


---

### US-2 — Feedback visual imediato ao toque

**Como** usuário de dispositivo com tela sensível ao toque,  
**Quero** receber feedback visual imediato quando toco em um elemento interativo (estado :active),  
**Para que** eu saiba que meu toque foi registrado e não repita a ação desnecessariamente.

**Contexto:** O feedback deve ser imediato (sem delay de transição) e não depender de hover. Aplica-se especialmente a usuários com deficiências cognitivas que precisam de confirmação visual da ação. O estado hover não existe em touch — controles que dependem apenas de hover para indicar interatividade são inacessíveis em mobile.

---

### US-3 — Respeito a prefers-reduced-motion

**Como** usuário que ativou "Reduzir movimento" no sistema operacional,  
**Quero** que a aplicação desative ou reduza animações e transições não-essenciais,  
**Para que** eu não experiencie desconforto, náusea ou desorientação causada por movimento na tela.

**Contexto:** Cobre page transitions, animações de skeleton/shimmer, entrada/saída de toasts, abertura/fechamento de dropdowns, e qualquer outro elemento animado. Animações "essenciais" (ex.: indicadores de progresso sem alternativa não-animada) podem ser mantidas com duração reduzida ao mínimo.


---

## Functional Requirements

### FR-1 — Tamanho mínimo de touch target (US-1)

**FR-1.1** Todo elemento interativo (<button>, <a>, <input>, <select>, <textarea>, <label> associado a checkbox/radio, item de tab, item de sidebar/bottom-nav) DEVE ter área de toque de no mínimo **44x44 CSS px** em viewport mobile (breakpoint < md, i.e. < 768 px).

**FR-1.2** O tamanho pode ser atingido via: dimensões intrínsecas (width/height), padding de preenchimento, ou `min-h-[44px] min-w-[44px]` em Tailwind. Área de clique estendida via pseudo-elemento (::after) é permitida quando o elemento visualmente menor faz parte de layout compacto (ex.: ícone de 24 px com pseudo-elemento 44x44).

**FR-1.3** A distância mínima entre bordas de dois alvos adjacentes DEVE ser **>= 8 CSS px** (previne toques acidentais).

**FR-1.4** Em viewport desktop (>= md), o tamanho mínimo é **24x24 CSS px** com espaçamento compensatório quando a distância entre alvos adjacentes for < 24 px (WCAG 2.5.8 AA). Classes responsivas Tailwind (md:) podem relaxar o constraint para desktop.

**FR-1.5** Os seguintes componentes são identificados como candidatos primários de auditoria, por risco elevado de subconformidade:
- Bottom navigation (mobile bottom-tabs — se implementado)
- Sidebar navigation items
- Botões de ação dentro de cards (CTA inline)
- Checkboxes e radio buttons (especialmente em formulários de onboarding)
- Links inline em blocos de texto (ex.: onboarding/import-result-summary.tsx, content/trail-progress-bar.tsx)

---

### FR-2 — Feedback visual ao toque (US-2)

**FR-2.1** Todo elemento interativo DEVE exibir estado visual de `:active` imediato ao toque. O padrão APROVADO é uma das seguintes implementações via Tailwind:
- `active:opacity-80` (redução de opacidade de 20%)
- `active:scale-[0.98]` (leve compressão visual)
- Combinação dos dois

**FR-2.2** O feedback de `:active` DEVE ser livre de delay de transição. Não é permitido `transition-all delay-*` ou `transition-opacity duration-*` que postergue a manifestação do estado `:active`.

**FR-2.3** Uma classe utilitária compartilhada DEVE ser criada (ex.: classe Tailwind customizada `touch-feedback` ou composição padronizada via variante de componente shadcn/ui) para garantir consistência em toda a codebase.

**FR-2.4** O feedback de `:active` DEVE ser visualmente distinguível do estado `hover` quando ambos coexistirem (ex.: em dispositivos com mouse e toque simultâneos).

---

### FR-3 — Respeito a prefers-reduced-motion (US-3)

**FR-3.1** Toda animação ou transição CSS que produza movimento perceptível DEVE ser suprimida ou reduzida a troca instantânea quando o sistema reportar `prefers-reduced-motion: reduce`.

**FR-3.2** A implementação DEVE usar uma das seguintes estratégias (em ordem de preferência):
1. **Prefixo Tailwind `motion-safe:`** — anteposte `motion-safe:` a qualquer utilitário de animação/transição (ex.: `motion-safe:animate-spin`, `motion-safe:transition-opacity`).
2. **Media query direta no CSS** — `@media (prefers-reduced-motion: reduce) { ... }` quando Tailwind não cobrir o caso (ex.: animações em arquivos .css globais ou keyframes custom).

**FR-3.3** Uma regra CSS global de segurança (safety net) DEVE ser adicionada ao arquivo de estilos globais (`apps/web/app/globals.css` ou equivalente):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Esta regra atua como fallback para qualquer animação não coberta pelos prefixos `motion-safe:`.

**FR-3.4** Os seguintes elementos animados são identificados como escopo primário de conformidade:
- **Page transitions:** desabilitar ou reduzir a fade instantâneo
- **Toast (Sonner/shadcn):** entrada/saída sem slide ou fade animado — exibição instantânea
- **Skeleton shimmer:** desabilitar animação de shimmer; exibir skeleton estático
- **Dropdown/Popover open/close:** transição instantânea; sem slide, scale ou fade animado
- **Qualquer `animate-*` de Tailwind** (ex.: animate-pulse, animate-spin, animate-bounce)

**FR-3.5** A auditoria de animações deve cobrir: (a) utilitários Tailwind `animate-*` e `transition-*` em .tsx/.css, (b) keyframes custom em CSS global, (c) bibliotecas de animação se adotadas (nenhuma detectada no codebase atual).

---

### FR-4 — Testes automatizados (US-1, US-2, US-3)

**FR-4.1** DEVE existir teste E2E Playwright em `apps/web/e2e/a11y/reduced-motion.e2e-spec.ts` cobrindo:
- Verificar que toast aparece sem animação de slide com `emulateMedia({ reducedMotion: 'reduce' })`
- Verificar que dropdown abre sem transição de motion com `emulateMedia({ reducedMotion: 'reduce' })`
- Verificar que skeleton não tem shimmer animado com `emulateMedia({ reducedMotion: 'reduce' })`

**FR-4.2** DEVE existir teste E2E Playwright em `apps/web/e2e/a11y/touch-targets.e2e-spec.ts` cobrindo:
- Verificar touch targets >= 44x44 px em viewport mobile (iPhone 12 ou equivalente Playwright)
- Verificar espaçamento >= 8 px entre alvos adjacentes de navegação

**FR-4.3** Testes unitários via `jest-axe` DEVEM incluir asserção de touch target sizing para componentes de Button, Link e NavigationItem do `packages/ui`.

**FR-4.4** Testes manuais em dispositivo real (iOS Safari + Android Chrome) são OBRIGATÓRIOS como gate de aceite final.

---

## Success Criteria

### SC-1 — Touch targets (US-1)

| # | Critério | Mensurável? | Método de verificação |
|---|----------|-------------|----------------------|
| SC-1.1 | 100% dos elementos interativos em viewport mobile têm min-height >= 44 px e min-width >= 44 px | Sim | Playwright getBoundingClientRect() em mobile viewport |
| SC-1.2 | 0 pares de alvos adjacentes com espaçamento < 8 px em navegação | Sim | Playwright: calcular distância entre bounding rects de ítens adjacentes |
| SC-1.3 | Auditoria manual em iOS Safari e Android Chrome confirma toque sem erros em 100% dos controles primários | Sim | Checklist de teste manual documentado em docs/tests/manual/touch-targets.md |

### SC-2 — Feedback ao toque (US-2)

| # | Critério | Mensurável? | Método de verificação |
|---|----------|-------------|----------------------|
| SC-2.1 | Todos os botões, links, tabs e cards CTA possuem active:opacity-80 ou active:scale-[0.98] | Sim | grep/AST scan no código-fonte |
| SC-2.2 | Nenhum elemento interativo com :active possui transition-duration > 0ms afetando a manifestação do estado | Sim | Inspeção de CSS gerado + teste manual com DevTools mobile |
| SC-2.3 | Classe utilitária touch-feedback (ou equivalente) existe no preset Tailwind ou em componente base | Sim | Presença no arquivo packages/config/tailwind.preset.css ou em variante de componente |

### SC-3 — Reduced motion (US-3)

| # | Critério | Mensurável? | Método de verificação |
|---|----------|-------------|----------------------|
| SC-3.1 | Regra CSS global prefers-reduced-motion presente em apps/web/app/globals.css | Sim | grep prefers-reduced-motion no arquivo |
| SC-3.2 | Todos os utilitários animate-* e transition-* no código de produção têm prefixo motion-safe: OU são cobertos pela regra global | Sim | grep/audit: utilitários sem motion-safe: que gerem motion são findings |
| SC-3.3 | Teste E2E Playwright passa com emulateMedia({ reducedMotion: 'reduce' }): toast, dropdown e skeleton não exibem animação de movimento | Sim | pnpm --filter web test:e2e -- e2e/a11y/reduced-motion.e2e-spec.ts passa em CI |
| SC-3.4 | Nenhuma animação essencial (sem substituto não-animado) é suprimida sem substituto funcional | Sim (qualitativo) | Revisão manual da lista de isenções documentada |

### SC-4 — Testes (FR-4)

| # | Critério | Mensurável? | Método de verificação |
|---|----------|-------------|----------------------|
| SC-4.1 | apps/web/e2e/a11y/reduced-motion.e2e-spec.ts existe e passa em CI | Sim | CI green em PR |
| SC-4.2 | apps/web/e2e/a11y/touch-targets.e2e-spec.ts existe e passa em CI | Sim | CI green em PR |
| SC-4.3 | jest-axe no packages/ui inclui asserção de touch target para Button, Link e NavigationItem | Sim | Presença dos casos nos arquivos *.spec.ts correspondentes |

---

## Clarifications

> Sessão de clarificação resolvida autonomamente em 2026-06-17 (clarify-answerer, heurística score 0..3). Ambos os pontos de clarificação resolvidos com score 2 — sem pausa humana.

### NC-1 (US-1 / FR-1.1) — RESOLVIDO (score 2)

**Pergunta:** Nível WCAG alvo para touch targets — 44x44 px (WCAG 2.5.5 AAA) ou 24x24 px com espaçamento (WCAG 2.5.8 AA)?

**Decisão:** Abordagem **híbrida** (opção c), já codificada em FR-1.1 e FR-1.4:
- **44x44 CSS px** como alvo de design em viewport mobile (< md, < 768 px) — alinhado à spec autoritativa 12-4, Apple HIG (44 pt) e Google Material (48 dp).
- **24x24 CSS px + espaçamento compensatório** como mínimo de fallback aceitável em viewport desktop (>= md), conforme WCAG 2.5.8 AA, e onde 44 px for inviável em layout compacto.

**Justificativa:** A referência autoritativa 12-4 usa 44x44 px como padrão definitivo. O público pastoral inclui idosos e usuários de baixa destreza (briefing), para quem 44 px é mensuravelmente melhor. A spec já reflete a decisão híbrida em FR-1.1 (44 mobile), FR-1.4 (24 desktop) e SC-1.1.

**Score de autonomia:** 2 — suporte de referência autoritativa + padrões da indústria (HIG/Material) + briefing.

### NC-2 (US-3 / FR-3.4) — RESOLVIDO (score 2)

**Pergunta:** Qual o critério formal para classificar uma animação como "essencial" e isenta da supressão por `prefers-reduced-motion`?

**Decisão (critério formal):** Uma animação é **essencial** — e portanto isenta de supressão total — **somente quando sua remoção eliminaria informação de estado sem que exista substituto não-animado disponível** (ex.: spinner de loading sem texto de porcentagem/label de progresso; barra de progresso de upload sem valor numérico alternativo). Animações essenciais isentas PODEM manter duração mínima, mas **não** movimento decorativo.

**Não-essenciais (sempre suprimidas/reduzidas a troca instantânea sob reduced-motion):** toasts (entrada/saída), skeleton shimmer, page transitions, dropdown/popover open-close, hover, parallax, e qualquer `animate-*`/`transition-*` decorativo. Toasts e skeletons **NUNCA** são isentos.

**Justificativa:** Único critério auditável das opções avaliadas (Constitution Princípio VI — Qualidade Verificável); alinhado a WCAG 2.3.3 (Animation from Interactions) e à orientação MDN de `prefers-reduced-motion`. Diretamente suportado por US-3 (contexto), FR-3.4 (lista de supressão) e SC-3.4 (substituto funcional obrigatório).

**Evidência (WCAG 2.3.3):** animação é essencial quando "removing the animation would substantially change the information or functionality of the content, and information and functionality cannot be achieved in another way".

**Score de autonomia:** 2 — critério técnico padrão WCAG/MDN ancorado; sem necessidade de decisão de produto.

---

## Dependências

| Dependência | Tipo | Impacto |
|-------------|------|---------|
| Story 12.1 (teclado público) | Predecessora | Componentes de navegação pública devem estar em conformidade de keyboard antes do audit de touch |
| Story 12.2 (teclado autenticado) | Predecessora | Idem para área autenticada |
| Story 12.3 (contraste/focus) | Predecessora | Focus rings visíveis devem estar presentes antes de auditoria de touch |
| Epics 1-11 (componentes) | Predecessora | Componentes auditados devem existir no código-fonte |
| packages/config/tailwind.preset.css | Técnica | Tokens de spacing/sizing base-4px usados nos utilitários de touch target |
| Playwright 1.59.1 | Técnica | emulateMedia({ reducedMotion: 'reduce' }) requer >= 1.12 — satisfeito |

---

## Fora do Escopo

- Acessibilidade de leitores de tela (screen readers) — spec separada
- Contraste de cores e focus rings — Story 12.3 (a11y-contraste-focus)
- Navegação por teclado — Stories 12.1 e 12.2
- Animações de terceiros (ex.: bibliotecas de charts) — fora do escopo nesta iteração
- Haptic feedback nativo (Vibration API) — fora do escopo
