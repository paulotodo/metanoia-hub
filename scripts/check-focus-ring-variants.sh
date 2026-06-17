#!/usr/bin/env bash
# check-focus-ring-variants.sh — Lint guardian para variantes obsoletas de focus-ring
#
# Detecta uso de tokens de focus-ring não-canônicos em apps/web/src.
# Token canônico: ring-brand-teal/30 (com focus-visible:ring-2 focus-visible:ring-offset-2)
#
# NOTA: packages/ui/components/ (shadcn gerados) usa ring-[var(--ring)] intencionalmente —
#   --ring é o token bridge shadcn que mapeia para brand-teal via globals.css.
#   Esses arquivos são excluídos do escopo deste guard (gerenciados pelo codemod).
#
# Ref: spec §US-3/SC-3.3, plan §C2/CHK011, feature a11y-contraste-focus task 3.2.6
#
# Uso:
#   bash scripts/check-focus-ring-variants.sh        → retorna exit 1 se variantes proibidas
#   bash scripts/check-focus-ring-variants.sh --ci   → saída mais concisa para CI

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Escopo: apenas apps/web/src (excluindo packages/ui/components que usam ring-[var(--ring)]
# como bridge shadcn canônico — valor efetivo = brand-teal via --ring em globals.css)
SRC_DIRS=(
  "$REPO_ROOT/apps/web/src"
)

# Padrões proibidos em código de aplicação (regex grep -E)
PATTERNS=(
  'ring-interactive-focus'
  'ring-ring\b'
  'ring-\[var\(--ring'
  'ring-\[var\(--color-brand-teal\)\]'
  'ring-primary\b'
)

CI_MODE=false
[[ "${1:-}" == "--ci" ]] && CI_MODE=true

TOTAL_HITS=0
FOUND_FILES=()

for dir in "${SRC_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  for pattern in "${PATTERNS[@]}"; do
    while IFS= read -r line; do
      # Ignorar linhas de comentário (// e /* e #)
      if echo "$line" | grep -qE ':[[:space:]]*(//|/\*|\*)'; then
        continue
      fi
      TOTAL_HITS=$((TOTAL_HITS + 1))
      FOUND_FILES+=("$line")
    done < <(grep -rn --include="*.tsx" --include="*.ts" --include="*.css" -E "$pattern" "$dir" 2>/dev/null || true)
  done
done

if [[ $TOTAL_HITS -eq 0 ]]; then
  if $CI_MODE; then
    echo "focus-ring-guard: OK (0 variantes proibidas em apps/web/src)"
  else
    echo "check-focus-ring-variants: nenhuma variante proibida encontrada em apps/web/src"
  fi
  exit 0
fi

echo "ERRO: check-focus-ring-variants: $TOTAL_HITS variante(s) proibida(s) de focus-ring em apps/web/src"
echo ""
echo "Variantes proibidas (usar ring-brand-teal/30 com focus-visible:ring-2 ring-offset-2):"
for line in "${FOUND_FILES[@]}"; do
  echo "  $line"
done
echo ""
echo "Para corrigir: node apps/web/scripts/codemod-focus-ring.mjs --apply"
exit 1
