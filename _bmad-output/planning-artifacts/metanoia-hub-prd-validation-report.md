---
validationTarget: 'auxiliar/metanoia-hub-prd.md'
validationDate: '2026-04-04'
inputDocuments: []
validationStepsCompleted:
  - step-v-01-discovery
  - step-v-02-format-detection
  - step-v-03-density-validation
  - step-v-04-brief-coverage-validation
  - step-v-05-measurability-validation
  - step-v-06-traceability-validation
  - step-v-07-implementation-leakage-validation
  - step-v-08-domain-compliance-validation
  - step-v-09-project-type-validation
  - step-v-10-smart-validation
  - step-v-11-holistic-quality-validation
  - step-v-12-completeness-validation
validationStatus: COMPLETE
holisticQualityRating: '2/5 - Needs Work'
overallStatus: Warning
---

# Relatório de Validação PRD — Metanoia Hub

---

## Format Detection

**Estrutura do PRD (Headers ## Level 2):**

1. `## 1. Resumo executivo`
2. `## 2. Problema que o produto resolve`
3. `## 3. Visão do produto`
4. `## 4. Objetivos do MVP`
5. `## 5. Público-alvo`
6. `## 6. Escopo funcional do MVP`
7. `## 7. Pergunta respondida: por que validar se a trilha é por tenant inteiro ou por grupo/turma?`
8. `## 8. Fora do escopo do MVP`
9. `## 9. Requisitos não funcionais`
10. `## 10. Arquitetura recomendada`
11. `## 11. Stack recomendada`
12. `## 12. Serviços sugeridos`
13. `## 13. Eventos de domínio sugeridos (EDA)`
14. `## 14. Regras principais de negócio`
15. `## 15. Modelo inicial de dados (alto nível)`
16. `## 16. Privacidade, segurança e LGPD`
17. `## 17. Relatórios do MVP`
18. `## 18. Roadmap sugerido`
19. `## 19. Riscos e mitigação`
20. `## 20. Decisões já tomadas neste PRD`
21. `## 21. Itens em aberto para próxima iteração do PRD`
22. `## 22. Recomendação final de produto para início do projeto`
23. `## 23. Próximo artefato recomendado`

**Seções Core BMAD Presentes:**

- Executive Summary: **Presente** (como "Resumo executivo", seção 1)
- Success Criteria: **Ausente** (seção 4 tem "Objetivos" mas sem critérios mensuráveis de sucesso)
- Product Scope: **Presente** (seções 6 "Escopo funcional" + 8 "Fora do escopo")
- User Journeys: **Ausente** (seção 5 lista perfis de usuário mas não documenta jornadas/fluxos)
- Functional Requirements: **Parcial** (seção 6 descreve funcionalidades narrativamente, sem formato FR)
- Non-Functional Requirements: **Presente** (seção 9)

**Classificação de Formato:** BMAD Variant
**Seções Core Presentes:** 3/6 (+ 1 parcial)

---

## Information Density Validation

**Violações de Anti-Pattern:**

**Conversational Filler:** 18 ocorrências

Padrão "O sistema/produto/MVP deve..." repetido extensivamente:
- Linha 111: "O sistema deve permitir"
- Linha 125: "O produto deve suportar"
- Linha 133: "O admin/líder deve conseguir"
- Linha 185: "O sistema deve registrar como indicadores"
- Linha 199: "O sistema deve permitir"
- Linha 217: "O administrador deve conseguir"
- Linha 259: "O MVP deve incluir"
- Linha 269: "O MVP deve incluir gamificação individual com"
- Linha 278: "O sistema deve oferecer dashboards"
- Linha 289: "O MVP deve suportar"
- Linha 299: "O sistema poderá permitir"
- Linha 355: "A solução deve nascer preparada para"
- Linha 397: "O MVP deve contemplar"
- Linhas adicionais com padrão semelhante (~5 mais)

**Wordy Phrases:** 2 ocorrências
- Linha 6: "Rascunho inicial validado com insumos do solicitante" → poderia ser mais direto
- Linha 163: "em vez de depender da experiência principal do" → construção verbosa

**Redundant Phrases:** 1 ocorrência
- Linha 38: "acompanhe objetivamente quem participou, quanto permaneceu na reunião, quanto tempo ficou fora da aba, como avançou na trilha e qual é o nível de engajamento do discipulado" → frase muito longa que repete conceitos já detalhados nas seções seguintes

**Total Violations:** 21

**Severity Assessment:** Critical (>10 violações)

**Recomendação:** O PRD requer revisão significativa na densidade de informação. O padrão "O sistema/MVP deve..." deve ser substituído por declarações diretas. Exemplo: "O sistema deve permitir cadastro com e-mail e senha" → "Cadastro via e-mail/senha e Google OAuth".

---

## Product Brief Coverage

**Status:** N/A - Nenhum Product Brief foi fornecido como input

---

## Measurability Validation

### Functional Requirements

**Total FRs Analisados:** 0 formais (seção 6 contém ~45 itens funcionais descritos narrativamente)

**Format Violations:** Crítico
- Nenhum requisito segue o formato "[Ator] pode [capacidade]"
- Não há numeração FR (FR-001, FR-002, etc.)
- Requisitos misturados com descrições de features
- Sem critérios de aceitação por requisito

**Subjective Adjectives Found:** 4 ocorrências
- Linha 163: "experiência própria de produto" (subjetivo)
- Linha 483: "melhor combinação" (subjetivo, sem critério)
- Linha 497: "menor esforço inicial" (vago)
- Linha 502: "maior controle fino" (subjetivo)

**Vague Quantifiers Found:** 6 ocorrências
- Linha 72: "múltiplos formatos" (quais formatos exatamente?)
- Linha 125: "múltiplos tenants" (sem número alvo)
- Linha 203: "múltiplos alarmes" (sem limite)
- Linha 80: "Aproximadamente 50 usuários" (impreciso para meta)
- Linha 159: "múltiplos grupos/turmas" (sem limite)
- Linha 191: "interações relevantes de sessão" (vago)

**Implementation Leakage:** 3 ocorrências dentro de requisitos funcionais
- Linha 114: "Google" como provedor específico (deveria ser "provedor OAuth")
- Linha 201: "WhatsApp" como canal (aceitável como decisão de produto, mas limita)
- Linha 113: "e-mail e senha" (implementação de auth)

**FR Violations Total:** ~53

### Non-Functional Requirements

**Total NFRs Analisados:** ~25 itens (seções 9.1 a 9.5)

**Missing Metrics:** 18 ocorrências
- Linha 356: "múltiplos tenants" → sem meta numérica
- Linha 360: "expansão horizontal dos serviços stateless" → sem target de escala
- Linha 364: "autenticação centralizada" → sem SLO de latência
- Linha 368: "criptografia em trânsito (TLS)" → OK, específico
- Linha 375-379: "métricas; logs estruturados; tracing distribuído; dashboards operacionais; alertas" → lista de itens sem SLOs
- Seção 9.1: Sem target de tenants simultâneos
- Seção 9.2: Sem SLO de autenticação
- Seção 9.3: Sem SLOs de observabilidade (latência de alerta, retenção de logs)
- Seção 9.4: Sem política de retenção com prazos
- Seção 9.5: Sem prazos para RIPD, sem SLA de resposta a solicitações LGPD

**Incomplete Template:** 25 (nenhum NFR segue o template BMAD)
- Nenhum NFR tem: critério + métrica + método de medição + contexto
- Todos são declarações gerais sem targets específicos

**Missing Context:** 20
- Nenhum NFR explica por que o requisito importa ou quem é afetado

**NFR Violations Total:** 63

### Overall Assessment

**Total Requirements:** ~70 (45 funcionais + 25 não funcionais)
**Total Violations:** ~116

**Severity:** Critical

**Recomendação:** A maioria dos requisitos não é mensurável nem testável. Os requisitos funcionais precisam ser reestruturados em formato FR numerado com critérios de aceitação. Os NFRs precisam de métricas específicas (ex: "API responde em <200ms para p95", "99.5% uptime em horário comercial", "suporta 500 usuários simultâneos").

---

## Traceability Validation

### Chain Validation

**Executive Summary → Success Criteria:** Gaps Identified
- O resumo executivo menciona validação, escala e multi-tenancy como objetivos
- Não existe seção formal de Success Criteria com métricas mensuráveis
- Seção 4 (Objetivos) parcialmente cobre, mas sem critérios de sucesso quantificáveis

**Success Criteria → User Journeys:** Gaps Identified
- Sem seção de Success Criteria formal
- Sem seção de User Journeys
- Impossível validar a cadeia

**User Journeys → Functional Requirements:** Gaps Identified
- Sem User Journeys documentadas
- Requisitos funcionais (seção 6) não rastreiam para jornadas de usuário
- Impossível verificar se cada FR atende uma necessidade de usuário

**Scope → FR Alignment:** Parcial
- Itens do escopo (seção 6) descrevem funcionalidades, mas sem correspondência formal FR↔Scope
- Itens fora do escopo (seção 8) estão bem definidos

### Orphan Elements

**Orphan Functional Requirements:** ~45
- Todos os requisitos funcionais são tecnicamente órfãos, pois não há User Journeys para rastrear

**Unsupported Success Criteria:** N/A (seção não existe)

**User Journeys Without FRs:** N/A (seção não existe)

### Traceability Matrix

| Cadeia | Status |
|--------|--------|
| Exec Summary → Success Criteria | Quebrada |
| Success Criteria → User Journeys | Quebrada |
| User Journeys → FRs | Quebrada |
| Scope → FRs | Parcial |

**Total Traceability Issues:** Crítico — cadeia completamente quebrada

**Severity:** Critical

**Recomendação:** Requisitos órfãos existem em massa. Toda a cadeia de rastreabilidade está quebrada pela ausência de seções Success Criteria e User Journeys. Cada FR deve rastrear para uma necessidade de usuário ou objetivo de negócio.

---

## Implementation Leakage Validation

### Leakage by Category

**Observação importante:** O PRD contém 6 seções inteiras (10-15) dedicadas a implementação — arquitetura, stack, serviços, eventos, modelo de dados. Embora sejam informativas, esse conteúdo pertence ao documento de arquitetura, não ao PRD. Abaixo, a análise foca nas seções de requisitos (6 e 9).

**Frontend Frameworks:** 0 violações em FRs/NFRs
(Next.js, React, etc. mencionados apenas na seção 11 — Stack)

**Backend Frameworks:** 0 violações em FRs/NFRs
(NestJS, Fastify mencionados apenas na seção 11)

**Databases:** 0 violações em FRs/NFRs
(PostgreSQL, Redis, MinIO mencionados apenas nas seções 11-12)

**Cloud Platforms:** 0 violações em FRs/NFRs

**Infrastructure:** 0 violações em FRs/NFRs
(Docker, Traefik, Hetzner mencionados apenas na seção 11)

**Libraries:** 0 violações em FRs/NFRs

**Other Implementation Details:** 3 violações em FRs
- Linha 114: "login via Google" → deveria especificar capacidade OAuth sem vincular provedor
- Linha 201: "lembretes via WhatsApp" → deveria mencionar "canal de mensageria" como capacidade
- Linha 490: "Jitsi self-hosted" aparece como decisão de produto dentro do escopo funcional (seção 6.4)

### Seções de Implementação Indevidas no PRD

**Finding de alto impacto:** Seções 10 a 15 (linhas 408–795) são inteiramente conteúdo de arquitetura e implementação:
- Seção 10: Arquitetura (princípios, estratégia de deploy, isolamento)
- Seção 11: Stack completa (frontend, backend, banco, cache, auth, infra)
- Seção 12: 12 microserviços detalhados
- Seção 13: 27 eventos de domínio nomeados
- Seção 14: Regras de negócio (válido para PRD)
- Seção 15: Modelo de dados com 25 entidades

**Total Implementation Leakage Violations:** 3 em FRs + 6 seções inteiras de implementação

**Severity:** Critical

**Recomendação:** As seções 10-13 e 15 devem ser movidas para o documento `architecture.md`. O PRD deve especificar O QUÊ, não COMO. Manter seção 14 (Regras de Negócio) no PRD é adequado. As decisões de stack podem ser referenciadas brevemente como constraints, não como especificações detalhadas.

---

## Domain Compliance Validation

**Domínio:** EdTech (educação/discipulado cristão, plataforma de ensino e formação)
**Complexidade:** Média (conforme domain-complexity.csv)

### Requisitos de Domínio Verificados

**Privacy Compliance (LGPD):** Presente — Adequado
- Seção 9.5: LGPD, consentimento, RIPD, exportação de dados, exclusão
- Seção 16: Dados pessoais, política de privacidade, base legal
- Seção 16.3: Ponto sensível sobre monitoramento de foco/aba

**Content Guidelines:** Parcial
- Não há menção a moderação de conteúdo nas trilhas de ensino
- Não há política de conteúdo aceitável/inaceitável
- Risco: conteúdo gerado por IA (quiz) sem revisão explícita

**Accessibility Features:** Ausente
- Nenhuma menção a WCAG, acessibilidade, leitores de tela, contraste, navegação por teclado
- Plataforma web educacional deveria ter requisitos básicos de acessibilidade

**Curriculum Alignment:** N/A (formação religiosa, sem necessidade de alinhamento curricular formal)

### Compliance Matrix

| Requisito | Status | Notas |
|-----------|--------|-------|
| LGPD / Privacidade | Met | Seções 9.5 e 16 cobrem adequadamente |
| Moderação de Conteúdo | Parcial | Ausente para trilhas e conteúdo gerado por IA |
| Acessibilidade (WCAG) | Missing | Nenhum requisito de acessibilidade |
| Proteção de Menores | Missing | Sem menção — possível presença de menores em discipulado |

**Required Sections Present:** 1/4
**Compliance Gaps:** 3

**Severity:** Warning

**Recomendação:** Adicionar requisitos de acessibilidade (mínimo WCAG 2.1 AA). Considerar política de moderação de conteúdo e proteção de menores, caso a plataforma atenda participantes menores de idade.

---

## Project-Type Compliance Validation

**Project Type:** web_app + saas_b2b (híbrido — plataforma SaaS multi-tenant web)

### Required Sections (web_app)

**Browser Matrix:** Missing — nenhuma especificação de navegadores suportados
**Responsive Design:** Missing — sem requisitos de responsividade ou dispositivos
**Performance Targets:** Missing — sem metas de performance (response time, load time, Core Web Vitals)
**SEO Strategy:** Missing — sem menção a SEO (pode ser N/A para app autenticado)
**Accessibility Level:** Missing — sem nível WCAG definido

### Required Sections (saas_b2b)

**Tenant Model:** Presente — seção 6.2 detalha multi-tenancy, branding, isolamento
**RBAC Matrix:** Parcial — seção 5.2 lista perfis mas sem matriz de permissões detalhada
**Subscription Tiers:** Missing — seção 8 menciona billing fora do escopo, sem tiers definidos
**Integration List:** Missing — sem lista de integrações externas (exceto WhatsApp e Google Auth)
**Compliance Reqs:** Presente — LGPD coberta nas seções 9.5 e 16

### Excluded Sections

**CLI Interface:** Absent ✓
**Mobile First:** Absent ✓ (app mobile fora do escopo)

### Compliance Summary

**Required Sections:** 3/10 presentes (Tenant Model, Compliance Reqs, parcial RBAC)
**Excluded Sections Present:** 0 (correto)
**Compliance Score:** 30%

**Severity:** Warning

**Recomendação:** Adicionar browser matrix, requisitos de responsividade, metas de performance, e detalhar a matriz RBAC. SEO pode ser N/A para aplicação autenticada, mas deve ser declarado explicitamente.

---

## SMART Requirements Validation

**Nota:** O PRD não possui FRs numerados formalmente. A análise abaixo avalia os requisitos implícitos nas subseções de 6.1 a 6.14 como blocos funcionais.

### Scoring Summary

**Blocos Funcionais Identificados:** 14 (seções 6.1 a 6.14)

| Bloco Funcional | S | M | A | R | T | Avg | Flag |
|----------------|---|---|---|---|---|-----|------|
| 6.1 Cadastro/Login | 4 | 2 | 5 | 5 | 2 | 3.6 | X |
| 6.2 Multi-tenancy | 3 | 2 | 4 | 5 | 2 | 3.2 | X |
| 6.3 Grupos/Turmas | 4 | 2 | 5 | 5 | 2 | 3.6 | X |
| 6.4 Reuniões Online | 4 | 2 | 4 | 5 | 2 | 3.4 | X |
| 6.5 Presença/Engajamento | 5 | 4 | 4 | 5 | 3 | 4.2 | |
| 6.6 Lembretes/Automações | 3 | 2 | 4 | 4 | 2 | 3.0 | X |
| 6.7 Trilhas de Ensino | 4 | 2 | 4 | 5 | 2 | 3.4 | X |
| 6.8 Tipos de Conteúdo | 4 | 3 | 5 | 4 | 2 | 3.6 | X |
| 6.9 Conclusão de Conteúdo | 5 | 4 | 5 | 5 | 3 | 4.4 | |
| 6.10 Quiz/Avaliação | 3 | 2 | 3 | 4 | 2 | 2.8 | X |
| 6.11 Gamificação | 3 | 2 | 4 | 4 | 2 | 3.0 | X |
| 6.12 Relatórios/Dashboards | 3 | 2 | 4 | 5 | 2 | 3.2 | X |
| 6.13 Conteúdo/Armazenamento | 3 | 2 | 4 | 4 | 2 | 3.0 | X |
| 6.14 Importação em Massa | 2 | 1 | 4 | 3 | 1 | 2.2 | X |

**Legend:** S=Specific, M=Measurable, A=Attainable, R=Relevant, T=Traceable (1-5)

**All scores ≥ 3:** 14% (2/14)
**All scores ≥ 4:** 0% (0/14)
**Overall Average Score:** 3.2/5.0

### Improvement Suggestions

**6.1 Cadastro/Login:** Definir critérios de aceitação testáveis (ex: "login em <3s", "suporta 2FA").

**6.2 Multi-tenancy:** Quantificar limites — quantos tenants simultâneos, SLA de isolamento.

**6.4 Reuniões Online:** Definir limites técnicos — máximo de participantes por sala, qualidade mínima de vídeo, latência máxima.

**6.6 Lembretes:** Definir SLA de entrega (ex: "lembrete enviado até 5min antes"), taxa de entrega alvo.

**6.10 Quiz/Avaliação:** Requisito "geração de quiz com IA" é vago — definir precisão mínima, tipos de perguntas, necessidade de revisão humana.

**6.11 Gamificação:** Definir fórmulas ou regras claras de pontuação e progressão.

**6.14 Importação em Massa:** Requisito extremamente vago ("poderá permitir") — definir formatos, limites, tratamento de erros.

### Overall Assessment

**Severity:** Critical (86% dos blocos flagged, >30%)

**Recomendação:** A maioria dos blocos funcionais carece de mensurabilidade e rastreabilidade. Converter cada bloco em FRs numerados com critérios de aceitação testáveis seguindo o padrão SMART.

---

## Holistic Quality Assessment

### Document Flow & Coherence

**Assessment:** Adequate (3/5)

**Strengths:**
- Progressão lógica do problema → visão → escopo → detalhes
- Seções bem delimitadas com numeração clara
- Decisões de produto documentadas explicitamente (seções 7, 20)
- Riscos e mitigações bem estruturados (seção 19)
- Itens em aberto transparentes (seção 21)

**Areas for Improvement:**
- Seções 10-15 quebram o fluxo do PRD ao introduzir arquitetura detalhada
- Seção 7 (pergunta sobre trilhas) é conteúdo de decisão que deveria estar integrado, não como seção independente
- Falta transição clara entre "o que o produto faz" e "como medir sucesso"

### Dual Audience Effectiveness

**For Humans:**
- Executive-friendly: Bom — visão e escopo claros, linguagem acessível
- Developer clarity: Parcial — muita implementação mas requisitos vagos
- Designer clarity: Fraco — sem jornadas de usuário, sem wireframes ou fluxos
- Stakeholder decision-making: Bom — decisões documentadas, riscos mapeados

**For LLMs:**
- Machine-readable structure: Parcial — headers consistentes mas sem frontmatter YAML
- UX readiness: Fraco — sem jornadas, sem personas detalhadas, impossível gerar UX design
- Architecture readiness: Bom — seções 10-15 são altamente detalhadas (mas no lugar errado)
- Epic/Story readiness: Fraco — requisitos não numerados, sem critérios de aceitação

**Dual Audience Score:** 2/5

### BMAD PRD Principles Compliance

| Princípio | Status | Notas |
|-----------|--------|-------|
| Information Density | Parcial | 21 violações de filler/wordiness |
| Measurability | Not Met | Maioria dos FRs e NFRs sem métricas |
| Traceability | Not Met | Cadeia completamente quebrada |
| Domain Awareness | Parcial | LGPD presente, acessibilidade ausente |
| Zero Anti-Patterns | Not Met | Filler extensivo, implementation leakage massivo |
| Dual Audience | Parcial | Bom para humanos, fraco para LLMs |
| Markdown Format | Met | Estrutura limpa, headers consistentes |

**Principles Met:** 1/7 (Markdown Format)
**Principles Partial:** 3/7 (Density, Domain, Dual Audience)
**Principles Not Met:** 3/7 (Measurability, Traceability, Anti-Patterns)

### Overall Quality Rating

**Rating:** 2/5 - Needs Work

O PRD é um rascunho abrangente com boa cobertura temática, mas estruturalmente não atende aos padrões BMAD. Contém conteúdo valioso que precisa ser reestruturado.

### Top 3 Improvements

1. **Adicionar seções Success Criteria e User Journeys**
   O PRD não tem cadeia de rastreabilidade. Criar Success Criteria mensuráveis (ex: "70% dos participantes completam a trilha em 30 dias") e documentar jornadas para cada persona (Super Admin, Admin, Líder, Participante).

2. **Reestruturar requisitos como FRs numerados com critérios de aceitação e mover seções 10-15 para architecture.md**
   Os ~45 itens funcionais da seção 6 devem se tornar FRs formais (FR-001 a FR-045) com formato "[Ator] pode [capacidade]" e critérios testáveis. As 6 seções de implementação (10-15) devem migrar para o documento de arquitetura.

3. **Adicionar métricas específicas a todos os NFRs**
   Cada NFR deve seguir o template: "O sistema deve [métrica] [condição] [método de medição]". Exemplos: "API responde em <500ms para p95 sob carga normal", "99.5% uptime mensal medido por health check externo", "Suporta 100 participantes simultâneos por sala de reunião".

### Summary

**Este PRD é:** um rascunho rico em conteúdo e decisões de produto, mas que precisa de reestruturação significativa para atender aos padrões BMAD — especialmente em rastreabilidade, mensurabilidade e separação entre PRD e arquitetura.

**Para torná-lo excelente:** focar nos 3 melhoramentos acima.

---

## Completeness Validation

### Template Completeness

**Template Variables Found:** 0
Nenhuma variável de template encontrada ✓

### Content Completeness by Section

**Executive Summary:** Presente (seção 1)
- Visão clara, problema definido, público-alvo mencionado

**Success Criteria:** Missing
- Seção inexistente. Seção 4 tem objetivos mas sem métricas de sucesso

**Product Scope:** Presente (seções 6 + 8)
- In-scope definido (seção 6), Out-of-scope definido (seção 8)

**User Journeys:** Missing
- Nenhuma jornada documentada. Seção 5 tem perfis mas não fluxos

**Functional Requirements:** Incomplete
- Conteúdo funcional existe (seção 6) mas sem formato FR, sem numeração, sem critérios

**Non-Functional Requirements:** Incomplete
- Seção 9 existe mas sem métricas específicas

### Section-Specific Completeness

**Success Criteria Measurability:** None — seção inexistente
**User Journeys Coverage:** No — perfis listados mas sem jornadas para nenhum
**FRs Cover MVP Scope:** Partial — funcionalidades cobrem o escopo mas sem FRs formais
**NFRs Have Specific Criteria:** None — todos os NFRs são declarações genéricas

### Frontmatter Completeness

**stepsCompleted:** Missing (sem frontmatter YAML)
**classification:** Missing (sem frontmatter YAML — domain e projectType não definidos)
**inputDocuments:** Missing (sem frontmatter YAML)
**date:** Presente (no header markdown, linha 7)

**Frontmatter Completeness:** 0/4 (sem frontmatter YAML formal)

### Completeness Summary

**Overall Completeness:** 40% (2 completas + 2 incompletas de 6 seções core)

**Critical Gaps:**
1. Sem seção Success Criteria
2. Sem seção User Journeys
3. Sem frontmatter YAML

**Minor Gaps:**
1. FRs sem formato padronizado
2. NFRs sem métricas
3. Seções de implementação no PRD (10-15)

**Severity:** Warning

**Recomendação:** O PRD tem gaps de completude que devem ser endereçados. Adicionar frontmatter YAML com classificação, criar seções Success Criteria e User Journeys, e formalizar os requisitos funcionais.

---

## Executive Summary — Resultados Rápidos

| Validação | Resultado | Severidade |
|-----------|-----------|------------|
| Format Detection | BMAD Variant (3/6 core) | Info |
| Information Density | 21 violações | Critical |
| Product Brief Coverage | N/A | — |
| Measurability | ~116 violações | Critical |
| Traceability | Cadeia quebrada | Critical |
| Implementation Leakage | 3 em FRs + 6 seções inteiras | Critical |
| Domain Compliance | 1/4 requisitos | Warning |
| Project-Type Compliance | 30% | Warning |
| SMART Quality | 14% aceitável | Critical |
| Holistic Quality | 2/5 | Needs Work |
| Completeness | 40% | Warning |

**Overall Status:** Warning (com tendência Critical)

**Issues Críticos:** 5 (Density, Measurability, Traceability, Leakage, SMART)
**Warnings:** 3 (Domain, Project-Type, Completeness)
**Passes:** 0

**Forças do PRD:**
- Cobertura temática abrangente e detalhada
- Decisões de produto bem documentadas (seções 7, 20)
- Riscos e mitigações bem estruturados (seção 19)
- LGPD e privacidade adequadamente cobertos
- Regras de presença/engajamento bem definidas (seção 6.5)
- Itens em aberto transparentes (seção 21)
