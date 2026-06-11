# Requirements Quality Checklist: Busca Full-Text de Trilhas e Aulas (`trilhas-busca` / Story 8-8)

**Purpose**: Validar clareza, completude e consistencia dos requisitos funcionais e nao-funcionais — campo indexado, visibilidade `archived`, top-20 sem paginacao, diacriticos, prefix, ranking, criterios de sucesso. "Unit tests for English".
**Created**: 2026-06-11
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md) | [research.md](../research.md)

## Campo indexado — `name` + `tags` (NAO title/description)

- [x] CHK022 - Esta sem ambiguidade que o `search_vector` indexa apenas `Lesson.name` + `Lesson.tags` (e nao `title`/`description`)? [Clareza, Spec §FR-001 / data-model §1 / research D0] {auto}
  - Evidencia: FR-001 indexa "nome e as tags"; data-model L15 — "nao ha `title` nem `description` em Lesson" (confirmado empiricamente no schema); plan L124 D0 — "Lesson NAO tem title/description — confirmado empiricamente". Consistente e fundamentado em evidencia de schema.
- [x] CHK023 - O escopo de indexacao automatica (no INSERT/UPDATE, excluindo soft-deleted) esta especificado? [Completude, Spec §FR-001 / data-model §1.1 / research D3] {auto}
  - Evidencia: FR-001 — "indexar automaticamente ... ao criar ou atualizar um registro, excluindo aulas marcadas como removidas logicamente"; data-model L44-45 — `search_vector = NULL` quando soft-deleted. Coberto.
- [x] CHK024 - A invariante "coluna `search_vector` NUNCA escrita por codigo de aplicacao (so trigger)" esta explicita? [Clareza, data-model §1.1 / plan §Bordas] {auto}
  - Evidencia: data-model L46 — "a coluna NUNCA e escrita por codigo de aplicacao — so pelo trigger"; plan L105 — "coluna tsvector | NUNCA escrita por codigo". Verificavel (`Unsupported` esconde do client tipado).

## Diacriticos e prefix matching

- [x] CHK025 - O requisito de busca insensivel a diacriticos esta quantificado com criterio mensuravel? [Mensurabilidade, Spec §FR-002/SC-002] {auto}
  - Evidencia: FR-002; SC-002 — "termo com acento e o mesmo termo sem acento retornam exatamente o mesmo conjunto de resultados". Criterio objetivo (`educacao` == `educacao`). research D1 define `unaccent` + dicionario `'portuguese'`.
- [x] CHK026 - O requisito de prefix matching esta quantificado (a partir de quantos caracteres / comportamento de 1 char)? [Clareza, Spec §FR-003/SC-003/§Edge Cases] {auto}
  - Evidencia: FR-003; SC-003 — "prefixo de 3 letras ou mais retorna todas as aulas cujas palavras (...) comecam com esse prefixo"; spec L95 edge — "termos muito curtos (1 caractere) ... aplica busca por prefixo ... sem rejeitar a query". Comportamento de borda definido.

## Ranking por relevancia

- [x] CHK027 - O requisito de ordenacao por relevancia textual (mais aderente ao topo) esta especificado e verificavel? [Clareza, Spec §FR-004/§US1 cenario 5 / contracts §Resposta] {auto}
  - Evidencia: FR-004; spec L36 cenario 5; contract L61 — "ordenado por `rank` DESC". research D4 usa `ts_rank`. Verificavel via ordem de `rank`.
- [x] CHK028 - O campo `rank` esta definido no contrato de resposta com tipo e semantica? [Completude, contracts §Resposta + Shape / data-model §3] {auto}
  - Evidencia: contract L69 — "`rank`: numero (relevancia textual)"; shape L130 `rank: number`; data-model L97 — `ts_rank(...)` float, ordena DESC. Coberto.

## `archived` tratado como `published`

- [x] CHK029 - O tratamento de trilhas `archived` como `published` (sem restricao adicional) esta sem ambiguidade e consistente entre artefatos? [Consistencia, Spec §FR-013/§Clarifications / contracts §Visibilidade / data-model §3] {auto}
  - Evidencia: spec L13 (clarification) + FR-013; contract L30 — "`archived` tratado como `published` para todos (FR-013)"; data-model L104 — "`archived` tratado como `published` (FR-013): nunca excluido por status". Consistente nos 3.
- [x] CHK030 - Esta explicito que SO `draft` aplica regra diferenciada de visibilidade (published/archived sem restricao)? [Clareza, Spec §FR-013 / data-model §3] {auto}
  - Evidencia: FR-013 — "Apenas trilhas com status `draft` aplicam regra diferenciada"; `TrailStatus` enum confirmado `draft|published|archived` (data-model L79). Sem ambiguidade.

## Top-20 sem paginacao

- [x] CHK031 - O limite top-20 fixo (nao configuravel pelo cliente, sem paginacao) esta quantificado e consistente? [Consistencia, Spec §FR-012/§Clarifications / contracts §Query params / plan §Scale] {auto}
  - Evidencia: spec L14 clarification + FR-012 ("no maximo 20 resultados ... Paginacao nao esta no escopo"); contract L22-23 — "NAO ha `limit` configuravel ... NAO ha paginacao"; plan L34. Consistente.
- [x] CHK032 - `meta.total` esta definido como contagem dos itens retornados (<=20), sem ambiguidade vs. total global de matches? [Clareza, contracts §Resposta] {auto}
  - Evidencia: contract L70 — "`meta.total`: numero de itens em `data` (<= 20)". Definido como contagem da pagina (nao total global). Sem ambiguidade no contrato.

## Resultado vazio / sucesso sem erro

- [x] CHK033 - O comportamento "sem correspondencia → 200 com lista vazia, nunca erro" esta especificado e mensuravel? [Mensurabilidade, Spec §FR-010/SC-007 / contracts §"sem resultados"] {auto}
  - Evidencia: FR-010; SC-007 — "lista vazia em menos de 200ms"; contract L73-82 — "NUNCA erro. Lista vazia". Mensuravel.

## Composicao do resultado de busca

- [x] CHK034 - Os campos obrigatorios do resultado (nome da aula, modulo, trilha, tipo de conteudo, snippet) estao todos especificados e consistentes spec↔contract↔data-model? [Completude, Spec §FR-005/§Key Entities / contracts §Shape / data-model §3] {auto}
  - Evidencia: FR-005 lista os 5; contract shape L120-131 (`lessonName/moduleName/trailName/contentType/snippet` + ids + rank + isDraft); data-model §3 mapeia origem de cada. Consistente.
- [x] CHK035 - O reuso do enum `LessonContentType` (sem redefinir) esta especificado como requisito de contrato? [Consistencia, contracts §Notas / plan §Bordas / data-model §3] {auto}
  - Evidencia: contract L127/L151 — "`contentType: LessonContentType` // enum reusado de content/"; plan L111-112. Sem duplicacao de enum.

## NFR — performance e consistencia eventual

- [x] CHK036 - Os targets de performance estao quantificados com threshold (nao "deve ser rapido")? [Mensurabilidade, Spec §SC-001/SC-006/SC-007 / plan §Performance target] {auto}
  - Evidencia: SC-001 <500ms p/ 10k lessons; SC-007 <200ms sem match; SC-006 <1min para remocao refletir; plan L33. Thresholds numericos definidos.
- [x] CHK037 - O comportamento sob consistencia eventual do indice (re-indexacao na proxima modificacao) esta documentado como premissa aceita? [Completude/Assumption, Spec §Edge Cases/SC-006] {auto}
  - Evidencia: spec L96-97 — "re-indexa automaticamente na proxima modificacao ... eventual consistency e aceitavel"; SC-006 amarra a janela (<1min apos a proxima atualizacao do registro que ativa o trigger). Premissa documentada.

## Consistencia geral / constitution

- [x] CHK038 - Os requisitos nao contradizem os principios da constitution (multi-tenant, type-safety, contratos, FE/estado)? [Constitution Alignment, plan §Constitution Check] {auto}
  - Evidencia: plan §Constitution Check (L37-57) avalia I-VII + Seguranca como PASS, sem entrada em Complexity Tracking. Gate registrado.
- [x] CHK039 - Empty state user-facing em PT-BR com vocabulario pastoral (sem termos tecnicos de erro) esta especificado? [Clareza, Spec §US4 cenario 3 / plan §III] {auto}
  - Evidencia: spec L88 — "mensagem pastoral de estado vazio (em portugues, sem termos tecnicos de erro)"; plan L45 — "empty state com vocabulario pastoral". Verificavel.

## Itens de julgamento (dono do produto)

- [ ] CHK040 - A priorizacao P1→P4 (busca basica antes de visibilidade-por-papel antes de UI) reflete o valor de negocio esperado para a release? [Risco] {humano}
- [ ] CHK041 - A janela de consistencia eventual de ate ~1min (SC-006) para sumico de aula removida da busca e aceitavel do ponto de vista de produto/pastoral? [Risco] {humano}

## Notes

- Items `{auto}` resolvidos com citacao; `{humano}` aguardam dono do produto.
- **Gaps/Conflicts abertos**: nenhum `[Gap]`/`[Conflict]` de requisito funcional — todos os pontos de risco apontados (campo indexado, archived, top-20, highlight, diacriticos, prefix) estao quantificados e consistentes entre spec/plan/contracts/data-model. A clarification HTML original foi explicitamente [SUPERADA por dec-014], sem conflito residual.
- Consumo `/create-tasks`: tarefas de TESTE derivaveis de CHK025 (acento==sem-acento), CHK026 (prefix 3+ / 1-char), CHK029 (archived visivel), CHK033 (vazio→200).
