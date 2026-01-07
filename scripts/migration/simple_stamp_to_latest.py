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
            # Get the latest revision ID from our migrations
            latest_revision = "ffca03f86792"  # This is our smart migration revision
            
            # Ensure alembic_version table exists with correct column size
            print("📋 Ensuring alembic_version table exists...")
            with app.engine.connect() as conn:
                # Check if table exists
                result = conn.execute(text("""
                    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')
                """))
                table_exists = result.fetchone()[0]
                
                if not table_exists:
                    conn.execute(text("""
                        CREATE TABLE alembic_version (
                            version_num VARCHAR(255) NOT NULL,
                            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                        )
                    """))
                    conn.commit()
                else:
                    # Check and alter column size if needed
                    result = conn.execute(text("""
                        SELECT character_maximum_length 
                        FROM information_schema.columns 
                        WHERE table_name = 'alembic_version' 
                        AND column_name = 'version_num'
                    """))
                    row = result.fetchone()
                    if row and row[0] and row[0] < 255:
                        print(f"⚠️  Column size is {row[0]}, expanding to VARCHAR(255)...")
                        conn.execute(text("""
                            ALTER TABLE alembic_version 
                            ALTER COLUMN version_num TYPE VARCHAR(255)
                        """))
                        conn.commit()
            
            # Clear any existing version and set to latest
            print("📋 Setting database version to latest revision...")
            with app.engine.connect() as conn:
                conn.execute(text("DELETE FROM alembic_version"))
                conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:version)"), 
                             {"version": latest_revision})
                conn.commit()
            
            print(f"✅ Successfully set database version to {latest_revision}!")
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
