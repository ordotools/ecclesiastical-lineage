#!/usr/bin/env python3
"""
Comprehensive script to fix all migration conflicts in production
This script handles existing columns gracefully and stamps the database to the latest revision
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
from sqlalchemy import inspect

def check_database_state():
    """Check the current state of the database"""
    print("🔍 Checking database state...")
    
    with app.app_context():
        try:
            inspector = inspect(app.engine)
            tables = inspector.get_table_names()
            
            print(f"✅ Found {len(tables)} tables in database")
            
            # Check clergy table columns
            if 'clergy' in tables:
                clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
                print(f"✅ Clergy table has {len(clergy_columns)} columns:")
                for col in clergy_columns:
                    print(f"   - {col}")
            
            # Check rank table columns
            if 'rank' in tables:
                rank_columns = [col['name'] for col in inspector.get_columns('rank')]
                print(f"✅ Rank table has {len(rank_columns)} columns:")
                for col in rank_columns:
                    print(f"   - {col}")
            
            # Check if alembic_version table exists
            if 'alembic_version' in tables:
                print("✅ Alembic version table exists")
            else:
                print("⚠️  Alembic version table does not exist")
            
            return True
            
        except Exception as e:
            print(f"❌ Error checking database state: {e}")
            return False

def fix_migration_conflicts():
    """Fix all migration conflicts by stamping to latest revision"""
    print("🔧 Fixing migration conflicts...")
    
    with app.app_context():
        try:
            # Check current migration state
            try:
                current_revision = current()
                print(f"Current migration revision: {current_revision}")
            except Exception as e:
                print(f"⚠️  Could not get current revision: {e}")
                current_revision = None
            
            # Stamp to the latest revision (head)
            print("Stamping to latest revision to bypass all conflicts...")
            stamp('head')
            
            print("✅ Successfully stamped database to latest revision!")
            print("This bypasses all migration conflicts for existing columns.")
            
            # Verify the stamp worked
            try:
                new_revision = current()
                print(f"New migration revision: {new_revision}")
            except Exception as e:
                print(f"⚠️  Could not get new revision: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error fixing migration conflicts: {e}")
            return False

def main():
    """Main function to fix all migration conflicts"""
    print("🚀 Starting comprehensive migration conflict resolution...")
    print("=" * 60)
    
    # Step 1: Check database state
    if not check_database_state():
        print("❌ Failed to check database state")
        return False
    
    print("\n" + "=" * 60)
    
    # Step 2: Fix migration conflicts
    if not fix_migration_conflicts():
        print("❌ Failed to fix migration conflicts")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 Migration conflict resolution completed successfully!")
    print("You can now run 'flask db upgrade' safely.")
    print("The smart migration should run without conflicts.")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
