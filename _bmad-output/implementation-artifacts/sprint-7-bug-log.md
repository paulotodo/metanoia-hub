# Sprint 7 — Bug Log

Sprint 7 (Estabilização Release 1a) usa este log para rastrear bugs descobertos
pela suite E2E (Story 7-4) e por sessões de hardening (Story 7-5). Cada entrada
é triada em uma das três severidades:

- **P0 — bloqueia Release 1a.** Fix obrigatório dentro da Story que descobriu o
  bug, antes do tag `v1a`.
- **P1 — importante mas não bloqueia.** Vai para Story 7-6 (follow-up de bugs
  do E2E) e precisa fechar antes do tag `v1a`.
- **P2 — cosmético / edge case.** Backlog Release 1b. Não bloqueia o tag.

## Convenções

- Data no formato ISO `YYYY-MM-DD`.
- Coluna **Trace** aponta para `playwright-report/` (local) ou para o artifact
  do CI run que reproduziu o bug.
- **Story de fix** vazio = ainda não tem story; preenche quando o bug for
  triado para uma sprint específica.

## Bugs

| Data | Descrição | Severidade | Trace | Story de fix | Status |
|------|-----------|------------|-------|--------------|--------|
| 2026-05-10 | Login form (`apps/web/app/(public)/login/_components/`) redireciona para `/dashboard`, rota que não existe na app router (admin home está em `/app/admin/igreja/vista`). Idem `/tenant/select` (deveria ser `/selecionar-igreja`) e `/consent` (não há página). Spec da Story 7-4 contorna fazendo `goto('/selecionar-igreja')` direto após login para destravar o fluxo. | P1 | descoberta durante criação do spec (não rodou) | 7-6 (a criar) | aberto |
| 2026-05-10 | `apps/web/app/(authenticated)/app/admin/grupos/novo/_components/create-group-form.tsx` redireciona para `/app/admin?acabou-de-criar=1` em vez de `/app/admin/igreja/grupos/<id>` como descrito na story 4-1. Spec captura o id via `waitForResponse` em `/api/v1/admin/groups`. Não bloqueia, mas sugere ajuste UX para abrir o grupo recém-criado. | P2 | descoberta durante criação do spec | backlog 1b | aberto |
