#!/bin/bash
# setup_test_environment.sh
# Set up the test environment with sample data and admin user

set -e

echo "🚀 Setting up test environment for Ecclesiastical Lineage..."

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Activate virtual environment
source env/bin/activate

echo "📊 Initializing database with sample data..."
ADD_SAMPLE_DATA=true python3 init_db.py

echo "👤 Creating admin user..."
python3 create_admin_user.py

echo "✅ Test environment setup complete!"
echo ""
echo "🎯 Login Credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "🌐 Start the development server:"
echo "   ./dev_start.sh"
echo ""
echo "📱 Then visit: http://localhost:5000"
echo ""
echo "⚠️  IMPORTANT: Change the admin password after first login!" 