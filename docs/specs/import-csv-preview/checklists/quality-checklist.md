# Quality Checklist — import-csv-preview (Story 10-3)

**Feature**: `import-csv-preview`
**Gerado**: 2026-06-13
**Fase**: checklist (pré-create-tasks)
**Domínios**: requirements (default) + ux + api

Legenda de resolução:
- `{auto}` → resolvido automaticamente com citação do artefato
- `{humano}` → requer decisão ou validação humana
- `[Gap]` → lacuna detectada → anotar para create-tasks
- `[Conflict]` → conflito detectado → anotar para create-tasks

---

## DOMÍNIO: Requirements

### RQ-01 — Completude de Requisitos Funcionais {auto}

**Item**: Todos os cenários das User Stories têm FR correspondente?

**Resolução**: PASS.
- US1 (upload): coberto por FR-01 (drag&drop + clique), FR-02 (≤5MB), FR-03 (extensões), FR-04 (template).
- US2 (preview): coberto por FR-11/12/13/14 (validação), FR-15 (botão bloqueado), FR-16/17 (tabela + resumo), FR-18 (check-emails).
- US3 (encoding): coberto por FR-05 (auto-detect UTF-8/ISO-8859-1/Win-1252).
- Edge cases: coberto por FR-08 (colunas por nome), FR-10 (colunas obrigatórias ausentes), FR-20 (batch ≤500), FR-21 (degradação), FR-07 (múltiplas abas).

**Citação**: spec.md §Requirements Functional, §Edge Cases.

---

### RQ-02 — Completude de Critérios de Sucesso {auto}

**Item**: Todos os SC têm FR ou artefato que garante rastreabilidade?

**Resolução**: PASS.
- SC-001 (<3s/200 linhas) → plano usa client-side parse (papaparse/SheetJS), sem RTT extra para esta etapa — razoável, mas sem teste de performance explícito. **[Gap RQ-02-G1]** Nenhum teste de performance automatizado para SC-001 aparece no Plano de Testes. Anotar para create-tasks: adicionar smoke test de latência (ex: Playwright perf timer ou unit bench com dataset de 200 linhas).
- SC-002 (encoding 100%) → FR-05 + `csv-parser.spec.ts` (ISO-8859-1/Win-1252/UTF-8). PASS.
- SC-003 (visibilidade de críticos) → FR-12/FR-14/FR-16 + `csv-preview-table.spec.tsx`. PASS.
- SC-004 (XLSX fora do bundle inicial) → FR-06 + plano (dynamic `import()`). PASS. Nenhum teste automatizado de bundle size especificado. **[Gap RQ-02-G2]** Anotar: adicionar verificação de bundle (ex: `pnpm turbo build` + `grep` no manifest).
- SC-005 (WCAG AA) → FR-22/23 + `jest-axe` gates. PASS.
- SC-006 (<2s para 500 e-mails) → sem teste de carga explícito no plano. **[Gap RQ-02-G3]** Anotar: ao menos um integration spec com fixture de 500 e-mails para medir latência de query.
- SC-007 (sem dados além de e-mails ao servidor) → garantido por design (feature stateless, só `check-emails` envia dados). PASS.

**Citação**: spec.md §Success Criteria; plan.md §Plano de Testes.

---

### RQ-03 — Consistência Interna de Requisitos {auto}

**Item**: FR se contradizem entre si?

**Resolução**: PASS.
- FR-15 (botão desabilitado com ≥1 crítico) vs FR-13 (aviso = importação possível): coerente — só crítico bloqueia.
- FR-16 (10 linhas no preview) vs FR-20 (500 e-mails no batch): coerente — preview mostra 10 mas check-emails processa todos.
- FR-21 (degradação graciosa) vs FR-17 (resumo atualizado após retorno): coerente — FR-17 condicional ao retorno bem-sucedido.
- FR-05 (auto-detect encoding) vs FR-08 (colunas por nome): sem conflito — são camadas distintas (byte→string vs string→campo).

**Citação**: spec.md §Requirements.

---

### RQ-04 — Escopo bem delimitado {auto}

**Item**: Limites entre 10-3 e 10-4 estão explícitos e sem sobreposição?

**Resolução**: PASS.
- spec.md §Escopo: "confirmação e processamento real da importação são responsabilidade da Story 10-4".
- SC-007 reforça: apenas e-mails trafegam nesta story.
- Nenhum FR menciona persistência de participantes ou gravação de registros.

**Citação**: spec.md linhas 9-12; SC-007.

---

### RQ-05 — Requisitos de Performance com Baseline Mensurável {humano}

**Item**: SC-001 (<3s para 200 linhas) e SC-006 (<2s para 500 e-mails) têm baseline de como serão medidos na entrega?

**Status**: ABERTO — humano deve decidir se:
- SC-001 é verificado apenas manualmente (smoke test visual) ou via teste automatizado de latência.
- SC-006 é verificado via integration spec com timer ou apenas via teste manual na infraestrutura real.

**Contexto**: o Plano de Testes não lista teste de performance. Sem automação, esses SC dependem de disciplina manual no review, o que pode deixar regressões passarem no CI.

---

### RQ-06 — Requisitos de Observabilidade e Logs {auto}

**Item**: Há requisito de log/audit para o endpoint `check-emails`?

**Resolução**: ATENÇÃO PARCIAL.
- plan.md §Notas de Segurança item 2: "NÃO deve logar a lista de e-mails em claro. Logar apenas contagem (`checkedCount`) e tenant/usuário."
- Isso é uma nota de segurança, não um FR formal. **[Gap RQ-06-G1]** Não há FR-25 explícito sobre logging/audit do endpoint. Anotar para create-tasks: garantir que a task de backend inclua requisito de log restrito (contagem, não e-mails).

**Citação**: plan.md §Notas de Segurança.

---

### RQ-07 — Requisito de Internacionalização (PT-BR) {auto}

**Item**: Todas as mensagens de erro user-facing têm correspondência em PT-BR?

**Resolução**: PASS.
- FR-14: "mensagem descritiva do problema em PT-BR".
- FR-24: vocabulário pastoral obrigatório.
- plan.md §Project Structure: `apps/web/messages/pt-BR.json` (EDIT — labels import.*).
- Nenhuma mensagem hardcoded na spec — todas parametrizadas via i18n.

**Citação**: spec.md FR-14, FR-24; plan.md §Project Structure.

---

### RQ-08 — Dependências Externas Identificadas e Aprovadas {auto}

**Item**: Novas dependências (`papaparse`, `xlsx`, `@types/papaparse`) estão aprovadas e têm risco mapeado?

**Resolução**: PASS.
- plan.md §Technical Context: papaparse e xlsx listados como NOVA dep.
- plan.md §Gotchas CI: `pnpm-lock.yaml` deve entrar no PR.
- plan.md §Notas de Segurança item 1: risco SheetJS/CVE mapeado — recomendar versão recente + `pnpm audit`.
- **[Gap RQ-08-G1]** Nenhuma versão mínima de `papaparse` ou `xlsx` foi fixada na spec/plan. Anotar para create-tasks: fixar versão mínima e incluir `pnpm audit` como step de CI.

**Citação**: plan.md §Technical Context, §Gotchas CI, §Notas de Segurança.

---

## DOMÍNIO: UX

### UX-01 — Estados da FileUploadZone definidos {auto}

**Item**: Todos os estados visuais da zona de upload estão especificados?

**Resolução**: PASS (com gap menor).
- Estado idle: implícito (zona visível, label "arraste ou clique").
- Estado drag-over: AC US1.1 ("confirmação visual").
- Estado arquivo aceito: AC US1.1 ("nome do arquivo, tamanho, ícone de sucesso, habilita botão").
- Estado erro tamanho: AC US1.3 ("mensagem de erro clara em PT-BR").
- Estado erro extensão: AC US1.4 ("mensagem de erro indicando quais formatos são aceitos").
- **[Gap UX-01-G1]** Estado de "arquivo sendo processado" (parse em andamento) não está especificado. Para arquivos grandes (≤5MB com muitas linhas), pode haver latência perceptível. Anotar para create-tasks: definir se há indicador de loading durante parse.

**Citação**: spec.md §User Story 1 AC 1-4.

---

### UX-02 — Estados da CSVPreviewTable definidos {auto}

**Item**: Todos os estados da tabela de preview estão especificados?

**Resolução**: PASS (com gap menor).
- Estado carregando (aguardando check-emails): US2.3 implica que a tabela existe antes do retorno da API, atualizada depois. Sem indicador de loading explícito para esta transição.
- Estado com críticos: AC US2.2 (indicador crítico + texto descritivo).
- Estado com avisos: AC US2.3 (indicador de aviso).
- Estado resumo: AC US2.1 ("23 linhas lidas — 20 válidas, 2 críticas, 1 aviso").
- Estado arquivo com >10 linhas: AC US2.4 ("Mostrando 10 de 47 linhas").
- Estado degradação API: spec.md §Edge Cases ("aviso discreto").
- **[Gap UX-02-G1]** Não está especificado o estado "arquivo vazio" (0 linhas de dados) no contexto da tabela — só no edge case global ("Arquivo sem participantes"). Anotar: deve exibir mensagem em vez de tabela vazia.
- **[Gap UX-02-G2]** Estado intermediário entre parse concluído e check-emails retornado não tem indicador visual definido (spinner? skeleton?). Anotar para create-tasks.

**Citação**: spec.md §User Story 2 AC 1-5, §Edge Cases.

---

### UX-03 — Acessibilidade: labels ARIA definidos {auto}

**Item**: Labels ARIA para FileUploadZone e CSVPreviewTable estão especificados?

**Resolução**: PASS parcial.
- FR-22: zona de upload "operável por teclado (foco, Enter/Space para abrir seletor) e ter labels ARIA adequados".
- FR-23: tabela com "cabeçalhos de coluna acessíveis" e "indicadores de status DEVE ter alternativa textual".
- Especificação é funcional, não prescritiva (nomes ARIA não listados na spec — correto, são de implementação).
- Gate real: `jest-axe` no `file-upload-zone.spec.tsx` e `csv-preview-table.spec.tsx`.

**Citação**: spec.md FR-22, FR-23; plan.md §Plano de Testes.

---

### UX-04 — Fluxo de navegação entre FileUploadZone e CSVPreviewTable {auto}

**Item**: O fluxo de transição (arquivo selecionado → parse → preview) está claro?

**Resolução**: PASS com gap.
- US2 pressupõe que após upload, o preview aparece automaticamente (parse client-side conclui, tabela é exibida).
- plan.md §Project Structure: `import-client.tsx` é o "Client orquestrador" — centraliza o estado.
- **[Gap UX-04-G1]** Não está especificado se FileUploadZone e CSVPreviewTable coexistem na tela (scroll) ou se há troca de "step" visual. A presença de um wizard de onboarding (Epic 10 Story 10-1) sugere steps, mas a spec desta story não o referencia explicitamente. Anotar para create-tasks: confirmar com design se é single-page scroll ou step-wizard inline.

**Citação**: plan.md §Project Structure (`import-client.tsx`); spec.md US2 AC 1.

---

### UX-05 — Template CSV: formato e nomeação do arquivo baixado {auto}

**Item**: O template gerado tem formato/conteúdo especificado?

**Resolução**: PASS com gap menor.
- FR-04: "gera e baixa um arquivo CSV modelo com as colunas corretas sem requisição de rede".
- csv-import.types.md §Identificação de colunas: colunas `nome, email, telefone, papel`.
- **[Gap UX-05-G1]** Nome do arquivo baixado não está especificado (ex: `template-importacao.csv` vs `metanoia-template.csv`). Menor, mas visível ao Admin. Anotar para create-tasks.
- **[Gap UX-05-G2]** Conteúdo de exemplo (linhas de exemplo no template) não está especificado. Anotar: template com ou sem linha de exemplo?

**Citação**: spec.md FR-04; contracts/csv-import.types.md §Identificação de colunas.

---

### UX-06 — Mensagens de erro e aviso em PT-BR (vocabulário pastoral) {auto}

**Item**: Há mapeamento completo das mensagens PT-BR que o sistema emitirá?

**Resolução**: GAP.
- FR-14: "mensagem descritiva do problema em PT-BR" — mas o conteúdo exato não está em nenhum artefato.
- FR-24: vocabulário pastoral obrigatório.
- plan.md: `messages/pt-BR.json` (EDIT — labels import.*) — referência ao arquivo, não ao conteúdo.
- **[Gap UX-06-G1]** Nenhum artefato lista as strings PT-BR das mensagens de erro/aviso (ex: texto exato para "e-mail inválido", "nome muito curto", "participante já cadastrado"). Anotar para create-tasks: criar seção de strings i18n na task de frontend, ou exigir que o PR inclua todas as keys `import.*` no `pt-BR.json`.

**Citação**: spec.md FR-14, FR-24; plan.md §Project Structure.

---

### UX-07 — Feedback do estado "múltiplas abas XLSX" {auto}

**Item**: O aviso de múltiplas abas está especificado como UX?

**Resolução**: PASS com gap menor.
- FR-07: "informar ao Admin com aviso não-bloqueante".
- `CSVValidationResultSchema.multiSheetWarning: z.boolean()`.
- Não há especificação de onde/como o aviso é renderizado (banner? tooltip? nota abaixo da tabela?).
- **[Gap UX-07-G1]** Posicionamento/forma do aviso de múltiplas abas não está definido. Anotar para create-tasks: implementador decide, mas deve constar no PR como não-bloqueante visível.

**Citação**: spec.md FR-07; contracts/csv-import.types.md §CSVValidationResultSchema.

---

## DOMÍNIO: API

### API-01 — Autenticação e Autorização completas {auto}

**Item**: O endpoint `check-emails` tem guards completos?

**Resolução**: PASS.
- `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN_TENANT)` → 3 camadas (Keycloak token, role guard, RLS).
- Rate-limit via `CheckEmailsRateLimitGuard`.
- plan.md §Constitution Check (Princípio I): PASS.

**Citação**: contracts/check-emails.api.md §Endpoint; plan.md §Constitution Check.

---

### API-02 — Tratamento de erro completo e padronizado {auto}

**Item**: Todos os status de erro têm body padronizado e sem stack trace?

**Resolução**: PASS.
- 400/401/403/429 documentados com `{ statusCode, error, message }`.
- plan.md §Constitution Check (VI): "sem stack trace exposto".
- Frontend: 429/5xx/timeout → degradação graciosa (FR-21).

**Citação**: contracts/check-emails.api.md §Erros; plan.md §Constitution Check.

---

### API-03 — Segurança: User-Enumeration (OWASP A01/API3) {auto}

**Item**: O risco de enumeração de usuários está mitigado?

**Resolução**: PASS.
- Mitigado por: auth (KeycloakAuthGuard) + role (ADMIN_TENANT) + tenant-scope (RLS/`withTenantTx`) + rate-limit.
- `exists: true` só para e-mails do próprio tenant — Admin Tenant já gerencia esses usuários, logo enumeração é aceitável no contexto.
- plan.md §Notas de Segurança: OWASP gate PASSOU sem finding critical/high.

**Citação**: plan.md §Notas de Segurança; contracts/check-emails.api.md §Segurança.

---

### API-04 — Segurança: PII em Logs {auto}

**Item**: O endpoint garante não logar lista de e-mails?

**Resolução**: ATENÇÃO — mapeado como nota, não como FR.
- plan.md §Notas de Segurança item 2: "NÃO deve logar a lista de e-mails em claro. Logar apenas contagem (`checkedCount`) e tenant/usuário."
- Não há FR formal nem task explícita para isso (ver Gap RQ-06-G1).
- **Ação**: a task de backend DEVE incluir this como requisito de implementação explícito.

**Citação**: plan.md §Notas de Segurança.

---

### API-05 — Validação de Input: cap de 500 e-mails {auto}

**Item**: O cap de 500 e-mails é aplicado de forma segura no servidor?

**Resolução**: PASS.
- `checkEmailsQuerySchema`: `.pipe(z.array(z.string().email()).min(1).max(500))` — hard cap no Zod.
- `ZodValidationPipe` aplicado no query param → validação automática antes do service.
- Retorna 400 se > 500.

**Citação**: contracts/check-emails.api.md §Request; contracts/csv-import.types.md §checkEmailsQuerySchema.

---

### API-06 — Validação de Input: e-mails individuais válidos {auto}

**Item**: Cada e-mail do batch é validado (não apenas o formato de lista)?

**Resolução**: PASS.
- `z.array(z.string().email())`: cada item deve ser e-mail válido (RFC).
- Transform `s.split(',').map(trim).filter(Boolean)` remove vazios — sem injeção via item vazio.

**Citação**: contracts/csv-import.types.md §checkEmailsQuerySchema.

---

### API-07 — Segurança: SQL Injection / Prisma $queryRaw {auto}

**Item**: O service usa Prisma client sem `$queryRaw`?

**Resolução**: PASS.
- plan.md: "usar Prisma client `user.findMany({ where: { email: { in: emails } } })`, **sem `$queryRaw`**".
- contracts/check-emails.api.md §Implementação: confirma mesma abordagem.

**Citação**: plan.md §Notas de Segurança item 3; contracts/check-emails.api.md §Implementação.

---

### API-08 — Rate-Limit: parâmetros do guard não especificados {humano}

**Item**: Os parâmetros do `CheckEmailsRateLimitGuard` (janela de tempo, limite de requisições) estão definidos?

**Status**: ABERTO.
- contracts/check-emails.api.md menciona "rate-limit (guard in-memory, padrão do projeto)".
- Nenhum artefato define a janela (ex: 10 req/min/tenant? 100 req/min?) para este endpoint específico.
- Se "padrão do projeto" significa um valor global, este deve ser documentado. Se este endpoint tem limite diferente (CSV com muitas linhas pode precisar de múltiplas chamadas de batching), o valor deve ser explícito.

**Decisão necessária**: qual janela/limite para `check-emails`? Considerar: cliente pode fazer ceil(totalLinhas/500) chamadas em rápida sucessão para arquivos grandes.

---

### API-09 — Batching client-side: comportamento com múltiplos batches {auto}

**Item**: O comportamento do hook quando total > 500 e-mails é especificado?

**Resolução**: PASS com gap.
- spec.md §Edge Cases: "sistema divide em batches automaticamente no cliente; o Admin não percebe".
- FR-20: "o cliente DEVE dividir automaticamente em batches quando o total exceder esse limite".
- plan.md §Plano de Testes: `use-check-emails.spec.ts` — "batching ≤500".
- **[Gap API-09-G1]** Comportamento de falha parcial não está especificado: se o 2º batch de 3 falhar (timeout/429), o sistema usa os resultados parciais dos batches 1 e 3 e marca o 2º como "não verificado" (degradação parcial), ou trata como falha total? Anotar para create-tasks: especificar comportamento de falha parcial no batching.

**Citação**: spec.md §Edge Cases, FR-20; plan.md §Plano de Testes.

---

### API-10 — Resposta: ordem de `results` garantida {auto}

**Item**: A garantia de que `results` espelha a ordem de entrada é verificável?

**Resolução**: PASS com gap de teste.
- contracts/check-emails.api.md: "Ordem de `results` espelha a entrada (cliente correlaciona por `email`)."
- O service usa `findMany(...in emails)` — PostgreSQL não garante ordem de IN por padrão.
- **[Conflict API-10-C1]** O contrato diz "ordem espelha a entrada" mas `findMany({ where: { email: { in: emails } } })` retorna na ordem do banco, não na ordem da entrada. O service **PRECISA** montar a resposta mapeando: `emails.map(e => ({ email: e, exists: found.has(e) }))`. Isso está implícito na contracts/check-emails.api.md §Implementação ("Mapear: para cada e-mail de entrada"), mas não há teste explícito de ordem. Anotar para create-tasks: adicionar assertion de ordem no integration spec.

**Citação**: contracts/check-emails.api.md §Response, §Implementação.

---

### API-11 — Tenant-scope: teste de isolamento cross-tenant {auto}

**Item**: Há teste que garante que e-mail do tenant A não retorna `exists: true` para tenant B?

**Resolução**: PASS.
- plan.md §Plano de Testes (Backend/integration): "`check-emails.integration-spec.ts` — tenant-scope real: e-mail do tenant A NÃO aparece para tenant B (FR-19)".
- Padrão de RLS do projeto: `withTenantTx` + PrismaPg adapter.

**Citação**: plan.md §Plano de Testes; contracts/check-emails.api.md §Segurança.

---

### API-12 — SheetJS: Supply Chain Risk {humano}

**Item**: A versão de `xlsx` (SheetJS) a ser usada está fixada e auditada?

**Status**: ABERTO (ver Gap RQ-08-G1).
- plan.md §Notas de Segurança item 1: "pinar uma versão **recente** de `xlsx`" mas não fixa qual.
- SheetJS tem histórico de CVEs (prototype-pollution). Versão atual estável: `xlsx@0.18.5` (2023) — SheetJS mudou para modelo de distribuição proprietário; avaliar alternativas como `exceljs` ou `read-excel-file`.
- Decisão: confirmar qual versão ou biblioteca XLSX será usada e que passou em `pnpm audit`.

---

## DOMÍNIO: Testing

### TST-01 — Cobertura de Testes por FR {auto}

**Item**: Cada FR tem pelo menos um teste mapeado?

**Resolução**: PASS (com lacunas menores mapeadas em outros items).
- FR-01/02/03/04 → `file-upload-zone.spec.tsx`.
- FR-05 → `csv-parser.spec.ts` (ISO-8859-1/Win-1252/UTF-8).
- FR-06 (XLSX dynamic import) → `csv-parser.spec.ts` (branch xlsx). Sem teste de bundle size (Gap RQ-02-G2).
- FR-07 → `csv-parser.spec.ts` + `multiSheetWarning`.
- FR-08/09/10 → `csv-parser.spec.ts`.
- FR-11/12/13/14/15 → `csv-validator.spec.ts`.
- FR-16/17 → `csv-preview-table.spec.tsx`.
- FR-18/19/20/21 → `use-check-emails.spec.ts` + `check-emails.integration-spec.ts`.
- FR-22/23 → jest-axe em `file-upload-zone.spec.tsx` e `csv-preview-table.spec.tsx`.
- FR-24 → verificado via strings i18n (teste de snapshot i18n ou inspeção manual).

**Citação**: plan.md §Plano de Testes.

---

### TST-02 — Snapshot Test Zod obrigatório {auto}

**Item**: O snapshot test de contrato Zod está no plano?

**Resolução**: PASS.
- plan.md §Plano de Testes: `packages/types/.../csv-import.snapshot.spec.ts`.
- plan.md §Gotchas CI: "Snapshot test Zod obrigatório — sem ele, o gate de contrato não existe."
- contracts/csv-import.types.md §Snapshot test: descreve mecanismo.

**Citação**: plan.md §Plano de Testes, §Gotchas CI.

---

### TST-03 — E2E: roundtrip real vs schema {auto}

**Item**: O E2E valida a shape da resposta real do backend?

**Resolução**: PASS.
- plan.md §Plano de Testes (E2E): "roundtrip REAL ao check-emails comparando shape vs `checkEmailsResponseSchema`".
- quickstart.md referenciado no plano para este roundtrip.

**Citação**: plan.md §Plano de Testes.

---

## RESUMO DE GAPS E CONFLITOS

### Gaps para create-tasks

| ID | Domínio | Descrição | Severidade |
|----|---------|-----------|------------|
| RQ-02-G1 | Requirements | Nenhum teste automatizado para SC-001 (<3s/200 linhas) | Baixa |
| RQ-02-G2 | Requirements | Nenhum teste de bundle size para SC-004 (XLSX fora do bundle) | Baixa |
| RQ-02-G3 | Requirements | Nenhum teste de carga/timer para SC-006 (<2s/500 e-mails) | Média |
| RQ-06-G1 | Requirements | Ausência de FR formal para restrição de logs (PII) no check-emails | Média |
| RQ-08-G1 | Requirements | Versão mínima de papaparse/xlsx não fixada na spec | Média |
| UX-01-G1 | UX | Estado de loading durante parse client-side não especificado | Baixa |
| UX-02-G1 | UX | Estado "arquivo vazio" na tabela não especificado | Baixa |
| UX-02-G2 | UX | Estado intermediário parse→check-emails sem indicador visual | Baixa |
| UX-04-G1 | UX | Não definido se é scroll único ou step-wizard (integração com wizard Epic 10) | Média |
| UX-05-G1 | UX | Nome do arquivo de template não especificado | Baixa |
| UX-05-G2 | UX | Template com ou sem linha de exemplo não especificado | Baixa |
| UX-06-G1 | UX | Strings PT-BR das mensagens de erro/aviso não listadas nos artefatos | Alta |
| UX-07-G1 | UX | Posicionamento/forma do aviso de múltiplas abas não definido | Baixa |
| API-09-G1 | API | Comportamento de falha parcial no batching multi-request não especificado | Média |

### Conflitos para create-tasks

| ID | Domínio | Descrição | Severidade |
|----|---------|-----------|------------|
| API-10-C1 | API | Contrato diz "ordem espelha entrada" mas `findMany({in})` do Postgres não preserva ordem — service deve mapear manualmente; falta teste de ordem | Média |

### Items humano pendentes

| ID | Domínio | Decisão Necessária |
|----|---------|-------------------|
| RQ-05 | Requirements | SC-001 e SC-006 serão verificados com automação ou apenas manualmente? |
| API-08 | API | Parâmetros de rate-limit do CheckEmailsRateLimitGuard para check-emails (janela, limite, considerando batching) |
| API-12 | API | Versão/biblioteca XLSX a usar (xlsx@latest vs exceljs vs read-excel-file) e confirmação de `pnpm audit` |

---

## ESTATÍSTICAS

- **Total de items**: 23
- **{auto} resolvidos**: 18
- **{humano} pendentes**: 3 (RQ-05, API-08, API-12)
- **Gaps [Gap]**: 14
- **Conflitos [Conflict]**: 1
- **Todos os MUST da constitution**: PASS (validado no plan.md §Constitution Check)
