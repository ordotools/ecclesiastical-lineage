#!/bin/bash
# sync_local_db.sh
# Safely sync local SQLite database with remote PostgreSQL (Render) for development.
# This script NEVER writes to the remote database.

set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# --- CONFIGURATION ---
# Set your Render PostgreSQL URL here or export it as an environment variable
RENDER_PG_URL="${RENDER_PG_URL:-}"  # e.g. postgres://user:pass@host:port/dbname
LOCAL_SQLITE_DB="instance/ecclesiastical_lineage.db"

# Check for required tools
command -v pgloader >/dev/null 2>&1 || { echo >&2 "pgloader is required but not installed. Install with: brew install pgloader"; exit 1; }

if [ -z "$RENDER_PG_URL" ]; then
  echo "Error: RENDER_PG_URL environment variable not set."
  echo "Set it with: export RENDER_PG_URL=postgres://user:pass@host:port/dbname"
  exit 1
fi

# Confirm with user
read -p "This will OVERWRITE your local SQLite database at $LOCAL_SQLITE_DB with data from the remote PostgreSQL. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Remove old local DB if exists
if [ -f "$LOCAL_SQLITE_DB" ]; then
  rm "$LOCAL_SQLITE_DB"
fi

# Create pgloader load script
tmpfile=$(mktemp)
cat > "$tmpfile" <<EOF
LOAD DATABASE
     FROM $RENDER_PG_URL
     INTO sqlite:///$LOCAL_SQLITE_DB
     WITH data only
     SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# Run pgloader
pgloader "$tmpfile"

# Clean up
echo "Local SQLite database ($LOCAL_SQLITE_DB) updated from remote PostgreSQL."
rm "$tmpfile" 