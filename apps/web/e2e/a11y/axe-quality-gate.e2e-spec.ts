/**
 * axe-quality-gate.e2e-spec.ts — Gate axe bloqueante (FR-5/FR-11)
 *
 * Páginas: a11y-pages.json (raiz do repo) — adicionar página = editar JSON, não este arquivo.
 * Tags WCAG bloqueantes: wcag2a, wcag2aa, wcag21aa. best-practice: excluída do gate.
 * requiresAuth:true → test.skip (R2 explícito; ver NC-3/dec-007 na spec a11y-ci-gate).
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

interface PageEntry {
  path: string;
  label: string;
  requiresAuth: boolean;
}

interface PagesJson {
  _README?: string[];
  pages: PageEntry[];
}

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

test.describe('axe quality gate — páginas públicas (WCAG 2AA)', () => {
  for (const pageEntry of allPages) {
    if (pageEntry.requiresAuth) {
      // R2 explícito: páginas autenticadas skipped neste sprint (NC-3/dec-007)
      test(
        `[SKIP/R2] ${pageEntry.label} (${pageEntry.path}) — requiresAuth=true`,
        async () => {
          test.skip(
            true,
            '[R2] Página autenticada: loginAs não disponível no CI (NC-3/dec-007). ' +
              'Adicionar suporte loginAs+Keycloak antes de remover este skip.'
          );
        }
      );
      continue;
    }

    test(
      `[axe] ${pageEntry.label} (${pageEntry.path}) — zero violações WCAG 2AA`,
      async ({ page: pwPage }) => {
        // Navegar para a página e aguardar estabilização
        await pwPage.goto(pageEntry.path, { waitUntil: 'networkidle' });

        // Executar axe com tags WCAG 2A/2AA/2.1AA (best-practice excluída intencionalmente)
        const results = await new AxeBuilder({ page: pwPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();

        // Gate hard: qualquer violação WCAG 2AA bloqueia o PR
        if (results.violations.length > 0) {
          const summary = results.violations
            .map(
              (v) =>
                `  • ${v.id} [${v.impact}]: ${v.description} (${v.nodes.length} nós)`
            )
            .join('\n');
          throw new Error(
            `Violações WCAG 2AA em "${pageEntry.label}" (${pageEntry.path}):\n${summary}`
          );
        }

        expect(results.violations).toHaveLength(0);
      }
    );
  }
});
