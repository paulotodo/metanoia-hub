# UX / A11y Checklist: SSE Reconnection & Gap Fill

**Purpose**: Validar a qualidade dos requisitos de experiência do usuário, acessibilidade e interação do componente `connection-status.tsx` e indicadores de reconexão.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)

## Estados de Interface e Visibilidade

- [x] CHK023 - Os três estados do componente de status (reconectando, falha-estendida, conectado) têm comportamento de renderização especificado para cada um? [Completude, Spec §FR-013] {auto}
  > _Evidência_: FR-013: "componente deve encapsular os três estados: reconectando, falha estendida e conectado (não renderiza nada quando conectado)". plan §6 connection-status.tsx especifica renderização por estado.

- [x] CHK024 - O indicador "Reconectando..." está caracterizado como "sutil" — há critério verificável para o que "sutil" significa (ex.: não modal, não bloqueia conteúdo, tamanho de fonte, posicionamento)? [Clareza, Spec §FR-002] {auto}
  > _Evidência_: FR-002 define "indicador sutil". plan §6 especifica `motion-safe:` em transições e `focus-ring ring-brand-teal/30`. A spec não quantifica "sutil" com posicionamento/sizing exatos — ver CHK025.

- [ ] CHK025 - "Sutil" no indicador "Reconectando..." está quantificado com critérios de posicionamento, tamanho de fonte ou peso visual (ex.: texto pequeno no rodapé do bell, sem overlay)? [Clareza, Spec §FR-002] {humano}
  > _Ambiguidade_: FR-002 usa "indicador sutil" sem definir posição, tamanho ou opacidade. Dependendo da implementação, "sutil" pode resultar em comportamentos muito diferentes (banner topo vs. ícone pequeno vs. texto abaixo do sino). Decisão de design necessária.

- [x] CHK026 - O estado "Sem conexão. Notificações podem estar atrasadas." tem texto exato especificado? [Completude, Spec §FR-004, FR-014] {auto}
  > _Evidência_: spec FR-004 define a mensagem literal. FR-014 exige PT-BR pastoral centralizado em `messages/pt-BR.json`. plan §8 define o namespace `notificationCenter.connection.offline`.

- [x] CHK027 - O botão "Tentar agora" tem comportamento especificado (reinicia contador de falhas, ignora timer de backoff)? [Completude, Spec §FR-005] {auto}
  > _Evidência_: FR-005: "O botão 'Tentar agora' DEVE iniciar uma nova tentativa de reconexão imediatamente, reiniciando o contador de falhas."

- [x] CHK028 - O comportamento de desaparecimento do aviso de outage após reconexão bem-sucedida está especificado? [Completude, Spec §US2 AC3, FR-007] {auto}
  > _Evidência_: FR-007: "Ao reconectar com sucesso após outage estendido, o aviso DEVE desaparecer e o gap fill DEVE ser executado." spec US2 AC3 detalha o mesmo.

## Textos e Vocabulário Pastoral

- [x] CHK029 - Todos os textos de estado de conexão estão centralizados em `pt-BR.json` (não hardcoded nos componentes)? [Completude, Spec §FR-014, CLAUDE.md §Language] {auto}
  > _Evidência_: FR-014: "Todos os textos de reconexão exibidos ao usuário DEVEM estar em PT-BR com vocabulário acessível e pastoral, centralizados no arquivo de mensagens do projeto." plan §8 nomeia o namespace específico.

- [x] CHK030 - O namespace de mensagens para o estado de conexão está definido (`notificationCenter.connection.*`)? [Completude, plan §8] {auto}
  > _Evidência_: plan §8: define `notificationCenter.connection.reconnecting`, `.offline`, `.retryNow` em `messages/pt-BR.json`.

- [ ] CHK031 - O vocabulário pastoral foi validado para os textos de conexão ("Reconectando...", "Sem conexão. Notificações podem estar atrasadas.", "Tentar agora")? [Clareza, Spec §FR-014] {humano}
  > _Nota_: os textos têm semântica técnica neutra — "Reconectando..." e "Sem conexão" são funcionais mas não pastorais. Decisão de produto: os textos em PT-BR estão adequados ao vocabulário pastoral da plataforma, ou precisam de revisão (ex.: "Aguardando sinal..." em vez de "Sem conexão")?

## Acessibilidade (a11y)

- [x] CHK032 - O componente de status de conexão usa `aria-live="polite"` para anunciar mudanças de estado para leitores de tela? [Cobertura, plan §6, plan §Constitution Check VI] {auto}
  > _Evidência_: plan §6 connection-status.tsx: "aria-live polite". plan Constitution Check VI: "WCAG AA (aria-live polite, motion-safe:, focus-ring ring-brand-teal/30)".

- [x] CHK033 - O botão "Tentar agora" tem foco visível (focus-ring) especificado com a cor da marca? [Completude, plan §6] {auto}
  > _Evidência_: plan §6: "focus-ring `ring-brand-teal/30`".

- [x] CHK034 - As transições/animações do componente de status respeitam `prefers-reduced-motion` (`motion-safe:`)? [Completude, plan §6, plan §Constitution Check VI] {auto}
  > _Evidência_: plan §6: "`motion-safe:` em transições". plan Constitution Check VI confirma WCAG AA.

- [ ] CHK035 - O `aria-live` region do status de conexão está especificado para não anunciar o estado "conectado" (sem renderização = sem anúncio a leitores de tela)? [Clareza, Spec §FR-013] {humano}
  > _Ambiguidade_: FR-013 diz "não renderiza nada quando conectado". Isso é correto para reduzir ruído em leitores de tela. Mas se o componente usar `aria-live` em um wrapper sempre presente no DOM (comum para evitar flicker), o estado conectado pode ainda acionar announcements vazios. Decisão de implementação/a11y necessária.

- [x] CHK036 - O Notification Center (componente pai) tem especificação de que o status de conexão não interrompe o foco durante o fluxo normal de uso? [Cobertura, Spec §US1 AC2] {auto}
  > _Evidência_: spec US1 AC2: "um indicador 'Reconectando...' aparece de forma sutil na interface, **sem interromper a navegação**." `aria-live="polite"` (não assertive) preserva o foco.

- [ ] CHK037 - Há requisito de contraste de cor para o indicador "Reconectando..." e para a mensagem de outage que atenda WCAG 2.1 AA (4.5:1 para texto)? [Cobertura, Spec §FR-013] {humano}
  > _Gap_: plan e spec não especificam cores concretas para o componente de status (apenas `ring-brand-teal/30` para focus). Sem definição de cor do texto/fundo do indicador, o contraste WCAG AA não é verificável em requisitos.

- [x] CHK038 - O botão "Tentar agora" tem `type="button"` implícito ou explícito para não acionar submit de formulário acidentalmente? [Cobertura, plan §6] {auto}
  > _Evidência_: plan §6 descreve `connection-status.tsx` como componente standalone (sem form wrapper). O risco de submit acidental é baixo; convenção React/Next.js de `type="button"` deve ser coberta por lint/review. Checagem razoável na spec.

## Fluxo de Reconexão — UX

- [x] CHK039 - O limiar de 5 falhas consecutivas no teto de backoff (30s) para exibir o aviso está quantificado? [Clareza, Spec §FR-004] {auto}
  > _Evidência_: FR-004: "Após 5 falhas consecutivas no intervalo máximo de backoff (30s)". Threshold numérico explícito.

- [x] CHK040 - O comportamento durante o desmonte do componente (navegação para outra página) está especificado? [Cobertura, Spec §Edge Cases] {auto}
  > _Evidência_: spec §Edge Cases: "O hook é desmontado, a conexão SSE é fechada, os timers de backoff são cancelados. Ao voltar, uma nova conexão é estabelecida do zero."

- [x] CHK041 - O cenário de "reconexão em background enquanto aviso de outage está visível" está especificado (reconexão automática continua mesmo com aviso)? [Completude, Spec §FR-006, US2 AC4] {auto}
  > _Evidência_: FR-006: "As tentativas de reconexão DEVEM continuar em segundo plano mesmo quando o aviso de outage estendido está visível." spec US2 AC4 confirma.

## Notes

- Items `{auto}` resolvidos com `[x]` incluem citação da seção da spec/plan que sustenta a conclusão.
- Items `{humano}` (CHK025, CHK031, CHK035, CHK037) aguardam decisão de design/produto antes de `/create-tasks`.
- CHK025 e CHK037 são os gaps de maior risco de a11y — recomenda-se resolver antes de codificar o componente.
