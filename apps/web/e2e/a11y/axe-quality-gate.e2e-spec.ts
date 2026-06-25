/**
 * axe-quality-gate.e2e-spec.ts — Gate axe bloqueante (FR-5/FR-11)
 *
 * Páginas: a11y-pages.json (raiz do repo) — adicionar página = editar JSON, não este arquivo.
 * Tags WCAG bloqueantes: wcag2a, wcag2aa, wcag21aa. best-practice: excluída do gate.
 *
 * Modos por entrada (campo `gate`, ver a11y-pages.json):
 *   'hard'     → asserta ZERO violações; qualquer violação bloqueia o PR (páginas públicas hoje).
 *   'baseline' → roda o axe e LOGA as violações, mas NÃO bloqueia (ratchet para páginas
 *                autenticadas com violações pré-existentes — débito R2 do Epic 12). O Epic 15
 *                (Acessibilidade Avançada) corrige cada página e troca o gate p/ 'hard'.
 *   requiresAuth:true → o gate faz loginAs (persona admin demo) antes de navegar.
 *   requiresRole sem persona disponível → test.skip com motivo (ex.: super_admin do health).
 *
 * Refs: FR-4, FR-5, FR-6, FR-11, SC-2.7, SC-2.8, SC-5.3, plan §2.2, CHK006
 *
 * CHK006 — resolução robusta via __dirname (4 níveis acima = raiz do repo) com fallback
 * para process.cwd() e busca ascendente (max 6 níveis). Funciona em dev (cwd=apps/web/) e CI.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs } from '../fixtures/auth.fixture';
import { E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD } from '../setup/env';

type GateMode = 'hard' | 'baseline';

interface PageEntry {
  path: string;
  label: string;
  requiresAuth: boolean;
  gate?: GateMode;
  requiresRole?: string;
}

interface PagesJson {
  _README?: string[];
  pages: PageEntry[];
}

/**
 * Roles para as quais existe persona E2E (login funcional + seed). Hoje só a persona
 * admin demo (tenant-scoped). Páginas com `requiresRole` fora deste conjunto são skipadas
 * até que o seed/persona correspondente seja adicionado (ex.: super_admin para o health).
 */
const AVAILABLE_ROLES = new Set<string>(['admin']);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

// Lê a11y-pages.json da raiz do repo (CHK006 — resolução robusta)
// __dirname = apps/web/e2e/a11y/ → subir 4 níveis para raiz do repo
// Fallback: process.cwd() para compatibilidade CI (raiz do repo no job E2E)
const repoRoot = (() => {
  const fromDirname = path.resolve(__dirname, '../../../../');
  if (fs.existsSync(path.join(fromDirname, 'a11y-pages.json'))) return fromDirname;
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, 'a11y-pages.json'))) return fromCwd;
  // Subir a partir do cwd até encontrar a11y-pages.json (max 6 níveis)
  let dir = fromCwd;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'a11y-pages.json'))) return dir;
    dir = path.resolve(dir, '..');
  }
  throw new Error('[axe-quality-gate] a11y-pages.json não encontrado. Raiz buscada: ' + fromDirname);
})();
const pagesJsonPath = path.join(repoRoot, 'a11y-pages.json');
const pagesJson: PagesJson = JSON.parse(fs.readFileSync(pagesJsonPath, 'utf-8'));
const allPages = pagesJson.pages;

test.describe('axe quality gate — WCAG 2AA (públicas hard + autenticadas baseline)', () => {
  for (const pageEntry of allPages) {
    const mode: GateMode = pageEntry.gate ?? 'hard';

    // Página exige uma role sem persona E2E disponível → skip explícito (não bloqueia).
    if (pageEntry.requiresRole && !AVAILABLE_ROLES.has(pageEntry.requiresRole)) {
      test(
        `[SKIP/persona] ${pageEntry.label} (${pageEntry.path}) — requiresRole=${pageEntry.requiresRole}`,
        async () => {
          test.skip(
            true,
            `Sem persona E2E para role "${pageEntry.requiresRole}". ` +
              `Epic 15 (a11y autenticada) deve criar seed/persona "${pageEntry.requiresRole}" ` +
              `e adicioná-la a AVAILABLE_ROLES antes de gatear ${pageEntry.path}.`,
          );
        },
      );
      continue;
    }

    if (mode === 'baseline') {
      // Ratchet informativo: roda o axe e loga, mas NUNCA bloqueia o CI. Falhas de
      // login/navegação também são toleradas — a página só passa a bloquear quando o
      // Epic 15 a corrige e troca `gate` para 'hard' no a11y-pages.json.
      test(
        `[axe:baseline] ${pageEntry.label} (${pageEntry.path}) — informativo (R2/Epic 15)`,
        async ({ page: pwPage }) => {
          try {
            if (pageEntry.requiresAuth) {
              await loginAs(pwPage, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
            }
            await pwPage.goto(pageEntry.path, { waitUntil: 'networkidle' });
            const results = await new AxeBuilder({ page: pwPage }).withTags(WCAG_TAGS).analyze();
            const summary = results.violations
              .map((v) => `${v.id}[${v.impact}]×${v.nodes.length}`)
              .join(', ');
            console.log(
              `[axe:baseline] ${pageEntry.label}: ${results.violations.length} violação(ões) ` +
                `WCAG 2AA — informativo, não bloqueia até Epic 15` +
                (summary ? ` — ${summary}` : ''),
            );
          } catch (err) {
            console.warn(
              `[axe:baseline] ${pageEntry.label}: scan não concluído ` +
                `(${(err as Error).message}) — não bloqueante (ratchet R2/Epic 15)`,
            );
          }
        },
      );
      continue;
    }

    // Gate hard: qualquer violação WCAG 2AA bloqueia o PR.
    test(
      `[axe:hard] ${pageEntry.label} (${pageEntry.path}) — zero violações WCAG 2AA`,
      async ({ page: pwPage }) => {
        if (pageEntry.requiresAuth) {
          await loginAs(pwPage, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
        }
        // Navegar para a página e aguardar estabilização
        await pwPage.goto(pageEntry.path, { waitUntil: 'networkidle' });

        // Executar axe com tags WCAG 2A/2AA/2.1AA (best-practice excluída intencionalmente)
        const results = await new AxeBuilder({ page: pwPage }).withTags(WCAG_TAGS).analyze();

        // Gate hard: qualquer violação WCAG 2AA bloqueia o PR
        if (results.violations.length > 0) {
          const summary = results.violations
            .map((v) => `  • ${v.id} [${v.impact}]: ${v.description} (${v.nodes.length} nós)`)
            .join('\n');
          throw new Error(
            `Violações WCAG 2AA em "${pageEntry.label}" (${pageEntry.path}):\n${summary}`,
          );
        }

        expect(results.violations).toHaveLength(0);
      },
    );
  }
});
