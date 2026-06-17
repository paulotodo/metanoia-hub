#!/usr/bin/env bash
# check-i18n-scf.sh — Gate SC-F: detectar strings hardcoded fora do i18n nos formulários
#
# Task 3.3 — feature a11y-formularios
# Ref: CHK024, dec-023
#
# Strings proibidas: textos de UI hardcoded em português nos forms (devem vir de pt-BR.json)
# Saída vazia = aprovado (SC-F verde)
# Saída com linhas = reprovado (strings hardcoded detectadas)
#
# Uso: bash scripts/check-i18n-scf.sh [--strict]
# --strict: exit 1 se qualquer string hardcoded for encontrada (para uso em CI)

set -euo pipefail

STRICT=false
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=true ;;
  esac
done

# Diretórios alvo
SEARCH_DIRS=(
  "apps/web/app/(public)"
  "apps/web/src/components/forms"
  "apps/web/src/components/groups"
  "apps/web/src/components/marketing"
  "apps/web/src/components/onboarding"
)

# Strings hardcoded proibidas (textos que devem estar em pt-BR.json)
PATTERNS=(
  '"Enviando"'
  '"Salvar"'
  '"Enviar"'
  '"Campo obrigatório"'
  '"E-mail inválido"'
  '"Senha obrigatória"'
  '"Confirmar senha"'
  '"Carregando\.\.\."'
)

# Construir argumento grep
GREP_ARGS=()
for pat in "${PATTERNS[@]}"; do
  GREP_ARGS+=("-e" "$pat")
done

# Construir lista de dirs existentes
EXISTING_DIRS=()
for dir in "${SEARCH_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    EXISTING_DIRS+=("$dir")
  fi
done

if [ ${#EXISTING_DIRS[@]} -eq 0 ]; then
  echo "AVISO: nenhum diretório de busca encontrado. Executar da raiz do projeto."
  exit 0
fi

# Executar grep
RESULT=$(grep -rn --include="*.tsx" "${GREP_ARGS[@]}" "${EXISTING_DIRS[@]}" 2>/dev/null || true)

if [ -z "$RESULT" ]; then
  echo "SC-F: APROVADO — nenhuma string hardcoded detectada nos formulários."
  exit 0
else
  echo "SC-F: REPROVADO — strings hardcoded detectadas:"
  echo "$RESULT"
  if [ "$STRICT" = "true" ]; then
    exit 1
  fi
  exit 0
fi
