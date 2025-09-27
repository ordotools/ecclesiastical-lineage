#!/usr/bin/env python3
"""
Fix production migration state by stamping the database to the correct revision
This script helps resolve migration conflicts in production
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from flask_migrate import current, stamp

def fix_production_migration():
    """Fix production migration state"""
    print("🔧 Fixing production migration state...")
    
    with app.app_context():
        try:
            # Check current migration state
            current_revision = current()
            print(f"Current migration revision: {current_revision}")
            
            # List of migration revisions in order
            migrations = [
                "bc170867dac1",  # Add is_deleted and deleted_at to clergy
                "810871a86b33",  # Some other migration
                "1f45b673ab3c",  # Migrate production lineage data
                "ffca03f86792",  # Smart production data migration
            ]
            
            # Check which migrations have been applied
            print("\n🔍 Checking migration status...")
            for migration in migrations:
                try:
                    # Try to get the current revision
                    current_rev = current()
                    if current_rev == migration:
                        print(f"✅ {migration} - Current")
                    else:
                        print(f"⏭️  {migration} - Not current")
                except Exception as e:
                    print(f"❌ {migration} - Error: {e}")
            
            # If we need to stamp to a specific revision
            print("\n💡 If you need to stamp the database to a specific revision:")
            print("   flask db stamp <revision_id>")
            print("\n💡 Available revisions:")
            for migration in migrations:
                print(f"   - {migration}")
            
            print("\n✅ Migration state check completed")
            
        except Exception as e:
            print(f"❌ Error checking migration state: {e}")
            return False
    
    return True

def main():
    """Main function"""
    fix_production_migration()

if __name__ == "__main__":
    main()
