#!/bin/bash
# sync_postgres_local.sh
# Sync local PostgreSQL database with remote PostgreSQL (Render) for development.
# This script NEVER writes to the remote database.

set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# --- CONFIGURATION ---
RENDER_PG_URL="${RENDER_PG_URL:-}"
LOCAL_DB_NAME="ecclesiastical_lineage_dev"
LOCAL_PG_URL="postgresql://localhost:5432/$LOCAL_DB_NAME"

# Check for required tools
command -v pg_dump >/dev/null 2>&1 || { echo >&2 "pg_dump is required but not installed. Install with: brew install postgresql@16"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo >&2 "psql is required but not installed. Install with: brew install postgresql@16"; exit 1; }

if [ -z "$RENDER_PG_URL" ]; then
  echo "Error: RENDER_PG_URL environment variable not set."
  echo "Set it with: export RENDER_PG_URL=postgresql://user:pass@host:port/dbname"
  exit 1
fi

# Confirm with user
read -p "This will OVERWRITE your local PostgreSQL database '$LOCAL_DB_NAME' with data from the remote PostgreSQL. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "🔄 Syncing from remote PostgreSQL to local PostgreSQL..."

# Drop and recreate the local database
echo "🗑️  Dropping local database..."
dropdb --if-exists "$LOCAL_DB_NAME" 2>/dev/null || true

echo "📊 Creating local database..."
createdb "$LOCAL_DB_NAME"

# Export from remote and import to local
echo "📤 Exporting data from remote PostgreSQL..."
/opt/homebrew/opt/postgresql@16/bin/pg_dump --clean --if-exists --no-owner --no-privileges "$RENDER_PG_URL" > /tmp/remote_dump.sql

echo "📥 Importing data to local PostgreSQL..."
psql "$LOCAL_PG_URL" < /tmp/remote_dump.sql

# Clean up
rm -f /tmp/remote_dump.sql

echo "✅ Local PostgreSQL database ($LOCAL_DB_NAME) updated from remote PostgreSQL."
echo ""
echo "🌐 To use this database, set in your .env file:"
echo "   DATABASE_URL=postgresql://localhost:5432/$LOCAL_DB_NAME" 