#!/usr/bin/env python3
"""
Database State Check Script
This script checks the current state of the database to see what exists.
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

def check_database_state():
    """Check the current state of the database"""
    print("🔍 Checking database state...")
    
    with app.app_context():
        inspector = inspect(db.engine)
        
        # List all tables
        print("\n📋 All tables in database:")
        tables = inspector.get_table_names()
        for table in tables:
            print(f"  - {table}")
        
        # Check user table specifically
        if 'user' in tables:
            print(f"\n👤 User table columns:")
            columns = inspector.get_columns('user')
            for col in columns:
                print(f"  - {col['name']}: {col['type']}")
        else:
            print("\n❌ User table does not exist!")
        
        # Check if required RBAC tables exist
        print(f"\n🔐 RBAC tables:")
        rbac_tables = ['role', 'permission', 'role_permissions', 'clergy_comment']
        for table in rbac_tables:
            if table in tables:
                print(f"  ✅ {table}")
            else:
                print(f"  ❌ {table} (missing)")
        
        # Check if required columns exist in user table
        if 'user' in tables:
            print(f"\n📝 Required columns in user table:")
            columns = [col['name'] for col in inspector.get_columns('user')]
            required_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
            
            for col in required_columns:
                if col in columns:
                    print(f"  ✅ {col}")
                else:
                    print(f"  ❌ {col} (missing)")

if __name__ == '__main__':
    try:
        check_database_state()
    except Exception as e:
        print(f"❌ Error checking database state: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1) 