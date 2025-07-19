#!/bin/bash
# Deployment script for ecclesiastical lineage application

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Debug environment variables
echo "🔍 Debugging environment variables..."
python debug_env.py

# Initialize database
echo "🗄️  Initializing database..."
if python3 init_postgres_db.py; then
    echo "✅ Database initialization completed successfully!"
else
    echo "❌ Database initialization failed!"
    exit 1
fi

# Start the application
echo "🌐 Starting application..."
gunicorn app:app 