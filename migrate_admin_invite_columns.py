#!/usr/bin/env python3
"""
Admin Invite Columns Migration Script
This script adds missing columns to the admin_invite table.
"""

import os
import sys
from sqlalchemy import text, inspect
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import Flask app and models
from app import app, db

def migrate_admin_invite_columns():
    """Add missing columns to admin_invite table"""
    print("🚀 Starting Admin Invite columns migration...")
    
    with app.app_context():
        try:
            # Check if admin_invite table exists
            inspector = inspect(db.engine)
            if 'admin_invite' not in inspector.get_table_names():
                print("❌ admin_invite table does not exist!")
                return False
            
            # Get current columns
            columns = [col['name'] for col in inspector.get_columns('admin_invite')]
            print(f"Current admin_invite columns: {columns}")
            
            # Define required columns
            required_columns = {
                'role_id': 'INTEGER',
                'max_uses': 'INTEGER DEFAULT 1',
                'current_uses': 'INTEGER DEFAULT 0',
                'expires_in_hours': 'INTEGER DEFAULT 24'
            }
            
            # Check for missing columns
            missing_columns = [col for col in required_columns.keys() if col not in columns]
            
            if not missing_columns:
                print("✅ All required columns already exist!")
                return True
            
            print(f"🔧 Adding missing columns: {missing_columns}")
            
            # Add missing columns
            with db.engine.connect() as conn:
                for col in missing_columns:
                    try:
                        sql = f"ALTER TABLE admin_invite ADD COLUMN {col} {required_columns[col]}"
                        print(f"Executing: {sql}")
                        conn.execute(text(sql))
                        print(f"✅ Added column: {col}")
                    except Exception as e:
                        print(f"⚠️  Column {col} might already exist: {e}")
                
                conn.commit()
            
            # Final verification
            print("🔍 Final verification...")
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('admin_invite')]
            print(f"Final admin_invite columns: {columns}")
            
            missing_columns = [col for col in required_columns.keys() if col not in columns]
            if missing_columns:
                print(f"❌ Still missing columns: {missing_columns}")
                return False
            else:
                print("✅ All required columns exist!")
                return True
                
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == '__main__':
    if migrate_admin_invite_columns():
        print("✅ Admin invite columns migration completed successfully!")
        sys.exit(0)
    else:
        print("❌ Admin invite columns migration failed!")
        sys.exit(1) 