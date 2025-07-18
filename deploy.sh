#!/bin/bash
# Deployment script for ecclesiastical lineage application

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Initialize database
echo "🗄️  Initializing database..."
python init_db.py

# Start the application
echo "🌐 Starting application..."
gunicorn app:app 