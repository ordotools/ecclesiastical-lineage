#!/bin/bash

set -e

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

export DATABASE_URL="postgresql://localhost:5432/ecclesiastical_lineage_dev"

if [ ! -z "$RENDER_PRODUCTION_PG_URL" ]; then
  echo "🔄 Production database URL found, syncing database..."
  echo "   Remote (PRODUCTION): $RENDER_PRODUCTION_PG_URL"
  echo "   Local:  $DATABASE_URL"
  echo ""
  
  # Check for required tools
  command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump is required but not installed. Install with: brew install postgresql@17"; exit 1; }
  command -v psql >/dev/null 2>&1 || { echo "❌ psql is required but not installed. Install with: brew install postgresql@17"; exit 1; }
  
  # Detect local and remote version for pg_dump compatibility.
  LOCAL_PG_DUMP_VERSION=$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+')
  REMOTE_PG_VERSION="$(psql "$RENDER_PRODUCTION_PG_URL" -c 'SHOW server_version;' -At | cut -d. -f1,2)"

  if [ "$LOCAL_PG_DUMP_VERSION" != "$REMOTE_PG_VERSION" ]; then
    echo "⚠️  Version mismatch: Local pg_dump is $LOCAL_PG_DUMP_VERSION, but remote server version is $REMOTE_PG_VERSION"
    echo ""
    PG_MAJOR="${REMOTE_PG_VERSION%%.*}"

    # Try to find the matching pg_dump first
    PG_DUMP_PATH_MAC="/opt/homebrew/opt/postgresql@$REMOTE_PG_VERSION/bin/pg_dump"
    PG_DUMP_PATH_INTEL="/usr/local/opt/postgresql@$REMOTE_PG_VERSION/bin/pg_dump"
    PG_DUMP_PATH_BIN=$(brew --prefix postgresql@$REMOTE_PG_VERSION 2>/dev/null)/bin/pg_dump

    PG_DUMP_CMD=""
    if [ -x "$PG_DUMP_PATH_MAC" ]; then
      PG_DUMP_CMD="$PG_DUMP_PATH_MAC"
    elif [ -x "$PG_DUMP_PATH_INTEL" ]; then
      PG_DUMP_CMD="$PG_DUMP_PATH_INTEL"
    elif [ -x "$PG_DUMP_PATH_BIN" ]; then
      PG_DUMP_CMD="$PG_DUMP_PATH_BIN"
    fi

    if [ -n "$PG_DUMP_CMD" ]; then
      echo "✅ Matching pg_dump version found at $PG_DUMP_CMD"
      echo "The script will use this binary for the export."
      USE_PG_DUMP="$PG_DUMP_CMD"
    else
      echo "❌ Could not find a matching pg_dump binary (v$REMOTE_PG_VERSION) automatically."
      echo "Please install it. On Mac (Homebrew), run:"
      echo "  brew install postgresql@$PG_MAJOR"
      echo ""
      echo "Then re-run this script."
      exit 1
    fi

    # Overwrite pg_dump in PATH for this script only
    export PATH="$(dirname "$PG_DUMP_CMD"):$PATH"
    # Double check version now
    FIXED_PG_DUMP_VERSION=$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+')
    if [ "$FIXED_PG_DUMP_VERSION" != "$REMOTE_PG_VERSION" ]; then
      echo "❌ Even after setting PATH, pg_dump version is still $FIXED_PG_DUMP_VERSION (expected $REMOTE_PG_VERSION)"
      echo "This can happen if your shell or Homebrew did not symlink binaries correctly."
      echo "Try manually specifying the full path to pg_dump or add it to your PATH before running this script."
      echo ""
      echo "For example:"
      echo "  export PATH=\"$(dirname "$PG_DUMP_CMD"):\$PATH\""
      echo "  ./localstartup.sh"
      echo ""
      exit 1
    else
      echo "✅ pg_dump is now the correct version ($FIXED_PG_DUMP_VERSION) in this shell session."
    fi
  fi
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

  echo "📤 Exporting data from PRODUCTION PostgreSQL..."
  pg_dump --clean --if-exists --no-owner --no-privileges "$REMOTE_DATABASE_URL" > /tmp/remote_dump.sql

  echo "📥 Importing data to local PostgreSQL..."
  psql "$LOCAL_PG_URL" < /tmp/remote_dump.sql

  rm -f /tmp/remote_dump.sql

  echo "✅ Database sync from PRODUCTION completed successfully!"
else
  exit 1
fi

echo "   Server will be available at: http://localhost:5001"
echo "   Login with: admin/admin123"

flask db upgrade;

python3 app.py --port 5001