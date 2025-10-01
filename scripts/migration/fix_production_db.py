#!/usr/bin/env python3
"""
Script to fix production database by adding missing columns.
Run this on Render.com to add the missing image_url and image_data columns.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import inspect

def fix_production_database():
    """Fix the production database by adding missing columns."""
    with app.app_context():
        print("🔧 Fixing production database...")
        
        # Check current database state
        inspector = inspect(db.engine)
        
        # Check clergy table columns
        clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
        print(f"Current clergy columns: {clergy_columns}")
        
        # Required columns that should exist
        required_clergy_columns = ['image_url', 'image_data', 'is_deleted', 'deleted_at']
        missing_clergy_columns = [col for col in required_clergy_columns if col not in clergy_columns]
        
        if missing_clergy_columns:
            print(f"⚠️  Missing clergy columns: {missing_clergy_columns}")
            print("🔧 Adding missing columns...")
            
            for col in missing_clergy_columns:
                try:
                    with db.engine.connect() as conn:
                        if col == 'image_url':
                            conn.execute(db.text('ALTER TABLE clergy ADD COLUMN image_url TEXT'))
                            print(f"✅ Added column: {col}")
                        elif col == 'image_data':
                            conn.execute(db.text('ALTER TABLE clergy ADD COLUMN image_data TEXT'))
                            print(f"✅ Added column: {col}")
                        elif col == 'is_deleted':
                            conn.execute(db.text('ALTER TABLE clergy ADD COLUMN is_deleted BOOLEAN DEFAULT false'))
                            print(f"✅ Added column: {col}")
                        elif col == 'deleted_at':
                            conn.execute(db.text('ALTER TABLE clergy ADD COLUMN deleted_at TIMESTAMP'))
                            print(f"✅ Added column: {col}")
                        conn.commit()
                except Exception as e:
                    print(f"⚠️  Error adding column {col}: {e}")
        else:
            print("✅ All required clergy columns already exist")
        
        # Verify the fix
        print("\n🔍 Verifying database state...")
        inspector = inspect(db.engine)
        clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
        print(f"Updated clergy columns: {clergy_columns}")
        
        # Check if all required columns exist
        all_required = all(col in clergy_columns for col in required_clergy_columns)
        if all_required:
            print("✅ Database fix completed successfully!")
            print("🎉 The application should now work without errors!")
        else:
            print("❌ Some required columns are still missing")
            sys.exit(1)

if __name__ == "__main__":
    try:
        fix_production_database()
    except Exception as e:
        print(f"❌ Error fixing database: {e}")
        sys.exit(1)
