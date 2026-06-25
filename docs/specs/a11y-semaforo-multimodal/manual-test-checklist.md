# Manual Test Checklist — Story 15.3 Semáforo Multimodal

**Componentes em escopo**: `SemaforoStatusBadge`, `ParticipantCard` (Expanded + Medium), `SemaforoPill`, `SemaforoBadge` (admin/relatorio).

> GATE HUMANO PENDENTE: os itens marcados com `[HUMANO]` requerem validação
> com tecnologia assistiva real (VoiceOver/NVDA/JAWS) ou visual regression.
> Os itens sem essa marcação podem ser validados no ambiente de desenvolvimento.

---

## 1. Daltonismo — ícone + texto distinguem sem cor

**Contexto**: WCAG 1.4.1 — a cor nunca deve ser o único meio de transmissão.
O semáforo multimodal usa cor + ícone Lucide + texto visível.

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 1.1 | SemaforoStatusBadge em escala de cinza: 3 estados são distinguíveis por **forma do ícone** (AlertCircle / AlertTriangle / CheckCircle2) | Simular com filtro de escala de cinza no browser (F12 → Rendering → Emulate vision deficiency → Achromatopsia) | `[ ]` |
| 1.2 | SemaforoStatusBadge em escala de cinza: texto "Urgente" / "Atenção necessária" / "Bem" é legível e distinto | Mesmo filtro de escala de cinza | `[ ]` |
| 1.3 | SemaforoPill: o ícone Lucide ao lado da contagem distingue os 3 estados sem cor | Filtro de escala de cinza | `[ ]` |
| 1.4 | SemaforoBadge (admin): ícones Lucide (CheckCircle2/AlertTriangle/AlertCircle) distinguem verde/amarelo/vermelho sem cor | Filtro de escala de cinza | `[ ]` |
| 1.5 | Modo compacto (`compact=true`): ícone + texto abreviado são identificáveis sem cor | Inspecionar no browser com modo compacto ativo | `[ ]` |

---

## 2. prefers-reduced-motion

**Contexto**: CSS `motion-safe:` suprime animações automaticamente. Nenhum JS é necessário.

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 2.1 | Quando `animatePulse=true`: animação `pulse-border` está visível em modo normal | Forçar `animatePulse=true` em dev; confirmar pulso de borda aparece | `[ ]` |
| 2.2 | Com `prefers-reduced-motion: reduce`: animação de pulso NÃO aparece (apenas `transition-opacity`) | F12 → Rendering → Emulate CSS media feature → prefers-reduced-motion: reduce | `[ ]` |
| 2.3 | Com `prefers-reduced-motion: reduce`: demais transições do componente (hover, focus ring) também NÃO animam | Mesmo setting de reduced-motion; hover e focus ainda funcionam mas sem transições | `[ ]` |
| 2.4 | Gate de CI `check-motion-safe.sh --ci` passa com 0 findings | Já validado automaticamente no pipeline | `[x]` |

---

## 3. Dark mode — contraste ≥ 3:1

**Contexto**: Tokens `care-*` são redefinidos em `.dark` (tokens.css). Color2k valida os 6 pares.

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 3.1 | SemaforoStatusBadge no dark mode: todos os 3 estados são visíveis com contraste adequado | Toggle `.dark` class no body; inspecionar badges | `[ ]` |
| 3.2 | SemaforoPill no dark mode: ícone + contagem legíveis | Mesmo toggle | `[ ]` |
| 3.3 | SemaforoBadge (admin) no dark mode: ícones Lucide + texto legíveis | Mesmo toggle | `[ ]` |
| 3.4 | Teste unitário `semaforo-contrast.spec.ts` valida 6 pares matematicamente | Automático (`pnpm --filter @metanoia/web test`) | `[x]` |
| 3.5 | Nota: care-attention e care-ok em light mode NÃO atingem 3:1 como fundo sozinho (2.22:1 e 2.70:1). A cor é indicador redundante com ícone+texto; o texto usa `text-care-*` com token de texto que passa 4.5:1 sobre fundos claros. | Documentado em research.md D6 e no teste | `[x]` |

---

## 4. Navegação por leitor de tela `[HUMANO]`

**Contexto**: `dec-007` — texto visível é a fonte única para AT; sem duplo-anúncio.

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 4.1 | `[HUMANO]` SemaforoStatusBadge sem `participantName`: o texto "Urgente" (ou equivalente) é anunciado UMA vez | VoiceOver/NVDA: navegar até o badge; confirmar anúncio único | `[ ]` |
| 4.2 | `[HUMANO]` SemaforoStatusBadge com `participantName="João"`: anunciado como "Urgente — João" (aria-label do container) | VoiceOver/NVDA; texto interno deve ser silenciado (aria-hidden) | `[ ]` |
| 4.3 | `[HUMANO]` ParticipantCard Expanded: badge de status lido UMA vez (não duplicado com nome do h3) | AT: navegar pelo card; confirmar ordem de leitura | `[ ]` |
| 4.4 | `[HUMANO]` ParticipantCard Medium: idem | AT: navegar pelo card médio | `[ ]` |
| 4.5 | `[HUMANO]` SemaforoPill: aria-label do botão "{label}: {count}" é lido corretamente; ícone NÃO é anunciado separadamente | AT: focar no botão pill; confirmar anúncio sem ícone | `[ ]` |
| 4.6 | `[HUMANO]` SemaforoBadge (admin): ícone Lucide NÃO é anunciado (aria-hidden); apenas o label PT-BR é lido | AT: navegar pelo badge de relatorio | `[ ]` |
| 4.7 | `[HUMANO]` Animação de pulso: não causa anúncios inesperados do leitor de tela | AT: disparar pulso via mudança de status; confirmar silêncio do AT durante animação | `[ ]` |

---

## 5. Teclado e foco `[AUTOMÁTICO]`

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 5.1 | SemaforoStatusBadge não recebe foco independente (é `<span>`, não interativo) | Tab navigation; confirmar que não entra no tab order | `[x]` |
| 5.2 | SemaforoPill (`role=switch`) recebe foco via Tab e é ativável com Space/Enter | Tab → pill → Space | `[ ]` |
| 5.3 | Gate de CI `check-focus-ring-variants.sh --ci` passa com 0 findings | Automático | `[x]` |

---

## 6. Visual regression `[HUMANO]`

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 6.1 | `[HUMANO]` SemaforoStatusBadge: screenshot 3 estados × 2 temas × normal/compact | Screenshot comparison manual (ambiente não roda visual regression automático) | `[ ]` |
| 6.2 | `[HUMANO]` Animação de pulso: confirmar aparência do efeito `pulse-border` (borda expandindo e sombreando) | Inspeccionar visualmente com `animatePulse=true` | `[ ]` |

---

## 7. Regressão 15.2 — anunciador de status

| # | Teste | Como validar | Status |
|---|-------|-------------|--------|
| 7.1 | Teste `use-participant-status-announcer.spec.ts` ainda passa: anúncio "João — Urgente" | `pnpm --filter @metanoia/web test` | `[x]` |
| 7.2 | `SIGNAL_STATUS_LABELS['care-urgent'] === 'Urgente'` (fonte única, dec-005) | Validado no snapshot do vocabulary | `[x]` |

---

## Resumo dos gates automáticos executados

| Gate | Resultado |
|------|----------|
| `pnpm --filter @metanoia/types test` (623 testes, incl. vocabulary snapshot) | PASS |
| `pnpm --filter @metanoia/web test` (973 testes, incl. contrast + badge) | PASS |
| `check-motion-safe.sh --ci` | PASS (0 findings) |
| `check-contrast-tokens.mjs` | PASS (0 HARD fails) |
| `check-focus-ring-variants.sh --ci` | PASS (0 findings) |
| `pnpm turbo lint --force --filter=@metanoia/web` | PASS |
| `pnpm turbo build --filter=@metanoia/web` | PASS |
