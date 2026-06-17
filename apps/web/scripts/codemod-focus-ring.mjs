#!/usr/bin/env node
/**
 * codemod-focus-ring.mjs — Substitui variantes obsoletas de focus-ring
 * pelo token canônico `ring-brand-teal/30`.
 *
 * Ref: spec §US-3/SC-3.3, plan §C2/C3, CHK008, CHK020
 * dec-020: ring-primary também é substituído (CHK025 resolvido)
 *
 * Uso:
 *   node apps/web/scripts/codemod-focus-ring.mjs --dry-run   (lista candidatos)
 *   node apps/web/scripts/codemod-focus-ring.mjs --apply     (aplica substituições)
 *
 * Substituições automáticas (seguras — sem revisão manual):
 *   ring-interactive-focus  →  ring-brand-teal/30
 *   ring-ring               →  ring-brand-teal/30
 *   ring-[var(--ring)]      →  ring-brand-teal/30
 *   ring-[var(--color-brand-teal)]  →  ring-brand-teal/30
 *   ring-primary            →  ring-brand-teal/30
 *
 * Preservações (NÃO substituir — hardcoded):
 *   ring-red-500 / ring-red-*        (semântica de erro/destrutivo)
 *   ring-brand-primary/30            (estado selecionado em wizard, não foco)
 *   ring-blue-500                    (revisar manualmente)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const SRC_DIR = join(PROJECT_ROOT, 'apps', 'web', 'src');

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run';

// ── Padrões de substituição (ordem importa — mais específico primeiro)
const SUBSTITUTIONS = [
  // Variante com colchetes: ring-[var(--ring)]
  {
    pattern: /\bring-\[var\(--ring\)\]/g,
    replacement: 'ring-brand-teal/30',
    label: 'ring-[var(--ring)]',
  },
  // Variante com colchetes: ring-[var(--color-brand-teal)]
  {
    pattern: /\bring-\[var\(--color-brand-teal\)\]/g,
    replacement: 'ring-brand-teal/30',
    label: 'ring-[var(--color-brand-teal)]',
  },
  // ring-interactive-focus (token semântico obsoleto)
  {
    pattern: /\bring-interactive-focus\b/g,
    replacement: 'ring-brand-teal/30',
    label: 'ring-interactive-focus',
  },
  // ring-ring (alias shadcn que aponta para --ring)
  // ATENÇÃO: não substituir ring-red, ring-brand-primary, ring-blue dentro desta regra
  {
    pattern: /\bring-ring\b/g,
    replacement: 'ring-brand-teal/30',
    label: 'ring-ring',
  },
  // ring-primary → ring-brand-teal/30 (dec-020: CHK025 resolvido)
  {
    pattern: /\bring-primary\b/g,
    replacement: 'ring-brand-teal/30',
    label: 'ring-primary',
  },
];

// ── Padrões EXCLUÍDOS (não tocar — verificados antes de aplicar substituição)
const EXCLUSION_PATTERNS = [
  /\bring-red-\w+/,          // semântica de erro/destrutivo
  /\bring-brand-primary/,    // estado selecionado em wizard
  /\bring-blue-\d+/,         // requer revisão manual
];

// ── Extensões alvo
const TARGET_EXTENSIONS = ['.tsx', '.ts', '.css', '.jsx', '.js'];

// ── Coletar arquivos recursivamente
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (TARGET_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// ── Verificar se uma linha contém padrão excluído
function lineHasExclusion(line) {
  return EXCLUSION_PATTERNS.some(p => p.test(line));
}

// ── Processar um arquivo
function processFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const changes = [];
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    let currentLine = originalLine;

    if (lineHasExclusion(originalLine)) {
      // Linha tem padrão excluído — não tocar
      newLines.push(originalLine);
      continue;
    }

    for (const { pattern, replacement, label } of SUBSTITUTIONS) {
      // Verificar se o padrão existe antes de substituir
      const matchCount = (currentLine.match(pattern) || []).length;
      if (matchCount > 0) {
        const newLine = currentLine.replace(pattern, replacement);
        if (newLine !== currentLine) {
          changes.push({
            line: i + 1,
            label,
            before: originalLine.trim(),
            after: newLine.trim(),
            count: matchCount,
          });
          currentLine = newLine;
        }
      }
    }

    newLines.push(currentLine);
  }

  return { changes, newContent: newLines.join('\n'), changed: changes.length > 0 };
}

// ── Main
const files = collectFiles(SRC_DIR);

let totalFiles = 0;
let totalSubstitutions = 0;
const report = [];

for (const filePath of files) {
  const { changes, newContent, changed } = processFile(filePath);

  if (!changed) continue;

  totalFiles++;
  totalSubstitutions += changes.length;
  const relPath = relative(PROJECT_ROOT, filePath);
  report.push({ file: relPath, changes });

  if (MODE === 'apply') {
    writeFileSync(filePath, newContent, 'utf8');
  }
}

// ── Relatório
console.log(`\n=== codemod-focus-ring [${MODE}] ===\n`);
console.log(`Arquivos com candidatos: ${totalFiles}`);
console.log(`Total de substituições: ${totalSubstitutions}\n`);

for (const { file, changes } of report) {
  console.log(`\n📄 ${file} (${changes.length} substituição${changes.length > 1 ? 'ões' : ''})`);
  for (const c of changes) {
    console.log(`  L${c.line} [${c.label}] (${c.count}×)`);
    console.log(`    - ${c.before}`);
    console.log(`    + ${c.after}`);
  }
}

// ── Casos de exclusão detectados (para log manual)
const exclusionReport = [];
for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (lineHasExclusion(line)) {
      for (const p of EXCLUSION_PATTERNS) {
        if (p.test(line)) {
          exclusionReport.push({ file: relative(PROJECT_ROOT, filePath), line: i + 1, content: line.trim() });
        }
      }
    }
  }
}

if (exclusionReport.length > 0) {
  console.log('\n⚠️  CASOS PRESERVADOS (exclusão hardcoded — revisão manual recomendada):');
  for (const { file, line, content } of exclusionReport) {
    console.log(`  ${file}:${line}  ${content}`);
  }
}

if (MODE === 'apply') {
  console.log(`\n✅ Substituições aplicadas em ${totalFiles} arquivo(s).`);
} else {
  console.log(`\n[dry-run] Nenhum arquivo modificado. Use --apply para aplicar.`);
}
