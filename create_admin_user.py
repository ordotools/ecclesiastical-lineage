#!/usr/bin/env python3
"""
Script to create an admin user for testing the ecclesiastical lineage application.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_admin_user():
    from app import app, db
    from models import User
    
    with app.app_context():
        # Check if admin user already exists
        existing_admin = User.query.filter_by(is_admin=True).first()
        if existing_admin:
            print(f"Admin user already exists: {existing_admin.username}")
            return
        
        # Create admin user
        admin_user = User(
            username="admin",
            is_admin=True
        )
        admin_user.set_password("admin123")  # Change this password!
        
        db.session.add(admin_user)
        db.session.commit()
        
        print("✅ Admin user created successfully!")
        print("Username: admin")
        print("Password: admin123")
        print("⚠️  IMPORTANT: Change this password after first login!")

if __name__ == "__main__":
    create_admin_user() 