#!/usr/bin/env python3
"""
Debug script to check environment variables on Render.
"""

import os

def debug_environment():
    print("🔍 Environment Variables Debug:")
    print(f"DATABASE_URL: {os.environ.get('DATABASE_URL', 'NOT SET')}")
    print(f"SECRET_KEY: {os.environ.get('SECRET_KEY', 'NOT SET')[:10]}..." if os.environ.get('SECRET_KEY') else 'NOT SET')
    print(f"ADD_SAMPLE_DATA: {os.environ.get('ADD_SAMPLE_DATA', 'NOT SET')}")
    print(f"PYTHON_VERSION: {os.environ.get('PYTHON_VERSION', 'NOT SET')}")
    
    # Check if we can parse the database URL
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        print(f"Database URL starts with: {db_url[:50]}...")
        if 'localhost' in db_url or '127.0.0.1' in db_url:
            print("⚠️  WARNING: Database URL points to localhost!")
        elif 'render.com' in db_url or 'postgres.render.com' in db_url:
            print("✅ Database URL points to Render PostgreSQL")
        else:
            print(f"ℹ️  Database URL points to: {db_url.split('@')[1].split('/')[0] if '@' in db_url else 'unknown'}")
    else:
        print("❌ DATABASE_URL is not set!")

if __name__ == '__main__':
    debug_environment() 