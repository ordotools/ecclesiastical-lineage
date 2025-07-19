#!/bin/bash
# sync_remote_to_local.sh
# Sync entire remote PostgreSQL database to local PostgreSQL database for development.
# This script NEVER writes to the remote database.

set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# --- CONFIGURATION ---
REMOTE_DATABASE_URL="${DATABASE_URL:-}"
LOCAL_DB_NAME="ecclesiastical_lineage_dev"
LOCAL_PG_URL="postgresql://localhost:5432/$LOCAL_DB_NAME"

# Check for required tools
command -v pg_dump >/dev/null 2>&1 || { echo >&2 "pg_dump is required but not installed. Install with: brew install postgresql@16"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo >&2 "psql is required but not installed. Install with: brew install postgresql@16"; exit 1; }

# Check if PostgreSQL is running locally
if ! pg_isready -q -h localhost; then
  echo "⚠️  PostgreSQL is not running locally. Starting it..."
  brew services start postgresql@16
  sleep 3
  
  if ! pg_isready -q -h localhost; then
    echo "❌ Failed to start PostgreSQL. Please start it manually:"
    echo "   brew services start postgresql@16"
    exit 1
  fi
fi

if [ -z "$REMOTE_DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable not set."
  echo "Please set it in your .env file to your remote PostgreSQL connection string."
  echo "Example: DATABASE_URL=postgresql://user:pass@host:port/dbname"
  exit 1
fi

# Confirm with user
echo ""
echo "🔄 This will sync your local PostgreSQL database with the remote database."
echo "   Remote: $REMOTE_DATABASE_URL"
echo "   Local:  $LOCAL_PG_URL"
echo ""
read -p "This will OVERWRITE your local database '$LOCAL_DB_NAME'. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🔄 Starting database sync..."

# Drop and recreate the local database
echo "🗑️  Dropping local database..."
dropdb --if-exists "$LOCAL_DB_NAME" 2>/dev/null || true

echo "📊 Creating local database..."
createdb "$LOCAL_DB_NAME"

# Export from remote and import to local
echo "📤 Exporting data from remote PostgreSQL..."
pg_dump --clean --if-exists --no-owner --no-privileges "$REMOTE_DATABASE_URL" > /tmp/remote_dump.sql

echo "📥 Importing data to local PostgreSQL..."
psql "$LOCAL_PG_URL" < /tmp/remote_dump.sql

# Clean up
rm -f /tmp/remote_dump.sql

echo ""
echo "✅ Database sync completed successfully!"
echo ""
echo "🌐 Local database is ready at: $LOCAL_PG_URL"
echo ""
echo "🎯 To use this database, make sure your .env file has:"
echo "   DATABASE_URL=postgresql://localhost:5432/$LOCAL_DB_NAME"
echo ""
echo "🚀 Start the development server:"
echo "   ./dev_start.sh" 