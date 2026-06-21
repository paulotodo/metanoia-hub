# UX / i18n Checklist: Notificações por Email via Resend

**Purpose**: Valida qualidade dos requisitos de experiência do usuário nos emails (vocabulário pastoral, templates PT-BR, acessibilidade de email, fallback in-app), i18n/l10n, e consistência entre o canal email e o canal in-app já existente.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [research.md](../research.md)

---

## Vocabulário Pastoral e Idioma

- [x] CHK057 - Os requisitos de idioma dos templates de email definem explicitamente PT-BR para conteúdo user-facing e inglês para código/logs, alinhados com a Constitution (Princípio III)? [Completude, spec.md §FR-01, plan.md §Constitution Check III] {auto}
  > Evidência: plan.md §Constitution Check III: "corpo dos emails user-facing em PT-BR (vocabulário pastoral: cuidado, jornada, lembrete)."

- [ ] CHK058 - O vocabulário pastoral específico a usar em cada template é definido ou referenciado (ex: qual termo para "alerta de risco pastoral" no subject do email — "Atenção pastoral" vs "Sinal de cuidado"? "Reunião" vs "Encontro"?)? [Clareza, Gap] {humano}
  > Gap: spec.md menciona "vocabulário pastoral" (Constitution III) mas não define o glossário de termos para cada template. Sem glossário aprovado, diferentes implementadores podem usar vocabulário inconsistente. Definir antes de criar os templates.

- [x] CHK059 - Acentos e caracteres PT-BR são cobertos por requisito de teste explícito (SC-06): nomes com acentos, URLs longas, tenant sem logo configuram? [Completude, spec.md §SC-06] {auto}
  > Evidência: spec.md §SC-06: "Templates de email com branding do tenant são validados por snapshot tests: nomes com acentos, URLs longas e tenant sem logo configurado todos produzem output correto e sem truncamento."

- [x] CHK060 - O charset UTF-8 é garantido nos emails via header do Resend (não requer configuração manual pelo implementador)? [Clareza, research.md Decision 3] {auto}
  > Evidência: research.md Decision 3: "Acentos PT-BR exigem `charset=utf-8` no header do email (garantido pelo Resend)."

---

## Templates por Tipo — Completude de Conteúdo

- [ ] CHK061 - Cada template define seu conteúdo mínimo obrigatório (campos a incluir)? Especificamente:
  - `pastoral-alert`: nome do participante, motivo do risco, link para o Radar
  - `meeting-reminder`: data, horário e link de acesso à reunião
  - `export-ready`: link de download com validade de 1 hora (sem o arquivo em anexo)
  - `content-new`: título da trilha, breve descrição, link para começar
  [Completude, Spec §P1/P2/P3/P4 ACs] {humano}
  > Gap parcial: spec.md P1-P4 listam ACs que implicam o conteúdo de cada template, mas não existe um documento de especificação de conteúdo dos templates (ex: quais seções, qual CTA, qual subject exato). Para o implementador dos templates, os ACs da spec são necessários mas não suficientes — a linha entre "o email contém nome e motivo" e a estrutura HTML do template é um gap.

- [x] CHK062 - O requisito de que emails de `export_ready` NUNCA contenham o arquivo em anexo — apenas o link assinado — está explícito no spec? [Completude, spec.md §P3] {auto}
  > Evidência: spec.md §P3 AC: "Email nunca contém o arquivo em anexo — apenas o link assinado."

- [x] CHK063 - O template `export_ready` define a validade do link (1 hora) e o comportamento pós-expiração (notificação in-app permanece com opção de regenerar)? [Completude, spec.md §P3] {auto}
  > Evidência: spec.md §P3 ACs: "Email contém link de download seguro com validade de 1 hora" e "Após expiração do link, a notificação in-app permanece disponível com opção de regenerar."

---

## Branding e Identidade Visual

- [x] CHK064 - O requisito de branding do tenant cobre TODOS os 4 templates (não apenas `pastoral-alert`)? O fallback sem branding (logo default + cores default) está definido para cada template? [Cobertura, spec.md §FR-02, research.md Decision 3] {auto}
  > Evidência: spec.md §FR-02: "Cada template deve incluir branding do tenant quando configurado"; research.md Decision 3: "fallback sem logo: `getBranding()` retorna `logoUrl: null` → usa identidade visual padrão."

- [ ] CHK065 - A identidade visual padrão da plataforma (logo default, cores default) está definida como ativo de design estável (não depende de valor hardcoded no template)? [Clareza, Gap] {humano}
  > Gap: research.md Decision 3 menciona "logo default + cores default" mas não referencia onde esses ativos vivem (URL do logo padrão? constantes de cor?). Para `base.layout.ts`, o implementador precisa saber o valor concreto do fallback.

- [x] CHK066 - O cache de branding (TTL 1h via `BrandingService`) cobre o caso de tenant que altera o logo durante o dia: emails novos usarão o logo atualizado em até 1h? [Clareza, research.md Decision 3] {auto}
  > Evidência: research.md Decision 3: "Reuso de `BrandingService.getBranding()` com cache Redis TTL 1h" — comportamento de staleness de 1h é consequência conhecida documentada.

---

## Consistência Email ↔ In-app

- [x] CHK067 - O conteúdo do fallback in-app (criado quando o email falha ou é diferido) é equivalente ao que o email transmitiria? O requisito especifica que a informação deve chegar por pelo menos um canal? [Completude, spec.md §FR-06/SC-02] {auto}
  > Evidência: spec.md §FR-06: "criar automaticamente uma notificação in-app equivalente como fallback, garantindo que a informação chegue ao destinatário por pelo menos um canal"; SC-02: "participante NUNCA perde o lembrete."

- [ ] CHK068 - São definidos os campos do fallback in-app que devem ser equivalentes aos do email: `title`, `body` (resumo), `actionUrl` iguais? Ou o fallback in-app tem seu próprio texto curto adaptado para o canal? [Ambiguity] {humano}
  > Ambiguidade: spec.md §FR-06 diz "notificação in-app equivalente" mas não especifica se o conteúdo é idêntico (mesmo título/body do email) ou adaptado (texto mais curto adequado ao in-app). Diferentes semânticas de "equivalente" levariam a implementações distintas.

- [x] CHK069 - Para `meeting_reminder` diferido pelo rate limiter, o fallback in-app é criado NO MESMO INSTANTE (não após falha de envio), garantindo SC-02? [Completude, spec.md §SC-02/FR-10] {auto}
  > Evidência: spec.md §FR-10: "Emails de tipo `meeting_reminder` são diferidos mas geram fallback in-app imediato"; spec.md §P2 AC: "fallback in-app imediato é criado automaticamente."

---

## Acessibilidade de Email

- [ ] CHK070 - Os templates de email têm requisitos de acessibilidade mínimos: atributo `alt` em imagens (logo do tenant), contraste mínimo de texto, estrutura semântica HTML? [Cobertura, Gap] {humano}
  > Gap: spec.md e plan.md não mencionam acessibilidade para os templates de email. Embora o gate a11y do CI (Epic 12) cubra a UI web, ele não cobre templates de email HTML renderizados. Para o `base.layout.ts`, definir `alt` obrigatório no `<img>` do logo é o mínimo.

- [ ] CHK071 - O subject do email para cada tipo de notificação segue convenção definida (ex: `[Metanoia] Alerta: <nome-grupo>`, `[Metanoia] Lembrete: <data-reunião>`)? [Clareza, Gap] {humano}
  > Gap: spec.md P1 AC menciona "subject identifica o grupo e indica urgência" para `pastoral-alert`, mas não define convenção de formato do subject para os demais templates (`meeting_reminder`, `export_ready`, `content_new`).

---

## Notificação de Limite ao Admin (P5)

- [x] CHK072 - A notificação in-app de alerta de limite (P5) tem conteúdo definido: "quantos emails foram enviados e o limite total"? [Completude, spec.md §P5] {auto}
  > Evidência: spec.md §P5 AC: "Mensagem informa quantos emails foram enviados e o limite total."

- [ ] CHK073 - O vocabulário da notificação in-app de limite usa termos que o admin reconhece como acionáveis? (Ex: "80 de 100 emails diários enviados. Considere fazer upgrade do plano.") [Clareza, Gap] {humano}
  > Gap: spec.md define o conteúdo informacional mas não o texto exato ou o CTA da notificação de limite. Sem texto definido, o implementador escolherá — risco de usar jargão técnico ao invés de vocabulário pastoral/negócio.

---

## Notes

- CHK058, CHK061, CHK065, CHK071 `[Gap]` → tarefas de `/create-tasks`: "definir glossário pastoral para templates", "especificar conteúdo mínimo de cada template", "documentar ativo de identidade visual padrão", "definir convenção de subject por tipo de email".
- CHK068 `[Ambiguity]` → resolver na spec: "equivalente" significa mesmos campos ou texto adaptado para in-app?
- CHK070 `[Gap]` → tarefa: "definir requisitos de acessibilidade para templates de email (alt em imagens, contraste)".
- CHK073 `{humano}` → produto define o texto exato e CTA da notificação de limite ao admin.
