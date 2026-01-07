#!/usr/bin/env python3
"""
Fix production migration state for databases that were created with fallback migrations
This script handles the case where tables exist but Flask-Migrate doesn't know about them
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from flask_migrate import stamp, current
from sqlalchemy import inspect, text

def check_existing_tables():
    """Check what tables already exist in the database"""
    print("🔍 Checking existing tables in database...")
    
    with app.app_context():
        try:
            inspector = inspect(app.engine)
            tables = inspector.get_table_names()
            
            print(f"✅ Found {len(tables)} existing tables:")
            for table in sorted(tables):
                print(f"   - {table}")
            
            # Check if key tables exist
            key_tables = ['clergy', 'ordination', 'consecration', 'rank', 'organization', 'user', 'role']
            existing_key_tables = [table for table in key_tables if table in tables]
            missing_key_tables = [table for table in key_tables if table not in tables]
            
            print(f"\n📊 Key tables analysis:")
            print(f"   ✅ Existing: {existing_key_tables}")
            if missing_key_tables:
                print(f"   ❌ Missing: {missing_key_tables}")
            
            return tables, existing_key_tables, missing_key_tables
            
        except Exception as e:
            print(f"❌ Error checking tables: {e}")
            return [], [], []

def check_alembic_version():
    """Check if alembic_version table exists and what revision it has"""
    print("\n🔍 Checking Alembic version table...")
    
    with app.app_context():
        try:
            inspector = inspect(app.engine)
            tables = inspector.get_table_names()
            
            if 'alembic_version' not in tables:
                print("⚠️  Alembic version table does not exist")
                return None, None
            
            # Check current revision
            try:
                current_revision = current()
                print(f"✅ Current Alembic revision: {current_revision}")
                return current_revision, tables
            except Exception as e:
                print(f"⚠️  Could not get current revision: {e}")
                return None, tables
                
        except Exception as e:
            print(f"❌ Error checking Alembic version: {e}")
            return None, None

def determine_migration_strategy(existing_tables, current_revision):
    """Determine the best migration strategy based on database state"""
    print("\n🎯 Determining migration strategy...")
    
    key_tables = ['clergy', 'ordination', 'consecration', 'rank', 'organization']
    has_all_tables = all(table in existing_tables for table in key_tables)
    
    if current_revision is None:
        if has_all_tables:
            print("📋 Strategy: Database has all tables but no Alembic tracking")
            print("   → Will stamp to latest revision to bypass all migrations")
            return "stamp_latest"
        else:
            print("📋 Strategy: Database is missing tables and has no Alembic tracking")
            print("   → Will need to run migrations normally")
            return "run_migrations"
    else:
        print("📋 Strategy: Database has Alembic tracking")
        print("   → Will run normal upgrade")
        return "normal_upgrade"

def fix_production_migration_state():
    """Fix the production migration state"""
    print("🚀 Starting production migration state fix...")
    print("=" * 60)
    
    # Step 1: Check existing tables
    existing_tables, existing_key_tables, missing_key_tables = check_existing_tables()
    
    # Step 2: Check Alembic version
    current_revision, tables = check_alembic_version()
    
    # Step 3: Determine strategy
    strategy = determine_migration_strategy(existing_tables, current_revision)
    
    print(f"\n🎯 Selected strategy: {strategy}")
    print("=" * 60)
    
    with app.app_context():
        try:
            if strategy == "stamp_latest":
                print("🔧 Stamping database to latest revision...")
                
                # First, ensure alembic_version table exists with correct column size
                with app.engine.connect() as conn:
                    if 'alembic_version' not in existing_tables:
                        print("📋 Creating alembic_version table...")
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
                            print("✅ Column size updated successfully")
                
                # Stamp to latest revision
                stamp('head')
                print("✅ Successfully stamped to latest revision!")
                
            elif strategy == "run_migrations":
                print("🔧 Database needs normal migration...")
                print("   → Run 'flask db upgrade' manually")
                
            elif strategy == "normal_upgrade":
                print("🔧 Database has proper Alembic tracking...")
                print("   → Run 'flask db upgrade' normally")
            
            return True
            
        except Exception as e:
            print(f"❌ Error fixing migration state: {e}")
            return False

def main():
    """Main function"""
    success = fix_production_migration_state()
    
    if success:
        print("\n🎉 Production migration state fix completed!")
        print("You can now run 'flask db upgrade' safely.")
    else:
        print("\n❌ Production migration state fix failed!")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
