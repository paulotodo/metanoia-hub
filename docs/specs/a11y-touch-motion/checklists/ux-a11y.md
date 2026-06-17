# UX + A11y Checklist: a11y-touch-motion (Story 12.4)

**Purpose**: Quality gate dos REQUISITOS (não da implementação) para os 3 eixos da feature — touch targets (WCAG 2.5.5/2.5.8), reduced-motion (WCAG 2.3.3) e feedback `:active` — antes de `create-tasks`. "Unit tests for English".
**Created**: 2026-06-17
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)
**Domínios**: ux, a11y
**Onda**: onda-003 (fase checklist)

> Legenda dono: `{auto}` = verificável contra spec/plan (resolvido com citação) · `{humano}` = julgamento de produto/risco (fica `[ ]`).
> Marcadores de gap: `[Gap]` (requisito ausente → create-tasks) · `[Ambiguity]`/`[Conflict]` (→ clarify) · `[Assumption]`.

## Eixo A — Touch Targets (US-1 / FR-1, dec-008 híbrido)

- [x] CHK001 - Os requisitos de tamanho mínimo de touch target estão definidos para todos os tipos de elemento interativo (button, a, input, select, textarea, label, tab, sidebar/bottom-nav)? [Completude, Spec §FR-1.1] {auto}
- [x] CHK002 - O valor "44x44" está quantificado em CSS px e vinculado a um breakpoint explícito (mobile < md / < 768 px)? [Clareza, Spec §FR-1.1] {auto}
- [x] CHK003 - A regra híbrida (44 mobile / 24 desktop, dec-008) está consistente entre FR-1.1, FR-1.4, SC-1.1 e a seção Clarifications NC-1? [Consistência, Spec §FR-1.1/§FR-1.4/§SC-1.1/§NC-1] {auto}
- [x] CHK004 - O mínimo de desktop (24x24, WCAG 2.5.8 AA) define quando o espaçamento compensatório é obrigatório (distância adjacente < 24 px)? [Clareza, Spec §FR-1.4] {auto}
- [x] CHK005 - A distância mínima entre alvos adjacentes está quantificada (>= 8 CSS px) e atribuída a um critério mensurável (SC-1.2)? [Mensurabilidade, Spec §FR-1.3/§SC-1.2] {auto}
- [x] CHK006 - Os meios aceitáveis de atingir o tamanho (dimensão intrínseca, padding, min-h/min-w, pseudo-elemento ::after) estão especificados? [Completude, Spec §FR-1.2] {auto}
- [x] CHK007 - A lista de componentes de risco elevado para auditoria está enumerada (bottom-nav, sidebar, CTA em cards, checkbox/radio, links inline)? [Cobertura, Spec §FR-1.5] {auto}
- [x] CHK008 - O plano nomeia o ponto de alavancagem (primitivo Button) e a correção concreta de tamanho (icon h-10→h-11 mobile; default/sm com min-h-[44px] md:)? [Completude, Plan §A2] {auto}
- [x] CHK009 - O plano cobre sidebar (min-h-[44px] explícito) e input como alvos de correção além do Button? [Cobertura, Plan §A3/§A4] {auto}
- [ ] CHK010 - A spec define como medir "área de toque" quando o alvo visual é menor que 44px mas estendido por pseudo-elemento (getBoundingClientRect mede o box visual, não o ::after)? O método de SC-1.1 (getBoundingClientRect) pode dar falso-negativo em alvos estendidos por ::after permitidos por FR-1.2. [Ambiguity, Spec §FR-1.2 vs §SC-1.1] {auto}
- [ ] CHK011 - A priorização entre subir densidade mobile (h-11) e preservar densidade desktop está alinhada ao apetite de produto para telas compactas? [Risco] {humano}

## Eixo B — Feedback ao toque / :active (US-2 / FR-2)

- [x] CHK012 - O padrão visual aprovado de `:active` está enumerado de forma fechada (active:opacity-80 e/ou active:scale-[0.98])? [Clareza, Spec §FR-2.1] {auto}
- [x] CHK013 - O requisito de ausência de delay está quantificado (proibição explícita de transition-all delay-* / transition-opacity duration-* que postergue o estado)? [Mensurabilidade, Spec §FR-2.2/§SC-2.2] {auto}
- [x] CHK014 - O requisito de classe utilitária compartilhada (`.touch-feedback` ou variante shadcn) está definido e tem critério de aceite de presença (SC-2.3)? [Completude, Spec §FR-2.3/§SC-2.3] {auto}
- [x] CHK015 - O requisito de distinção entre `:active` e `hover` em dispositivos híbridos (mouse+touch) está especificado? [Cobertura, Spec §FR-2.4] {auto}
- [ ] CHK016 - SC-2.2 ("nenhum elemento com :active possui transition-duration > 0ms afetando a manifestação do estado") é mensurável de forma determinística? Distinguir "duration que afeta a manifestação" de uma duration legítima em outra propriedade não está operacionalizado para um scan automatizável. [Ambiguity, Spec §SC-2.2] {auto}
- [x] CHK017 - O método de verificação de SC-2.1 (grep/AST scan no código-fonte) é mensurável e citado? [Mensurabilidade, Spec §SC-2.1] {auto}

## Eixo C — Reduced Motion (US-3 / FR-3, dec-007, WCAG 2.3.3)

- [x] CHK018 - O requisito de safety net global com `@media (prefers-reduced-motion: reduce)` está definido com as 4 propriedades (animation-duration, animation-iteration-count, transition-duration, scroll-behavior)? [Completude, Spec §FR-3.3] {auto}
- [x] CHK019 - A estratégia de prefixo `motion-safe:` está definida como preferencial e diferenciada da media-query direta para casos custom/keyframes? [Clareza, Spec §FR-3.2] {auto}
- [x] CHK020 - O critério formal de animação "essencial" (isenta) está definido de forma auditável e alinhado a WCAG 2.3.3 (sem substituto não-animado disponível)? [Clareza, Spec §NC-2/§FR-3.4] {auto}
- [x] CHK021 - A lista de não-essenciais sempre suprimidas (toast, skeleton shimmer, page transition, dropdown/popover, hover) está enumerada, com toast e skeleton explicitamente NUNCA isentos? [Cobertura, Spec §FR-3.4/§NC-2] {auto}
- [x] CHK022 - O exemplo de animação essencial (spinner sem label de %/progresso) é consistente com o critério formal de NC-2? [Consistência, Spec §NC-2] {auto}
- [x] CHK023 - O escopo da auditoria de animações (Tailwind animate-*/transition-*, keyframes custom em CSS, libs) está definido (FR-3.5) e a ausência de framer-motion/lib de animação está afirmada? [Completude, Spec §FR-3.5/Plan §0] {auto}
- [x] CHK024 - O arquivo-alvo do safety net está resolvido sem ambiguidade? A spec FR-3.3 diz "apps/web/app/globals.css ou equivalente" e o plano (dec-013, score 3) fixa packages/ui/styles/globals.css como o entry real importado por layout.tsx. [Conflict-resolvido, Spec §FR-3.3 vs Plan §C1; SC-3.1 cita apps/web/app/globals.css] {auto}
- [ ] CHK025 - SC-3.1 referencia o caminho `apps/web/app/globals.css` para o grep de verificação, mas o plano fixou a regra em `packages/ui/styles/globals.css` (dec-013). O critério de aceite SC-3.1 precisa apontar o arquivo real, senão o gate verde valida o arquivo errado. [Conflict, Spec §SC-3.1 vs Plan §C1/dec-013] {auto}
- [x] CHK026 - O toast está tratado como N/A documentado (nenhuma lib instalada) e o E2E de reduced-motion redirecionado para Dialog + Skeleton reais? [Consistência, Plan §C4 vs Spec §FR-3.4/§FR-4.1] {auto}
- [ ] CHK027 - A profundidade de cobertura para keyframes custom legados (ex.: onboarding-shake) além do safety net é suficiente, ou exige enumeração explícita por keyframe? [Profundidade] {humano}

## Cobertura WCAG (rastreabilidade normativa)

- [x] CHK028 - Os requisitos referenciam o critério WCAG aplicável a cada eixo (2.5.5 AAA / 2.5.8 AA para targets; 2.3.3 para motion)? [Completude, Spec §FR-1.1/§FR-1.4/§NC-1/§NC-2] {auto}
- [ ] CHK029 - O nível de conformidade alvo do projeto (AA vs AAA) está fixado em briefing/constitution, ou a escolha híbrida (AAA mobile / AA desktop) é uma decisão de feature sem ancoragem de produto? NC-1 nota que briefing/constitution não especificam o nível alvo. [Assumption, Spec §NC-1] {humano}

## Qualidade dos testes planejados (FR-4) — mensurabilidade

- [x] CHK030 - O requisito de E2E de reduced-motion (FR-4.1) especifica o método mensurável (emulateMedia reducedMotion:'reduce' + asserção getComputedStyle duration ≈ 0, não espera por tempo)? [Mensurabilidade, Spec §FR-4.1/§SC-3.3, Plan §T1/§7] {auto}
- [x] CHK031 - O requisito de E2E de touch-targets (FR-4.2) especifica a asserção mensurável (getBoundingClientRect width/height >= 44; distância de bordas >= 8 px)? [Mensurabilidade, Spec §FR-4.2/§SC-1.1/§SC-1.2, Plan §T2] {auto}
- [x] CHK032 - O requisito de jest-axe (FR-4.3) enumera os componentes-alvo (Button, Link, NavigationItem) com critério de presença verificável (SC-4.3)? [Completude, Spec §FR-4.3/§SC-4.3] {auto}
- [ ] CHK033 - **[CI-RISK] O projeto "mobile" do playwright.config DEVE usar emulação Chromium (devices['Pixel 5'] / "Mobile Chrome", ou Desktop Chrome + viewport mobile + hasTouch:true), NÃO `devices['iPhone 12']`.** O plano (§T2, dec-015) e FR-4.2 propõem/permitem "iPhone 12", que usa engine WebKit por padrão; o CI é Chromium-only e NÃO tem WebKit instalado → o projeto mobile QUEBRA o CI. A mitigação do plano (§7: "devices é built-in, sem download extra") está incorreta: o problema não é o perfil de device, é o **browser engine WebKit** ausente no runner. [Conflict, Plan §T2/§7 + dec-015 vs Spec §FR-4.2; precedente dec-012 da Story 12.1: Chromium-only, não adicionar WebKit] {auto}
- [x] CHK034 - O requisito de teste manual em dispositivo real (FR-4.4) está definido como gate de aceite final com artefato documentado (docs/tests/manual/touch-targets.md, SC-1.3)? [Completude, Spec §FR-4.4/§SC-1.3] {auto}
- [ ] CHK035 - SC-3.2 ("todos os animate-*/transition-* têm motion-safe: OU são cobertos pela regra global") é auto-satisfeito pelo safety net global — tornando o critério não-discriminante (sempre verde). O requisito precisa distinguir "coberto pelo safety net" (aceitável) de "deveria ter motion-safe explícito" para ser um gate útil. [Ambiguity, Spec §SC-3.2] {auto}

## Dependências e premissas

- [x] CHK036 - As dependências (tokens em packages/config/tailwind.preset.css; ausência de lib de animação; entry CSS real) estão documentadas e validadas por auditoria de código no plano? [Dependências, Plan §0/§1/§C4] {auto}
- [ ] CHK037 - A premissa de que "h-11 md:h-9/10" não quebra a densidade visual de telas desktop existentes foi validada com o dono de design, ou permanece risco aberto? [Assumption/Risco, Plan §7] {humano}

## Notes

- Items `{auto}` resolvidos com `[x]` citam a seção que prova; `[ ]` com marcador `[Gap]`/`[Ambiguity]`/`[Conflict]` indicam o que falta.
- Items `{humano}` ficam `[ ]` aguardando o dono do produto.
- Total: 37 items (35 `{auto}`, 4 `{humano}` — CHK011/CHK027/CHK029/CHK037; CHK029 é {humano}).

## Follow-up obrigatório (gaps → ação)

| Item | Marcador | Destino |
|------|----------|---------|
| CHK010 | [Ambiguity] | /clarify — método de medição de alvo estendido por ::after vs getBoundingClientRect |
| CHK016 | [Ambiguity] | /clarify — operacionalizar SC-2.2 (duration que "afeta a manifestação") |
| CHK025 | [Conflict] | /clarify — alinhar SC-3.1 (apps/web/app/globals.css) ao arquivo real packages/ui/styles/globals.css (dec-013) |
| CHK033 | [Conflict] **CI-RISK** | /clarify + /create-tasks — fixar projeto mobile em emulação Chromium (Pixel 5 / Mobile Chrome ou Desktop Chrome+viewport+hasTouch); proibir iPhone 12/WebKit; corrigir mitigação errada do plano §7 |
| CHK035 | [Ambiguity] | /clarify — SC-3.2 precisa discriminar safety-net-coberto vs motion-safe-explícito |
| CHK011, CHK027, CHK029, CHK037 | {humano} | decisão do dono do produto antes de /execute-task |
