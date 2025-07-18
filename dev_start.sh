#!/bin/bash
# dev_start.sh
# Sync local SQLite DB from remote PostgreSQL, then start Flask development server.

set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Sync the local database
./sync_local_db.sh

# Start the Flask development server
export FLASK_APP=app.py
export FLASK_ENV=development
flask run 