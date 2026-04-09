#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RLS_DIR="$SCRIPT_DIR/../prisma/rls"

# Load env from root .env if DATABASE_URL not set
if [ -z "${DATABASE_URL:-}" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/../../../.env"
fi

# Extract connection details from DATABASE_URL
DB_USER="${POSTGRES_USER:-metanoia}"
DB_NAME="${POSTGRES_DB:-metanoia_dev}"

echo "Applying RLS policies..."
for sql_file in "$RLS_DIR"/*.sql; do
  echo "  -> $(basename "$sql_file")"
  # Use psql if available locally, otherwise use Docker container
  if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f "$sql_file"
  else
    docker exec -i metanoia-postgres psql -U "$DB_USER" -d "$DB_NAME" < "$sql_file"
  fi
done
echo "RLS policies applied successfully."
