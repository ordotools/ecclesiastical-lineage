#!/bin/bash
# dev_setup_local.sh
# Set up local development environment with sample data and admin user
# This does NOT sync from remote database - it's for local development only

set -e

echo "🚀 Setting up local development environment..."

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Activate virtual environment
source env/bin/activate

# Remove old database if it exists
LOCAL_SQLITE_DB="instance/ecclesiastical_lineage.db"
if [ -f "$LOCAL_SQLITE_DB" ]; then
  echo "🗑️  Removing old database..."
  rm "$LOCAL_SQLITE_DB"
fi

echo "📊 Initializing database with sample data..."
python3 init_db.py

echo "👤 Creating admin user..."
python3 create_admin_user.py

echo "✅ Local development environment setup complete!"
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