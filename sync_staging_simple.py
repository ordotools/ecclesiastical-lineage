#!/usr/bin/env python3
"""
Simple script to sync production data to staging using pg_dump/psql
"""

import os
import subprocess
import sys
from dotenv import load_dotenv

def run_command(cmd, description):
    """Run a command and return success status"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} completed")
            return True
        else:
            print(f"❌ {description} failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {description} error: {e}")
        return False

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Simple Staging Database Sync")
    print("=" * 40)
    
    if not production_url:
        print("❌ PRODUCTION_DATABASE_URL not found")
        return
    
    if not staging_url:
        print("❌ STAGING_DATABASE_URL not found")
        return
    
    print(f"📊 Production: {production_url[:50]}...")
    print(f"📊 Staging: {staging_url[:50]}...")
    
    # Create a temporary dump file
    dump_file = "/tmp/production_dump.sql"
    
    try:
        # Step 1: Dump production database
        dump_cmd = f'pg_dump "{production_url}" --no-owner --no-privileges --clean --if-exists > {dump_file}'
        if not run_command(dump_cmd, "Dumping production database"):
            return
        
        # Step 2: Restore to staging database
        restore_cmd = f'psql "{staging_url}" < {dump_file}'
        if not run_command(restore_cmd, "Restoring to staging database"):
            return
        
        # Step 3: Verify the sync
        verify_cmd = f'psql "{staging_url}" -c "SELECT COUNT(*) FROM clergy;"'
        if run_command(verify_cmd, "Verifying clergy count"):
            print(f"\n✅ Database sync completed successfully!")
        
        # Clean up
        os.remove(dump_file)
        print(f"🧹 Cleaned up temporary files")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        # Clean up on error
        if os.path.exists(dump_file):
            os.remove(dump_file)

if __name__ == "__main__":
    main()
