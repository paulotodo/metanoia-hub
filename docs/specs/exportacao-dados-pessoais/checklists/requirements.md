# Requirements + Security + API Checklist: exportacao-dados-pessoais

**Purpose**: Validar qualidade, clareza e completude dos requisitos da Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD. Cobre domínios de requisitos funcionais, segurança de dados pessoais e contratos de API assíncrona.
**Created**: 2026-06-12
**Feature**: [spec.md](../spec.md)

---

## A. Completude de Requisitos Funcionais

- [x] CHK001 - Cada módulo que persiste dados pessoais (Users, Groups, Meetings, Trails, Pastoral, Consent, Audit) tem `exportUserData()` especificado com campos de retorno? [Completude, Spec §2.5 + §6.4] {auto}
  > `spec §2.5` lista todos os 7 módulos com service e tabelas relevantes. `spec §6.4` define interface TypeScript de retorno para cada um (`UserExportData`, `GroupsExportData`, `MeetingsExportData`, `TrailsExportData`, `PastoralExportData`, `ConsentExportData`, `AuditExportData`). `data-model.md` define os schemas Zod correspondentes. Satisfeito.

- [x] CHK002 - O requisito de "usuário sem dados retorna export vazio válido (não erro)" está documentado com critério verificável? [Completude, Spec §FR-06 + §AC8] {auto}
  > `spec §FR-06`: "Usuário sem dados: export válido com seções vazias (não erro)". `spec §6.4`: cada `exportUserData()` definido como "NUNCA lança — retorna arrays vazios se usuário não tem dados". AC8 na tabela §8. Satisfeito.

- [x] CHK003 - O mecanismo de detecção de export duplicado (409) cobre os status `accepted` E `processing`, não apenas um deles? [Completude, Spec §FR-01 + §FR-07] {auto}
  > `spec §FR-01`: "Se já existe job `accepted` ou `processing`: retornar 409". `contracts/api.md` documenta Response 409. `plan.md §Verificação de job ativo`: `status: { in: ['accepted', 'processing'] }`. Ambos os status cobertos. Satisfeito.

- [x] CHK004 - O requisito de retry com backoff está especificado com valores concretos (tentativas, intervalos)? [Completude, Spec §FR-02] {auto}
  > `spec §FR-02`: "Retry 3x: backoff 1m, 5m, 30m (BullMQ `attempts` + `backoff`)". `contracts/api.md §BullMQ Job Payload`: `attempts: 3, backoff: { type: 'fixed', delay: 60_000 }`. Nota: spec cita "1m, 5m, 30m" (backoff crescente) mas contracts define `fixed` (1m fixo). Há inconsistência — ver CHK031 `[Conflict]`.

- [x] CHK005 - O ciclo de vida de status do job (`accepted → processing → completed / failed`) está documentado com todas as transições válidas? [Completude, Spec §6.2 + data-model.md] {auto}
  > `data-model.md §State Transitions`: `accepted → processing → completed` e `processing → failed (após 3 tentativas BullMQ)`. Diagrama de estado completo. Satisfeito.

- [x] CHK006 - O requisito de notificação por e-mail define explicitamente o que o e-mail contém e o que NÃO deve conter (signed URL)? [Completude, Spec §FR-05 + §NFR-S3] {auto}
  > `spec §FR-05`: "E-mail inclui LINK para página de download (NÃO a signed URL diretamente)". `spec §NFR-S3`: "Conteúdo do e-mail não inclui signed URL (apenas link para página de download)". Requisito negativo explícito presente. Satisfeito.

- [x] CHK007 - Os dados de Pastoral no export excluem `PastoralAction` explicitamente — a exclusão está justificada nos requisitos? [Completude, Spec §CL-04] {auto}
  > `spec §CL-04`: "`PastoralAction` NÃO entra no export desta story. O export Pastoral cobre apenas `pastoral_alerts` e `pastoral_notes`." Justificativa: "spec §2.5 lista explicitamente... sem mencionar `pastoral_actions`". Exclusão explicitamente documentada. Satisfeito.

- [x] CHK008 - Existe requisito cobrindo o comportamento quando o worker falha após 3 tentativas (além de "alertar Sentry")? [Completude, Spec §FR-02 + §AC5] {auto}
  > `spec §FR-02`: "Falha após 3 tentativas: mover para `queue:privacy-export:failed`, alertar Sentry". AC5 na tabela §8 inclui verificação de retry. Comportamento de falha documentado. Falta: está especificado se o `status` do job é atualizado para `failed` no DB/Redis após esgotar retries? `data-model.md §State Transitions` e `spec §6.4 processExportJob` implicitamente cobrem, mas nenhum FR diz "UPDATE status=failed no Redis e DB". `[Gap]` menor — ver CHK032.

- [x] CHK009 - A lifetime de 30 dias dos arquivos no MinIO (`NFR-S2`) e a validade de 48h da signed URL (`NFR-S1`) são requisitos não-funcionais distintos e não-conflitantes? [Clareza, Spec §NFR-S1 + §NFR-S2] {auto}
  > `spec §NFR-S1`: "Signed URL com 48h de validade". `spec §NFR-S2`: "Arquivo armazenado no MinIO por 30 dias (storage policy `temporary`)". São dois TTLs distintos (URL vs. objeto), sem conflito. O arquivo existe 30 dias; a URL expira em 48h (renovável). Satisfeito.

- [x] CHK010 - O requisito de deadline de 48h (escalação para fila prioritária) está especificado com mecanismo de implementação? [Clareza, Spec §NFR-L1 + §FR-02] {auto}
  > `spec §NFR-L1`: "Job completado em até 72h; escalação para fila prioritária se não completo em 48h". `spec §FR-02`: "Deadline: se não completo em 48h, escalar para fila de alta prioridade". Nenhum dos artefatos (`plan.md`, `contracts/api.md`, `data-model.md`) especifica o mecanismo de detecção dos 48h (scheduled check? campo `scheduled_at`? cron job?). `[Gap]` — mecanismo de escalação não detalhado.

---

## B. Clareza e Precisão dos Requisitos

- [x] CHK011 - O termo "modo privilegiado" do worker está definido com precisão operacional (o que exatamente bypassa e o que mantém)? [Clareza, Spec §2.6] {auto}
  > `spec §2.6`: "Usar `prisma.client` diretamente com `{ tenantId }` explícito (mesmo padrão do super-admin — não via RLS, pois o worker é um job privilegiado de sistema)". `plan.md §Exceção documentada`: "worker usa `prisma.client` diretamente (sem `withTenantTx`) no contexto de job BullMQ privilegiado... toda query filtra `userId` AND `tenantId` explicitamente." Bem definido: bypassa RLS + `withTenantTx`; mantém filtro explícito `userId + tenantId`. Satisfeito.

- [x] CHK012 - O campo `tenantId` no INSERT de `privacy_export_jobs` — seu significado semântico está claro (tenant ativo da request vs. tenant do export)? [Clareza, Spec §6.2 + data-model.md] {auto}
  > `spec §6.2`: comentário no SQL: `-- tenant ativo no momento da solicitação (RLS)`. `data-model.md §Campos`: "Tenant ativo no momento da solicitação; RLS scope". Distingue do `allTenantIds` (todos os tenants do export). Semântica explícita. Satisfeito.

- [x] CHK013 - A exceção multi-tenancy (worker privilegiado passando `tenantId` como parâmetro de função) está documentada como exceção formal ao padrão AsyncLocalStorage? [Clareza, Spec §2.6 + plan.md] {auto}
  > `spec §2.6`: "esta é a ÚNICA exceção ao padrão AsyncLocalStorage (o job roda fora de uma request HTTP)". `plan.md §Exceção documentada ao padrão Multi-tenancy`: parágrafo completo justificando. Exceção formal documentada. Satisfeito.

- [x] CHK014 - A responsabilidade de autorização no endpoint GET `/privacy/export/:jobId` (quem pode ver qual job) está especificada? [Clareza, Spec §FR-04 + contracts/api.md] {auto}
  > `contracts/api.md §GET`: "O endpoint NÃO verifica se o jobId pertence ao usuário autenticado via DB — confia no TTL + UUID v7 como segurança suficiente para o MVP (job ID gerado pelo servidor, não previsível)." Comportamento documentado. No entanto, a aceitabilidade desse modelo de autorização (UUID v7 como token implícito) como tradeoff de segurança para LGPD MVP — é uma decisão de produto. `{humano}` — ver CHK035.

- [x] CHK015 - Os schemas Zod de saída de cada `exportUserData()` estão definidos no `data-model.md` com todos os campos? [Completude, data-model.md] {auto}
  > `data-model.md §Schemas Zod` define 9 schemas: `PrivacyExportRequestSchema`, `PrivacyExportJobResponseSchema`, `PrivacyExportStatusSchema`, `UserProfileExportSchema`, `UserExportDataSchema`, `GroupsExportDataSchema`, `MeetingsExportDataSchema`, `TrailsExportDataSchema`, `PastoralExportDataSchema`, `ConsentExportDataSchema`, `AuditExportDataSchema`, `FullExportPayloadSchema`. Todos os 7 módulos cobertos. Satisfeito.

- [x] CHK016 - O `FullExportPayloadSchema` inclui metadados de identificação do export (`exportedAt`, `userId`, `format`) além dos dados por tenant? [Completude, data-model.md §FullExportPayloadSchema] {auto}
  > `data-model.md §FullExportPayloadSchema`: inclui `exportedAt: z.string()`, `userId: z.string().uuid()`, `format: z.enum([...])`, e array `tenants`. Metadados presentes. Satisfeito.

- [x] CHK017 - Está especificado se a chave Redis de polling (`cache:privacy:export-job:<jobId>`) é gravada ANTES ou DEPOIS do upload para MinIO? [Clareza, Spec §7 + plan.md] {auto}
  > `spec §7 Fluxo Principal` (worker): "6. UPDATE privacy_export_jobs (status=completed, ...) → 7. Redis SET `cache:privacy:export-job:<jobId>`". Redis é gravado APÓS o upload e UPDATE no DB. Ordem determinada implicitamente pela numeração. Satisfeito.

---

## C. Consistência dos Requisitos

- [ ] CHK018 - O campo `object_key` e o campo `signed_url` no DB — estão consistentes com o padrão MinIO object key definido em `data-model.md §MinIO`? [Consistência, data-model.md §MinIO + §Campos] {auto}
  > `data-model.md §MinIO`: padrão `exports/privacy/{userId}/{YYYY-MM-DD}-{jobId}.{format}`. `data-model.md §Campos`: `object_key TEXT` (quando completed). `spec §6.2` SQL: `object_key TEXT`. Consistentes. Mas `spec §FR-02`: `exports/global/{userId}/{timestamp}.{format}` — divergência de prefixo (`exports/global/` vs. `exports/privacy/`). `[Conflict]` — qual prefixo MinIO usar?

- [x] CHK019 - Os critérios de aceitação na tabela §8 da spec cobrem todos os FRs principais sem lacunas? [Consistência, Spec §3 + §8] {auto}
  > Mapeamento FR↔AC: FR-01→AC1, FR-02→AC2+AC5+AC8, FR-03→AC2, FR-04→AC3, FR-05→AC10, FR-06→AC2+AC8, FR-07→AC4. Todos os FRs têm pelo menos 1 AC correspondente. AC6 (UI botão) e AC7 (toast polling) cobrem o frontend. AC9 cobre RLS. Satisfeito.

- [x] CHK020 - As dependências listadas em `spec §9` são todas stories já concluídas? [Consistência, Spec §9] {auto}
  > `spec §9`: Story 9-4 (CONCLUÍDA — PR #136), Story 8-7 (CONCLUÍDA — PR #131), Story 4-3 (CONCLUÍDA — PR #93), Epic 4/5/6/8 (serviços existentes a serem estendidos). Todas as dependências marcadas como concluídas. Satisfeito.

- [ ] CHK021 - O intervalo de backoff do BullMQ — spec diz "1m, 5m, 30m" (crescente) mas contracts/api.md diz `fixed delay: 60_000ms` (1m fixo). Qual é a especificação autoritativa? [Conflito, Spec §FR-02 vs. contracts/api.md §BullMQ] {auto}
  > `spec §FR-02`: "backoff 1m, 5m, 30m" — implica `type: 'exponential'` ou lista customizada. `contracts/api.md`: `backoff: { type: 'fixed', delay: 60_000 }` — 1m fixo. `[Conflict]` — valores inconsistentes. Necessita resolução antes de implementar.

- [x] CHK022 - A signing da URL MinIO (`StorageService.getSignedUrl`) e o TTL do Redis (`PRIVACY_EXPORT_JOB_TTL_SECONDS = 172800`) são consistentes entre si? [Consistência, data-model.md §Constantes + §Redis] {auto}
  > Ambos definidos como `172800s = 48h`. `data-model.md §Constantes`: `PRIVACY_EXPORT_JOB_TTL_SECONDS = 172800` e `PRIVACY_EXPORT_SIGNED_URL_SECONDS = 172800`. Consistentes. Satisfeito.

---

## D. Segurança e Privacidade (LGPD)

- [x] CHK023 - Está especificado que a `signed_url` não aparece em NENHUM log do sistema (nem `Logger.log`, apenas `Logger.debug`)? [Segurança, plan.md §Riscos] {auto}
  > `plan.md §Riscos e Mitigações`: "Signed URL na resposta API de polling vaza para logs → Remover signed URL de qualquer `Logger.log` — apenas `Logger.debug`". Requisito de logging documentado. Satisfeito.

- [x] CHK024 - O campo `all_tenant_ids` na tabela DB está especificado como write-once e como NUNCA retornado pela API pública? [Segurança, Spec §CL-06] {auto}
  > `spec §CL-06`: "coluna **write-once** nunca retornada pela API pública". "DTOs de resposta (`PrivacyExportResponseSchema`) não incluem `allTenantIds`." Confirmado em `data-model.md §PrivacyExportStatusSchema` — `allTenantIds` ausente. Satisfeito.

- [x] CHK025 - O isolamento RLS está especificado para `privacy_export_jobs` com teste de regressão obrigatório? [Segurança, Spec §NFR-T1 + §AC9] {auto}
  > `spec §NFR-T1`: "RLS isolation tests obrigatórios para migration `privacy_export_jobs`". `spec §5.1 IN SCOPE`: "Testes: unit (por módulo), integration (completude), RLS isolation". AC9: "RLS isolation: tenant A não vê jobs do tenant B". Path do teste: `apps/api/test/rls/privacy-export-jobs.rls.spec.ts`. Satisfeito.

- [x] CHK026 - O worker está especificado para filtrar sempre por `userId` (além de `tenantId`) para prevenir vazamento cross-user? [Segurança, Spec §2.6 + §10] {auto}
  > `spec §2.6`: "Worker precisa iterar por TODOS os tenants do usuário". `spec §10 Riscos`: "Worker privilegiado vaza dados cross-user → Query sempre filtra por `userId` explicitamente". `plan.md §exportUserData — Contrato de Módulo`: `where: { userId, tenantId }`. Mitigação explícita documentada. Satisfeito.

- [x] CHK027 - O e-mail de notificação está especificado para NÃO incluir a signed URL (apenas link para página de download)? [Segurança, Spec §NFR-S3] {auto}
  > `spec §FR-05`: "E-mail inclui LINK para página de download (NÃO a signed URL diretamente)". `spec §NFR-S3`: "Conteúdo do e-mail não inclui signed URL (apenas link para página de download)". Requisito de segurança explícito. Satisfeito.

- [ ] CHK028 - Está especificado se o arquivo gerado no MinIO tem ACL privada (não-público)? E se o bucket `exports/privacy/` tem policy de acesso restrito? [Segurança, Spec §FR-02] {auto}
  > `spec §FR-02`: "Upload para MinIO: `exports/privacy/global/{userId}/...` + Signed URL com validade 48h". Signed URL implica objeto privado (sem signed URL não é acessível). Mas a spec não documenta explicitamente o ACL do objeto ou a policy do bucket. `[Gap]` — implícito via uso de signed URL, mas não formalizado.

- [ ] CHK029 - Existe requisito especificando o que acontece quando a signed URL expira ANTES do usuário fazer o download? [Cobertura, Spec §NFR-S1] {auto}
  > `spec §NFR-S1`: "Signed URL com 48h de validade; renovável sob demanda". `spec §5.2 OUT OF SCOPE`: "Renovação automática de signed URL". O que acontece na expiração: 404 do MinIO (comportamento implícito). A spec diz "renovável sob demanda" mas não especifica o endpoint nem o flow de renovação. `[Gap]` — flow de renovação excluído do escopo mas não detalhado como limitação conhecida.

---

## E. Contratos de API

- [x] CHK030 - O contrato do POST `/privacy/export` inclui explicitamente o body de erro 409 no padrão `{ statusCode, error, message }` da constitution? [Completude, contracts/api.md + Spec §AC4] {auto}
  > `contracts/api.md §POST`: Response 409 documentado com `{ statusCode: 409, error: "Conflict", message: "..." }`. Padrão da constitution seguido. Satisfeito.

- [ ] CHK031 - O contrato do GET `/privacy/export/:jobId` especifica o comportamento quando o `jobId` não pertence ao usuário autenticado (403 vs. 404)? [Cobertura, contracts/api.md + Spec §FR-04] {auto}
  > `contracts/api.md §GET`: documenta Response 404 (Redis TTL expirou) mas não Response 403 (jobId de outro usuário). A nota: "NÃO verifica se jobId pertence ao usuário autenticado". Comportamento: um usuário com jobId de outro usuário recebe 200 com dados daquele job (se o Redis ainda existe) ou 404 (se expirou). `[Gap]` — ausência de validação de ownership documentada como decisão, mas o comportamento resultante não está explicitamente especificado como "retornar 200 do job de outro usuário é aceito para MVP".

- [x] CHK032 - A resposta 200 do polling inclui `signedUrl` como `null` (não ausente) quando o job ainda não está completo? [Clareza, contracts/api.md + data-model.md §PrivacyExportStatusSchema] {auto}
  > `contracts/api.md §GET Response 200 — Polling`: `"signedUrl": null`. `data-model.md §PrivacyExportStatusSchema`: `signedUrl: z.string().url().nullable()`. Null explícito (não ausente). Satisfeito.

- [x] CHK033 - O contrato de erro `{ statusCode, error, message, details? }` está seguido em TODOS os endpoints (sem stack traces)? [Consistência, contracts/api.md + CLAUDE.md §API Contracts] {auto}
  > `contracts/api.md`: todos os erros documentados (409, 429, 404) seguem `{ statusCode, error, message }`. Nenhum inclui `details` de stack trace. Satisfeito.

- [x] CHK034 - Todos os campos de data nas respostas de API estão especificados como ISO 8601 strings (não timestamps Unix)? [Consistência, data-model.md §Schemas Zod] {auto}
  > `data-model.md §UserProfileExportSchema`: `onboardingCompletedAt: z.string().nullable()` com comentário "ISO 8601". `data-model.md §MeetingsExportDataSchema`: `joinTime: z.string()`. `plan.md §Convencoes de Borda`: "Mapper layer: `record.createdAt.toISOString()`". Consistente. Satisfeito.

---

## F. Critérios de Aceitação Mensuráveis

- [x] CHK035 - O AC2 ("Worker coleta dados de todos módulos e todos tenants") tem critério de verificação objetivo (não subjetivo)? [Mensurabilidade, Spec §AC2 + §FR-06] {auto}
  > `spec §FR-06`: "Teste de integração: criar usuário com dados em TODAS as tabelas → export → verificar presença de todos. Se um módulo novo adicionar tabela sem atualizar `exportUserData()`: teste FALHA". Critério binário e automatizável. Satisfeito.

- [x] CHK036 - O AC5 ("Retry 3x com backoff; falha → Sentry alert") é verificável sem depender de um ambiente Sentry real? [Mensurabilidade, Spec §AC5] {auto}
  > `spec §AC5`: "BullMQ config + unit mock". Verificação via mock BullMQ — não exige Sentry real. Satisfeito.

- [x] CHK037 - O NFR-P1 ("< 30s para 5 tenants") é um critério testável com dados representativos? [Mensurabilidade, Spec §NFR-P1] {auto}
  > `spec §NFR-P1`: "Export para usuário com dados em até 5 tenants deve completar em < 30s (job)". `plan.md §Riscos`: "benchmark com 5 tenants antes de declarar done". Critério mensurável com benchmark explícito. Satisfeito. Mas: não especificado o volume de dados por tenant no benchmark (1 registro? 1000?). `{humano}` — ver CHK038.

---

## G. Dependências e Premissas

- [x] CHK038 - As premissas sobre paths reais dos serviços a modificar (`group-members`, `trail-progress`) estão documentadas como incertezas a verificar? [Dependências, plan.md §Riscos] {auto}
  > `plan.md §Riscos`: "`group-members` path real no codebase → Verificar: `src/groups/group-members/` ou `src/participant-groups/`". "`trail-progress` path real → Verificar: `src/content/my-trails/` ou `src/content/progress/`". Premissas identificadas como riscos com alternativas listadas. Satisfeito.

- [x] CHK039 - A dependência do `ConsentRepository` (não re-implementar) está documentada com o método exato a injetar? [Dependências, Spec §2.2] {auto}
  > `spec §2.2`: "`privacy.service.exportConsentData()` deve **injetar ConsentRepository**, não reimplementar." Métodos listados: `findAllAcceptancesByUser(userId)` e `findWithdrawalsByUser(userId, tenantId)`. Satisfeito.

- [x] CHK040 - A premissa de que `pdfkit` não exige fontes nativas no ambiente Docker/CI está identificada como risco a validar? [Dependências, plan.md §Riscos] {auto}
  > `plan.md §Riscos`: "pdfkit build no Docker/CI → Verificar que `pdfkit` não exige fontes nativas; usar embedding". Risco identificado com mitigação proposta. Satisfeito.

---

## H. Itens para Decisão do Produto (humano)

- [ ] CHK041 - O modelo de autorização do GET polling (UUID v7 como token implícito, sem ownership check por usuário) é aceitável para LGPD no MVP? [Risco de Privacidade, contracts/api.md §GET Nota] {humano}
  > Um usuário com jobId de outro usuário pode ver o status e a signed URL daquele job durante as 48h de TTL do Redis. Para LGPD (acesso a dados pessoais de outro titular), isso pode ser um gap de privacidade. Decisão: aceitar para MVP com jobId não-previsível (UUID v7), ou adicionar validação de ownership?

- [ ] CHK042 - O volume de dados esperado por tenant no benchmark do NFR-P1 ("< 30s para 5 tenants") está especificado? [Mensurabilidade, Spec §NFR-P1] {humano}
  > O critério "<30s para 5 tenants" não define volume: usuário com 10 registros por módulo ou 10.000? Necessário definir o perfil de dados do benchmark para que o teste tenha valor como gate de release.

- [ ] CHK043 - O mecanismo de escalação para fila prioritária após 48h sem conclusão (NFR-L1) deve ser implementado nesta story ou é deferido? [Escopo, Spec §NFR-L1] {humano}
  > `plan.md` e a sequência de implementação não incluem um mecanismo de cron job / delayed check para detectar jobs com > 48h e escalá-los. O requisito está no NFR mas não há tarefa correspondente na sequência de implementação.

---

## Notes

- Items `{auto}` resolvidos pelo agente com citação de evidência (`[x]`) ou marcador de gap/conflito (`[ ]`).
- Items `{humano}` aguardam decisão do dono do produto antes de `/execute-task`.
- **Itens `[Conflict]` obrigatórios** antes de iniciar implementação:
  - CHK018: `exports/global/` vs. `exports/privacy/` — prefixo MinIO
  - CHK021: backoff "1m, 5m, 30m" vs. `fixed 60_000ms` — strategy BullMQ
- **Itens `[Gap]` a endereçar** (viram tarefas ou aceites explícitos):
  - CHK008: UPDATE status=failed no Redis/DB após esgotar retries — não coberto por FR explícito
  - CHK010: mecanismo técnico de detecção dos 48h para escalação
  - CHK028: ACL do objeto MinIO (privado) não formalizado
  - CHK029: flow quando signed URL expira (sem renovação nesta story)
  - CHK031: comportamento da API quando jobId não pertence ao usuário
