# Project Briefing: metanoia-hub

**Data**: 2026-06-09
**Status**: Ratificado (derivado de artefatos BMad existentes)
**Versao**: 1.0

> Briefing canônico para a pipeline SDD/cstk. Sintetizado a partir de
> `docs/prd.md`, `docs/architecture.md`, `docs/project-context.md` e
> `CLAUDE.md`. O projeto já está em implementação avançada (Sprints 0-9
> fechados, ~32 stories `done`); este briefing formaliza a fundação que já
> dirige o desenvolvimento, para habilitar `/constitution` e `/feature-00c`.

---

## 1. Visao e Proposito

**O que e**: Plataforma web SaaS B2B para discipulado cristão e cuidado
pastoral (EdTech) que integra encontro ao vivo, trilhas de formação,
acompanhamento de presença e visibilidade pastoral numa experiência única.

**Problema que resolve**: A fragmentação atual — igrejas e escolas bíblicas
usam WhatsApp + videoconferência + Google Drive sem nenhuma visibilidade sobre
quem está engajado, quem está se afastando e quem completou a formação.

**Proposta de valor**: Funciona como um **Radar Pastoral** — revela sinais
digitais de participação e distanciamento para que o líder saiba quem precisa
de atenção antes que seja tarde. O radar é bidirecional (participantes, líderes
e grupos). Princípio fundador: **mede sinais, não almas** — presença digital
não equivale a saúde espiritual; o discernimento pastoral permanece com o líder.
Não substitui ferramentas: substitui a fragmentação.

## 2. Usuarios e Stakeholders

| Ator | Papel | Acoes Principais |
|------|-------|-----------------|
| Super Admin | Operador da plataforma | Provisiona tenants, métricas de plataforma, gestão de planos |
| Admin Tenant | Gestor da igreja/escola | Configura tenant, gerencia usuários/papéis, grupos, trilhas, branding |
| Líder | Conduz grupos de discipulado | Conduz reuniões, acompanha jornada, lê sinais de cuidado (semáforo) |
| Participante | Membro de um grupo | Consome trilhas, participa de reuniões, vê seu progresso |

**Stakeholders de decisao**: Paulo (product owner). Buyer-alvo é
**não-técnico** (pastores, líderes ministeriais) — restringe complexidade de UX
e de onboarding. Early adopters: escolas bíblicas e ministérios de formação com
30+ participantes em programas estruturados.

## 3. Escopo

### MVP (Essencial) — "Lovable MVP", 6 domínios

1. Autenticação, multi-tenancy e grupos (Identidade & Acesso)
2. Trilhas e conteúdo multiformato com progresso
3. Reunião ao vivo por integração agnóstica (LiveKit/adapter)
4. Presença e engajamento (sinais de cuidado, pipeline real-time)
5. Relatórios para o líder (dashboard semáforo 🟢🟡🔴 — Radar Pastoral)
6. Onboarding mínimo (time-to-value: líder cria 1ª trilha ≤ 5 min, grupo ≤ 10 min)

### Pos-MVP (Desejavel)

1. Relatórios avançados & analytics (materialized views, risco de evasão)
2. Notificações & comunicação (SSE, in-app, e-mail via Resend)
3. Acessibilidade avançada (screen-reader, semáforo multimodal)
4. Planos, limites dinâmicos e feature gating; branding por tenant
5. LGPD completo (exportação/exclusão, auditoria imutável)
6. Resiliência/offline (PWA), MFA líder, tracing distribuído, legendas de vídeo

### Fora de Escopo (MVP)

- WhatsApp via ChatMaster Veloz (Post-MVP)
- NATS JetStream / separação em microserviços (só com 3+ serviços)
- Modelagem de embeddings/IA Copiloto Pastoral (pgvector instalado, sem uso até fase futura)
- Hierarquia de tenants e API pública (Post-MVP/Enterprise)
- Database-per-tenant (evolução de tier enterprise sob demanda real)

## 4. Prioridades e Trade-offs

**Ordem de prioridade**: Segurança/Isolamento (multi-tenant) > Qualidade >
UX (buyer não-técnico) > Velocidade > Escopo.

**Decisoes explicitas**:
- Multi-tenancy via RLS desde o MVP (não database-per-tenant) — simplifica migrations.
- Dívida técnica consciente: cache + sessões + BullMQ + estado de reunião no mesmo Redis no MVP.
- Complexidade progressiva: modo express para líder não-técnico, modo avançado opcional.
- Confiabilidade do sinal: priorizar padrões sobre eventos isolados; permitir correção humana; nunca penalizar por falha técnica.
- Reframing obrigatório controle→cuidado em toda a UI (anti-vigilância).

## 5. Restricoes

| Restricao | Valor | Notas |
|-----------|-------|-------|
| Prazo | Flexível, por releases | Releases 1a → 1b → 2; sprints incrementais |
| Equipe | Desenvolvimento AI-assisted | Pipeline agêntica (BMad + cstk/SDD) |
| Budget | Não definido | — |
| Tecnica | Multi-tenant RLS obrigatória; mobile-responsive crítico; WCAG AA; LGPD | tenant_id em toda tabela; UUID v7; ISO 8601; strict TS |

## 6. Stack Tecnica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Monorepo | Turborepo 2.5+ / pnpm 10.33 | apps/web, apps/api, packages/{ui,types,config} |
| Frontend | Next.js 16.2 (App Router, SSR+CSR) | SSR landing/SEO, CSR área autenticada |
| Backend | NestJS 11.1 (bounded contexts) | REST `/api/v1`, repository pattern nos core domains |
| Banco | PostgreSQL + pgvector, Prisma v7, RLS | Isolamento multi-tenant no nível do banco |
| Auth | Keycloak | Autenticação centralizada + roles (3 camadas: roles → guards → RLS) |
| Cache/Jobs/RT | Redis + BullMQ | Namespaces cache:/rt:/queue:/rate:/session: |
| Storage | MinIO | Mídia, documentos, gravações (URLs assinadas) |
| Real-time | SSE + WebSocket do provedor de vídeo | Dashboard ao vivo, presença |
| UI | Tailwind 4.2, shadcn/ui, Zustand 5, TanStack Query 5.96 | Server state ≠ client state |
| Validação | Zod 4.3 (contratos em packages/types) | Compartilhado FE+BE, snapshot tests |
| Testes | Vitest 4.1, Playwright 1.59, MSW | Unit/integration/e2e + RLS isolation specs |

## 7. Qualidade e Padroes

**Padroes adotados** (fonte: `docs/project-context.md`, 47 regras + `CLAUDE.md`):
- **Multi-tenancy absoluto**: `tenant_id` em toda tabela; RLS obrigatória;
  nunca passar `tenant_id` como parâmetro (AsyncLocalStorage/RequestContext +
  `withTenantTx`); teste RLS em `apps/api/test/rls/` para toda migration que toque policy.
- **TypeScript** `strict: true` sem exceção; UUID v7 via `uuidv7()` (nunca `@default(uuid())`); datas ISO 8601; `null` explícito (sem `undefined` em JSON).
- **Idioma**: código/log/comentário em inglês; mensagens user-facing em PT-BR (`apps/web/messages/pt-BR.json`); vocabulário pastoral na UI.
- **Contratos de API**: sucesso `{ data, meta? }`; erro `{ statusCode, error, message, details? }` sem stack trace; 201/204/202; eventos de domínio padronizados.
- **Frontend**: Server Components por default com `fetch` nativo; TanStack Query só em Client Components; Zustand um store por concern.
- **Git/CI**: conventional commits em PT-BR; branch `feat/`; CI lint+test+build (Turborepo remote cache); 1 PR por story.

**Compliance**: LGPD (exportação ≤ 72h, exclusão ≤ 30 dias, consentimento
prévio, retenção diferenciada, auditoria imutável). WCAG AA obrigatório.

## 8. Visao de Futuro

**6 meses**: Releases 1b e 2 completas — Radar Pastoral ativado, reuniões ao
vivo com presença/engajamento, relatórios avançados, notificações, LGPD e
acessibilidade endurecidos.

**12 meses**: Evolução de "radar" para **Copiloto Pastoral com IA** — de mostrar
quem precisa de atenção para recomendar ações de cuidado (pgvector + embeddings);
WhatsApp via ChatMaster Veloz; API pública; hierarquia de tenants; observabilidade
completa (Grafana/Prometheus/Loki).

**Riscos conhecidos**:
- Scope creep (domínio composto edtech + realtime + multi-tenant + compliance).
- Perda de dados de presença se o flush Redis→PostgreSQL falhar (mitigação: WAL em Redis + retry + reconciliação assíncrona).
- Drift entre tracking BMad (sprint-status.yaml) e código real entregue via cenários WDS — exige reconciliação antes de implementar cada story.

---

## Itens a Definir

| Item | Dimensao | Impacto |
|------|----------|---------|
| Política de retenção/purga de dados pessoais inativos (período exato) | Compliance | Médio |
| Momento de separar instâncias Redis por concern | Stack | Baixo (escala) |

---

**Proximo passo recomendado**: `/constitution` para definir principios de governanca
