# Reconciliação WDS↔BMad — Wave W1a.3

> Pré-flight 2026-06-10. Auditoria do código real contra 4-5, 7-1, 5-6.

## Resultado

| Story | Classificação | Ação |
|---|---|---|
| 5-6 Relatório pós-reunião | **JÁ-COBERTA** (drift tracking) | Marcar `done` (PR #112, `437ee66`) |
| 4-5 Participante vê grupos | **PARCIAL ~80%** | `/feature-00c` residual pequeno |
| 7-1 Boas-vindas personalizada | **NOVA ~33%** | `/feature-00c` implementação completa |

## 5-6 — JÁ-COBERTA (drift)
Mergeada PR #112 (`437ee66`, 2026-05-12). 4/4 ACs: report JSONB no meeting end +
role-based shaping (líder/admin full, participante personal) + reminder BullMQ stub
30min. Migration `20260513140000_add_meeting_reports` + RLS. sprint-status marcava
`in-review` por engano → corrigido para `done`.

## 4-5 — PARCIAL (~80%, Cenário 06)
Coberto: `GET /participant/groups` (lista + envelope `{data, meta:{firstVisit}}` via
Redis SETNX), `GET /participant/groups/:id` (detalhe), RLS (membership), empty-state,
testes (unit/a11y/snapshot). `participant-groups` module + frontend `app/consumo/grupos`.

Residual:
1. **AC#6**: emitir domain event `participant.group.first_view` no 1º acesso (hoje só
   trackeia flag firstVisit no Redis, sem evento).
2. **AC#8 (UI)**: renderizar seção "Outros participantes" (peers, só primeiro nome) na
   página de detalhe `grupos/[id]/page.tsx` — backend (`mapToDetail`) e Zod já entregam os dados.
3. **AC#10 (cosmético)**: alinhar cópia do empty-state ao texto pastoral da spec.

## 7-1 — NOVA (~33%)
Existe só: esqueleto `app/admin/boas-vindas/page.tsx` (nome "Pastor" hardcoded) +
chaves `welcome` em pt-BR.json. O ParticipantWelcomeView do Cenário 06 é o onboarding
de **convite** (`(onboarding)/convite/[token]`), NÃO a tela pós-login da 7-1.

Residual (implementação completa):
1. `onboarding_completed_at DateTime?` no model User + migration (+RLS já existe em users).
2. Endpoint `PATCH /api/v1/users/me/onboarding-complete` (SET now()).
3. Middleware/guard em `(authenticated)`: 1º acesso (campo null) → redireciona p/ boas-vindas do papel.
4. Páginas de boas-vindas para líder e participante (admin já tem esqueleto) com CTA por papel.
5. Personalização: nome dinâmico do usuário (remover "Pastor" hardcoded).
6. Wire CTA → chama PATCH ao concluir.
- Deferir: centralização em `vocabulary.ts` (depende de Story 6-1, ainda ready-for-dev) — usar pt-BR.json existente.

## Impacto no plano
W1a.3 = 1 marcação (5-6) + 1 PR pequeno (4-5) + 1 PR completo (7-1). Fecha a Release 1a.
