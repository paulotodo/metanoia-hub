# Quickstart: exportacao-dados-pessoais

**Feature:** Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD
**Data:** 2026-06-12

---

## Cenário 1: Happy Path — Solicitar e baixar export JSON

**Pré-condições:** Usuário autenticado com dados em 2 tenants, nenhum export ativo.

```
1. Frontend: usuário clica "Exportar meus dados" em /app/consumo/perfil/privacidade
2. Frontend: POST /api/v1/privacy/export { "format": "json" }
3. Backend: ZodValidationPipe valida body
4. Backend: prisma.client.userTenant.findMany({ where: { userId } }) retorna [tenantA, tenantB]
5. Backend: verifica 409 — nenhum job ativo encontrado
6. Backend: INSERT privacy_export_jobs (status='accepted', all_tenant_ids=[tenantA, tenantB])
7. Backend: queue.add('export-personal-data', { jobId, userId, allTenantIds, format, requestedAt })
8. Backend: Redis SET cache:privacy:export-job:<jobId> { status: 'accepted', ... } TTL 48h
9. Backend → Frontend: 202 { data: { jobId, status: "accepted", estimatedCompletionHours: 24 } }

10. Frontend: inicia polling GET /api/v1/privacy/export/<jobId> a cada 5s
    → Response: { status: "processing", signedUrl: null, ... }

11. Worker BullMQ (assíncrono):
    a. UPDATE privacy_export_jobs SET status='processing'
    b. Redis SET { status: 'processing' }
    c. Para tenantA:
       - users.exportUserData(userId, tenantA) → { profile: {...}, tenants: [...] }
       - groups.exportUserData(userId, tenantA) → { memberships: [...] }
       - meetings.exportUserData(userId, tenantA) → { attendance: [...], ... }
       - trails.exportUserData(userId, tenantA) → { trailProgress: [...], ... }
       - pastoral.exportUserData(userId, tenantA) → { alertsAboutMe: [...], ... }
       - privacy.exportConsentData(userId, tenantA) → { acceptances: [...], ... }
       - audit.exportUserData(userId, tenantA) → { events: [...] }
    d. Repete para tenantB
    e. Gera JSON FullExportPayload
    f. StorageService.upload('exports/privacy/<userId>/<date>-<jobId>.json', buffer, 'application/json')
    g. StorageService.getSignedUrl(objectKey, 172800) → signedUrl
    h. UPDATE privacy_export_jobs SET status='completed', object_key, signed_url, expires_at, completed_at
    i. Redis SET { status: 'completed', signedUrl, expiresAt } TTL 48h
    j. queue.add (queue:notifications) { type: 'privacy-export-ready', userId, jobId } [stub]

12. Frontend: polling detecta status='completed'
    → usePrivacyExport hook atualiza estado
    → Toast: "Seus dados estão prontos para download"
    → Seção "Meus Exports" exibe botão de download com link para página de privacidade

Expected: arquivo JSON baixado contém seções para tenantA e tenantB; profile sem tenantId; dados de todos os módulos.
```

---

## Cenário 2: Erro — Export duplicado (409)

```
1. Usuário já tem job com status='accepted' no DB
2. POST /api/v1/privacy/export { "format": "pdf" }
3. Backend: prisma.client.privacyExportJob.findFirst({
     where: { userId, status: { in: ['accepted', 'processing'] } }
   }) → encontra job existente
4. Backend → Frontend: 409 { error: "Conflict", message: "Export em andamento..." }

Expected: frontend exibe mensagem informando que export já está em andamento.
```

---

## Cenário 3: Usuário sem dados (export vazio válido)

```
1. Novo usuário autenticado, sem grupos/reuniões/trilhas
2. POST /api/v1/privacy/export { "format": "json" }
3. Worker executa exportUserData em todos os módulos
   → Cada módulo retorna arrays vazios (nunca lança exceção)
4. JSON gerado contém: { tenants: [{ tenantId: X, users: { profile: {...}, tenants: [...] }, groups: { memberships: [] }, ... }] }

Expected: arquivo JSON válido, sem erro, seções com arrays vazios.
```

---

## Cenário 4: Falha do worker após 3 tentativas

```
1. Worker tenta processar, StorageService.upload lança erro de rede
2. BullMQ tenta novamente após 60s (attempts: 3, backoff: fixed 60s)
3. Após 3 falhas: job movido para fila failed
4. Worker handler: UPDATE privacy_export_jobs SET status='failed', failure_reason='...'
5. Redis SET { status: 'failed', failureReason: 'Timeout after 3 attempts' }
6. Sentry.captureException(error) [stub via console.error em dev]

Expected: polling retorna status='failed' com failureReason; frontend exibe mensagem de erro.
```

---

## Roundtrip End-to-End (teste de integração obrigatório)

```
1. Setup: criar usuário com dados em TODAS as tabelas (factory com tenantId)
2. POST /api/v1/privacy/export → capturar jobId
3. Aguardar conclusão do worker (await job.waitUntilFinished ou polling com timeout 30s)
4. GET /api/v1/privacy/export/<jobId> → capturar signedUrl
5. GET signedUrl → baixar arquivo JSON real do MinIO
6. Parse JSON e verificar:
   - profile.email === usuario.email
   - profile sem campo tenantId
   - groups.memberships.length >= 1
   - meetings.attendance.length >= 1
   - trails.trailProgress.length >= 1
   - pastoral.alertsAboutMe.length >= 1
   - consent.acceptances.length >= 1
   - audit.events.length >= 1

Expected: TODOS os campos presentes no export; nenhuma seção undefined ou null onde array esperado.
```

---

## Cenário de RLS Isolation

```
1. Setup: tenantA com usuárioA; tenantB com usuárioB; ambos com jobs
2. Como usuárioA (tenantA): GET /api/v1/privacy/export/<jobId-de-usuarioB>
   → 404 (Redis TTL: jobId não pertence ao usuário; ou DB RLS filtra)

Expected: isolamento — usuário não vê exports de outro usuário.
```
