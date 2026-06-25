# Requirements Quality Checklist — a11y domain (Story 15.3)

**Feature**: `a11y-semaforo-multimodal`
**Domain**: Accessibility (a11y) — "unit tests for English"
**Created**: 2026-06-25

Valida a QUALIDADE dos requisitos da spec (não o código). Cada item verde = requisito testável, não-ambíguo, completo.

## Cobertura de canais multimodais (WCAG 1.4.1)

- [x] CHK001 — A spec exige os 3 canais (cor + ícone + texto) simultâneos? (FR-001/002/003)
- [x] CHK002 — A spec define qual ícone por estado de forma não-ambígua? (data-model D2: AlertCircle/AlertTriangle/CheckCircle2)
- [x] CHK003 — A spec exige que ícone+texto distingam estados SEM cor (testável)? (FR-003, US1 Independent Test: simulação daltonismo)
- [x] CHK004 — A spec especifica os rótulos de texto exatos e sua fonte? (dec-005: SIGNAL_STATUS_LABELS "Urgente"/"Atenção necessária"/"Bem")

## ARIA e leitores de tela

- [x] CHK005 — A spec exige `aria-hidden` + `focusable="false"` nos ícones? (FR-004)
- [x] CHK006 — A spec previne duplo-anúncio (sr-only vs visível vs aria-label)? (FR-005, dec-007)
- [x] CHK007 — A spec define o formato do aria-label contextual? (US2.3: "{label} — {nome}")
- [x] CHK008 — A spec reutiliza a região aria-live existente sem duplicar? (FR-008)

## Movimento e animação

- [x] CHK009 — A spec exige CSS (não JS) para prefers-reduced-motion? (FR-006)
- [x] CHK010 — A spec define o comportamento reduced-motion (opacity ≤ 0.15s, sem pulso)? (FR-007)
- [x] CHK011 — A spec define o gatilho da animação de pulso de forma testável? (dec-006: prop animatePulse)

## Modo compacto

- [x] CHK012 — A spec define tamanho mínimo do ícone compacto? (FR-009: 16×16px)
- [x] CHK013 — A spec proíbe `title` e exige aria-label completo em compacto? (FR-010)

## Dark mode e contraste

- [x] CHK014 — A spec exige validação automática de contraste? (FR-011: color2k ≥ 3:1)
- [x] CHK015 — A spec usa os tokens do projeto, não hex avulso? (FR-012: care-*)
- [x] CHK016 — A spec define o alvo de contraste correto (3:1 non-text, não 4.5:1)? (research D6)

## Vocabulário e consistência

- [x] CHK017 — A spec exige vocabulário pastoral (rejeita corporativo)? (FR-013)
- [x] CHK018 — A spec previne quebra do teste 15.2 ao centralizar labels? (FR-014: valores idênticos)

## Escopo

- [x] CHK019 — A spec delimita componentes IN vs OUT claramente? (SemaforoPill/ParticipantCard/SemaforoBadge IN; GroupCard OUT)
- [x] CHK020 — A spec documenta o follow-up de GroupCard como decisão consciente? (Edge Cases + plan.md "Fora de escopo")

## Success criteria mensuráveis

- [x] CHK021 — SC são mensuráveis e verificáveis? (SC-001 100%, SC-002 0 violations axe, SC-003 6 pares ≥3:1)
- [x] CHK022 — A spec reconhece os limites honestos (sem screen reader/visual regression real)? (research D8, SC-007 manual-test-checklist)

## Resultado

**22/22 itens verdes.** Nenhuma lacuna de qualidade de requisito detectada. A spec é testável, não-ambígua e completa para o domínio a11y. Pronta para create-tasks.

> Observação de qualidade: o único ponto que exige validação empírica em execução (não lacuna de requisito) é o alvo color2k dos pares light care-attention/care-ok — research D6 já documenta a mitigação (cor no ícone/borda, texto em token AA, validar par a par com getContrast).
