# Checklist de Teste Manual — a11y-touch-motion (Story 12.4)

**Escopo:** Touch targets em dispositivos reais iOS/Android; Reduced-motion no SO.
**Ref:** NFR-A2, FR-1.1, FR-1.2, FR-2.1–2.4, FR-3.1–3.4, WCAG 2.5.5

---

## Responsáveis

| Fase | Responsável | Quando |
|------|-------------|--------|
| Validação de touch targets e feedback | Dev | Pré-merge (branch `feat/12-4-a11y-touch-motion`) |
| Validação de reduced-motion | Dev | Pré-merge |
| Revalidação em staging | QA | Pré-release (staging, após merge em `dev`) |

---

## Seção 1 — Touch Targets (FR-1 / WCAG 2.5.5)

### 1.1 Dispositivos iOS

**Dispositivos recomendados:** iPhone SE (tela pequena, pior caso), iPhone 14 (padrão).
**Browser:** Safari (WebKit nativo).

- [ ] **Button (size:default)** — toque sem dificuldade; sem necessidade de tentar duas vezes.
- [ ] **Button (size:icon)** — `h-11 w-11` visível; ícone X no Dialog alcançável com polegar.
- [ ] **Button (size:sm)** — `min-h-[44px]` verificável inspecionando elemento em Safari DevTools → Inspect Element → computed height ≥ 44px.
- [ ] **Input** — campo de texto com altura mínima 44px (verificar formulário de login e onboarding).
- [ ] **Sidebar** — links de navegação laterais com `min-h-[44px]`; acionáveis sem seleção acidental do item adjacente.
- [ ] **BottomTabs** — tabs inferiores com área de toque confortável; sem sobreposição entre tabs adjacentes.
- [ ] **Dialog close button** — botão X do Dialog com área ≥ 44×44px; alcançável com polegar no canto superior direito.
- [ ] **Radar pills** — cada pill clicável com altura ≥ 44px em viewport mobile.
- [ ] **Plan-card actions** — botões de ação do plano com tamanho adequado.
- [ ] **Espaçamento entre alvos** — nenhum par de alvos adjacentes com menos de 8px de espaçamento (SC 2.5.8 / FR-1.3).

### 1.2 Dispositivos Android

**Dispositivos recomendados:** Pixel 5 (referência CI), Samsung Galaxy A-series.
**Browser:** Chrome for Android.

- [ ] Repetir todos os itens de 1.1 em Chrome para Android.
- [ ] Verificar que `active:` estados (feedback de toque) são visíveis imediatamente ao tocar (sem atraso de transition).

---

## Seção 2 — Feedback Visual ao Toque (FR-2 / WCAG 2.5.3)

### 2.1 Estados `:active` — verificação visual

Para cada componente abaixo, pressionar e **manter** o dedo/clique e observar o feedback visual:

- [ ] **Button (todas as variantes)** — escurecimento imediato (`active:scale-[0.98]` + `active:opacity-90`); sem atraso.
- [ ] **Sidebar links** — feedback `active:opacity-80` visível.
- [ ] **BottomTabs** — feedback `active:opacity-80` ao tocar tab.
- [ ] **Dialog close button** — feedback `active:opacity-80` ao pressionar X.
- [ ] **Radar pills** — feedback `:active` visível e distinto do estado hover.
- [ ] **Plan-card buttons** — feedback imediato ao pressionar.
- [ ] **Confirmar** que nenhum `hover:` precede o `:active` (em touch, hover pode travavar sem cursor real).

### 2.2 Ausência de delay no `:active`

- [ ] Inspecionar que `transition-all delay-*` ou `transition-opacity duration-*` **não** atrasa o estado `:active` em nenhum componente (FR-2.2).

---

## Seção 3 — Reduced Motion no SO (FR-3 / WCAG 2.3.3)

### 3.1 Configuração do SO

**iOS:** Ajustes → Acessibilidade → Movimento → Reduzir Movimento → Ativar.
**Android:** Configurações → Acessibilidade → Texto e exibição → Remover animações → Ativar.
**macOS:** Preferências do Sistema → Acessibilidade → Monitor → Reduzir movimento.
**Windows:** Configurações → Facilidade de Acesso → Exibição → Mostrar animações no Windows → Desativar.

### 3.2 Verificações com Reduced Motion ativo

- [ ] **Dialog** — abre e fecha **sem** animação fade/zoom/slide (conteúdo aparece instantaneamente).
- [ ] **Skeleton loaders** — `animate-pulse` suprimido; skeletons aparecem estáticos (safety net CSS global ativa).
- [ ] **Skip-nav link** — sem animação de deslizamento ao receber foco (apenas aparece).
- [ ] **Button hover/active** — sem transição de cores; estado muda instantaneamente.
- [ ] **Sidebar** — sem transição ao abrir/fechar se aplicável.
- [ ] **live-status-bar dot** — `animate-pulse` do ponto de reunião ativa suprimido (isenção documentada — aceitar visual estático).
- [ ] **Verificar** que nenhuma animação de interface principal persiste com reduced-motion ativo.

### 3.3 Safety net global (CSS)

- [ ] Confirmar via DevTools → Computed Styles que `@media (prefers-reduced-motion: reduce)` aplica `animation-duration: 0.01ms; transition-duration: 0.01ms` em `packages/ui/styles/globals.css`.

---

## Seção 4 — Regressão Visual

- [ ] **Formulários de login/onboarding** — campos `Input` com `h-11` não quebram layout (verificar em viewport 375px e 768px).
- [ ] **Marketing-nav** — links de navegação com touch target correto sem quebrar alinhamento desktop.
- [ ] **Dialog** — abertura/fechamento funcional em mobile após ajustes de motion-safe.
- [ ] **Sidebar desktop** — links com `min-h-[44px]` não causam espaçamento excessivo em viewport ≥ 768px.

---

## Critério de Conclusão

Todos os itens acima marcados `[x]` por dev **antes do merge** (itens de staging por QA **antes do release**).
Falhas bloqueiam merge; registrar issue com screenshot/gravação de tela se necessário.

**Última execução:** _a preencher pelo responsável_
**Responsável (dev):** _a preencher_
**Responsável (QA):** _a preencher_
