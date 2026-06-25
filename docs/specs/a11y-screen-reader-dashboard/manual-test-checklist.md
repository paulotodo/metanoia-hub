# Manual Test Checklist — Screen Reader Dashboard (Story 15.2)

**GATE HUMANO PENDENTE** — VoiceOver (macOS/iOS), NVDA (Windows), JAWS (Windows).
Os cenários abaixo NÃO são automatizáveis por screen reader real; exigem execução manual
antes do release de produção.

---

## Ambiente de teste recomendado

| Screen Reader | Plataforma | Browser compatível |
|---------------|------------|-------------------|
| VoiceOver | macOS 13+ / iOS 16+ | Safari (suporte primário) |
| NVDA 2023.3+ | Windows 10/11 | Chrome, Firefox, Edge |
| JAWS 2024+ | Windows 10/11 | Chrome, Edge |

**Conta de teste:** persona admin demo (`E2E_DEMO_ADMIN_EMAIL` / `E2E_DEMO_PASSWORD` do seed).

---

## Grupo 1 — Navegação no Radar Pastoral

### SR-01: Leitura de cards de participante com status semântico

**Pré-condição:** pelo menos 1 participante em cada categoria (Urgente / Atenção / Bem).

**Passos:**
1. Navegar para `/app/gestao/radar`.
2. Usar Tab/seta para percorrer os cards da seção "Urgente".
3. **Esperado:** screen reader anuncia `{nome} — Urgente` (não apenas a cor/ícone).
4. Percorrer cards da seção "Atenção".
5. **Esperado:** screen reader anuncia `{nome} — Atenção necessária`.
6. Percorrer o card compacto "Bem".
7. **Esperado:** o botão tem aria-expanded anunciado; ao expandir, lista é lida normalmente.

**Resultado esperado:** Nenhum participante é identificado apenas por cor; todo status tem texto alternativo.

---

### SR-02: aria-controls no card compacto (care-ok)

**Passos:**
1. Focar o botão do card compacto ("Estão bem: João · Maria · +2").
2. **Esperado:** screen reader anuncia `aria-expanded: recolhido` e `aria-controls` aponta para o painel.
3. Pressionar Enter/Space para expandir.
4. **Esperado:** painel é anunciado imediatamente (VoiceOver: `listagem, 5 itens`; NVDA/JAWS: move foco para o primeiro item).
5. Pressionar Enter/Space para recolher.
6. **Esperado:** painel desaparece da árvore de acessibilidade.

---

### SR-03: Title dinâmico da página

**Passos:**
1. Navegar para `/app/gestao/radar` sem filtro de grupo.
2. **Esperado:** título da janela (anunciado por VoiceOver/NVDA ao chegar na página) = `"Radar Pastoral"`.
3. Clicar no pill de um grupo específico (ex: "Grupo Alpha").
4. **Esperado:** título da janela muda para `"Radar Pastoral — Grupo Alpha"`.
5. Clicar em "Todos" para remover o filtro.
6. **Esperado:** título retorna a `"Radar Pastoral"`.

---

### SR-04: Anúncio de contagem pós-filtro

**Passos:**
1. Clicar em um SemaforoPill (ex: "Urgente").
2. **Esperado:** região aria-live anuncia `"{n} participantes visíveis"` (sem anunciar no load inicial).
3. Clicar no mesmo pill para remover o filtro.
4. **Esperado:** anúncio reflete a contagem total (ou silêncio se sem filtro ativo).
5. Selecionar um grupo que não tem participantes urgentes, depois clicar em "Urgente".
6. **Esperado:** anuncia `"Nenhum participante nessa categoria"`.

---

## Grupo 2 — Anúncios SSE em Tempo Real

### SR-05: 5 mudanças de status em 2s → 1 anúncio batched

**Pré-condição:** conta de teste com múltiplos participantes; backend capaz de gerar atualizações SSE simuladas (ou ferramenta de teste SSE — ver `/spike/sse-test`).

**Passos:**
1. Abrir `/app/gestao/radar` com screen reader ativo.
2. Disparar 5 mudanças de signalType em menos de 2s via SSE.
3. Aguardar 3s (janela de debounce).
4. **Esperado:** screen reader anuncia UMA vez: `"5 participantes atualizados"` (não 5 anúncios individuais).

**Critério de falha:** se o screen reader ler 5 anúncios separados, o debounce não está funcionando.

---

### SR-06: Toggle silenciar → aria-live off (0 anúncios)

**Passos:**
1. Ativar o toggle "Silenciar notificações" (NotificationCenter / botão de silêncio).
2. **Esperado:** region `aria-live` passa para `aria-live="off"`.
3. Disparar mudança de status SSE.
4. Aguardar 4s.
5. **Esperado:** screen reader NÃO anuncia nada.
6. Reativar o toggle.
7. Disparar nova mudança de status SSE.
8. **Esperado:** screen reader volta a anunciar após o debounce.

---

### SR-07: Desconexão → reconexão com grace period de 5s

**Passos:**
1. Simular desconexão de rede (DevTools → Network → Offline) por ~10s.
2. Reconectar a rede.
3. **Esperado:** `ConnectionStatus` volta ao estado `connected` (indicador visual some).
4. Durante os 5s de grace period: se chegarem atualizações SSE do gap-fill, NÃO devem gerar anúncios individuais.
5. Após 5s: screen reader anuncia `"Conexão restaurada. {n} participante(s) atualizado(s)."` — UM único anúncio batched.

**Critério de falha:** se cada atualização do gap-fill for anunciada individualmente (pode gerar dezenas de anúncios em sequência).

---

## Grupo 3 — Conformidade Geral

### SR-08: Filtros do semáforo (SemaforoPill)

**Passos:**
1. Focar um SemaforoPill (ex: "3 Urgentes").
2. **Esperado:** screen reader anuncia o label completo (ex: `"Urgentes: 3"`) e o tooltip descritivo.
3. Pressionar Enter/Space para filtrar.
4. **Esperado:** `aria-pressed` muda para `mixed` (filter-active); screen reader anuncia a mudança de estado.

---

### SR-09: Filtro de grupo (GrupoPillFilter)

**Passos:**
1. Focar o radiogroup "Filtrar por grupo".
2. Usar setas para navegar entre as opções.
3. **Esperado:** screen reader anuncia cada opção como radio button com estado checked/unchecked.

---

## Status do Gate

| Cenário | Automatizado? | Status |
|---------|---------------|--------|
| SR-01 Leitura de cards | Parcial (axe) | Pendente VoiceOver/NVDA |
| SR-02 aria-controls | Parcial (axe) | Pendente VoiceOver/NVDA |
| SR-03 Title dinâmico | Não | **Gate humano** |
| SR-04 Contagem pós-filtro | Não | **Gate humano** |
| SR-05 5 mudanças → 1 anúncio | Unit test (debounce) | **Gate humano** (anúncio real) |
| SR-06 Toggle silenciar | Unit test | **Gate humano** (anúncio real) |
| SR-07 Grace period 5s | Unit test | **Gate humano** (gap-fill SSE) |
| SR-08 SemaforoPill | Parcial (axe) | Pendente VoiceOver/NVDA |
| SR-09 GrupoPillFilter | Parcial (axe) | Pendente VoiceOver/NVDA |

**Aprovação necessária:** pelo menos 1 testador com VoiceOver (macOS ou iOS) E 1 com NVDA (Windows)
antes de considerar a Story 15.2 como "done" no sentido de acessibilidade real.
