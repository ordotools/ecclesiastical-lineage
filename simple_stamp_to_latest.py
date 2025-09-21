#!/usr/bin/env python3
"""
Simple script to stamp database to latest revision and bypass all migrations
Use this when the database already has all the tables from fallback migrations
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from flask_migrate import stamp
from sqlalchemy import text

def simple_stamp_to_latest():
    """Simply stamp the database to the latest revision"""
    print("🔧 Stamping database to latest revision to bypass all migrations...")
    
    with app.app_context():
        try:
            # Ensure alembic_version table exists
            print("📋 Ensuring alembic_version table exists...")
            app.engine.execute(text("""
                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
            """))
            
            # Stamp to latest revision
            print("📋 Stamping to latest revision...")
            stamp('head')
            
            print("✅ Successfully stamped database to latest revision!")
            print("All migrations are now marked as applied.")
            print("You can now run the smart migration directly.")
            
            return True
            
        except Exception as e:
            print(f"❌ Error stamping database: {e}")
            return False

def main():
    """Main function"""
    simple_stamp_to_latest()

if __name__ == "__main__":
    main()
