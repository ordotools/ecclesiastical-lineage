#!/usr/bin/env python3
"""
Properly fix Flask-Migrate by stamping the database to the correct revision
This approach uses Flask-Migrate properly instead of bypassing it
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from flask_migrate import stamp, current
from sqlalchemy import text

def check_migration_state():
    """Check the current Flask-Migrate state"""
    print("🔍 Checking Flask-Migrate state...")
    
    with app.app_context():
        try:
            # Check if alembic_version table exists
            with db.engine.connect() as conn:
                result = conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')"))
                alembic_exists = result.fetchone()[0]
            
            if alembic_exists:
                print("✅ Alembic version table exists")
                
                # Check current revision
                try:
                    current_revision = current()
                    print(f"✅ Current revision: {current_revision}")
                    return current_revision
                except Exception as e:
                    print(f"⚠️  Could not get current revision: {e}")
                    return None
            else:
                print("❌ Alembic version table does not exist")
                return None
                
        except Exception as e:
            print(f"❌ Error checking migration state: {e}")
            return None

def stamp_to_correct_revision():
    """Stamp the database to the correct revision based on what tables exist"""
    print("🔧 Determining correct revision to stamp to...")
    
    with app.app_context():
        try:
            # Check what tables exist
            with db.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """))
                tables = [row[0] for row in result.fetchall()]
            
            print(f"📋 Found {len(tables)} tables: {sorted(tables)}")
            
            # Key tables that should exist
            key_tables = ['clergy', 'ordination', 'consecration', 'rank', 'organization', 'user', 'role']
            existing_key_tables = [table for table in key_tables if table in tables]
            missing_key_tables = [table for table in key_tables if table not in tables]
            
            print(f"✅ Existing key tables: {existing_key_tables}")
            if missing_key_tables:
                print(f"❌ Missing key tables: {missing_key_tables}")
            
            # Check if we have the alembic_version table
            has_alembic = 'alembic_version' in tables
            
            if has_alembic:
                print("✅ Alembic version table exists")
            else:
                print("❌ Alembic version table missing - will create it")
            
            # Based on what tables exist, determine the correct revision
            if len(existing_key_tables) >= 6:  # Most key tables exist
                if 'alembic_version' in tables:
                    # Database is properly set up, just stamp to head
                    target_revision = 'head'
                    print("🎯 Strategy: Stamp to head (database is properly set up)")
                else:
                    # Database has tables but no alembic tracking
                    target_revision = 'head'
                    print("🎯 Strategy: Stamp to head (database has tables but no alembic tracking)")
            else:
                # Database is missing tables, need to run migrations
                target_revision = None
                print("🎯 Strategy: Need to run migrations (database missing tables)")
            
            return target_revision, tables
            
        except Exception as e:
            print(f"❌ Error checking tables: {e}")
            return None, []

def fix_flask_migrate():
    """Fix Flask-Migrate properly"""
    print("🚀 Fixing Flask-Migrate properly...")
    print("=" * 60)
    
    # Step 1: Check current state
    current_revision = check_migration_state()
    
    # Step 2: Determine correct revision
    target_revision, tables = stamp_to_correct_revision()
    
    if target_revision is None:
        print("❌ Cannot determine target revision - database missing tables")
        return False
    
    print(f"\n🎯 Target revision: {target_revision}")
    print("=" * 60)
    
    with app.app_context():
        try:
            # Ensure alembic_version table exists
            if 'alembic_version' not in tables:
                print("📋 Creating alembic_version table...")
                with db.engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE alembic_version (
                            version_num VARCHAR(32) NOT NULL,
                            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                        )
                    """))
                    conn.commit()
            
            # Stamp to target revision
            print(f"📋 Stamping to {target_revision}...")
            stamp(target_revision)
            
            # Verify the stamp worked
            try:
                new_revision = current()
                print(f"✅ Successfully stamped to: {new_revision}")
            except Exception as e:
                print(f"⚠️  Could not verify new revision: {e}")
            
            print("✅ Flask-Migrate is now properly configured!")
            print("You can now run 'flask db upgrade' safely.")
            
            return True
            
        except Exception as e:
            print(f"❌ Error fixing Flask-Migrate: {e}")
            return False

def main():
    """Main function"""
    success = fix_flask_migrate()
    
    if success:
        print("\n🎉 Flask-Migrate fix completed successfully!")
        print("Now you can run 'flask db upgrade' to apply the smart migration.")
    else:
        print("\n❌ Flask-Migrate fix failed!")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
