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

# Initialize the database with tables
echo "Initializing database tables..."
source env/bin/activate
python3 init_db.py

# Use pg_dump to export data, then import to SQLite
echo "Exporting data from PostgreSQL..."
/opt/homebrew/opt/postgresql@16/bin/pg_dump --data-only --column-inserts $RENDER_PG_URL > /tmp/pg_dump.sql

echo "Importing data to SQLite..."
# Create a simple Python script to import the data
source env/bin/activate
python3 -c "
import sqlite3
import re

# Connect to SQLite database
conn = sqlite3.connect('$LOCAL_SQLITE_DB')
cursor = conn.cursor()

# Read the pg_dump file
with open('/tmp/pg_dump.sql', 'r') as f:
    content = f.read()

# Extract INSERT statements
insert_pattern = r'INSERT INTO (\w+) \(([^)]+)\) VALUES\s*([^;]+);'
matches = re.findall(insert_pattern, content, re.IGNORECASE | re.DOTALL)

for table_name, columns, values in matches:
    print(f'Processing table: {table_name}')
    
    # Clean up the values
    values = values.strip()
    if values.startswith('(') and values.endswith(')'):
        values = values[1:-1]
    
    # Split multiple value sets
    value_sets = re.split(r'\),\s*\(', values)
    
    for value_set in value_sets:
        if value_set.startswith('('):
            value_set = value_set[1:]
        if value_set.endswith(')'):
            value_set = value_set[:-1]
        
        # Create the INSERT statement
        insert_sql = f'INSERT OR REPLACE INTO {table_name} ({columns}) VALUES ({value_set});'
        try:
            cursor.execute(insert_sql)
        except Exception as e:
            print(f'  Error inserting into {table_name}: {e}')

conn.commit()
conn.close()
print('Data import completed!')
"

# Clean up temporary files
rm -f /tmp/pg_dump.sql

# Clean up
echo "Local SQLite database ($LOCAL_SQLITE_DB) updated from remote PostgreSQL." 