#!/bin/bash
# start_dev.sh
# Complete development environment setup script
# Syncs local PostgreSQL with remote database and starts development server

set -e

echo "🚀 Starting Ecclesiastical Lineage Development Environment"
echo "=" * 60

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
command -v python3 >/dev/null 2>&1 || { echo "❌ python3 is required but not installed."; exit 1; }
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

# Set up local environment
echo "🔧 Setting up local environment..."
LOCAL_DATABASE_URL="postgresql://localhost:5432/$LOCAL_DB_NAME"

# Create or update .env file for local development
if [ -f .env ]; then
  echo "📄 Updating existing .env file..."
  # Backup existing .env
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  
  # Update DATABASE_URL for local development
  if grep -q "DATABASE_URL=" .env; then
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=$LOCAL_DATABASE_URL|" .env
  else
    echo "DATABASE_URL=$LOCAL_DATABASE_URL" >> .env
  fi
else
  echo "📄 Creating new .env file..."
  cat > .env << EOF
# Flask configuration
SECRET_KEY=dev-secret-key-change-in-production
DATABASE_URL=$LOCAL_DATABASE_URL

# Remote PostgreSQL connection for syncing (keep this for future syncs)
REMOTE_DATABASE_URL=$DATABASE_URL

# Optional: Set to 'true' to add sample data during initialization

EOF
fi

echo "✅ Local environment configured"

# Activate virtual environment if it exists, or create one
if [ -d "env" ]; then
  echo "🐍 Activating existing virtual environment..."
  source env/bin/activate
  echo "✅ Virtual environment activated"
  
  # Check if dependencies are installed
  if ! python3 -c "import flask" 2>/dev/null; then
    echo "📦 Installing dependencies in existing virtual environment..."
    pip install -r requirements.txt
    echo "✅ Dependencies installed"
  else
    echo "✅ Dependencies already installed"
  fi
else
  echo "⚠️  Virtual environment not found. Creating one..."
  python3 -m venv env
  source env/bin/activate
  echo "📦 Installing dependencies..."
  pip install -r requirements.txt
  echo "✅ Virtual environment created and dependencies installed"
fi

# Test the local database connection
echo "🔍 Testing local database connection..."
python3 -c "import os; os.environ['DATABASE_URL'] = '$LOCAL_DATABASE_URL'; from app import app, db; app.app_context().push(); db.engine.connect(); print('✅ Local database connection test successful')"

# Run database migrations
echo "🗄️  Running database migrations (flask db upgrade)..."
flask db upgrade
echo "✅ Database migrations applied"

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📊 Database Information:"
echo "   Local Database: $LOCAL_DATABASE_URL"
echo "   Remote Database: $REMOTE_DATABASE_URL"
echo ""
echo "👤 Admin Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "🚀 Starting development server..."
echo "   Press Ctrl+C to stop the server"
echo ""

# Start the development server
export FLASK_APP=app.py
export FLASK_ENV=development
export DATABASE_URL="$LOCAL_DATABASE_URL"

python3 app.py --port 5001 