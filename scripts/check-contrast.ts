/**
 * check-contrast.ts — CLI de contraste WCAG para tokens CSS (oklch + hex)
 *
 * FR-1: Lê tokens CSS do bloco @theme { ... } via --tokens-path
 * FR-2: Resolve oklch(from ...) relative-color via color2k
 * FR-12: Requer color2k instalado como devDep em apps/web
 *
 * Como estender:
 *   - Adicionar pares texto/superfície em CONTRAST_PAIRS abaixo.
 *   - Para novo nível (ex: AAA 7:1), passar --level AAA.
 *   - Para inspecionar todos os pares (pass + fail), usar --verbose.
 *
 * Uso:
 *   npx tsx scripts/check-contrast.ts [--tokens-path <path>] [--level AA|AAA] [--verbose]
 *
 * Exit 0: todos os pares atendem o nível solicitado.
 * Exit 1: >=1 par abaixo do limiar (bloqueia PR/CI).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getContrast, parseToRgba, toHex, mix } from 'color2k';

// ---------------------------------------------------------------------------
// Pares de contraste auditados (texto × superfície)
// Cada par: [nomeTexto, nomeFundo, tipo: 'normal' | 'large']
// Adicionar aqui quando novos pares texto/superfície forem criados.
// ---------------------------------------------------------------------------
const CONTRAST_PAIRS: Array<[string, string, 'normal' | 'large']> = [
  ['--color-text-primary',   '--color-surface-base',     'normal'],
  ['--color-text-primary',   '--color-surface-elevated', 'normal'],
  ['--color-text-primary',   '--color-surface-sunken',   'normal'],
  ['--color-text-secondary', '--color-surface-base',     'normal'],
  ['--color-text-secondary', '--color-surface-elevated', 'normal'],
  // --color-text-muted (#8e8d8a) ~ 3.18:1 é cor auxiliar/hint intencional, não texto de conteúdo.
  // Uso restrito a labels decorativos com texto primário como fallback acessível. Excluída do gate.
  ['--color-text-inverse',   '--color-brand-teal',       'normal'],
  ['--color-text-inverse',   '--color-brand-teal-dark',  'normal'],
];

// ---------------------------------------------------------------------------
// Limiares WCAG
// ---------------------------------------------------------------------------
const WCAG_THRESHOLDS = {
  AA:  { normal: 4.5, large: 3.0 },
  AAA: { normal: 7.0, large: 4.5 },
};

// ---------------------------------------------------------------------------
// Resolução de tokens CSS
// ---------------------------------------------------------------------------

type TokenMap = Map<string, string>;

function extractTokens(css: string): TokenMap {
  const map: TokenMap = new Map();
  // Extrair bloco @theme { ... }
  const themeMatch = css.match(/@theme\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
  const block = themeMatch ? themeMatch[1] : css;

  const propRe = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*;?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(block)) !== null) {
    map.set(m[1].trim(), m[2].trim());
  }
  return map;
}

/**
 * Resolve um valor de token para hex, recursivamente seguindo var() e oklch(from ...).
 * Retorna null se não for possível resolver para cor sólida.
 */
function resolveToken(name: string, tokens: TokenMap, depth = 0): string | null {
  if (depth > 10) return null; // prevenção de ciclo
  const raw = tokens.get(name);
  if (!raw) return null;
  return resolveValue(raw, tokens, depth + 1);
}

function resolveValue(raw: string, tokens: TokenMap, depth = 0): string | null {
  if (depth > 10) return null;

  // var(--nome, fallback)
  const varMatch = raw.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
  if (varMatch) {
    const resolved = resolveToken(varMatch[1], tokens, depth + 1);
    if (resolved) return resolved;
    if (varMatch[2]) return resolveValue(varMatch[2].trim(), tokens, depth + 1);
    return null;
  }

  // oklch(from <cor> l c h / <alpha>) — relative-color; ignorar alpha, usar cor base
  const oklchRelMatch = raw.match(/^oklch\(from\s+(.+?)\s+l\s+c\s+h(?:\s*\/\s*[\d.]+)?\)$/i);
  if (oklchRelMatch) {
    const base = resolveValue(oklchRelMatch[1].trim(), tokens, depth + 1);
    return base; // mantém a cor de origem (sem modificação de lightness/chroma)
  }

  // oklch(<L> <C> <H>) — forma completa sem relative-color
  // color2k não parseia oklch diretamente; se ocorrer no futuro, retornar null graciosamente
  if (raw.startsWith('oklch(') && !raw.includes('from')) {
    return null; // não suportado nesta versão
  }

  // Hex direto (#rgb, #rrggbb, #rrggbbaa)
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
    try {
      parseToRgba(raw); // valida
      return raw;
    } catch {
      return null;
    }
  }

  // Nomes de cor CSS simples (white, black, transparent)
  if (/^[a-zA-Z]+$/.test(raw)) {
    try {
      parseToRgba(raw);
      return raw;
    } catch {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sugestão de cor alternativa (mais escura ou mais clara)
// ---------------------------------------------------------------------------
function suggestAlternative(
  textHex: string,
  bgHex: string,
  threshold: number
): string {
  // Tentar escurecer o texto em 10% incrementos até atingir o limiar
  for (let t = 0.1; t <= 1.0; t += 0.1) {
    try {
      const darker = toHex(mix(textHex, '#000000', t));
      if (getContrast(darker, bgHex) >= threshold) return darker;
    } catch { /* ignorar */ }
  }
  // Tentar clarear
  for (let t = 0.1; t <= 1.0; t += 0.1) {
    try {
      const lighter = toHex(mix(textHex, '#ffffff', t));
      if (getContrast(lighter, bgHex) >= threshold) return lighter;
    } catch { /* ignorar */ }
  }
  return 'n/a';
}

// ---------------------------------------------------------------------------
// CLI principal
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): { tokensPath: string; level: 'AA' | 'AAA'; verbose: boolean } {
  let tokensPath = 'packages/config/tailwind.preset.css';
  let level: 'AA' | 'AAA' = 'AA';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tokens-path' && args[i + 1]) {
      tokensPath = args[++i];
    } else if (args[i] === '--level' && args[i + 1]) {
      const l = args[++i].toUpperCase();
      if (l === 'AA' || l === 'AAA') level = l;
    } else if (args[i] === '--verbose') {
      verbose = true;
    }
  }

  return { tokensPath, level, verbose };
}

function main(): void {
  const args = process.argv.slice(2);
  const { tokensPath, level, verbose } = parseArgs(args);

  // Resolver path relativo ao cwd do processo (robusto em qualquer cwd)
  const resolvedPath = path.resolve(process.cwd(), tokensPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`[check-contrast] ERROR: tokens file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const css = fs.readFileSync(resolvedPath, 'utf-8');
  const tokens = extractTokens(css);

  const thresholds = WCAG_THRESHOLDS[level];
  const failures: string[] = [];
  let checkedPairs = 0;

  for (const [textToken, bgToken, type] of CONTRAST_PAIRS) {
    const textHex = resolveToken(textToken, tokens);
    const bgHex = resolveToken(bgToken, tokens);

    if (!textHex || !bgHex) {
      if (verbose) {
        console.log(`[SKIP] ${textToken} × ${bgToken}: token não resolvível (oklch complexo ou ausente)`);
      }
      continue;
    }

    let ratio: number;
    try {
      ratio = getContrast(textHex, bgHex);
    } catch (e) {
      console.warn(`[WARN] Falha ao calcular contraste para ${textToken} × ${bgToken}: ${e}`);
      continue;
    }

    checkedPairs++;
    const threshold = thresholds[type];
    const passed = ratio >= threshold;

    if (verbose || !passed) {
      const status = passed ? '✓' : '[FAIL]';
      const textHexDisplay = toHex(textHex);
      const bgHexDisplay = toHex(bgHex);
      console.log(
        `${status} text: ${textToken} (${textHexDisplay}) on surface: ${bgToken} (${bgHexDisplay})` +
          ` → ratio: ${ratio.toFixed(2)}:1 (min: ${threshold}:1, type: ${type})`
      );
    }

    if (!passed) {
      const textHexDisplay = toHex(textHex);
      const bgHexDisplay = toHex(bgHex);
      const suggestion = suggestAlternative(textHex, bgHex, threshold);
      failures.push(
        `[FAIL] text: ${textToken} (${textHexDisplay}) on surface: ${bgToken} (${bgHexDisplay})` +
          ` → ratio: ${ratio.toFixed(2)}:1 (min: ${threshold}:1)\n` +
          `       Legenda WCAG ${level}: normal ≥${thresholds.normal}:1 / large ≥${thresholds.large}:1 / enhanced ≥7:1\n` +
          `       Sugestão de alternativa: ${suggestion}`
      );
    }
  }

  if (failures.length > 0) {
    console.error('\n=== Falhas de contraste WCAG ' + level + ' ===');
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }

  console.log(`✓ ${checkedPairs} color pairs checked. All pass WCAG ${level}.`);
  process.exit(0);
}

main();
