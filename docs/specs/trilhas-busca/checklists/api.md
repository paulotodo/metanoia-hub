# API Checklist: Busca Full-Text de Trilhas e Aulas (`trilhas-busca` / Story 8-8)

**Purpose**: Validar QUALIDADE do contrato de API de busca — query params, envelope `{data, meta}`, shape do item, ranking, codigos de erro, versionamento. "Unit tests for English".
**Created**: 2026-06-11
**Feature**: [contracts/search-api.md](../contracts/search-api.md) | [spec.md](../spec.md) | [plan.md](../plan.md)

## Contrato e schema

- [x] CHK042 - O endpoint, metodo e versionamento (`GET /api/v1/search`) estao especificados? [Completude, contracts §GET / plan §IV] {auto}
  - Evidencia: contract L10 — "GET `/api/v1/search`"; base `/api/v1` L3 ("versionado desde MVP"); plan L46 — "`/api/v1/` prefix". Definido.
- [x] CHK043 - O query param `q` esta especificado com tipo, obrigatoriedade, default e regras de borda? [Clareza, contracts §Query parameters] {auto}
  - Evidencia: contract L18-24 tabela — `q` string, obrigatorio, sem default, "1+ caractere", caracteres especiais tolerados, termo sem token util → vazio. Completo.
- [x] CHK044 - Esta explicito que NAO ha params `limit`/`page`/`cursor` configuraveis pelo cliente? [Completude, contracts §Query parameters] {auto}
  - Evidencia: contract L22-23 — "NAO ha `limit` configuravel ... top-20 fixo"; "NAO ha paginacao nesta versao (sem `page`/`cursor`)". Fronteira do contrato definida.
- [x] CHK045 - O shape canonico do item de resultado (Zod) esta definido campo-a-campo com tipos? [Completude, contracts §Shape canonico] {auto}
  - Evidencia: contract L119-137 — `searchResultItem` (lessonId:uuid, lessonName:string, moduleId, moduleName, trailId, trailName, contentType:enum, snippet:string, rank:number, isDraft:boolean) + `searchResponse`. Verificavel via snapshot Zod.
- [x] CHK046 - O requisito de snapshot test do schema Zod (gate contra breaking change silencioso) esta especificado? [Mensurabilidade, contracts §Shape / plan §IV/VI] {auto}
  - Evidencia: contract L139 — "Snapshot test obrigatorio (...) `packages/types/src/__tests__/...snapshot.spec.ts`"; plan L48/L83. Criterio de aceite presente.

## Envelope de resposta

- [x] CHK047 - O envelope de sucesso `{ data, meta }` esta especificado com estrutura de `meta` (total, query)? [Clareza, contracts §Resposta 200] {auto}
  - Evidencia: contract L38-58 — envelope `{ data, meta }`; `meta.total` (numero de itens, <=20) e `meta.query` (eco do termo). Definido.
- [x] CHK048 - A regra "sem `undefined`; `null` explicito quando aplicavel" esta especificada para o JSON de resposta? [Clareza, contracts §Resposta / plan §II] {auto}
  - Evidencia: contract L35-36 — "Sem `undefined`; `null` explicito quando aplicavel (Principio II)"; plan L44/L103. Aderente a constitution.
- [x] CHK049 - O campo `isDraft` esta definido com semantica clara (true so para lider/admin vendo draft)? [Clareza, contracts §Resposta + Shape] {auto}
  - Evidencia: contract L68 — "`isDraft`: `true` somente para Lider/Admin vendo aula de trilha draft (FR-008)". Booleano explicito, semantica definida.
- [x] CHK050 - O contrato do `snippet` (texto plano, matches entre sentinelas nao-HTML, sem HTML) esta inequivoco no shape? [Consistencia, contracts §Resposta + Shape / data-model §3] {auto}
  - Evidencia: contract L62-67 e L128 — "`snippet: string // texto plano; matches entre sentinelas \x02..\x03 (NAO HTML)"; consistente com data-model §3 e FR-005. (Cross-link: security.md CHK001-CHK004.)

## Error handling

- [x] CHK051 - Os codigos de erro (400/401) estao especificados com gatilho de cada um? [Completude, contracts §Erros] {auto}
  - Evidencia: contract L107-110 — 400 "`q` ausente/invalido"; 401 "nao autenticado". Mapeados.
- [x] CHK052 - O formato de erro padrao (`{ statusCode, error, message, details? }`, sem stack trace) esta especificado? [Consistencia, contracts §Erros / plan §IV] {auto}
  - Evidencia: contract L104-105 — "`{ statusCode, error, message, details? }`, sem stack trace"; plan L46. Aderente ao contrato global do projeto.
- [x] CHK053 - Esta explicito que caracteres especiais no termo NAO geram 4xx/5xx (sao sanitizados → `data:[]`)? [Clareza, contracts §Erros nota / spec §Edge Cases] {auto}
  - Evidencia: contract L112-113 — "Caracteres especiais NO termo NAO geram 4xx/5xx (...) O contrato proibe 500 por termo malformado". (Cross-link security.md CHK010.)
- [x] CHK054 - A separacao mensagem tecnica (ingles, corpo) vs. user-facing (PT-BR, FE) esta especificada para erros? [Clareza, contracts §Erros / plan §III] {auto}
  - Evidencia: contract L109 — "Mensagem PT-BR amigavel no FE; corpo tecnico em ingles"; plan L45. Definido.

## Auth e visibilidade no contrato

- [x] CHK055 - O requisito de autenticacao (Keycloak) e resolucao de `tenant_id`/papel do token estao no contrato (nao do cliente)? [Cobertura, contracts §Auth + Visibilidade] {auto}
  - Evidencia: contract L4-5 (auth + tenant do token) e L26-31 (visibilidade por papel server-side). (Cross-link security.md CHK012/CHK018.)
- [x] CHK056 - O contrato amarra ranking/ordenacao como parte da resposta (data ordenado por rank DESC)? [Completude, contracts §Resposta] {auto}
  - Evidencia: contract L61 — "`data`: array, no MAXIMO 20 itens, ordenado por `rank` DESC". Parte do contrato.
- [x] CHK057 - O metodo GET read-only (sem 201/204/202, sem idempotency-key) esta consistente com a natureza da operacao? [Consistencia, plan §IV] {auto}
  - Evidencia: plan L46 — "GET de busca → 200 (read-only, sem 201/204)". Operacao de leitura, idempotente por natureza; sem mutacao de estado.

## Observabilidade (NFR)

- [ ] CHK058 - Requisitos de observabilidade especificos do endpoint de busca (metrica de latencia p95, taxa de termos sem resultado, log estruturado da query sem vazar PII) sao necessarios nesta versao ou ficam para incremento? [Cobertura, Gap] {humano}

## Notes

- Items `{auto}` resolvidos com citacao; `{humano}` aguardam dono do produto.
- **Gaps abertos**: CHK058 marca um `[Gap]` de NFR (observabilidade por endpoint) deixado a julgamento de produto — o contrato atual nao especifica metricas/log do `/search`; nao bloqueia a story (read-only, sem dependencia externa), mas vale registrar.
- Cross-links de seguranca: snippet (CHK050↔security CHK001-008), tenant/papel (CHK055↔security CHK012/CHK016-018), sanitizacao (CHK053↔security CHK010).
- Consumo `/create-tasks`: o snapshot Zod (CHK046) e os mapeamentos de erro (CHK051-052) viram tarefas de teste/implementacao explicitas; CHK058 pode virar tarefa "definir metricas/log do endpoint de busca" se o dono decidir incluir.
