# Quickstart: a11y-screen-reader-trilhas

Cenários de validação manual e automatizada. Feature é FE-only — sem backend real necessário (mocks MSW existentes).

## Scenario 1: Trail Card Announces Complete Status

1. Navegar para `/app/consumo/trilhas` com usuário autenticado (ou usar Storybook/test render)
2. Focar um trail card com Tab
3. Verificar o atributo `aria-label` no botão do card
4. **Expected**: label contém `"Trilha: {nome}, {status em PT-BR}, {N}% concluída, {M} módulos"` — ex: `"Trilha: Discipulado Básico, Em Andamento, 50% concluída, 3 módulos"`
5. Verificar que o badge de status dentro do card tem `aria-hidden="true"` ou está incluído no aria-label do botão (sem duplicar)

---

## Scenario 2: Module Accordion Announces Position and Status

1. Navegar para `/app/consumo/trilhas/{trailId}` (qualquer trilha com módulos)
2. Focar o botão do primeiro accordion de módulo com Tab
3. Verificar `aria-label` no botão
4. **Expected**: `"Módulo 1 de {total}: {nome do módulo} — {Concluído|Em andamento|Bloqueado|Não iniciado}"`
5. Tab para o segundo módulo
6. **Expected**: `"Módulo 2 de {total}: ..."` (índice atualizado corretamente)
7. Verificar que qualquer ícone visual de checkmark tem `aria-hidden="true"`

---

## Scenario 3: Progress Bars Have Contextual Labels

1. Abrir `/app/consumo/trilhas/{trailId}` com módulos e progresso
2. Localizar todos os elementos `role="progressbar"` (via DevTools → Accessibility)
3. **Expected para a barra geral**: `aria-label="Progresso na trilha: {N}%"` e `aria-valuenow={N}`
4. **Expected para barras por módulo**: `aria-label="Progresso no módulo {nome}: {N}%"` e `aria-valuenow={N}`
5. Verificar que não há nenhuma barra com `aria-label` genérico como `"% concluído"` ou sem label

---

## Scenario 4: "Meu Progresso" Summary Region

1. Navegar para `/app/consumo/trilhas/{trailId}/progresso`
2. Verificar que a primeira região de conteúdo tem `role="region"` com `aria-label` descritivo
3. **Expected**: region anuncia `"{N} módulos concluídos de {total}"` ou equivalente
4. Expandir um módulo na lista
5. Verificar os `<li>` de aulas
6. **Expected**: cada item de aula anuncia pelo menos status ("Concluída", "Em andamento", "Não iniciada") e uma referência de posição ("Aula 1", "Aula 2")

---

## Scenario 5: ModuleCompletionAnnounce Component

1. Renderizar `<ModuleCompletionAnnounce message="" />` → verificar que `role="status"` está no DOM mas sem texto
2. Atualizar `message` para `"Módulo Fundamentos concluído! Progresso na trilha: 75%"`
3. **Expected**: o texto é lido pelo screen reader (polite announcement) sem mover o foco
4. Verificar que o elemento tem `aria-live="polite"` e `aria-atomic="true"`
5. Verificar que o componente tem `className="sr-only"` (visualmente oculto, sem layout shift)

---

## Scenario 6: Video Player Contextual Label and End-of-Video Focus

1. Renderizar `<VideoPlayer signedUrl="..." title="Fundamentos da Oração" />`
2. Verificar `aria-label` no `<video>` element
3. **Expected**: `aria-label="Vídeo: Fundamentos da Oração"`
4. Renderizar sem `title` prop
5. **Expected fallback**: `aria-label="Vídeo da aula"`
6. Simular o evento `ended` no `<video>` element (via `fireEvent.ended`)
7. **Expected com nextModuleButtonRef**: foco muda para o botão "Próximo módulo"
8. **Expected sem nextModuleButtonRef**: foco retorna ao próprio `<video>` element
9. Verificar que `onVideoEnded` callback é chamado (para o anúncio polite)

---

## Scenario 7 (Error Case): Label Genérico Detectado pelo Axe

1. Renderizar página de trilhas no ambiente de teste E2E
2. Executar `axe-quality-gate` nos paths `/app/consumo/trilhas` e `/app/consumo/trilhas/{id}`
3. **Expected**: zero violações de `aria-label`, `progressbar`, ou `button-name`
4. Se violação encontrada: detalhe indica o elemento e o atributo faltante
5. **Correção esperada**: localizar o call site no código, atualizar a prop `label` ou `aria-label`

---

## Scenario 8 (Error Case): motion-safe Gate

1. Após qualquer modificação de `className` nos componentes em escopo
2. Executar o gate a11y `motion-safe`
3. **Expected**: zero ocorrências de `transition-` ou `animate-` sem prefixo `motion-safe:`
4. Se falhar: localizar a linha no componente modificado e adicionar `motion-safe:` prefix

---

> **Nota**: esta feature não tem borda backend↔frontend nova. O Scenario de Roundtrip E2E não se aplica.
