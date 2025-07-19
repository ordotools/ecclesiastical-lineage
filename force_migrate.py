#!/usr/bin/env python3
"""
Force Migration Script
This script forces the database migration to complete with detailed logging.
"""

import os
import sys
from datetime import datetime
from sqlalchemy import text, inspect
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import Flask app and models
from app import app, db, User, Role, Permission, ClergyComment, initialize_roles_and_permissions

def force_migrate():
    """Force the migration to complete"""
    print("🚀 Starting FORCE migration...")
    
    with app.app_context():
        try:
            # Step 1: Create all tables
            print("📋 Creating all tables...")
            db.create_all()
            print("✅ All tables created")
            
            # Step 2: Initialize roles and permissions
            print("🔐 Initializing roles and permissions...")
            initialize_roles_and_permissions()
            print("✅ Roles and permissions initialized")
            
            # Step 3: Check current state
            print("🔍 Checking current database state...")
            inspector = inspect(db.engine)
            
            # Check user table columns
            columns = [col['name'] for col in inspector.get_columns('user')]
            print(f"User table columns: {columns}")
            
            # Check if required columns exist
            required_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
            missing_columns = [col for col in required_columns if col not in columns]
            
            if missing_columns:
                print(f"❌ Missing columns: {missing_columns}")
                print("🔧 Adding missing columns...")
                
                # Add missing columns manually
                for col in missing_columns:
                    try:
                        with db.engine.connect() as conn:
                            if col == 'email':
                                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN email VARCHAR(120)"))
                            elif col == 'full_name':
                                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN full_name VARCHAR(200)"))
                            elif col == 'is_active':
                                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN is_active BOOLEAN DEFAULT true"))
                            elif col == 'created_at':
                                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
                            elif col == 'last_login':
                                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN last_login TIMESTAMP"))
                            elif col == 'role_id':
                                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN role_id INTEGER"))
                            conn.commit()
                        
                        print(f"✅ Added column: {col}")
                    except Exception as e:
                        print(f"⚠️  Column {col} might already exist: {e}")
            
            # Step 4: Update existing users
            print("👥 Updating existing users...")
            super_admin_role = Role.query.filter_by(name='Super Admin').first()
            if super_admin_role:
                existing_users = User.query.filter_by(role_id=None).all()
                for user in existing_users:
                    user.role_id = super_admin_role.id
                    user.is_active = True
                    if not user.created_at:
                        user.created_at = datetime.utcnow()
                
                db.session.commit()
                print(f"✅ Updated {len(existing_users)} users")
            else:
                print("❌ Super Admin role not found!")
            
            # Step 5: Final verification
            print("🔍 Final verification...")
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('user')]
            missing_columns = [col for col in required_columns if col not in columns]
            
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
    if force_migrate():
        print("✅ Force migration completed successfully!")
        sys.exit(0)
    else:
        print("❌ Force migration failed!")
        sys.exit(1) 