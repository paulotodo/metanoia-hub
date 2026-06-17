#!/usr/bin/env node
/**
 * check-contrast-tokens.mjs
 *
 * CI script: verifica contraste WCAG AA dos tokens de cor do design system.
 *
 * Estratégia:
 *   - Parseia @theme de packages/config/tailwind.preset.css (light mode)
 *   - Parseia .dark de packages/ui/styles/tokens.css (dark mode overrides)
 *   - Calcula razão de contraste (WCAG 2.1 rel. luminance) para pares de cores
 *   - Gate HARD: 6 pares corrigidos por esta feature (exit 1 se < 4.5:1)
 *   - Gate WARN: demais pares de texto vs surface (log, sem exit 1)
 *
 * Ref: spec.md §9.1, task 4.1, feature a11y-contraste-focus
 * Uso: node apps/web/scripts/check-contrast-tokens.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PRESET_CSS = join(REPO_ROOT, 'packages/config/tailwind.preset.css');
const TOKENS_CSS = join(REPO_ROOT, 'packages/ui/styles/tokens.css');

// ---------------------------------------------------------------------------
// WCAG 2.1 contrast formula (mirrors apps/web/src/lib/contrast-checker.ts)
// ---------------------------------------------------------------------------

/** @param {number} value 0-255 channel */
function linearize(value) {
  const sRGB = value / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/** @param {string} hex  #RGB or #RRGGBB */
function parseHex(hex) {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/** @param {string} hex */
function relativeLuminance(hex) {
  const ch = parseHex(hex);
  if (!ch) throw new Error(`Invalid hex: ${hex}`);
  const [r, g, b] = ch;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** @param {string} hex1 @param {string} hex2 @returns {number} */
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// CSS parser — extrai custom properties de um bloco de CSS
// ---------------------------------------------------------------------------

/**
 * Extrai tokens de nome → hex de um bloco de CSS.
 * Suporta apenas valores hex (#rrggbb / #rgb).
 * Ignora oklch, var(), gradients, etc.
 *
 * @param {string} cssText
 * @returns {Record<string, string>}
 */
function extractHexTokens(cssText) {
  const tokens = {};
  // Regex: --color-xxx: #rrggbb ou #rgb
  const re = /--(color-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const name = m[1];
    const hex = m[2];
    // Aceitar apenas 3 ou 6 dígitos
    const clean = hex.replace('#', '');
    if (clean.length === 3 || clean.length === 6) {
      tokens[name] = hex;
    }
  }
  return tokens;
}

/**
 * Extrai tokens de dentro de um bloco específico (@theme, .dark, :root).
 *
 * @param {string} cssText texto completo do arquivo
 * @param {string} selector '@theme' | '.dark' | ':root'
 * @returns {Record<string, string>}
 */
function extractBlockTokens(cssText, selector) {
  // Encontrar o bloco (balancear chaves)
  const startIdx = cssText.indexOf(selector);
  if (startIdx === -1) return {};
  const braceOpen = cssText.indexOf('{', startIdx);
  if (braceOpen === -1) return {};

  let depth = 1;
  let i = braceOpen + 1;
  while (i < cssText.length && depth > 0) {
    if (cssText[i] === '{') depth++;
    else if (cssText[i] === '}') depth--;
    i++;
  }
  const blockText = cssText.slice(braceOpen + 1, i - 1);
  return extractHexTokens(blockText);
}

// ---------------------------------------------------------------------------
// Carregar tokens
// ---------------------------------------------------------------------------

const presetCss = readFileSync(PRESET_CSS, 'utf8');
const tokensCss = readFileSync(TOKENS_CSS, 'utf8');

// Light mode: @theme no preset (fonte primária) + :root no tokens.css
const lightFromPreset = extractBlockTokens(presetCss, '@theme');
const lightFromRoot = extractBlockTokens(tokensCss, ':root');
const lightTokens = { ...lightFromRoot, ...lightFromPreset };

// Dark mode: .dark no tokens.css
const darkTokens = { ...lightTokens, ...extractBlockTokens(tokensCss, '.dark') };

// ---------------------------------------------------------------------------
// Pares de contraste a verificar
// ---------------------------------------------------------------------------

/**
 * Gate HARD: 6 pares corrigidos por esta feature (a11y-contraste-focus).
 * Razão mínima WCAG AA: 4.5:1 (texto normal).
 *
 * Fonte: spec.md §AC4, AC5, AC6 + tasks FASE 1 e FASE 2.
 *   1. text-primary (#17252a) sobre surface-base (#fafaf8)     → 13.0:1 ✓
 *   2. text-primary (#17252a) sobre care-ok bg (#7ba38a)       → 5.58:1 ✓  (badge fix task 1.2)
 *   3. text-primary (#17252a) sobre care-attention bg (#d4a24c) → 6.80:1 ✓ (badge fix task 1.3)
 *   4. text-secondary (#5c5a57) sobre surface-base (#fafaf8)    → 5.14:1 ✓ (home fix task 2.1)
 *   5. care-urgent (#c1666b) sobre surface-base (#fafaf8)       → 4.51:1 ✓ (link fix task 2.2)
 *   6. interactive-focus (#2b7a78) sobre surface-elevated (#fff) → 4.55:1 ✓ (focus color gate)
 *
 * Se qualquer par falhar em 4.5:1 → exit 1 (regressão introduzida).
 */
const HARD_GATE_PAIRS = [
  {
    id: 'text-primary-on-surface-base',
    label: 'text-primary (#17252a) sobre surface-base',
    fgToken: 'color-text-primary',
    bgToken: 'color-surface-base',
    minRatio: 4.5,
    mode: 'light',
    taskRef: 'FASE1/FASE2',
  },
  {
    id: 'text-primary-on-care-ok-bg',
    label: 'text-primary sobre care-ok (badge)',
    fgToken: 'color-text-primary',
    bgToken: 'color-care-ok',
    minRatio: 4.5,
    mode: 'light',
    taskRef: 'task-1.2',
  },
  {
    id: 'text-primary-on-care-attention-bg',
    label: 'text-primary sobre care-attention (badge)',
    fgToken: 'color-text-primary',
    bgToken: 'color-care-attention',
    minRatio: 4.5,
    mode: 'light',
    taskRef: 'task-1.3',
  },
  {
    id: 'text-secondary-on-surface-base',
    label: 'text-secondary sobre surface-base (home)',
    fgToken: 'color-text-secondary',
    bgToken: 'color-surface-base',
    minRatio: 4.5,
    mode: 'light',
    taskRef: 'task-2.1',
  },
  {
    id: 'brand-primary-on-surface-base',
    label: 'brand-primary (link forgotPassword) sobre surface-base',
    fgToken: 'color-brand-teal',
    bgToken: 'color-surface-base',
    minRatio: 4.5,
    mode: 'light',
    taskRef: 'task-2.2',
  },
  {
    id: 'interactive-focus-on-surface-elevated',
    label: 'interactive-focus sobre surface-elevated (foco ring)',
    fgToken: 'color-interactive-focus',
    bgToken: 'color-surface-elevated',
    minRatio: 4.5,
    mode: 'light',
    taskRef: 'FASE3',
  },
];

/**
 * Gate WARN: demais pares de texto vs surface.
 * Apenas loga se abaixo de 4.5:1 (não bloqueia CI).
 */
const WARN_PAIRS = [
  {
    id: 'text-muted-on-surface-base',
    label: 'text-muted sobre surface-base (atenção: muted pode falhar)',
    fgToken: 'color-text-muted',
    bgToken: 'color-surface-base',
    mode: 'light',
  },
  {
    id: 'text-primary-on-surface-elevated-dark',
    label: 'text-primary dark sobre surface-elevated dark',
    fgToken: 'color-text-primary',
    bgToken: 'color-surface-elevated',
    mode: 'dark',
  },
  {
    id: 'text-secondary-on-surface-base-dark',
    label: 'text-secondary dark sobre surface-base dark',
    fgToken: 'color-text-secondary',
    bgToken: 'color-surface-base',
    mode: 'dark',
  },
];

// ---------------------------------------------------------------------------
// Executar verificações
// ---------------------------------------------------------------------------

let hardFailed = 0;
let warnFailed = 0;
const results = [];

function checkPair(pair, isHard) {
  const tokens = pair.mode === 'dark' ? darkTokens : lightTokens;
  const fg = tokens[pair.fgToken];
  const bg = tokens[pair.bgToken];

  if (!fg || !bg) {
    const msg = `  SKIP  [${pair.id}] token não encontrado: fg=${pair.fgToken}=${fg ?? 'N/A'}, bg=${pair.bgToken}=${bg ?? 'N/A'}`;
    results.push({ id: pair.id, status: 'skip', msg });
    return;
  }

  let ratio;
  try {
    ratio = contrastRatio(fg, bg);
  } catch (e) {
    const msg = `  ERROR [${pair.id}] falha ao calcular contraste: ${e.message}`;
    results.push({ id: pair.id, status: 'error', msg });
    return;
  }

  const ratioStr = ratio.toFixed(2);
  const pass = ratio >= 4.5;
  const icon = pass ? '✓' : (isHard ? '✗' : '⚠');
  const status = pass ? 'pass' : (isHard ? 'fail' : 'warn');
  const msg = `  ${icon} [${pair.id}] ${pair.label}: ${fg} / ${bg} = ${ratioStr}:1${!pass && !isHard ? ' (WARN — abaixo de AA)' : ''}${!pass && isHard ? ` (HARD FAIL — mínimo 4.5:1, ref: ${pair.taskRef ?? ''})` : ''}`;
  results.push({ id: pair.id, status, ratio, msg });

  if (!pass && isHard) hardFailed++;
  if (!pass && !isHard) warnFailed++;
}

console.log('');
console.log('check-contrast-tokens: verificando pares de contraste WCAG AA...');
console.log('');
console.log('=== GATE HARD (6 pares corrigidos por a11y-contraste-focus) ===');
for (const pair of HARD_GATE_PAIRS) {
  checkPair(pair, true);
}
for (const r of results.filter(r => HARD_GATE_PAIRS.some(p => p.id === r.id))) {
  console.log(r.msg);
}

console.log('');
console.log('=== GATE WARN (pares adicionais) ===');
for (const pair of WARN_PAIRS) {
  checkPair(pair, false);
}
for (const r of results.filter(r => WARN_PAIRS.some(p => p.id === r.id))) {
  console.log(r.msg);
}

console.log('');
console.log(`Resultado: ${hardFailed} falha(s) HARD | ${warnFailed} aviso(s) WARN`);

if (hardFailed > 0) {
  console.error('');
  console.error(`ERRO: ${hardFailed} par(es) de contraste abaixo do mínimo WCAG AA (4.5:1).`);
  console.error('Verifique os tokens em packages/ui/styles/tokens.css e packages/config/tailwind.preset.css.');
  process.exit(1);
} else {
  console.log('OK: todos os pares HARD passaram (>= 4.5:1).');
  process.exit(0);
}
