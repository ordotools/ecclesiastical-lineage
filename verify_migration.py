#!/usr/bin/env python3
"""
Migration Verification Script
This script verifies that the database migration has been completed successfully.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import inspect

def verify_migration():
    """Verify that the migration was successful"""
    print("🔍 Verifying database migration...")
    
    with app.app_context():
        inspector = inspect(db.engine)
        
        # Check if user table has required columns
        print("Checking user table columns...")
        columns = [col['name'] for col in inspector.get_columns('user')]
        required_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
        
        missing_columns = [col for col in required_columns if col not in columns]
        
        if missing_columns:
            print(f"❌ Missing columns in user table: {missing_columns}")
            return False
        else:
            print("✅ All required columns exist in user table")
        
        # Check if required tables exist
        print("Checking required tables...")
        tables = inspector.get_table_names()
        required_tables = ['role', 'permission', 'role_permissions', 'clergy_comment']
        
        missing_tables = [table for table in required_tables if table not in tables]
        
        if missing_tables:
            print(f"❌ Missing tables: {missing_tables}")
            return False
        else:
            print("✅ All required tables exist")
        
        # Check if roles exist
        print("Checking roles...")
        from app import Role
        roles = Role.query.all()
        if roles:
            print(f"✅ Found {len(roles)} roles")
        else:
            print("❌ No roles found!")
            return False
        
        # Check if users have roles assigned
        from app import User
        users_with_roles = User.query.filter(User.role_id.isnot(None)).count()
        total_users = User.query.count()
        print(f"✅ {users_with_roles}/{total_users} users have roles assigned")
        
        return True

if __name__ == '__main__':
    try:
        if verify_migration():
            print("✅ Migration verification passed!")
            sys.exit(0)
        else:
            print("❌ Migration verification failed!")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1) 