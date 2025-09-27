#!/usr/bin/env python3
"""
Fix migration state by updating alembic_version table to point to the correct migration.
This script should be run during deployment to fix any migration state issues.
"""

import os
import sys
from sqlalchemy import create_engine, text

def fix_migration_state():
    """Fix the migration state by updating alembic_version table"""
    
    # Get database URL from environment
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return False
    
    try:
        # Create database connection
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Check if alembic_version table exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'alembic_version'
                );
            """))
            
            if not result.fetchone()[0]:
                print("❌ alembic_version table does not exist")
                return False
            
            # Update alembic_version to point to rebuild_db_users
            conn.execute(text("UPDATE alembic_version SET version_num = 'rebuild_db_users'"))
            conn.commit()
            
            print("✅ Updated alembic_version to rebuild_db_users")
            return True
            
    except Exception as e:
        print(f"❌ Error fixing migration state: {e}")
        return False

if __name__ == "__main__":
    if fix_migration_state():
        print("✅ Migration state fixed successfully")
        sys.exit(0)
    else:
        print("❌ Failed to fix migration state")
        sys.exit(1)
