#!/usr/bin/env python3
"""
Initialize local PostgreSQL database with tables and sample data.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def migrate_admin_invite_columns():
    """Add missing columns to admin_invite table"""
    from app import db
    from sqlalchemy import text, inspect
    
    try:
        # Check if admin_invite table exists
        inspector = inspect(db.engine)
        if 'admin_invite' not in inspector.get_table_names():
            print("ℹ️  admin_invite table does not exist yet, will be created by db.create_all()")
            return True
        
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
            print("✅ All required admin_invite columns already exist!")
            return True
        
        print(f"🔧 Adding missing admin_invite columns: {missing_columns}")
        
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
        
        print("✅ Admin invite columns migration completed!")
        return True
        
    except Exception as e:
        print(f"❌ Admin invite migration failed: {e}")
        return False

def init_postgres_database():
    from app import app, db
    from models import User, Clergy, Rank, Organization
    
    
    with app.app_context():
        try:
            print("📊 Creating database tables...")
            print(f"🔍 Database URL: {app.config['SQLALCHEMY_DATABASE_URI']}")
            
            # Test connection first
            db.engine.connect()
            print("✅ Database connection test successful")
            
            # Create tables
            db.create_all()
            print("✅ Database tables created successfully!")
            
            # Run admin invite columns migration
            print("🔧 Running admin invite columns migration...")
            migrate_admin_invite_columns()
            
            # Verify tables were created
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"📋 Created tables: {tables}")
            
        except Exception as e:
            print(f"❌ Error creating database tables: {e}")
            print(f"🔍 Database URL: {app.config['SQLALCHEMY_DATABASE_URI']}")
            raise
        
        print("ℹ️  Sample data functionality has been removed to prevent accidental data overwrites")
        
        # Create admin user if it doesn't exist
        existing_admin = User.query.filter_by(username="admin").first()
        if not existing_admin:
            print("👤 Creating admin user...")
            try:
                admin_user = User(
                    username="admin",
                    is_admin=True
                )
                admin_user.set_password("admin123")
                db.session.add(admin_user)
                db.session.commit()
                print("✅ Admin user created successfully!")
                print("Username: admin")
                print("Password: admin123")
            except Exception as e:
                print(f"⚠️  Admin user creation failed (may already exist): {e}")
                db.session.rollback()
                # Check again after rollback
                existing_admin = User.query.filter_by(username="admin").first()
                if existing_admin:
                    print(f"ℹ️  Admin user already exists: {existing_admin.username}")
                else:
                    print("❌ Admin user creation failed and user doesn't exist")
        else:
            print(f"ℹ️  Admin user already exists: {existing_admin.username}")

if __name__ == '__main__':
    init_postgres_database() 