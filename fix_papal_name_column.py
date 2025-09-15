#!/usr/bin/env python3
"""
Fix missing papal_name column in production database
"""

import os
import sys
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import inspect, text

def fix_papal_name_column():
    """Add the missing papal_name column to the clergy table"""
    
    with app.app_context():
        try:
            print("🔍 Checking if papal_name column exists...")
            
            # Check if papal_name column exists
            inspector = inspect(db.engine)
            clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
            
            if 'papal_name' in clergy_columns:
                print("✅ papal_name column already exists")
                return True
            
            print("⚠️  papal_name column missing, adding it...")
            
            # Add the papal_name column
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE clergy ADD COLUMN papal_name VARCHAR(200)'))
                conn.commit()
            
            print("✅ papal_name column added successfully")
            
            # Verify the column was added
            inspector = inspect(db.engine)
            clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
            
            if 'papal_name' in clergy_columns:
                print("✅ Verification: papal_name column now exists")
                return True
            else:
                print("❌ Verification failed: papal_name column still missing")
                return False
                
        except Exception as e:
            print(f"❌ Error adding papal_name column: {e}")
            return False

if __name__ == "__main__":
    load_dotenv()
    
    # Check if DATABASE_URL is set
    if not os.environ.get('DATABASE_URL'):
        print("❌ DATABASE_URL environment variable not set!")
        sys.exit(1)
    
    print("🚀 Starting papal_name column fix...")
    
    if fix_papal_name_column():
        print("✅ papal_name column fix completed successfully!")
        sys.exit(0)
    else:
        print("❌ papal_name column fix failed!")
        sys.exit(1)
