/**
 * check-contrast.spec.ts — Testes unitários para scripts/check-contrast.ts
 *
 * Ref: T4, SC-1.9, plan §3.3
 * Cobre os 5 casos obrigatórios de SC-1.9:
 *  1. Tokens com contraste suficiente → exit 0
 *  2. Token com contraste insuficiente → exit 1 + mensagem inclui nome do token
 *  3. Flag --verbose → saída inclui ratio numérico por par
 *  4. Flag --tokens-path inválido → exit 1 com mensagem de erro de arquivo não encontrado
 *  5. Sugestões → quando falha, output inclui valor hex sugerido
 *
 * Fixtures CSS inline — independentes de packages/config/tailwind.preset.css.
 * Não importam de apps/web/src/.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Caminho para o script sob teste (relativo à raiz do repo)
const SCRIPT = path.resolve(__dirname, '../check-contrast.ts');
// tsx disponível via apps/web
const TSX = path.resolve(__dirname, '../../apps/web/node_modules/.bin/tsx');

// Fixture: CSS com contraste suficiente (text: #17252a on #fafaf8 → ~15:1)
const CSS_PASS = `
@theme {
  --color-text-primary: #17252a;
  --color-surface-base: #fafaf8;
  --color-text-inverse: #fafaf8;
  --color-brand-teal: #2b7a78;
  --color-brand-teal-dark: #17252a;
  --color-text-secondary: #5c5a57;
  --color-surface-elevated: #ffffff;
  --color-surface-sunken: #f2f0ed;
}
`;

// Fixture: CSS com contraste insuficiente (text: #aaaaaa on #ffffff → ~1.6:1)
const CSS_FAIL = `
@theme {
  --color-text-primary: #aaaaaa;
  --color-surface-base: #ffffff;
  --color-text-inverse: #fafaf8;
  --color-brand-teal: #2b7a78;
  --color-brand-teal-dark: #17252a;
  --color-text-secondary: #aaaaaa;
  --color-surface-elevated: #ffffff;
  --color-surface-sunken: #ffffff;
}
`;

function writeTempCss(content: string): string {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `check-contrast-test-${Date.now()}.css`);
  fs.writeFileSync(tmpFile, content, 'utf-8');
  return tmpFile;
}

function runScript(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`${TSX} ${SCRIPT} ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

describe('check-contrast.ts — SC-1.9 casos obrigatórios', () => {
  // Caso 1: tokens com contraste suficiente → exit 0
  it('SC-1.9.1: tokens com contraste suficiente retornam exit 0', () => {
    const tmpCss = writeTempCss(CSS_PASS);
    try {
      const result = runScript(`--tokens-path ${tmpCss}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/color pairs checked\. All pass WCAG AA/);
    } finally {
      fs.unlinkSync(tmpCss);
    }
  });

  // Caso 2: token com contraste insuficiente → exit 1 + mensagem inclui nome do token
  it('SC-1.9.2: token com contraste insuficiente retorna exit 1 com nome do token', () => {
    const tmpCss = writeTempCss(CSS_FAIL);
    try {
      const result = runScript(`--tokens-path ${tmpCss}`);
      expect(result.exitCode).toBe(1);
      // Mensagem deve incluir o nome do token que falhou
      const output = result.stdout + result.stderr;
      expect(output).toMatch(/--color-text-primary/);
      expect(output).toMatch(/\[FAIL\]/);
    } finally {
      fs.unlinkSync(tmpCss);
    }
  });

  // Caso 3: flag --verbose → saída inclui ratio numérico para pares que passam
  it('SC-1.9.3: flag --verbose exibe ratio numérico por par', () => {
    const tmpCss = writeTempCss(CSS_PASS);
    try {
      const result = runScript(`--tokens-path ${tmpCss} --verbose`);
      expect(result.exitCode).toBe(0);
      // Verbose deve mostrar pares com ratio → ratio: X.XX:1
      expect(result.stdout).toMatch(/ratio:\s*[\d.]+:1/);
    } finally {
      fs.unlinkSync(tmpCss);
    }
  });

  // Caso 4: flag --tokens-path inválido → exit 1 com mensagem de arquivo não encontrado
  it('SC-1.9.4: --tokens-path inválido retorna exit 1 com mensagem de erro', () => {
    const result = runScript('--tokens-path /tmp/nao-existe-arquivo-check-contrast.css');
    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/not found|nao encontrado|ERROR/i);
  });

  // Caso 5: quando falha, output inclui sugestão de valor hex alternativo
  it('SC-1.9.5: sugestão de alternativa hex incluída na saída de falha', () => {
    const tmpCss = writeTempCss(CSS_FAIL);
    try {
      const result = runScript(`--tokens-path ${tmpCss}`);
      expect(result.exitCode).toBe(1);
      const output = result.stdout + result.stderr;
      // Sugestão deve incluir um valor hex ou "n/a"
      expect(output).toMatch(/Sugest[aã]o.*#[0-9a-fA-F]{6}|n\/a/);
    } finally {
      fs.unlinkSync(tmpCss);
    }
  });
});
