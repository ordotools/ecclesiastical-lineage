#!/bin/bash
# Deployment script for ecclesiastical lineage application

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Debug environment variables
echo "🔍 Debugging environment variables..."
python debug_env.py

# Initialize database (only if tables don't exist)
echo "🗄️  Checking database..."
python -c "
from app import app, db
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    existing_tables = inspector.get_table_names()
    
    if not existing_tables:
        print('📊 Creating database tables...')
        db.create_all()
        
        # Add sample data if requested
        import os
        if os.environ.get('ADD_SAMPLE_DATA', 'false').lower() == 'true':
            print('📝 Adding sample data...')
            from add_sample_data import add_sample_data
            add_sample_data()
            print('✅ Sample data added successfully!')
        else:
            print('ℹ️  Skipping sample data')
    else:
        print('✅ Database tables already exist')
"

# Start the application
echo "🌐 Starting application..."
gunicorn app:app 