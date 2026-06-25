# Performance Checklist: a11y-conteudo-multimidia (Story 15.5)

**Purpose**: Valida a qualidade dos requisitos de performance — bundle size, queries de banco, latência, carregamento de assets e degradação para as 3 frentes da story.
**Created**: 2026-06-25
**Feature**: [spec.md](../spec.md)

---

## Bundle e Assets

- [x] CHK401 - O requisito de validação de regressão de bundle após instalação do Plyr está documentado? [Completude, Spec §NFR-P1, Plan §4.1] {auto}
  > Evidência: NFR-P1 "Bundle Plyr ~50KB — validar `pnpm turbo build` sem regressão de tamanho crítica"; Plan §4.1 "pnpm turbo build (api+web) — sem erro TypeScript" como gate de build.

- [ ] CHK402 - Está definido o limiar concreto de "regressão de tamanho crítica" para o bundle (ex: +50KB gzip em First Load JS)? [Clareza, Spec §NFR-P1, Ambiguity] {auto}
  > [Ambiguity]: NFR-P1 diz "sem regressão de tamanho crítica" mas não define um threshold numérico. "~50KB" do Plyr é a estimativa de tamanho da lib, não o limiar de aceitação. Sem número, o gate é subjetivo.

- [x] CHK403 - Está documentado o risco de SSR do Plyr (Next.js) e a mitigação via `dynamic import { ssr: false }`? [Completude, Spec §Plan §8] {auto}
  > Evidência: Plan §8 Riscos "Plyr não mountar em SSR (Next.js) — Alta probabilidade — Importar Plyr com `dynamic import { ssr: false }` dentro do Client Component".

- [x] CHK404 - Está documentado que o CSS do Plyr (~10KB) será importado globalmente, com justificativa de trade-off vs. import por segmento? [Completude, Spec §Clarify P5] {auto}
  > Evidência: Clarify P5 (dec-013) "CSS Plyr importado no layout global autenticado — Frente B diz 'Importar CSS do Plyr globalmente'". Trade-off documentado: +10KB em todas páginas autenticadas, mas garante CSS sem condicional.

---

## Queries de Banco de Dados

- [x] CHK405 - O índice de performance para a query do endpoint admin `(tenant_id, has_missing_alt_text)` está especificado? [Completude, Spec §FR-011, CA-006.2, Plan §3.1.1] {auto}
  > Evidência: CA-006.2 "Índice `(tenant_id, has_missing_alt_text)` criado"; Plan §3.1.1 SQL "CREATE INDEX `lessons_tenant_id_has_missing_alt_text_idx` ON `lessons` (tenant_id, has_missing_alt_text)".

- [ ] CHK406 - Estão definidos os JOINs necessários para `AdminAccessibilityRepository.findLessonsWithMissingAlt()` — quantas tabelas (lessons + modules + trails) e se há N+1? [Completude, Spec §Plan §3.1.3, Gap] {auto}
  > [Gap]: FR-015 define que a resposta inclui `moduleName` e `trailName`, o que exige JOINs nas tabelas `modules` e `trails`. Plan §3.1.3 menciona "JOINs module/trail" mas não especifica se é JOIN único (performance) ou se há risco de N+1 queries. Para paginação de listas, a spec deveria definir a estratégia de JOIN (Prisma `include` com cursor ou `findMany` com JOIN SQL direto).

- [ ] CHK407 - Está definido o comportamento da query quando o número de aulas com alt-text ausente é muito grande (ex: tenant com 10.000 lessons) — paginação é obrigatória? [Completude, Spec §FR-014, Gap] {auto}
  > [Gap]: FR-014 menciona paginação mas sem definir se é cursor-based ou offset-based. Offset paginação com 10.000 registros pode ser lenta. Para tabelas grandes, cursor-based é mais eficiente — mas nenhuma das duas estratégias está especificada.

---

## Latência do AltTextValidator

- [x] CHK408 - O requisito de execução síncrona do `AltTextValidator` está justificado com análise de performance (contentBody < 50KB)? [Completude, Spec §Clarify P3] {auto}
  > Evidência: Clarify P3 (dec-009) "Parser in-memory de HTML é sub-milissegundo para conteúdo típico (<50KB)". A justificativa de performance está documentada na decisão auditada.

- [ ] CHK409 - Está definido o comportamento do `AltTextValidator` para `contentBody` excepcionalmente grande (ex: lesson com rich_text de 5MB de HTML inline)? [Completude, Spec §FR-012, Gap] {auto}
  > [Gap]: FR-012 define interface síncrona mas sem mencionar limite de tamanho. A análise de performance de Clarify P3 assume "<50KB". Para conteúdo legado migrado (potencialmente grande), regex em HTML de 5MB pode ser significativamente mais lento. Não há CA de limite máximo de `contentBody` para o validador.

---

## Carregamento de Assets de Vídeo

- [x] CHK410 - O requisito de usar presigned URL (4h) para o asset de vídeo está referenciado como existente (herança do video-player.tsx)? [Completude, Spec §Plan §3.3] {auto}
  > Evidência: Plan §3.3 PlyrVideoPlayer "Props: `signedUrl`" — herda o mesmo mecanismo de presigned URL do `video-player.tsx` existente (que já tem JSDoc "Presigned URL for the video file (4h expiry)").

- [ ] CHK411 - Está especificado o requisito de `loading="lazy"` ou `preload` para o player de vídeo na rota de aula (evitar carregar o vídeo antes da interação)? [Completude, Spec §FR-005, Gap] {auto}
  > [Gap]: Spec/plan não especificam a estratégia de `preload` do Plyr (Plyr default é `preload="metadata"`, que carrega apenas metadados — razoável). Documentar se esse default é aceitável ou se deve ser customizado.

---

## Observabilidade de Performance

- [ ] CHK412 - Está definido se o `use-video-progress.ts` (analytics de progresso) deve ser reutilizado também para métricas de performance do player Plyr (ex: buffering, time-to-first-frame)? [Completude, Spec §FR-008, Gap] {auto}
  > [Gap]: FR-008 "Reaproveitar `use-video-progress.ts` no `plyr-video-player.tsx`" refere-se apenas ao tracking de progresso para analytics. A spec não menciona métricas de performance do player. O escopo do FR-008 poderia ser mais explícito.

---

## Notes

- Items `{auto}` resolvidos com `[x]` têm citação de evidência explícita
- **Gaps abertos ([ ] {auto})**: CHK402, CHK406, CHK407, CHK409, CHK411, CHK412

### Follow-up dos Gaps

| Gap | Destino |
|-----|---------|
| CHK402 — threshold numérico bundle | Especificar NFR-P1: "bundle da rota /aulas/[lessonId]: First Load JS ≤ +100KB gzip em relação à baseline (medido via `next build` analyzer)" |
| CHK406 — estratégia de JOIN | Especificar em plan §3.1.3: "query usa Prisma `findMany` com `include: { module: { select: { name, trail: { select: { name } } } } }` — JOIN único, sem N+1" |
| CHK407 — paginação cursor vs offset | Especificar FR-014: "paginação offset-based com `page`/`pageSize`; monitorar se tenant superar 1.000 aulas com gaps (candidato a cursor-based)" |
| CHK409 — limite de contentBody | Especificar FR-012: "AltTextValidator.hasInvalidImgs() opera sobre contentBody ≤ 2MB; para valores maiores, retorna false com log de warning" |
| CHK411 — preload do Plyr | Especificar FR-005: "Plyr configurado com `preload: 'metadata'` (default — carrega apenas duração/dimensões, não buffer de vídeo)" |
| CHK412 — escopo de use-video-progress.ts | Especificar FR-008: "use-video-progress.ts provê apenas tracking de progresso (intervals assistidos + percentual); NÃO inclui métricas de buffering/performance" |
