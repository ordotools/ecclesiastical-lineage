#!/bin/bash
# setup_postgres_dev.sh
# Set up PostgreSQL development environment with sync from remote

set -e

echo "🚀 Setting up PostgreSQL development environment..."

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Activate virtual environment
source env/bin/activate

# Check if PostgreSQL is running
if ! pg_isready -q; then
  echo "⚠️  PostgreSQL is not running. Starting it..."
  brew services start postgresql@16
  sleep 3
fi

# Check if we want to sync from remote or set up locally
echo ""
echo "Choose setup option:"
echo "1) Sync from remote PostgreSQL (recommended for production-like data)"
echo "2) Set up local database with sample data (for development/testing)"
read -p "Enter choice (1 or 2): " choice

case $choice in
  1)
    echo "🔄 Syncing from remote PostgreSQL..."
    ./sync_postgres_local.sh
    ;;
  2)
    echo "📊 Setting up local database with sample data..."
    ADD_SAMPLE_DATA=true python3 init_postgres_db.py
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "✅ PostgreSQL development environment setup complete!"
echo ""
echo "🎯 Login Credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "🌐 Start the development server:"
echo "   source env/bin/activate && python3 app.py --port 5001"
echo ""
echo "📱 Then visit: http://localhost:5001"
echo ""
echo "⚠️  IMPORTANT: Change the admin password after first login!"
echo ""
echo "💾 Database: postgresql://localhost:5432/ecclesiastical_lineage_dev" 