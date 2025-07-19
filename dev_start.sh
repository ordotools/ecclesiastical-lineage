#!/bin/bash
# dev_start.sh
# Sync local PostgreSQL DB from remote PostgreSQL, then start Flask development server.

set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable not set."
  echo "Please set it in your .env file to your PostgreSQL connection string."
  echo "For local development, you can use: DATABASE_URL=postgresql://localhost:5432/ecclesiastical_lineage_dev"
  exit 1
fi

# Check if we want to sync from remote
echo ""
echo "Choose startup option:"
echo "1) Sync from remote PostgreSQL (recommended for production-like data)"
echo "2) Start with current local database"
read -p "Enter choice (1 or 2): " choice

case $choice in
  1)
    echo "🔄 Syncing from remote PostgreSQL..."
    ./sync_postgres_local.sh
    ;;
  2)
    echo "🚀 Starting with current local database..."
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

# Start the Flask development server
export FLASK_APP=app.py
export FLASK_ENV=development
python3 app.py --port 5001 