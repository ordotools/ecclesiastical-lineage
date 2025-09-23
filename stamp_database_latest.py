#!/usr/bin/env python3
"""
Stamp the database to the latest revision to bypass migration conflicts
This is a one-time fix for production databases that have existing columns
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from flask_migrate import stamp, current

def stamp_database_to_latest():
    """Stamp the database to the latest revision"""
    print("🔧 Stamping database to latest revision to bypass migration conflicts...")
    
    with app.app_context():
        try:
            # Check current migration state
            current_revision = current()
            print(f"Current migration revision: {current_revision}")
            
            # Stamp to the latest revision (head)
            print("Stamping to latest revision...")
            stamp('head')
            
            print("✅ Successfully stamped database to latest revision!")
            print("This bypasses all migration conflicts for existing columns.")
            print("You can now run 'flask db upgrade' safely.")
            
        except Exception as e:
            print(f"❌ Error stamping database: {e}")
            return False
    
    return True

def main():
    """Main function"""
    stamp_database_to_latest()

if __name__ == "__main__":
    main()
