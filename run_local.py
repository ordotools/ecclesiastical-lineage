#!/usr/bin/env python3
"""
Simple script to run the Ecclesiastical Lineage app locally for development.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check if DATABASE_URL is set
if not os.environ.get('DATABASE_URL'):
    print("❌ Error: DATABASE_URL environment variable not set.")
    print("Please create a .env file with your database configuration.")
    print("See env.example for reference.")
    sys.exit(1)

# Check if SECRET_KEY is set
if not os.environ.get('SECRET_KEY'):
    print("⚠️  Warning: SECRET_KEY not set. Using default development key.")
    os.environ['SECRET_KEY'] = 'dev-secret-key-change-in-production'

print("🚀 Starting Ecclesiastical Lineage Development Server")
print("=" * 50)
print(f"📊 Database: {os.environ.get('DATABASE_URL', 'Not set')}")
print(f"🔑 Secret Key: {'Set' if os.environ.get('SECRET_KEY') else 'Not set'}")
print("=" * 50)

# Import and run the app
from app import app

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5001) 