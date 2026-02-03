#!/bin/bash
# Start development server with local database synced from PRODUCTION
# Use this script when you need the most up-to-date production data

set -e

echo "🚀 Starting Development Server (Production Data)"
echo "================================================"

# Load environment variables from .env if present
if [ -f .env ]; then
  echo "📄 Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Set local database URL
export DATABASE_URL="postgresql://localhost:5432/ecclesiastical_lineage_dev"

echo "📊 Using local database: $DATABASE_URL"
echo ""

# Check if we should sync from production database
if [ ! -z "$RENDER_PRODUCTION_PG_URL" ]; then
  echo "🔄 Production database URL found, syncing database..."
  echo "   Remote (PRODUCTION): $RENDER_PRODUCTION_PG_URL"
  echo "   Local:  $DATABASE_URL"
  echo ""
  
  # Check for required tools
  command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump is required but not installed. Install with: brew install postgresql@17"; exit 1; }
  command -v psql >/dev/null 2>&1 || { echo "❌ psql is required but not installed. Install with: brew install postgresql@17"; exit 1; }
  
  # Check if PostgreSQL is running locally
  echo "🔍 Checking PostgreSQL status..."
  if ! pg_isready -q -h localhost; then
    echo "⚠️  PostgreSQL is not running locally. Starting it..."
    brew services start postgresql@17
    sleep 3
    
    if ! pg_isready -q -h localhost; then
      echo "❌ Failed to start PostgreSQL. Please start it manually:"
      echo "   brew services start postgresql@17"
      exit 1
    fi
  fi
  echo "✅ PostgreSQL is running"
  
  # Configuration
  LOCAL_DB_NAME="ecclesiastical_lineage_dev"
  LOCAL_PG_URL="postgresql://localhost:5432/$LOCAL_DB_NAME"
  REMOTE_DATABASE_URL="$RENDER_PRODUCTION_PG_URL"
  
  echo ""
  echo "🔄 Syncing database from PRODUCTION..."
  
  # Drop and recreate the local database
  echo "🗑️  Terminating connections to local database..."
  psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LOCAL_DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
  
  echo "🗑️  Dropping local database..."
  if dropdb --if-exists "$LOCAL_DB_NAME"; then
      echo "✅ Local database dropped successfully"
  else
      echo "⚠️  Database may not have existed or was already dropped"
  fi
  
  echo "📊 Creating local database..."
  if createdb "$LOCAL_DB_NAME"; then
      echo "✅ Local database created successfully"
  else
      echo "❌ Failed to create local database"
      exit 1
  fi
  
  # Export from remote and import to local
  echo "📤 Exporting data from PRODUCTION PostgreSQL..."
  pg_dump --clean --if-exists --no-owner --no-privileges "$REMOTE_DATABASE_URL" > /tmp/remote_dump.sql
  
  echo "📥 Importing data to local PostgreSQL..."
  psql "$LOCAL_PG_URL" < /tmp/remote_dump.sql
  
  # Clean up
  rm -f /tmp/remote_dump.sql
  
  echo "✅ Database sync from PRODUCTION completed successfully!"
  echo ""
else
  echo "❌ No RENDER_PRODUCTION_PG_URL found!"
  echo "   This script requires RENDER_PRODUCTION_PG_URL in your .env file"
  echo "   to sync from the production database."
  echo ""
  echo "   Add to your .env file:"
  echo "   RENDER_PRODUCTION_PG_URL=postgresql://user:password@host:port/database"
  echo ""
  exit 1
fi

# Start the Flask application
echo "🌐 Starting Flask development server..."
echo "   Server will be available at: http://localhost:5001"
echo "   Login with: admin/admin123"
echo ""

python3 app.py --port 5001

