#!/usr/bin/env python3
"""
Database Migration Script for Role-Based Access Control
This script migrates the existing database to support the new RBAC system.
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

def check_column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    with app.app_context():
        inspector = inspect(db.engine)
        # Handle quoted table names
        table_name_clean = table_name.strip('"')
        columns = [col['name'] for col in inspector.get_columns(table_name_clean)]
        return column_name in columns

def add_column_if_not_exists(table_name, column_name, column_type, nullable=True, default=None):
    """Add a column to a table if it doesn't exist"""
    if not check_column_exists(table_name, column_name):
        print(f"Adding column {column_name} to table {table_name}...")
        
        # Build the ALTER TABLE statement with proper quoting
        quoted_table = f'"{table_name}"'
        alter_sql = f"ALTER TABLE {quoted_table} ADD COLUMN {column_name} {column_type}"
        if not nullable:
            alter_sql += " NOT NULL"
        if default is not None:
            alter_sql += f" DEFAULT {default}"
        
        with app.app_context():
            with db.engine.connect() as conn:
                conn.execute(text(alter_sql))
                conn.commit()
            print(f"✅ Added column {column_name}")
    else:
        print(f"ℹ️  Column {column_name} already exists in table {table_name}")

def create_table_if_not_exists(table_name):
    """Create a table if it doesn't exist"""
    with app.app_context():
        inspector = inspect(db.engine)
        if table_name not in inspector.get_table_names():
            print(f"Creating table {table_name}...")
            db.create_all()
            print(f"✅ Created table {table_name}")
        else:
            print(f"ℹ️  Table {table_name} already exists")

def migrate_user_table():
    """Migrate the user table to support RBAC"""
    print("🔧 Migrating User table...")
    
    # Add new columns to user table
    add_column_if_not_exists('user', 'email', 'VARCHAR(120)', nullable=True)
    add_column_if_not_exists('user', 'full_name', 'VARCHAR(200)', nullable=True)
    add_column_if_not_exists('user', 'is_active', 'BOOLEAN', nullable=False, default='true')
    add_column_if_not_exists('user', 'created_at', 'TIMESTAMP', nullable=False, default='CURRENT_TIMESTAMP')
    add_column_if_not_exists('user', 'last_login', 'TIMESTAMP', nullable=True)
    add_column_if_not_exists('user', 'role_id', 'INTEGER', nullable=True)  # Initially nullable for migration
    
    print("✅ User table migration completed")

def create_rbac_tables():
    """Create the new RBAC tables"""
    print("🔧 Creating RBAC tables...")
    
    # Create role table
    create_table_if_not_exists('role')
    
    # Create permission table
    create_table_if_not_exists('permission')
    
    # Create role_permissions association table
    create_table_if_not_exists('role_permissions')
    
    # Create clergy_comment table
    create_table_if_not_exists('clergy_comment')
    
    print("✅ RBAC tables created")

def migrate_existing_users():
    """Migrate existing users to have Super Admin role"""
    print("🔧 Migrating existing users...")
    
    with app.app_context():
        # Initialize roles and permissions
        initialize_roles_and_permissions()
        
        # Get Super Admin role
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if not super_admin_role:
            print("❌ Super Admin role not found!")
            return
        
        # Update existing users to have Super Admin role
        existing_users = User.query.filter_by(role_id=None).all()
        for user in existing_users:
            print(f"Updating user {user.username} to Super Admin role...")
            user.role_id = super_admin_role.id
            user.is_active = True
            user.created_at = datetime.utcnow()
        
        db.session.commit()
        print(f"✅ Migrated {len(existing_users)} users to Super Admin role")

def verify_migration():
    """Verify that the migration was successful"""
    print("🔍 Verifying migration...")
    
    with app.app_context():
        # Check if all required columns exist
        required_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
        for col in required_columns:
            if check_column_exists('user', col):
                print(f"✅ Column {col} exists")
            else:
                print(f"❌ Column {col} missing!")
                return False
        
        # Check if all required tables exist
        required_tables = ['role', 'permission', 'role_permissions', 'clergy_comment']
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()
        for table in required_tables:
            if table in existing_tables:
                print(f"✅ Table {table} exists")
            else:
                print(f"❌ Table {table} missing!")
                return False
        
        # Check if roles exist
        roles = Role.query.all()
        if roles:
            print(f"✅ Found {len(roles)} roles")
        else:
            print("❌ No roles found!")
            return False
        
        # Check if users have roles assigned
        users_with_roles = User.query.filter(User.role_id.isnot(None)).count()
        total_users = User.query.count()
        print(f"✅ {users_with_roles}/{total_users} users have roles assigned")
        
        return True

def main():
    """Main migration function"""
    print("🚀 Starting RBAC Migration")
    print("=" * 50)
    
    try:
        # Step 1: Migrate user table
        migrate_user_table()
        
        # Step 2: Create RBAC tables
        create_rbac_tables()
        
        # Step 3: Initialize roles and permissions
        with app.app_context():
            initialize_roles_and_permissions()
        
        # Step 4: Migrate existing users
        migrate_existing_users()
        
        # Step 5: Verify migration
        if verify_migration():
            print("=" * 50)
            print("✅ Migration completed successfully!")
            print("\nNext steps:")
            print("1. Restart your Flask application")
            print("2. Test login with existing credentials")
            print("3. Access the user management interface to create additional users")
        else:
            print("=" * 50)
            print("❌ Migration verification failed!")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main() 