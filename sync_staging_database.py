#!/usr/bin/env python3
"""
Script to sync staging database with production data
This script copies all data from production to staging
"""

import os
import sys
import subprocess
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def main():
    # Load environment variables
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    if not production_url:
        print("❌ Error: PRODUCTION_DATABASE_URL not found in environment")
        sys.exit(1)
    
    if not staging_url:
        print("❌ Error: STAGING_DATABASE_URL not found in environment")
        print("Please set STAGING_DATABASE_URL in your .env file")
        sys.exit(1)
    
    print("🔄 Syncing staging database from production...")
    print(f"📊 Production: {production_url[:50]}...")
    print(f"📊 Staging: {staging_url[:50]}...")
    
    try:
        # Create database connections
        prod_engine = create_engine(production_url)
        staging_engine = create_engine(staging_url)
        
        # Test connections
        with prod_engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM clergy"))
            prod_count = result.scalar()
            print(f"✅ Production database connected - {prod_count} clergy records")
        
        with staging_engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM clergy"))
            staging_count = result.scalar()
            print(f"✅ Staging database connected - {staging_count} clergy records")
        
        # Use pg_dump and pg_restore for complete data sync
        print("🔄 Starting data synchronization...")
        
        # Create a temporary dump file
        dump_file = "temp_production_dump.sql"
        
        # Dump production database
        print("📤 Dumping production database...")
        dump_cmd = [
            "pg_dump",
            "--no-owner",
            "--no-privileges",
            "--clean",
            "--if-exists",
            "--create",
            production_url,
            "-f", dump_file
        ]
        
        result = subprocess.run(dump_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Error dumping production database: {result.stderr}")
            sys.exit(1)
        
        print("✅ Production database dumped successfully")
        
        # Restore to staging database
        print("📥 Restoring to staging database...")
        restore_cmd = [
            "psql",
            staging_url,
            "-f", dump_file
        ]
        
        result = subprocess.run(restore_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Error restoring to staging database: {result.stderr}")
            sys.exit(1)
        
        print("✅ Staging database restored successfully")
        
        # Verify the sync
        with staging_engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM clergy"))
            new_staging_count = result.scalar()
            print(f"✅ Verification: Staging now has {new_staging_count} clergy records")
        
        # Clean up
        if os.path.exists(dump_file):
            os.remove(dump_file)
            print("🧹 Cleaned up temporary files")
        
        print("🎉 Database synchronization completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during synchronization: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
