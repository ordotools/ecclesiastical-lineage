#!/bin/bash
# Start development server with local database

set -e

echo "🚀 Starting Development Server"
echo "=============================="

# Load environment variables from .env if present
if [ -f .env ]; then
  echo "📄 Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Set local database URL
export DATABASE_URL="postgresql://localhost:5432/ecclesiastical_lineage_dev"

echo "📊 Using local database: $DATABASE_URL"
echo ""

# Start the Flask application
echo "🌐 Starting Flask development server..."
echo "   Server will be available at: http://localhost:5001"
echo "   Login with: admin/admin123"
echo ""

python3 app.py --port 5001
