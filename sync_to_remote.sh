#!/bin/bash
# sync_to_remote.sh
# Sync local PostgreSQL database TO remote PostgreSQL (Render).
# WARNING: This will OVERWRITE the remote database!

set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# --- CONFIGURATION ---
RENDER_PG_URL="${RENDER_PG_URL:-}"
LOCAL_DB_NAME="ecclesiastical_lineage_dev"

# Check for required tools
command -v pg_dump >/dev/null 2>&1 || { echo >&2 "pg_dump is required but not installed. Install with: brew install postgresql@16"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo >&2 "psql is required but not installed. Install with: brew install postgresql@16"; exit 1; }

if [ -z "$RENDER_PG_URL" ]; then
  echo "Error: RENDER_PG_URL environment variable not set."
  echo "Set it with: export RENDER_PG_URL=postgresql://user:pass@host:port/dbname"
  exit 1
fi

# Confirm with user - this is destructive!
echo "⚠️  WARNING: This will OVERWRITE your remote PostgreSQL database!"
echo "   Remote URL: $RENDER_PG_URL"
echo "   Local database: $LOCAL_DB_NAME"
echo ""
read -p "Are you sure you want to overwrite the remote database? Type 'YES' to confirm: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "Aborted."
  exit 0
fi

echo "🔄 Syncing from local PostgreSQL to remote PostgreSQL..."

# Export from local and import to remote
echo "📤 Exporting data from local PostgreSQL..."
pg_dump --clean --if-exists --no-owner --no-privileges "$LOCAL_DB_NAME" > /tmp/local_dump.sql

echo "📥 Importing data to remote PostgreSQL..."
psql "$RENDER_PG_URL" < /tmp/local_dump.sql

# Clean up
rm -f /tmp/local_dump.sql

echo "✅ Remote PostgreSQL database updated from local PostgreSQL."
echo ""
echo "🌐 Your production site should now have the same data as your local development environment." 