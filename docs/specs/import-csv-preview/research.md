# Phase 0 — Research: import-csv-preview

Resolução dos unknowns técnicos. Todas as `NEEDS CLARIFICATION` resolvidas
antes do Phase 1.

---

## Decision 1 — Biblioteca de parse CSV

**Decision**: usar **papaparse** (nova dep em `apps/web`).

**Rationale**:
- Nenhuma dep CSV/XLSX instalada hoje (grep `papaparse|xlsx|csv-parse` em
  `package.json` / `apps/*/package.json` / `packages/*/package.json` → vazio).
- papaparse é a lib madura de parse CSV no browser: lida com quoting, células
  com vírgula/quebra de linha, delimitador auto, header parsing por nome — tudo
  necessário para FR-08 (colunas por nome) e robustez do Excel BR.
- Aceita `string` já decodificada → permite combinar com detecção de encoding
  manual (ver Decision 3).
- Carregada apenas no chunk do Client Component de parse; não infla o bundle
  inicial das demais rotas.

**Alternatives considered**:
- *Parser próprio (split por vírgula)*: rejeitado — não trata quoting/escape,
  campos com vírgula embutida, nem aspas — gera bugs silenciosos em planilhas
  reais. Custo de manutenção > ganho.
- *csv-parse (node)*: rejeitado — orientado a streams Node, ergonomia pior no
  browser.

---

## Decision 2 — Biblioteca de parse XLSX + carregamento sob demanda

**Decision**: usar **xlsx (SheetJS)** carregado via **dynamic `import('xlsx')`**
dentro da função de parse, acionado apenas no branch `.xlsx`.

**Rationale**:
- SC-004 exige que a lib XLSX NÃO entre no bundle inicial. `import()` dinâmico
  cria um chunk separado, carregado só quando o Admin seleciona um `.xlsx`
  (FR-06).
- SheetJS é o padrão de facto para ler XLSX no browser; lê a primeira aba
  (FR-07) e converte para matriz/JSON facilmente.
- Para XLSX multi-aba: ler `workbook.SheetNames[0]` apenas e emitir aviso
  não-bloqueante (FR-07, edge case).

**Alternatives considered**:
- *exceljs*: rejeitado — maior, API mais pesada, sem ganho para leitura simples.
- *Sempre carregar xlsx estático*: rejeitado — viola SC-004 (bundle inflado
  para usuários que só usam CSV).

**Nota de segurança**: SheetJS historicamente teve CVEs de prototype pollution
em versões antigas — fixar versão recente e revisar advisory ao adicionar a dep
(o parse roda no cliente sobre arquivo do próprio Admin, superfície limitada,
mas vale a versão atual).

---

## Decision 3 — Detecção automática de encoding (UTF-8 / ISO-8859-1 / Windows-1252)

**Decision**: ler o arquivo como `ArrayBuffer`; tentar decodificar como UTF-8
com `TextDecoder('utf-8', { fatal: true })`; em falha (bytes inválidos),
decodificar com `TextDecoder('windows-1252')` (superset compatível de
ISO-8859-1 para os bytes do Excel BR). Heurística complementar: presença de
byte 0xEF 0xBB 0xBF (BOM) → UTF-8.

**Rationale**:
- `TextDecoder` é nativo do browser (sem dep extra). Modo `fatal: true` faz o
  UTF-8 falhar em sequências inválidas — sinal claro de que o arquivo é
  legacy (ISO-8859-1/Windows-1252), o caso típico do Excel BR (SC-002).
- Windows-1252 é superset de ISO-8859-1 nas posições que importam para
  acentos PT-BR (ã, ç, é, ô), cobrindo ambos os encodings da spec com um único
  fallback.
- Resolve FR-05 sem intervenção do usuário e sem lib de detecção pesada
  (ex: jschardet) — mantém o bundle enxuto.

**Alternatives considered**:
- *jschardet / chardet*: rejeitado — detecção estatística boa mas adiciona dep
  e peso; a heurística UTF-8-fatal→1252 cobre os 3 encodings exigidos com
  confiabilidade suficiente para o domínio (Excel BR).
- *Pedir o encoding ao usuário*: rejeitado — viola FR-05 ("sem intervenção").

---

## Decision 4 — Formato do query param `emails` no GET check-emails

**Decision**: **CSV-na-query** — `GET /api/v1/users/check-emails?emails=a@x.com,b@y.com`,
validado por `checkEmailsQuerySchema` (`z.string().transform(s => s.split(','))`
→ array, com refine `length ≤ 500` e cada item validado como e-mail). Cliente
divide em batches de ≤500 quando o total excede o limite.

**Rationale**:
- A spec FR-18 fixa `GET /api/v1/users/check-emails` (não POST) — decisão §10
  não reabrível.
- CSV-na-query é mais compacto que param repetido (`?emails=a&emails=b`) e
  evita estourar limites de URL: 500 e-mails × ~40 chars ≈ 20 KB, dentro do
  limite prático de URL (~8 KB no nginx default? — **cap defensivo**: ver
  trade-off abaixo).
- **Trade-off de tamanho de URL**: 500 e-mails pode exceder limites de URL de
  alguns proxies (~8 KB). Mitigação: o batch de 500 é o **máximo absoluto** do
  contrato; na prática o cliente pode usar batches menores (ex: 100) se o
  comprimento da query string ultrapassar um teto seguro (configurável no
  hook). O schema valida ≤500 como hard cap; o batching do cliente respeita
  tanto a contagem quanto um cap de bytes de URL.

**Alternatives considered**:
- *Param repetido `?emails=a&emails=b`*: rejeitado — mais verboso, mesmo
  problema de tamanho de URL, e a validação via Zod fica menos direta.
- *POST com body*: rejeitado — viola FR-18 (GET fixado). GET também é
  semanticamente correto (leitura pura, sem efeito colateral, cacheável —
  embora o rate-limit limite cache agressivo).

---

## Decision 5 — Localização do endpoint check-emails

**Decision**: `users.controller.ts` (módulo `apps/api/src/users/`).

**Rationale**:
- O recurso consultado é **users** (existência de usuários no tenant). REST:
  o controller do recurso. `users.controller.ts` já tem
  `@Controller('api/v1/users')` com `GET me/*` — `check-emails` é coerente.
- `onboarding.controller.ts` modela o **fluxo wizard** (demo-radar, status), não
  o recurso users; colocar lá acoplaria consulta de users a onboarding.

**Alternatives considered**:
- *onboarding.controller.ts*: rejeitado — quebra a granularidade por recurso;
  check-emails é reutilizável fora do onboarding (ex: convites).

---

## Decision 6 — Mitigação de user-enumeration (OWASP A01 / API3)

**Decision**: defesa em camadas — (1) `@UseGuards(KeycloakAuthGuard, RolesGuard)`
+ `@Roles(Role.ADMIN_TENANT)`; (2) tenant-scope via `withTenantTx` + RLS;
(3) rate-limit guard in-memory custom.

**Rationale**:
- O endpoint revela existência de e-mails → risco de enumeração. Mitigações:
  - **Auth + role**: só Admins do tenant acessam (padrão exato de
    `admin-invites.controller.ts:26-27`).
  - **Tenant-scope**: a query só vê e-mails do tenant corrente (RLS). O Admin
    já gerencia esses participantes — enumeração restrita ao próprio domínio,
    sem vazamento cross-tenant (FR-19). Risco residual baixo.
  - **Rate-limit**: guard in-memory (projeto **não** usa `@nestjs/throttler` —
    padrão de `privacy-rate-limit.guard.ts` / `marketing-rate-limit.guard.ts`).
    Limita abuso automatizado.
- Documentar essa mitigação no plano evita que o gate `owasp-security` escale
  um BloqueioHumano HIGH desnecessário — o risco está endereçado por design.

**Alternatives considered**:
- *Sem rate-limit (apenas tenant-scope)*: aceitável em risco mas pior em
  defesa-em-profundidade; rejeitado em favor do padrão do projeto.
- *Resposta uniforme (não revelar exists)*: rejeitado — o propósito do
  endpoint É revelar duplicatas dentro do tenant (FR-13/FR-18); a confidencialidade
  é garantida pelo escopo-tenant, não por ofuscar a resposta.

---

## Decision 7 — Geração do template CSV client-side

**Decision**: gerar o template (`nome,email,telefone,papel` + 1-2 linhas de
exemplo) como string CSV em `csv-template.ts` e disparar download via `Blob` +
`URL.createObjectURL` — **sem requisição de rede** (FR-04, AC US1#5).

**Rationale**:
- FR-04 exige geração no cliente, sem rede. `Blob`/`createObjectURL` é a
  técnica nativa padrão. Header com nomes de coluna canônicos garante que o
  arquivo re-importado bata com a identificação por nome (FR-08).

**Alternatives considered**:
- *Servir arquivo estático do servidor*: rejeitado — viola "sem requisição de
  rede".

---

## Resumo

| Unknown | Resolução |
|---------|-----------|
| Parser CSV | papaparse |
| Parser XLSX + lazy | xlsx (SheetJS) via dynamic `import()` |
| Encoding auto | `TextDecoder` UTF-8-fatal → Windows-1252 fallback |
| Formato query `emails` | CSV-na-query, cap ≤500 + cap de bytes de URL |
| Local do endpoint | `users.controller.ts` |
| User-enumeration | auth+role+tenant-scope+rate-limit |
| Template | Blob client-side, sem rede |

**NEEDS CLARIFICATION restantes**: 0.
