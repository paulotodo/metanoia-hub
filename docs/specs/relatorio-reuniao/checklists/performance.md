# PERFORMANCE Checklist: Relatório por Reunião (FR63)

**Purpose**: Valida a QUALIDADE dos requisitos não-funcionais de desempenho (latência, throughput, escalabilidade, TTL, polling). Não testa performance real.
**Created**: 2026-06-17
**Feature**: [spec.md](../spec.md) §SC-03/07 · §FR-06/07

## Targets de latência (quantificados)

- [x] CHK036 - O target de tempo de resposta do relatório está quantificado com limite e tamanho de carga? [Mensurabilidade, Spec §SC-03] {auto} — Resolvido: SC-03 "< 3 segundos ... reunião típica (até 50 participantes)".
- [x] CHK037 - O target de disponibilidade do link de export está quantificado com limite e carga? [Mensurabilidade, Spec §SC-07] {auto} — Resolvido: SC-07 "< 60 segundos ... reuniões com até 200 participantes".

## Assíncrono / fila

- [x] CHK038 - O requisito de processamento assíncrono via fila (não bloqueante) do export está expresso? [Completude, Spec §FR-06] {auto} — Resolvido: FR-06 "processada de forma assíncrona, através de uma fila de jobs".
- [x] CHK039 - O TTL do registro de job e da URL assinada está especificado e correlacionado (REPORTS_JOB_TTL_SECONDS, 1h)? [Clareza, Spec §FR-07; data-model.md §State transitions] {auto} — Resolvido: TTL = REPORTS_JOB_TTL_SECONDS(+300); URL 1h (dec-008).

## Escalabilidade / degradação

- [ ] CHK040 - O comportamento de polling sob carga (intervalo recomendado, máximo de tentativas, rate limiting) está especificado para evitar busy-poll? [Gap, Spec §FR-07] {auto} — [Gap]: FR-07 diz "consultar periodicamente" sem definir cadência mínima/máx tentativas nem rate limit. Sem isso, cliente pode martelar o endpoint. Vira tarefa de requisito (definir intervalo/backoff) no create-tasks.
- [ ] CHK041 - O comportamento do relatório acima do tamanho de carga típico (>50 no report, >200 no export) está definido (paginação, limite, degradação)? [Gap, Spec §SC-03, §SC-07] {auto} — [Gap]: targets cobrem só "até 50"/"até 200"; não há requisito para reuniões maiores (paginação ou limite explícito). Vira tarefa de requisito no create-tasks.
- [ ] CHK042 - O apetite do produto para o limite superior de participantes por reunião (e se acima disso é fora de escopo) reflete a realidade do negócio? [Risco, Spec §SC-03/07] {humano} — Decisão de produto: confirmar se reuniões > 200 participantes são realistas no MVP e qual o comportamento esperado.

## Notes

- 2 itens [Gap] (CHK040 cadência de polling, CHK041 carga acima do alvo) → create-tasks.
- 1 item {humano} (CHK042 limite de participantes) → dono do produto.
- Targets de latência e TTL já estão quantificados e mensuráveis.
