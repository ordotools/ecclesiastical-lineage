#!/usr/bin/env python3
"""
Initialize local PostgreSQL database with tables and sample data.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def init_postgres_database():
    from app import app, db, User, Clergy, Rank, Organization
    from add_sample_data import add_sample_data
    
    with app.app_context():
        print("📊 Creating database tables...")
        db.create_all()
        print("✅ Database tables created successfully!")
        
        # Check if we should add sample data
        if os.environ.get('ADD_SAMPLE_DATA', 'false').lower() == 'true':
            print("📝 Adding sample data...")
            add_sample_data()
            print("✅ Sample data added successfully!")
        else:
            print("ℹ️  Skipping sample data (set ADD_SAMPLE_DATA=true to include)")
        
        # Create admin user if it doesn't exist
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

if __name__ == '__main__':
    init_postgres_database() 