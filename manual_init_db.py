#!/usr/bin/env python3
"""
Manual database initialization script
Run this to create database tables if they don't exist
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def manual_init_database():
    """Manually initialize the database"""
    try:
        from app import app, db, User, Clergy, Rank, Organization
        from add_sample_data import add_sample_data
        
        print("🔍 Manual Database Initialization")
        print("=" * 50)
        
        with app.app_context():
            print(f"🔍 Database URL: {app.config['SQLALCHEMY_DATABASE_URI']}")
            
            # Test connection
            print("🔍 Testing database connection...")
            db.engine.connect()
            print("✅ Database connection successful")
            
            # Check existing tables
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            existing_tables = inspector.get_table_names()
            print(f"📋 Existing tables: {existing_tables}")
            
            # Create tables
            print("📊 Creating database tables...")
            db.create_all()
            print("✅ Database tables created successfully!")
            
            # Verify tables were created
            inspector = inspect(db.engine)
            new_tables = inspector.get_table_names()
            print(f"📋 All tables after creation: {new_tables}")
            
            # Add sample data
            print("📝 Adding sample data...")
            add_sample_data()
            print("✅ Sample data added successfully!")
            
            # Create admin user
            existing_admin = User.query.filter_by(is_admin=True).first()
            if not existing_admin:
                print("👤 Creating admin user...")
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
            else:
                print(f"ℹ️  Admin user already exists: {existing_admin.username}")
            
            print("=" * 50)
            print("✅ Database initialization completed successfully!")
            
    except Exception as e:
        print(f"❌ Error during database initialization: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == '__main__':
    success = manual_init_database()
    sys.exit(0 if success else 1) 