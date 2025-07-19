#!/bin/bash
# Startup script with migration

echo "🚀 STARTUP SCRIPT - MIGRATION VERSION"
echo "======================================"

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Check database state
echo "🔍 Checking database state..."
python3 check_db_state.py

# Run force migration
echo "🔧 Running force migration..."
python3 force_migrate.py

# Verify migration
echo "✅ Verifying migration..."
python3 verify_migration.py

# Start application
echo "🌐 Starting application..."
exec gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 30 