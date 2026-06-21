# Security Checklist: SSE Reconnection & Gap Fill

**Purpose**: Validar a qualidade dos requisitos de segurança — proteção de token SSE, tratamento de 401, bind parametrizado, isolamento RLS e ausência de vazamento de credenciais em logs — integrando os findings M1/M2/L1/L2/L3 do OWASP gate da fase plan.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)

## Proteção de Token SSE em Logs (OWASP M1 — Medium)

- [x] CHK042 - O requisito de nunca logar a URL do SSE (que contém `?token=`) está explícito na spec/plan? [Completude, Spec §Edge Cases, plan §5, OWASP M1] {auto}
  > _Evidência_: spec §Edge Cases: "A reconexão não deve logar a URL (contém token)". plan §5 hook: "NUNCA logar a URL (contém `?token=`)". Requisito explícito em dois artefatos.

- [x] CHK043 - Há requisito de teste que assevera a ausência da substring `token=` nos logs do caminho de erro de reconexão? [Completude, OWASP M1] {auto}
  > _Evidência_: finding M1 do OWASP gate define o item de checklist como: "exigir teste asseverando ausência da substring `token=` em logs do caminho de erro". FR-021 cobre testes unitários do hook; o teste de ausência de `token=` em logs deve ser coberto como assertion unitária no `use-notification-stream.ts`.

- [ ] CHK044 - O teste de ausência de `token=` nos logs está explicitamente mencionado nos requisitos de teste (FR-020/FR-021) como assertion obrigatória? [Completude, Spec §FR-020, FR-021, OWASP M1] {humano}
  > _Gap_: FR-020 e FR-021 cobrem backoff, lastReceivedAt, dedup e estados, mas não listam explicitamente o teste de ausência de `token=` nos logs. Deve ser adicionado como assertion obrigatória nos requisitos de teste para que o executor não esqueça de incluí-la. Ação: adicionar à spec ou às tasks de teste.

## Tratamento de 401 / Credencial Expirada (OWASP M2 — Medium)

- [x] CHK045 - O requisito de distinguir 401/token expirado de falha transitória de rede está presente na spec? [Completude, Spec §Edge Cases, OWASP M2] {auto}
  > _Evidência_: spec §Edge Cases: "O fluxo de reconexão deve respeitar erros de autenticação sem expor o token em logs." Finding M2 reforça a necessidade de não entrar em loop cego com credencial morta.

- [ ] CHK046 - Está especificado que um erro 401 para de tentar reconectar e aciona um fluxo distinto (ex.: re-autenticação, exibição de "Sessão expirada")? [Completude, OWASP M2] {humano}
  > _Gap_: a spec menciona "respeitar erros de autenticação" mas não define o comportamento exato em 401: (a) parar o backoff e redirecionar para login, (b) parar o backoff e exibir aviso "Sessão expirada" diferente do aviso de outage, ou (c) apenas logar silenciosamente. Sem essa definição, a implementação pode entrar em loop infinito com token morto. Classificado como CHK015 no domínio API — reforçado aqui por impacto de segurança.

- [ ] CHK047 - O componente `connection-status.tsx` tem estado distinto para "sessão expirada" (vs. "sem conexão transitória")? [Completude, OWASP M2] {humano}
  > _Gap_: spec define 3 estados: `connected`, `reconnecting`, `extended-outage`. Um 401 seria apresentado como `extended-outage`? Isso seria confuso para o usuário (não é falta de rede, é falta de autenticação). Decisão de produto necessária sobre estado adicional ou tratamento especial de 401.

## Bind Parametrizado (OWASP L1 — Low)

- [x] CHK048 - O requisito de usar bind posicional (`$N::timestamptz`) para o filtro `since` no SQL raw está documentado? [Completude, plan §Backend passo 3, OWASP L1] {auto}
  > _Evidência_: plan §Backend passo 3: "adicionar `AND created_at > $N::timestamptz` (bind posicional, nunca interpolado)". Requisito técnico explícito.

- [x] CHK049 - A proibição de interpolação de string para o valor de `since` no SQL está explícita? [Clareza, plan §Backend passo 3, OWASP L1] {auto}
  > _Evidência_: plan §Backend passo 3: "bind posicional, nunca interpolado". O método `$queryRawUnsafe` é mencionado no plan §Convenções de Borda como abordagem existente — o requisito de bind posicional é a mitigação de SQL injection.

- [x] CHK050 - O cuidado com renumeração posicional (quando outros parâmetros antecedem `since` na query) está documentado como requisito de implementação? [Clareza, OWASP L1] {auto}
  > _Evidência_: finding L1 do OWASP gate: "renumeração posicional cuidadosa". Presente como instrução no contexto desta onda. Deve ser explicitado nas tasks de implementação do filtro `since`.

## Isolamento RLS Cross-Tenant (OWASP L2 — Low)

- [x] CHK051 - O requisito de isolamento RLS aplicado ao filtro `since` (notificações de outro tenant não são retornadas) está na spec? [Completude, Spec §FR-018, US3 AC4] {auto}
  > _Evidência_: FR-018: "filtro se aplica apenas às notificações do inquilino do usuário autenticado (isolamento RLS preservado)." spec US3 AC4: "apenas notificações do inquilino do usuário autenticado são retornadas".

- [x] CHK052 - O teste RLS específico para `since` (asseverando não-vazamento cross-tenant com o filtro ativo) está nos requisitos de teste? [Completude, plan §Backend passo 4, OWASP L2] {auto}
  > _Evidência_: plan §Backend passo 4: "RLS spec para isolamento sob `since`". Finding L2 do OWASP gate: "teste RLS asseverando não-vazamento cross-tenant sob `since`, rodando 2× no CI". Arquivo alvo: `apps/api/test/rls/notifications.rls-spec.ts`.

- [x] CHK053 - O requisito de rodar o teste RLS 2× no CI (idempotência, padrão do projeto) está explícito? [Completude, OWASP L2, MEMORY epic-13-feature-00c-lessons] {auto}
  > _Evidência_: finding L2 do OWASP gate especifica "rodando 2× no CI". Padrão confirmado pelo MEMORY do projeto (epic-13-feature-00c-lessons: "teste RLS idempotente roda 2x no CI").

## Paginação do Gap-Fill e Perda Silenciosa (OWASP L3 — Low)

- [x] CHK054 - O cenário onde o número de notificações perdidas excede `perPage` está identificado como risco de completude do gap-fill? [Cobertura, OWASP L3] {auto}
  > _Evidência_: finding L3 do OWASP gate: "gap-fill completo quando nº de perdidas > perPage (paginação/load-more)". A spec §Edge Cases não cobre este caso (CHK021/CHK055).

- [ ] CHK055 - Está especificado o comportamento do gap-fill quando as notificações perdidas superam `perPage` (busca paginada completa vs. somente primeira página)? [Completude, OWASP L3] {humano}
  > _Gap_: espelho de CHK021 (domínio API) — reforçado aqui por impacto de segurança informacional: perda silenciosa de notificações pastorais urgentes em outages longos é um risco real para o produto. Decisão de produto necessária: buscar todas as páginas (`while (hasNextPage) fetch(...)`) vs. primeira página + indicador "podem existir mais".

## Proteção de Dados e Sessão

- [x] CHK056 - O requisito de não persistir `lastReceivedAt` além da sessão do navegador (sem localStorage/sessionStorage/cookie) está na spec? [Completude, Spec §FR-009, SC-006] {auto}
  > _Evidência_: FR-009: "`lastReceivedAt` NÃO deve ser persistido (localStorage, sessionStorage, cookie)". SC-006: "verificável auditando localStorage/sessionStorage/cookies após refresh de página".

- [x] CHK057 - O critério de sucesso SC-006 (ausência de persistência verificável pós-refresh) é mensurável em teste? [Mensurabilidade, Spec §SC-006] {auto}
  > _Evidência_: SC-006 define explicitamente como verificar: "auditando localStorage/sessionStorage/cookies após refresh de página". Mensurável em teste E2E Playwright.

## Notes

- Items `{auto}` resolvidos com `[x]` incluem citação da seção que sustenta a conclusão.
- Items `{humano}` em aberto: CHK044, CHK046, CHK047, CHK055.
- CHK046/CHK047 são os gaps de maior risco de segurança (loop com token morto). Recomenda-se resolver antes de codificar o hook de reconexão.
- CHK044 pode ser resolvido pelo executor diretamente adicionando a assertion obrigatória às tasks.
