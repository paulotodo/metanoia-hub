# Contract: Search API (`trilhas-busca` / Story 8-8)

**Base**: `/api/v1` (Princípio IV — versionado desde MVP)
**Auth**: requer usuário autenticado (Keycloak). `tenant_id` resolvido do token via
`RequestContext` — **NUNCA** aceito como parâmetro de requisição (FR-006 / SC-005).
**Module**: `apps/api/src/search/`

---

## GET `/api/v1/search`

Busca full-text de aulas (lessons) por nome e tags, ranqueada por relevância, escopada
ao tenant do usuário autenticado, com highlight em **texto plano** (sem HTML — ver
"Contrato de segurança do snippet" abaixo).

### Query parameters

| Param | Tipo | Obrigatório | Default | Regras |
|-------|------|-------------|---------|--------|
| `q` | string | sim | — | termo de busca. 1+ caractere (FR/edge: 1 char → prefix). Caracteres especiais (aspas, parênteses) tolerados sem erro 500 (sanitização server-side). Termo sem token útil → resultado vazio. |

- NÃO há `limit` configurável pelo cliente — top-20 fixo (Clarification + FR-012).
- NÃO há paginação nesta versão (sem `page`/`cursor`).
- `q` validado por `ZodValidationPipe` custom (Princípio IV).

### Visibilidade por papel (server-side, do token)

- **Participante**: aulas de trilhas `draft` são omitidas (FR-007 / SC-004).
- **Líder / Admin**: incluem aulas de trilhas `draft`, marcadas `isDraft: true` (FR-008).
- `archived` tratado como `published` para todos (FR-013).
- Soft-deleted (lesson/module/trail) nunca aparece, qualquer papel (FR-009).

### Resposta 200 — sucesso

Envelope padrão `{ data, meta }` (Princípio IV). Sem `undefined`; `null` explícito quando
aplicável (Princípio II).

```json
{
  "data": [
    {
      "lessonId": "0190a1b2-c3d4-7e5f-8901-23456789abcd",
      "lessonName": "Fundamentos do Discipulado",
      "moduleId": "0190a1b2-c3d4-7e5f-8901-111111111111",
      "moduleName": "Início da Jornada",
      "trailId": "0190a1b2-c3d4-7e5f-8901-222222222222",
      "trailName": "Trilha de Novos Convertidos",
      "contentType": "video",
      "snippet": "Fundamentos do Discipulado cristão",
      "rank": 0.0607927,
      "isDraft": false
    }
  ],
  "meta": {
    "total": 1,
    "query": "discipulado"
  }
}
```

- `data`: array, no MÁXIMO 20 itens, ordenado por `rank` DESC (FR-004 / SC-005-ordem).
- `data[].snippet`: **texto plano** (string). Os trechos que casam o termo são delimitados
  por **marcadores sentinela NÃO-HTML**: `` (STX) abre e `` (ETX) fecha cada
  match (ver "Contrato de segurança do snippet" abaixo). O exemplo acima omite as sentinelas
  por legibilidade; o payload real é, p.ex., `"Fundamentos do Discipulado cristão"`.
  O FE faz `split` por essas sentinelas e monta o destaque com `<b>{trecho}</b>` em JSX.
  O `snippet` NUNCA contém HTML — nem do conteúdo do autor, nem `<b>`.
- `data[].isDraft`: `true` somente para Líder/Admin vendo aula de trilha draft (FR-008).
- `data[].rank`: número (relevância textual).
- `meta.total`: número de itens em `data` (≤ 20).
- `meta.query`: eco do termo recebido (string).

### Resposta 200 — sem resultados (FR-010 / SC-007)

NUNCA erro. Lista vazia:

```json
{ "data": [], "meta": { "total": 0, "query": "xyzinexistente" } }
```

Aplica-se também a: termo só com caracteres especiais, termo sem token útil,
nenhuma aula correspondente.

### Contrato de segurança do snippet (A03:2025 / CWE-79 — dec-014)

**O payload NÃO contém HTML.** Mitigação "secure by construction": eliminamos a classe de
XSS armazenado em vez de mitigá-la com escape + sanitizer.

- **Backend**: `snippet` é texto plano produzido por `ts_headline` com `StartSel`/`StopSel`
  = caracteres de controle `\x02` (STX) / `\x03` (ETX) — **não** `<b>`/`</b>`. Nenhum HTML
  (incluindo HTML eventualmente presente em `name`/`tags` do autor) é emitido como markup:
  `<`, `>`, `<script>` viajam como texto literal dentro do `snippet`. O backend remove
  quaisquer `\x02`/`\x03` pré-existentes do texto-fonte antes do `ts_headline` (higiene de
  delimitador).
- **Frontend**: monta o destaque com `<b>{trecho}</b>` via JSX após `split` pelas sentinelas.
  React escapa o conteúdo do autor automaticamente. É **PROIBIDO** `dangerouslySetInnerHTML`.
  **Não** há DOMPurify nem escape HTML manual (revogados da abordagem anterior).
- **Teste**: unit do `search.service` com `name='<script>alert(1)</script>'` assevera que o
  snippet é texto plano (sem HTML interpretável do autor); teste de componente do FE verifica
  que o `<script>` do autor não é interpretado/renderizado (aparece como texto via JSX).

### Erros

Formato de erro padrão (Princípio IV): `{ statusCode, error, message, details? }`,
sem stack trace.

| Status | Quando |
|--------|--------|
| 400 | `q` ausente / inválido (ex: vazio após trim quando schema exige 1+). Mensagem PT-BR amigável no FE; corpo técnico em inglês. |
| 401 | não autenticado (sem token / token inválido). |

> Caracteres especiais NO termo NÃO geram 4xx/5xx — são sanitizados e podem resultar
> em `data: []` (Edge Cases da spec). O contrato proíbe 500 por termo malformado.

---

## Shape canônico (referência Zod — ver `packages/types`)

```
searchResultItem = {
  lessonId: uuid,
  lessonName: string,
  moduleId: uuid,
  moduleName: string,
  trailId: uuid,
  trailName: string,
  contentType: LessonContentType,   // enum reusado de content/
  snippet: string,                  // texto plano; matches entre sentinelas \x02..\x03 (NÃO HTML)
  rank: number,
  isDraft: boolean,
}

searchResponse = {
  data: searchResultItem[],         // max 20
  meta: { total: number, query: string },
}
```

Snapshot test obrigatório (Princípio IV / VI): `packages/types/src/__tests__/...snapshot.spec.ts`.

---

## Notas de implementação (vinculadas a research)

- Query via `$queryRaw` (tsvector/ts_rank/ts_headline não exprimíveis no Prisma tipado).
- Roda dentro de `withTenantTx` → RLS aplica isolamento (D5); `tenant_id` nunca em código.
- JOIN `lessons → modules → trails` com `deleted_at IS NULL` em cada nível (edge case).
- Termo bound como parâmetro (`$1`), nunca concatenado (anti SQL/tsquery injection).
- `ts_headline` com `StartSel=\x02, StopSel=\x03` (sentinelas não-HTML); o snippet sai como
  texto plano — o FE reconstrói o `<b>` em JSX (sem HTML no payload; dec-014).
- `LessonContentType` reusa o enum de `packages/types/src/content/content-type.enum.ts`.
