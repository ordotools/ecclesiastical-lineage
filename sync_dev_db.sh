#!/bin/bash
# sync_dev_db.sh
# Sync local PostgreSQL database with remote database for development
# This script only syncs the database, doesn't start the server

set -e

echo "🔄 Syncing Local Development Database"
echo "=" * 50

# Load environment variables from .env if present
if [ -f .env ]; then
  echo "📄 Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Check if RENDER_PG_URL is set for remote sync
if [ -z "$RENDER_PG_URL" ]; then
  echo "❌ Error: RENDER_PG_URL environment variable not set."
  echo "Please set it in your .env file to your remote PostgreSQL connection string."
  echo "Example: RENDER_PG_URL=postgresql://user:pass@host:port/dbname"
  echo ""
  echo "You can get this from your Render dashboard or from the production environment."
  exit 1
fi

# Use RENDER_PG_URL for syncing from remote
REMOTE_DATABASE_URL="$RENDER_PG_URL"

# Check for required tools
echo "🔍 Checking required tools..."
command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump is required but not installed. Install with: brew install postgresql@16"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ psql is required but not installed. Install with: brew install postgresql@16"; exit 1; }
echo "✅ All required tools are available"

# Check if PostgreSQL is running locally
echo "🔍 Checking PostgreSQL status..."
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
echo "✅ PostgreSQL is running"

# Configuration
LOCAL_DB_NAME="ecclesiastical_lineage_dev"
LOCAL_PG_URL="postgresql://localhost:5432/$LOCAL_DB_NAME"

echo ""
echo "🔄 Database Sync Configuration:"
echo "   Remote: $REMOTE_DATABASE_URL"
echo "   Local:  $LOCAL_PG_URL"
echo ""

# Confirm sync operation
read -p "This will OVERWRITE your local database '$LOCAL_DB_NAME' with data from the remote database. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "❌ Aborted."
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
echo "📊 Local database is now synchronized with remote:"
echo "   Database: $LOCAL_DB_NAME"
echo "   Connection: $LOCAL_PG_URL"
echo ""
echo "🎯 Next steps:"
echo "   - Run './start_dev.sh' to start the development server"
echo "   - Or run 'python3 app.py --port 5001' manually"
echo "   - Login with admin/admin123" 