#!/usr/bin/env python3
"""
Database initialization script for ecclesiastical lineage application.
This script creates all database tables and optionally adds sample data.
"""

from app import app, db
from add_sample_data import add_sample_data
import os

def init_database():
    """Initialize the database with all tables"""
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✅ Database tables created successfully!")
        
        # Check if we should add sample data
        if os.environ.get('ADD_SAMPLE_DATA', 'false').lower() == 'true':
            print("📝 Adding sample data...")
            add_sample_data()
            print("✅ Sample data added successfully!")
        else:
            print("ℹ️  Skipping sample data (set ADD_SAMPLE_DATA=true to include)")

if __name__ == '__main__':
    init_database() 