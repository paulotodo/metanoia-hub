# Security Checklist: Busca Full-Text de Trilhas e Aulas (`trilhas-busca` / Story 8-8)

**Purpose**: Validar QUALIDADE dos requisitos de seguranca da feature de busca — XSS no snippet (dec-014, A03/CWE-79), injection no termo (A05), isolamento multi-tenant (RLS), visibilidade por papel (A01). "Unit tests for English": cada item testa se o REQUISITO esta claro/completo/consistente/verificavel, nao se a implementacao esta correta.
**Created**: 2026-06-11
**Feature**: [spec.md](../spec.md) | [contracts/search-api.md](../contracts/search-api.md) | [plan.md](../plan.md)

## XSS no snippet — emissao sem HTML (dec-014, A03:2025 / CWE-79)

- [x] CHK001 - O requisito de "snippet sem HTML no payload" esta especificado de forma testavel? [Clareza, Spec §FR-005 / contracts §"Contrato de seguranca do snippet"] {auto}
  - Evidencia: FR-005 — "o payload NAO contem HTML"; contract linha 84-100 detalha `ts_headline` com `StartSel=\x02, StopSel=\x03` e snippet como texto plano. Verificavel: payload pode ser inspecionado contra presenca de `<`/`>` como markup.
- [x] CHK002 - O requisito proibe explicitamente `dangerouslySetInnerHTML` no FE? [Completude, plan.md §Technical Context / contracts §FE] {auto}
  - Evidencia: plan linha 30 e 118 — "PROIBIDO `dangerouslySetInnerHTML`"; contract linha 96 — "E **PROIBIDO** `dangerouslySetInnerHTML`". Requisito negativo explicito e auditavel por grep.
- [x] CHK003 - O requisito de render do destaque via JSX (`<b>{trecho}</b>`, React escapa autor) esta especificado como contrato? [Clareza, contracts §FE / data-model §3] {auto}
  - Evidencia: contract linha 95 — "monta o destaque com `<b>{trecho}</b>` via JSX apos `split` pelas sentinelas. React escapa o conteudo do autor automaticamente"; data-model linha 96. Verificavel.
- [x] CHK004 - A delimitacao dos matches por sentinelas NAO-HTML (`\x02`/`\x03`) esta quantificada sem ambiguidade entre spec/plan/contracts/data-model? [Consistencia, Spec §FR-005 / contracts §Shape / data-model §3 / plan §Bordas] {auto}
  - Evidencia: 4 artefatos citam `StartSel=\x02 (STX), StopSel=\x03 (ETX)` identicamente (spec L108, contract L89/L128/L149, data-model L96, plan L116). Sem conflito.
- [x] CHK005 - O requisito de "higiene de delimitador" (remover `\x02`/`\x03` pre-existentes do texto-fonte antes do `ts_headline`) esta especificado? [Completude, contracts §"Contrato de seguranca do snippet"] {auto}
  - Evidencia: contract linha 93-94 — "O backend remove quaisquer `\x02`/`\x03` pre-existentes do texto-fonte antes do `ts_headline` (higiene de delimitador)". Requisito presente e testavel.
- [x] CHK006 - O requisito reconhece explicitamente que `name`/`tags` SAO input de autor (premissa de ameaca)? [Clareza, Spec §Clarifications / plan §Constitution Check Seguranca] {auto}
  - Evidencia: spec L12 — "a premissa 'sem input de usuario no conteudo' e incorreta (`name`/`tags` sao input de autor)"; plan L49 — "`name`/`tags` sao input de autor". Modelo de ameaca declarado.
- [x] CHK007 - Existe requisito de teste verificavel para a nao-interpretacao de `<script>` do autor (unit BE + componente FE)? [Mensurabilidade, contracts §Teste / plan §VI] {auto}
  - Evidencia: contract L98-100 — "unit do `search.service` com `name='<script>alert(1)</script>'` assevera que o snippet e texto plano (...); teste de componente do FE verifica que o `<script>` do autor nao e interpretado". Criterio de aceite mensuravel.
- [x] CHK008 - O requisito declara explicitamente que DOMPurify / escape HTML manual foram REMOVIDOS (sem ambiguidade de qual mitigacao vale)? [Consistencia, contracts §FE / plan §Bordas] {auto}
  - Evidencia: contract L97 — "Nao ha DOMPurify nem escape HTML manual (revogados da abordagem anterior)"; plan L118 — "DOMPurify e o escape HTML manual server-side foram REMOVIDOS". A clarification original (HTML `<b>`) foi marcada [SUPERADA por dec-014] na spec L12 — sem conflito residual.

## Injection no termo de busca (A05:2025 — SQL / tsquery)

- [x] CHK009 - O requisito de bind do termo `q` como parametro (`$1`, nunca concatenado) esta especificado? [Completude, contracts §Notas / plan §Bordas / data-model] {auto}
  - Evidencia: contract L148 — "Termo bound como parametro (`$1`), nunca concatenado (anti SQL/tsquery injection)"; plan L110. Verificavel.
- [x] CHK010 - O requisito de sanitizacao server-side de caracteres especiais (aspas, parenteses) com garantia de "nunca 500" esta quantificado? [Clareza, Spec §Edge Cases / contracts §Query params + Erros] {auto}
  - Evidencia: spec L94 — "nunca erro 500"; contract L20 "Caracteres especiais (...) tolerados sem erro 500 (sanitizacao server-side)" e L112-113 "O contrato proibe 500 por termo malformado". Criterio testavel (input adversarial → 200 com `data:[]`).
- [x] CHK011 - O comportamento para termo so com caracteres especiais / sem token util esta definido (resultado vazio, nao erro)? [Cobertura, Spec §Edge Cases / contracts §"sem resultados"] {auto}
  - Evidencia: contract L81 — "Aplica-se tambem a: termo so com caracteres especiais, termo sem token util, nenhuma aula correspondente" → `{ data: [], meta:{total:0} }`. Edge case coberto.

## Isolamento multi-tenant na busca (Constitution I — RLS)

- [x] CHK012 - O requisito de escopo por organizacao via RLS (`tenant_id` resolvido do token, NUNCA parametro) esta especificado para o novo caminho de leitura? [Completude, Spec §FR-006/FR-011 / contracts §Auth / plan §I] {auto}
  - Evidencia: FR-006/FR-011; contract L4-5 "`tenant_id` resolvido do token via RequestContext — **NUNCA** aceito como parametro"; plan L43 "Busca roda em `withTenantTx`; `tenant_id` NUNCA e parametro". data-model L57-64 confirma policy `rls_lessons_tenant_isolation` existente cobre a busca.
- [x] CHK013 - Existe requisito de RLS spec nova (2 tenants) provando isolamento do caminho full-text com JOINs? [Mensurabilidade, plan §I/VI / data-model §1.3] {auto}
  - Evidencia: plan L43 — "RLS spec nova obrigatoria (`lessons-search.rls-spec.ts`, 2 tenants)"; data-model L62-64 justifica ("novo caminho de leitura ... precisa provar isolamento"). SC-005 da o criterio mensuravel (Tenant A nunca recebe conteudo do Tenant B).
- [x] CHK014 - O requisito declara que JOINs em `modules`/`trails` tambem operam sob RLS (sem vazamento por tabela lida)? [Cobertura, plan §I / data-model §2] {auto}
  - Evidencia: plan L43 — "JOINs em `modules`/`trails` tambem sob RLS"; data-model §2 lista `tenant_id` nas tabelas lidas. Coberto.
- [x] CHK015 - O requisito impede o cliente de especificar/alterar o tenant na requisicao? [Clareza, Spec §US3 cenario 2 / FR-006] {auto}
  - Evidencia: spec L70 — "o usuario nao pode especificar ou alterar o tenant na requisicao"; contract L4. Verificavel (ausencia de param de tenant no contrato).

## Controle de acesso por papel — visibilidade de rascunho (A01:2025)

- [x] CHK016 - O requisito de deny-by-default para participantes (rascunhos omitidos) esta especificado e mensuravel? [Clareza, Spec §FR-007/SC-004 / contracts §Visibilidade] {auto}
  - Evidencia: FR-007 "Participantes NAO DEVEM visualizar aulas cujas trilhas estao em status de rascunho"; SC-004 da o criterio; contract L29. Mensuravel.
- [x] CHK017 - O requisito de visibilidade de rascunho para lider/admin com flag `isDraft: true` esta especificado? [Completude, Spec §FR-008 / contracts §Visibilidade + Resposta] {auto}
  - Evidencia: FR-008; contract L30/L68 — "`isDraft: true` somente para Lider/Admin vendo aula de trilha draft". Coberto.
- [x] CHK018 - O requisito de papel resolvido server-side (do token), nao do cliente, esta explicito? [Clareza, contracts §Visibilidade / plan §Seguranca] {auto}
  - Evidencia: contract L26 — "Visibilidade por papel (server-side, do token)"; plan L49 — "deny-by-default server-side". Verificavel.
- [x] CHK019 - O requisito de exclusao de soft-deleted (lesson/module/trail em qualquer nivel) de TODOS os papeis esta coberto? [Cobertura, Spec §FR-009/§Edge Cases / data-model §2] {auto}
  - Evidencia: FR-009; spec L98 edge case (cadeia soft-deleted); data-model L75-77 — "a query exige `modules.deleted_at IS NULL AND trails.deleted_at IS NULL`". Coberto para qualquer papel.

## Itens de julgamento (dono do produto)

- [ ] CHK020 - O apetite de risco para "secure by construction" (eliminar a classe de XSS) vs. defesa em profundidade (manter tambem escape/CSP) reflete a postura de seguranca do produto? [Risco] {humano}
- [ ] CHK021 - A ausencia de rate limiting / quota especifica no endpoint de busca (alem do que ja existe na plataforma) e aceitavel para o risco de abuso/DoS de busca nesta versao? [Risco, Gap] {humano}

## Notes

- Items `{auto}` resolvidos pelo agente com citacao da secao que prova; `{humano}` aguardam o dono do produto.
- **Gaps/Conflicts abertos**: nenhum `[Gap]`/`[Conflict]` de requisito de seguranca — a dec-014 fechou o achado HIGH do owasp-security com mitigacao secure-by-construction consistente nos 4 artefatos. CHK021 sinaliza um `[Gap]` de NFR (rate limiting) deixado a julgamento de produto.
- Consumo `/create-tasks`: derivar tarefas de TESTE a partir de CHK007 (unit XSS BE + componente FE), CHK010 (input adversarial → sem 500), CHK013 (RLS spec 2 tenants).
