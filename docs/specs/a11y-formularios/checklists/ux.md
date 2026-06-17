# UX / A11y Checklist: a11y-formularios

**Purpose**: Validar a qualidade dos requisitos de acessibilidade (WCAG 2.1 AA) para
formulários — não a implementação, mas a completude, clareza e mensurabilidade dos
requisitos definidos na spec/plan.
**Created**: 2026-06-17
**Feature**: [docs/specs/a11y-formularios/spec.md](../spec.md)
**Domínio**: ux + a11y (WCAG 2.1 AA, ARIA patterns, testes mensuráveis)

---

## 1. Completude de Requisitos ARIA

- [x] CHK001 — São os requisitos de `aria-describedby` definidos para TODOS os campos
  com possibilidade de erro (link campo→mensagem)? [Completude, Spec §FR-03]
  **Evidência**: FR-03 define `aria-describedby` composto por `${id}-description` e
  `${id}-error`; data-model.md §IDs derivados detalha o mapeamento; auditoria lista gap
  em todos os 17 formulários. {auto}

- [x] CHK002 — São os requisitos de `aria-invalid` definidos com regra clara de quando
  omitir vs. quando setar? [Completude, Clareza, Spec §FR-04, Research §Decision 3]
  **Evidência**: FR-04: "omitido (não `false`) caso contrário"; research Decision 3 justifica
  a decisão contra `aria-invalid="false"` literal. {auto}

- [x] CHK003 — São os requisitos de `aria-required` cobertos em todos os formulários
  must-have e should-have? [Completude, Spec §FR-10, §SC4.1]
  **Evidência**: Auditoria pré-spec (tabela em §Estado atual) confirma ausência em todos os
  forms; FR-10 exige retrofit no registro; SC4.1 lista todos os campos de registro. {auto}

- [x] CHK004 — São os requisitos de `aria-busy` definidos para botões de submit durante
  submissão assíncrona? [Completude, Spec §FR-08, §FR-15]
  **Evidência**: FR-08 especifica `SubmitButton` com `aria-busy`+`disabled`+spinner`aria-hidden`;
  FR-15 estende para todos os steps do wizard. {auto}

- [x] CHK005 — É o requisito de anúncio de erro (`role="alert"`) coberto sem redundância
  com `aria-live`? [Completude, Clareza, Spec §FR-05, Research §Decision 4]
  **Evidência**: FR-05: "role='alert'. Não combinar com aria-live (redundante)"; research
  Decision 4 explica que `role="alert"` implica `aria-live="assertive" aria-atomic="true"`. {auto}

- [x] CHK006 — São os requisitos de `fieldset/legend` nativo definidos para grupos
  radio/checkbox (vs. role="radiogroup" ad-hoc)? [Completude, Spec §FR-06, §FR-13]
  **Evidência**: FR-06 define variante `fieldset` no FormField; FR-13 exige conversão do
  Step3Group; plan.md §Step3Group mostra before/after explícito. {auto}

- [ ] CHK007 — São os requisitos de `aria-label` em `<input type="file">` cobertos com
  critério mensurável (qual texto de label, por qual formulário)? [Completude, Clareza,
  Spec §SC4.4, §SC4.5]
  **Gap**: SC4.4 menciona "aria-label no input file de foto" e SC4.5 "aria-label no logo
  file" mas não especifica o texto concreto do label (ex.: "Foto de perfil" vs. "Selecione
  uma foto"). [Ambiguity — texto de aria-label não quantificado] {auto}

- [x] CHK008 — É o requisito de `scrollToFirstError()` definido com comportamento específico
  (seletor, scroll + foco, no-op sem campo inválido)? [Completude, Clareza, Spec §FR-07,
  §SC2.1, §SC2.2, Research §Decision 5]
  **Evidência**: SC2.1 especifica seletor `[aria-invalid="true"]`, `scrollIntoView({ behavior:
  'smooth', block: 'center' })` e `focus()`; SC2.2 define no-op. plan.md §scrollToFirstError()
  inclui pseudocódigo. {auto}

- [x] CHK009 — São os requisitos de agrupamento semântico de campos relacionados
  (cidade+estado, Step2) cobertos? [Completude, Spec §FR-12, §SC4.5]
  **Evidência**: SC4.5: "campos cidade+estado agrupados semanticamente (fieldset/legend ou
  aria-labelledby equivalente)"; FR-12 confirma. {auto}

- [ ] CHK010 — São os requisitos de acessibilidade para `terms-checkbox.tsx`,
  `password-input-with-toggle.tsx` e `day-of-week-select.tsx` definidos com critérios
  mensuráveis (e não apenas "auditar e corrigir")? [Completude, Clareza, Spec §SC5.5]
  **Gap**: SC5.5 lista ação "auditar e corrigir labels, aria-required, aria-invalid" mas não
  define o estado de destino esperado para cada componente auxiliar. O critério de aceite
  "auditado e corrigido" não é mensurável sem o estado alvo. [Gap — critério de destino
  ausente para 3 componentes auxiliares] {auto}

---

## 2. Clareza de Requisitos

- [x] CHK011 — O requisito de composição de `aria-describedby` (description antes, erro
  depois) é não-ambíguo? [Clareza, Spec §FR-03, data-model.md §aria-describedby composto]
  **Evidência**: data-model.md especifica `[description-id, error-id].filter(Boolean).join(' ')`
  com nota "leitores de tela anunciam na ordem do valor do atributo". Inequívoco. {auto}

- [x] CHK012 — O requisito de "opcional" no label (SC1.4) é definido como texto visível
  (não `aria-hidden`)? [Clareza, Spec §SC1.4]
  **Evidência**: SC1.4: "adiciona '(opcional)' ao label (visível, sem `aria-hidden`)". {auto}

- [x] CHK013 — O requisito de `required` visual (asterisco) com `aria-hidden="true"`
  está diferenciado do `required` semântico (`aria-required`)? [Clareza, Spec §SC1.3]
  **Evidência**: SC1.3: "indicador visual `*` com `aria-hidden='true'` no label"; plano §Design
  Técnico mostra `<span aria-hidden="true"> *</span>`. Separação explícita. {auto}

- [x] CHK014 — O requisito de chaves i18n para erros está livre de duplicação com chaves
  existentes? [Clareza, Consistência, Spec §FR-09, §SC3.2]
  **Evidência**: SC3.2: "Chaves de erros de campo já existentes (`register.*`, `group.field.
  name.error.*`, etc.) NÃO são duplicadas — apenas referenciadas ou estendidas." {auto}

- [ ] CHK015 — Está claro quais chaves i18n do namespace `form.*` são novas vs. extensões
  de chaves existentes, com lista explícita? [Clareza, Spec §SC3.1]
  **Gap**: SC3.1 lista categorias de chaves (campo obrigatório genérico, e-mail inválido,
  senha, grupo, convite, arquivo, submissão) mas não fornece a lista concreta das chaves com
  seus valores. Sem a lista, o developer pode criar variações inconsistentes.
  [Ambiguity — lista de chaves i18n não enumerada explicitamente] {auto}

- [ ] CHK016 — O requisito de `SubmitButton` é consistente com a prop name usada no design
  técnico vs. spec? [Clareza, Consistência, Spec §SC2.3, plan.md §SubmitButton, data-model.md]
  **Conflito**: spec SC2.3 usa `labelPending`; plan.md e data-model.md usam `pendingLabel`.
  [Conflict — discrepância de nome de prop `labelPending` (spec) vs. `pendingLabel`
  (plan/data-model)] {auto}

- [x] CHK017 — O requisito de `FormField` com `children` tipado está claro quanto ao
  mecanismo de injeção ARIA (cloneElement vs. context)? [Clareza, Spec §SC1.5,
  plan.md §Injeção de props ARIA]
  **Evidência**: plan.md §Injeção de props ARIA especifica `React.cloneElement` com pseudo-código;
  data-model.md confirma. Sem ambiguidade. {auto}

---

## 3. Consistência de Requisitos

- [x] CHK018 — Os formulários listados na tabela de auditoria (spec §Estado atual) e no
  plano §Fases de implementação são consistentes (mesmo conjunto, mesma fase)? [Consistência,
  Spec §Escopo final, plan.md §Fases]
  **Evidência**: spec §Escopo final lista 7 must-have + 10 should-have; plan §Fase 1 lista 7,
  §Fase 2 lista 10. Contagem e paths consistentes. {auto}

- [x] CHK019 — O tratamento de `aria-busy` é consistente entre `SubmitButton` (FR-08) e os
  botões de avanço dos steps do wizard (FR-15)? [Consistência, Spec §FR-08, §FR-15]
  **Evidência**: FR-08 define o comportamento via `SubmitButton`; FR-15 especifica "aria-busy
  durante submissão assíncrona" nos steps — implica uso do mesmo `SubmitButton`. {auto}

- [x] CHK020 — A decisão de "sem `aria-live` redundante" é aplicada consistentemente em toda
  a spec (não há FR contradizendo FR-05)? [Consistência, Spec §FR-05, §Restrições]
  **Evidência**: §Dependências e restrições: "`role='alert'` implica `aria-live='assertive'
  aria-atomic='true'` — NÃO adicionar `aria-live` no mesmo elemento". FR-05 alinhado. {auto}

---

## 4. Qualidade dos Critérios de Aceite

- [x] CHK021 — Cada critério de sucesso (SC-A a SC-H) tem forma de verificação mensurável
  (CI, comando, ferramenta)? [Mensurabilidade, Spec §Success Criteria]
  **Evidência**: tabela SC-A a SC-H inclui coluna "Forma de verificação" com ferramentas
  específicas: CI jest-axe, CI Playwright, CI tsc, CI Vitest. {auto}

- [x] CHK022 — O critério SC-B ("todos os formulários auditados passam toHaveNoViolations()")
  enumera os formulários de forma que o scope de "todos" seja inequívoco? [Mensurabilidade,
  Spec §SC-B, §US4, §US5]
  **Evidência**: SC-B referencia "US4 e US5" cujos critérios listam os forms individualmente
  (SC4.1-SC4.8, SC5.1-SC5.6). Rastreável. {auto}

- [x] CHK023 — O critério SC-G ("scrollToFirstError >= 3 casos") é específico o suficiente
  para o dev saber quais cenários cobrir? [Mensurabilidade, Spec §SC-G, §SC6.2]
  **Evidência**: SC6.2 enumera os 3 casos: (a) encontra campo, (b) chama scroll+focus,
  (c) no-op sem campo inválido. Mensurável. {auto}

- [ ] CHK024 — Há critério mensurável para validar que NENHUMA string hardcoded de erro
  permanece nos formulários após o retrofit (SC-F)? [Mensurabilidade, Spec §SC-F]
  **Gap**: SC-F diz "grep lint ou revisão" mas não especifica o padrão de grep (ex.: grep de
  strings PT-BR em JSX) nem integração com CI. "Revisão manual" como forma de verificação
  não é mensurável de forma reproduzível.
  [Ambiguity — forma de verificação de SC-F não automatizada/reproduzível] {auto}

---

## 5. Cobertura de Cenários WCAG

- [x] CHK025 — Os critérios de sucesso WCAG 1.3.1 (Info and Relationships) estão cobertos
  pelos requisitos de `fieldset/legend` e `htmlFor`? [Cobertura, Spec §FR-06, §FR-13]
  **Evidência**: FR-06 (fieldset/legend), FR-01/SC1.2 (htmlFor automático via FormField).
  WCAG 1.3.1 requer que relações label-controle sejam programaticamente determinadas. {auto}

- [x] CHK026 — Os critérios de sucesso WCAG 3.3.1 (Error Identification) estão cobertos
  pelos requisitos de `aria-invalid` + `role="alert"` + mensagem de erro por campo? [Cobertura,
  Spec §FR-04, §FR-05]
  **Evidência**: FR-04 (aria-invalid), FR-05 (role="alert" inline), SC1.5 (mensagem com id
  por campo). WCAG 3.3.1 requer identificação e descrição em texto. {auto}

- [x] CHK027 — Os critérios de sucesso WCAG 3.3.2 (Labels or Instructions) estão cobertos
  por `FormField` (label + description)? [Cobertura, Spec §SC1.1, §SC1.2, §FR-01]
  **Evidência**: SC1.1 lista prop `description?` para hint/instrução; SC1.2 gera
  `aria-describedby` para o hint; FR-01 inclui "descrição/instrução" no FormField. {auto}

- [x] CHK028 — Os critérios de sucesso WCAG 3.3.3 (Error Suggestion) estão cobertos pelas
  chaves i18n específicas (senha, e-mail, nome de grupo)? [Cobertura, Spec §FR-09, §SC3.1]
  **Evidência**: SC3.1 lista chaves de erro com sugestão de correção implícita (ex.: "senha
  mínimo", "e-mail inválido", "nome duplicado"). WCAG 3.3.3 requer sugestão quando possível. {auto}

- [x] CHK029 — Os critérios de sucesso WCAG 4.1.3 (Status Messages) estão cobertos pelo
  `role="alert"` nas mensagens de erro? [Cobertura, Spec §FR-05, Research §Decision 4]
  **Evidência**: research Decision 4: "WCAG 4.1.3 (Status Messages) é atendido por
  `role='alert'`". {auto}

- [ ] CHK030 — Há cobertura de requisito para o estado intermediário de `scrollToFirstError()`
  quando múltiplos campos têm `aria-invalid="true"` simultaneamente (ordem de foco)? [Cobertura,
  Edge Case, Spec §SC2.1]
  **Gap**: SC2.1 especifica "busca o primeiro elemento" via `document.querySelector` — que
  retorna o PRIMEIRO no DOM (ordem de renderização, não visual). Não há requisito explicitando
  o que "primeiro" significa quando o primeiro no DOM não é o primeiro visualmente (campos
  reordenados por CSS ou fora do viewport).
  [Gap — ordem de foco com múltiplos inválidos: DOM order vs. visual order não especificada] {auto}

---

## 6. Cobertura de Edge Cases

- [x] CHK031 — O edge case de `FormField` sem `error` (campo sem estado de erro) está coberto
  nos critérios de aceite? [Edge Case, Spec §SC1.6]
  **Evidência**: SC1.6: "Quando `error` é `undefined` ou vazio: `aria-invalid` é removido
  (não `false` literal — omitido)". {auto}

- [x] CHK032 — O edge case de `FormField` com `error` tornando-se `undefined` após correção
  (recovery state) está coberto? [Edge Case, Spec §SC1.6, §SC-A]
  **Evidência**: SC1.6 cobre o estado recovered; SC-A inclui "recovered" nos cenários jest-axe
  ("valid/error/recovered"). {auto}

- [x] CHK033 — O edge case de submissão sem campos inválidos (scrollToFirstError no-op) está
  coberto? [Edge Case, Spec §SC2.2]
  **Evidência**: SC2.2: "Se nenhum elemento com `aria-invalid='true'` for encontrado, a função
  é no-op (sem exceção)". {auto}

- [ ] CHK034 — O edge case de `SubmitButton` com `isPending=true` enquanto o backend retorna
  erro (transição pending → error) está coberto? [Edge Case, Spec §SC2.3-§SC2.5]
  **Gap**: Os critérios cobrem o estado `pending` e o estado estático mas não descrevem o
  comportamento quando a submissão falha: `aria-busy` é removido? `disabled` é removido? Foco
  retorna ao botão? Sem isso, o botão pode travar em `aria-busy=true` após erro do backend.
  [Gap — transição pending→error no SubmitButton não especificada] {auto}

- [ ] CHK035 — O edge case de `login-form.tsx` sem react-hook-form (form nativo Next.js)
  com `scrollToFirstError()` está coberto (como `aria-invalid` é setado sem RHF)? [Edge Case,
  Spec §NC1, plan.md §login-form — form nativo]
  **Gap**: plan.md nota "não usa `useForm` de react-hook-form. O retrofit adiciona `aria-*`
  direto nos elementos HTML" mas não especifica como `aria-invalid` é gerenciado
  dinamicamente sem a camada RHF (estado local `useState`? referências via `useRef`?).
  [Gap — mecanismo de `aria-invalid` dinâmico em login-form (sem RHF) não especificado] {auto}

- [ ] CHK036 — O edge case de `day-of-week-select.tsx` com label provido pelo parent
  (via `htmlFor` no parent) está coberto com critério mensurável? [Edge Case, Spec §SC5.5]
  **Gap**: data-model §Mapeamento confirma "label via htmlFor no parent" mas não especifica
  o critério para validar que esse padrão de delegação funciona com jest-axe (jest-axe pode
  reportar violation se o controle filho não tiver label direta).
  [Gap — label-por-delegação do day-of-week-select não tem critério de teste definido] {auto}

---

## 7. Requisitos Não-Funcionais

- [x] CHK037 — Os requisitos de testes não-funcionais (jest-axe + Playwright) têm critérios
  de cobertura mensuráveis e não apenas "testar"? [Mensurabilidade, Spec §FR-20, §SC6.1-§SC6.4]
  **Evidência**: SC6.1 lista os 9 componentes para jest-axe; SC6.2 lista os 3 casos de
  scrollToFirstError; SC6.3 especifica submit vazio → aria-invalid → aria-busy; SC6.4
  especifica regressão. Mensurável. {auto}

- [x] CHK038 — O requisito de zero breaking change em TypeScript (strict) está coberto com
  critério mensurável? [Mensurabilidade, Spec §SC-E]
  **Evidência**: SC-E: "Nenhum erro TypeScript (tsc --noEmit) introduzido. CI: tsc". {auto}

- [x] CHK039 — Os requisitos de i18n (PT-BR, vocabulário pastoral) são não-funcionais
  verificáveis? [Mensurabilidade, Spec §SC-F, §SC3.4]
  **Evidência**: SC-F cobre ausência de hardcode; SC3.4 exige vocabulário pastoral. SC-F tem
  forma de verificação (grep), mesmo que não totalmente automatizada. {auto}

- [x] CHK040 — Os requisitos de não-regressão (testes existentes continuam passando) têm
  critério explícito? [Mensurabilidade, Spec §FR-21, §SC-H, §SC6.4]
  **Evidência**: FR-21; SC-H ("ReflectionFormField continua passando"); SC6.4 ("Testes
  existentes continuam passando após refactor"). {auto}

---

## Notes

- Items `{auto}` já vêm resolvidos pelo agente (`[x]` com citação, ou marcador `[Gap]`/`[Ambiguity]`/`[Conflict]`)
- Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto
- Marcar items concluídos com `[x]`
- Items numerados sequencialmente para referência

---

## Resolução

| Categoria | Total |
|-----------|-------|
| **`{auto}` resolvidos `[x]`** | 31 |
| **`{auto}` com gap/ambiguity/conflict (abertos)** | 9 |
| **`{humano}` aguardando decisão** | 0 |
| **Total** | 40 |

### Itens com gap aberto

| ID | Tipo | Problema |
|----|------|---------|
| CHK007 | [Ambiguity] | Texto concreto de `aria-label` para inputs file não especificado |
| CHK010 | [Gap] | Estado-destino ARIA dos 3 componentes auxiliares não definido (apenas "auditar") |
| CHK015 | [Ambiguity] | Lista concreta de chaves i18n `form.*` não enumerada |
| CHK016 | [Conflict] | Nome de prop `labelPending` (spec SC2.3) vs. `pendingLabel` (plan/data-model) |
| CHK024 | [Ambiguity] | SC-F: forma de verificação de hardcode não automatizada/reproduzível |
| CHK030 | [Gap] | Ordem de foco quando múltiplos campos inválidos: DOM order vs. visual order |
| CHK034 | [Gap] | Transição `pending → error` no SubmitButton não especificada |
| CHK035 | [Gap] | Mecanismo de `aria-invalid` dinâmico em `login-form.tsx` (sem RHF) |
| CHK036 | [Gap] | Label-por-delegação do `day-of-week-select.tsx` sem critério de teste definido |

---

## Próximos Passos

- **CHK016 (Conflict)**: resolver antes de `/create-tasks` — a prop se chama `labelPending`
  ou `pendingLabel`? Editar spec SC2.3 ou plan/data-model para alinhar.
- **CHK007, CHK010, CHK015, CHK024 (Ambiguity/Gap)**: baixo risco de bloqueio — developer
  pode resolver durante execute-task com decisão local registrada.
- **CHK030, CHK034, CHK035, CHK036 (Gap de edge case)**: acompanhar em execute-task;
  se o developer encontrar comportamento inesperado, reabrir como bloqueio.
- **CHK024 (Ambiguity SC-F)**: sugestão — substituir "grep lint ou revisão" por script
  grep com padrão para strings PT-BR hardcoded em JSX.
- `/create-tasks` — decompor plano em tarefas executáveis (as 9 gaps viram notas nas
  tasks de execute-task correspondentes).
