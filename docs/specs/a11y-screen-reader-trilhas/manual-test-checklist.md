# Manual Test Checklist — Screen Reader: Trilhas, Progresso & Conteúdo

**Feature**: `a11y-screen-reader-trilhas` (Story 15.4)
**Gate**: Este checklist é o **gate humano obrigatório** para fechar a story. Paulo deve assinar após testar.
**Nota**: Esta feature não foi testada com screen reader real durante a implementação. Axe-core + testes automatizados cobrem violações detectáveis; o comportamento real de anúncio exige verificação humana.

---

## Pré-requisitos

- Browser: Chrome (para VoiceOver no Mac) ou Firefox/Edge (para NVDA no Windows)
- Screen reader: VoiceOver (macOS/iOS) ou NVDA (Windows) — pelo menos um
- Conta de teste com trilhas publicadas atribuídas ao grupo do usuário
- App rodando localmente (`pnpm dev`) com mocks ativos OU staging

---

## 1. Trail Listing — `/app/consumo/trilhas`

### 1.1 Título de página
- [ ] Ao carregar, o screen reader anuncia "Minhas Trilhas" (h1 ou document.title)
- [ ] O título está presente em todos os estados: loading, erro, lista vazia, lista com dados

### 1.2 Cards de trilha
- [ ] Focar um trail card com Tab — o screen reader anuncia o conteúdo completo do card
- [ ] O anúncio inclui: nome da trilha, status em PT-BR ("Em Andamento", "Não Iniciada", "Concluída"), percentual de conclusão, número de módulos
- [ ] Formato esperado: `"Trilha: {nome}, {status}, {N}% concluída, {M} módulos"`
- [ ] O badge de status visual NOT duplicado pelo screen reader (aria-hidden ou incluído no aria-label do botão)
- [ ] A barra de progresso no card anuncia `"Progresso na trilha: {N}%"` (não genérico)
- [ ] Scroll infinito: ao chegar ao final, novos cards são carregados e anunciados

---

## 2. Trail Detail — `/app/consumo/trilhas/{trailId}`

### 2.1 Estrutura geral
- [ ] Ao carregar, o título da trilha é o primeiro h1 anunciado
- [ ] A barra de progresso geral anuncia `"Progresso na trilha: {N}%"` com valor correspondente

### 2.2 Módulos no accordion
- [ ] Tab para o primeiro botão de accordion — o screen reader anuncia posição e status
- [ ] Formato esperado: `"Módulo 1 de {total}: {nome do módulo} — {status}"`
- [ ] Tabulação para o segundo módulo anuncia `"Módulo 2 de {total}: ..."` (índice correto)
- [ ] Módulo concluído anuncia status "Concluído" — sem leitura de símbolo Unicode (✓)
- [ ] Módulo bloqueado anuncia "Bloqueado"
- [ ] A barra de progresso dentro do accordion anuncia `"Progresso no módulo {nome}: {N}%"`
- [ ] Ao expandir accordion (Enter ou Space), o screen reader anuncia que o módulo foi expandido (`aria-expanded=true`)
- [ ] Aulas dentro do módulo expandido: cada LessonRow é navegável por Tab e anunciada com nome e status

---

## 3. "Meu Progresso" — `/app/consumo/trilhas/{trailId}/progresso`

### 3.1 Summary region
- [ ] Ao carregar a página, a primeira região de conteúdo anuncia o resumo de módulos concluídos
- [ ] Formato esperado: `"{N} módulos concluídos de {total}"` via `role="region"` com aria-label
- [ ] O summary é anunciado antes dos detalhes por módulo (ordem no DOM)

### 3.2 Lista de aulas por módulo
- [ ] Cada item de aula na lista é anunciado com pelo menos: posição ("Aula 1", "Aula 2") e status
- [ ] Status usa vocabulário PT-BR: "Concluída", "Em andamento", "Não iniciada"
- [ ] Ícones de status (○ ◑ ✓) são aria-hidden="true" — screen reader NÃO lê símbolos Unicode
- [ ] Link "Continuar de onde parei" (se presente) é anunciado com nome descritivo

---

## 4. Conclusão de Módulo — Anúncio polite

### 4.1 Componente ModuleCompletionAnnounce
- [ ] Quando um módulo é concluído (vídeo termina + threshold de progresso atingido), o screen reader anuncia a mensagem de conclusão
- [ ] Formato esperado: `"Módulo {nome} concluído! Progresso na trilha: {N}%"`
- [ ] O anúncio é **polite** — não interrompe o screen reader no meio de uma leitura
- [ ] O foco NÃO se move para o anúncio — usuário permanece onde estava
- [ ] O anúncio some após alguns segundos (não fica repetindo em re-renders)

---

## 5. Player de Vídeo — `/app/consumo/trilhas/{trailId}` (módulo com vídeo)

### 5.1 Label do player
- [ ] Focar o elemento `<video>` com Tab — o screen reader anuncia o título da aula
- [ ] Formato esperado: `"Vídeo: {título da aula}"` (não `"Vídeo da aula"` genérico)
- [ ] Se nenhum título disponível, fallback `"Vídeo da aula"` é aceitável

### 5.2 Controles nativos do browser
- [ ] Space: play/pause
- [ ] Setas esquerda/direita: seek ±5s (comportamento do browser nativo)
- [ ] M: mute/unmute
- [ ] F: fullscreen
- [ ] Estes controles são anunciados pelos controles nativos do `<video controls>` — não é responsabilidade desta story implementar painel de atalhos adicional

### 5.3 Foco ao fim do vídeo (crítico)
- [ ] Ao terminar o vídeo (`ended` event), o foco se move para o botão "Próximo módulo" (se presente)
- [ ] O screen reader anuncia o botão "Próximo módulo" após o foco mover
- [ ] Anúncio polite: `"Vídeo concluído. Avance para o próximo módulo."`
- [ ] Se não houver botão "Próximo módulo", o foco retorna ao `<video>` (sem perda de foco)
- [ ] O anúncio polite ocorre mesmo sem botão "Próximo módulo"

### 5.4 Ausência de focus trap
- [ ] Tab após o vídeo move o foco para o próximo elemento focável (sem preso no player)
- [ ] Shift+Tab antes do vídeo move o foco para o elemento anterior

---

## 6. Gates de Qualidade Automatizados (verificar antes de assinar)

- [ ] `pnpm turbo lint` → 0 erros
- [ ] `pnpm --filter @metanoia/web test` → 0 falhas
- [ ] `pnpm turbo build --filter=@metanoia/web` → build OK
- [ ] `axe-quality-gate` E2E → 0 violações em `/app/consumo/trilhas`
- [ ] `axe-quality-gate` E2E → 0 violações em `/app/consumo/trilhas/{trailId}`
- [ ] Gate `focus-ring`: todos os elementos focáveis têm ring visível
- [ ] Gate `contrast`: ratio ≥ 4.5:1 para texto normal
- [ ] Gate `motion-safe`: nenhum `transition-` ou `animate-` sem prefixo `motion-safe:`

---

## Assinatura

- [ ] **Testado por**: ______________________
- [ ] **Data**: ______________________
- [ ] **Screen reader(s) usados**: ______________________
- [ ] **Aprovado para fechar story 15.4**: SIM / NÃO

**Issues encontrados** (se NÃO):
> _(registrar aqui para follow-up)_

---

## Follow-up Story 15.5 (documentado — não implementado aqui)

Os itens abaixo foram intencionalmente excluídos da story 15.4 por decisão do operador:
- Migração para Plyr (player de vídeo com ARIA nativa)
- Campo `has_missing_alt_text` no Prisma + endpoint de gaps de acessibilidade
- Página admin `/app/admin/accessibility-gaps`
- Renderer de conteúdo rich-text com hierarquia de headings e fallback de alt-text (rota `/aulas/[lessonId]` não existe ainda)
- Atalhos de teclado documentados em painel UI do player (dependeria do Plyr)
