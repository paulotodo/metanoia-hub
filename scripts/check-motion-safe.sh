#!/usr/bin/env bash
# check-motion-safe.sh — Scan estático de motion não-guardado
#
# Detecta classes `animate-*` e `transition-*` sem prefixo `motion-safe:` em
# arquivos TSX/TS da aplicação, garantindo conformidade com FR-3.1/FR-3.5 e
# WCAG 2.5.3 (prefers-reduced-motion).
#
# Isenções documentadas (FR-3.5 / dec-007):
#   - animate-spin  → loader essencial sem alternativa não-animada
#                     deve ter comentário {/* motion-essential: ... */}
#   - duration-*    → apenas duração, não anima nada (data-[state] sem motion-safe é correto)
#   - transition-*  em packages/ui/styles/globals.css safety-net block
#                   (@media (prefers-reduced-motion: reduce)) → escopo próprio
#
# Uso:
#   bash scripts/check-motion-safe.sh             → exit 1 com findings, exit 0 se OK
#   bash scripts/check-motion-safe.sh --warn      → sempre exit 0 (modo warn, para CI não-bloqueante)
#   bash scripts/check-motion-safe.sh --ci        → saída concisa para CI
#
# Ref: spec a11y-touch-motion §T.4, plan §SC-3.2, FR-3.5

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- Flags ---
WARN_MODE=false
CI_MODE=false
for arg in "$@"; do
  case "$arg" in
    --warn) WARN_MODE=true ;;
    --ci)   CI_MODE=true ;;
  esac
done

# --- Escopo de busca ---
# Apenas código de aplicação; excluir:
#   - packages/ui/styles/globals.css (safety-net block usa @media diretamente)
#   - node_modules, .next, dist, .turbo, .claude
SCAN_DIRS=(
  "$REPO_ROOT/apps/web/src"
  "$REPO_ROOT/packages/ui/components"
)

# --- Padrões de animate-* bare (sem motion-safe:) ---
# Detecta classes que iniciam com animate- mas NÃO com motion-safe:animate-
# e NÃO são animate-spin (isenção documentada)
ANIMATE_PATTERN='(^|[^-a-zA-Z:])animate-(in|out|fade|zoom|slide|bounce|pulse|ping|spin)'

# --- Padrões de transition-* bare (sem motion-safe:) ---
# Detecta transition-colors, transition-opacity, transition-all, transition-transform
# quando aparecem como classe isolada (sem prefixo motion-safe:)
TRANSITION_PATTERN='(^|[[:space:]"])(transition-(colors|opacity|all|transform))'

# --- Isenções: padrões que NÃO são falso-positivo ---
# motion-safe:animate-* → já guardado → OK
# motion-safe:transition-* → já guardado → OK
# animate-spin → loader essencial documentado como isenção
# data-[state=...]:motion-safe: → correto
EXEMPT_ANIMATE_SPIN='animate-spin'

# --- Contadores ---
FINDINGS=0

print_header() {
  if [ "$CI_MODE" = false ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║  check-motion-safe.sh — Scan de motion não-guardado             ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
  fi
}

print_finding() {
  local file="$1" line="$2" content="$3" type="$4"
  FINDINGS=$((FINDINGS + 1))
  local relpath="${file#$REPO_ROOT/}"
  if [ "$CI_MODE" = true ]; then
    echo "FINDING|warn|motion-not-guarded|${relpath}:${line}|${type}: ${content}"
  else
    echo "  ⚠  ${relpath}:${line}"
    echo "     ${type}"
    echo "     → ${content}"
    echo ""
  fi
}

scan_animate() {
  local dir="$1"
  # Busca animate-in/out/fade/zoom/slide/bounce/pulse/ping em TSX/TS
  # Exclui: motion-safe:animate-* (já guardado) e animate-spin (isenção)
  while IFS=: read -r file line content; do
    # Pular se linha contém motion-safe:animate (já guardado)
    if printf '%s' "$content" | grep -qE 'motion-safe:animate-'; then
      continue
    fi
    # Pular animate-spin (isenção documentada — loader essencial)
    if printf '%s' "$content" | grep -qE '\banimate-spin\b' && \
       ! printf '%s' "$content" | grep -qE 'animate-(in|out|fade|zoom|slide|bounce|pulse|ping)'; then
      continue
    fi
    # Pular animate-pulse/ping quando há comentário motion-essential na mesma linha ou arquivo
    # (detectado pela presença do token motion-essential no bloco do arquivo)
    if printf '%s' "$content" | grep -qE '\banimate-pulse\b|\banimate-ping\b'; then
      # Verificar se há comentário de isenção motion-essential no arquivo próximo (±3 linhas)
      local linenum=$line
      local ctx_start=$(( linenum > 3 ? linenum - 3 : 1 ))
      if sed -n "${ctx_start},${linenum}p" "$file" | grep -q 'motion-essential'; then
        continue
      fi
    fi
    print_finding "$file" "$line" "$(printf '%s' "$content" | xargs)" "animate-* sem motion-safe:"
  done < <(
    grep -rn --include='*.tsx' --include='*.ts' \
      -E 'animate-(in|out|fade|zoom|slide|bounce|pulse|ping)' \
      "$dir" 2>/dev/null || true
  )
}

scan_transition() {
  local dir="$1"
  # Busca transition-colors/opacity/all/transform em TSX/TS
  # Exclui: motion-safe:transition-* (já guardado)
  while IFS=: read -r file line content; do
    # Pular se linha contém motion-safe:transition (já guardado)
    if printf '%s' "$content" | grep -qE 'motion-safe:transition-'; then
      continue
    fi
    # Pular comentários (linhas que começam com // ou /*)
    if printf '%s' "$content" | grep -qE '^\s*(//|/\*)'; then
      continue
    fi
    print_finding "$file" "$line" "$(printf '%s' "$content" | xargs)" "transition-* sem motion-safe:"
  done < <(
    grep -rn --include='*.tsx' --include='*.ts' \
      -E '(^|[[:space:]"'"'"'`])(transition-(colors|opacity|all|transform))([[:space:]"'"'"'`]|$)' \
      "$dir" 2>/dev/null || true
  )
}

# --- Main ---
print_header

for dir in "${SCAN_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    continue
  fi
  scan_animate "$dir"
  scan_transition "$dir"
done

# --- Resultado ---
if [ "$FINDINGS" -eq 0 ]; then
  if [ "$CI_MODE" = true ]; then
    echo "check-motion-safe: OK (0 findings)"
  else
    echo "  ✓ Nenhum motion não-guardado encontrado (0 findings)"
    echo ""
  fi
  exit 0
else
  if [ "$CI_MODE" = true ]; then
    echo "check-motion-safe: ${FINDINGS} finding(s)"
  else
    echo "  Total: ${FINDINGS} finding(s)"
    echo ""
    echo "  Para cada finding:"
    echo "    - Adicionar prefixo motion-safe: na classe"
    echo "    - OU documentar isenção com {/* motion-essential: <motivo> */}"
    echo ""
  fi
  if [ "$WARN_MODE" = true ]; then
    # Modo warn: reporta mas não bloqueia
    exit 0
  else
    exit 1
  fi
fi
