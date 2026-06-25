# Checklist de Qualidade de Requisitos — a11y-screen-reader-dashboard (Story 15.2)

**Domínio**: Acessibilidade (a11y) / Screen Reader
**Base**: WCAG 2.1 AA (NFR-A4) + UX-DR20
**Data**: 2026-06-25

> "Unit tests for English" — valida a QUALIDADE dos requisitos da spec, não o código.

---

## A. Completude dos Requisitos

- [x] CHK-A1: Todo AC tem requisito funcional correspondente (AC-1↔RF-01/02, AC-3↔RF-03, AC-4↔RF-08, AC-5↔RF-04/05, AC-6↔RF-06/07, AC-7↔RF-09)
- [x] CHK-A2: Todo signalType (care-ok, care-attention, care-urgent) tem texto de status definido (C2)
- [x] CHK-A3: Comportamento do toggle silenciar especificado para anúncios de participante (RF-05)
- [x] CHK-A4: Comportamento de debounce especificado com janela exata (3s — RF-04)
- [x] CHK-A5: Comportamento de grace period especificado com janela exata (5s — RF-06)
- [x] CHK-A6: Estado de "nenhum resultado" no filtro tem mensagem definida (AC-3)

## B. Clareza e Não-Ambiguidade

- [x] CHK-B1: Textos de anúncio são literais e testáveis ("Conexão restaurada. {n} participantes atualizados.")
- [x] CHK-B2: Localização do `aria-label` resolvida (elemento raiz — C1, dec-009)
- [x] CHK-B3: Mecanismo de title dinâmico resolvido (document.title/useEffect — C5, dec-012)
- [x] CHK-B4: Localização do hook resolvida (co-located — C3, dec-010)
- [x] CHK-B5: Fronteira 15.2 (não-visível) × 15.3 (visível) explícita (§8.1)

## C. Testabilidade

- [x] CHK-C1: SC "5 mudanças em 2s → 1 anúncio" é mensurável via spec mockado (SSE EventSource mock)
- [x] CHK-C2: SC "0 violações axe" verificável via CI gate
- [x] CHK-C3: SC "toggle silenciar suprime 100%" verificável (aria-live="off" + 0 announce)
- [x] CHK-C4: Reconexão grace verificável (1 anúncio após 5s)
- [x] CHK-C5: Anti-redirect verificável (URL não contém /login + landmark presente)

## D. Escopo e Fronteiras

- [x] CHK-D1: Busca full-text explicitamente fora de escopo (§2.2, §8.2)
- [x] CHK-D2: Tabelas N/A documentado com justificativa (sem `<table>` real — §8.3)
- [x] CHK-D3: Semáforo visual (15.3) explicitamente fora de escopo
- [x] CHK-D4: Dashboard admin fora do fluxo líder (summary cards já cobertos)
- [x] CHK-D5: Teste real screen reader = roteiro manual (gate humano, não automatizável)

## E. Consistência com Estado Atual (anti-retrabalho)

- [x] CHK-E1: Spec NÃO pede reimplementar SemaforoPill (já tem aria-pressed)
- [x] CHK-E2: Spec NÃO pede reimplementar GrupoPillFilter (já tem radiogroup)
- [x] CHK-E3: Spec NÃO pede reimplementar silenciar-suprime-announce (já existe)
- [x] CHK-E4: Spec NÃO pede `<table>` semântica onde não há tabela
- [x] CHK-E5: Nota de descoberta reflete redução de LAC-04 (só falta aria-live de contagem)

## F. Dependências e Riscos

- [x] CHK-F1: Dependências de Epic 7/12/14 declaradas e marcadas done
- [x] CHK-F2: Risco `aria-label` em `<Link>` ocultar filhos documentado (plan §7)
- [x] CHK-F3: Risco de gates a11y por className mitigado (re-rodar 3 gates)
- [x] CHK-F4: Risco E2E keyboard/a11y por mudança de DOM do card mitigado (auditar specs)
- [x] CHK-F5: Risco de ratchet hard prematuro mitigado (axe local primeiro)

---

## Veredito

**APROVADO** — Todos os 26 itens verdes. Requisitos completos, não-ambíguos, testáveis, com escopo delimitado e consistentes com o estado atual do código. Pronto para create-tasks.

### Findings (não-bloqueantes)
- Nenhum finding crítico ou alto.
- Observação: a aplicação do grace period (RF-06/07) no `use-notification-stream.ts` deve ser localizada e mínima para não regredir o gap-fill paginado existente (CHK021/055 do Epic 14). Tratado como risco no plan §7.
