#!/usr/bin/env python3
"""
Simple script to restore original lineage relationships from a backup file.
This version uses pg_restore and psql commands directly without temporary databases.

Usage:
    python restore_relationships_simple.py --backup-file backup.sql --target staging
    python restore_relationships_simple.py --backup-file backup.sql --target production
"""

import argparse
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
            return True, result.stdout
        else:
            print(f"❌ {description} failed: {result.stderr}")
            return False, result.stderr
    except Exception as e:
        print(f"❌ {description} error: {e}")
        return False, str(e)

def extract_clergy_data_from_backup(backup_file):
    """Extract clergy table data from backup file"""
    print(f"📊 Extracting clergy data from {backup_file}...")
    
    # Use grep to extract clergy table data from backup
    # This extracts INSERT statements for the clergy table
    extract_cmd = f'grep -E "INSERT INTO clergy|COPY clergy" {backup_file} > /tmp/clergy_data.sql'
    
    success, output = run_command(extract_cmd, "Extracting clergy data from backup")
    if not success:
        print(f"❌ Could not extract clergy data: {output}")
        return False
    
    return True

def create_restoration_sql():
    """Create SQL script to restore legacy relationships"""
    print("📝 Creating restoration SQL script...")
    
    restoration_sql = """
-- Script to restore legacy relationships from clergy table data
-- This script assumes the clergy table has been restored with legacy fields

BEGIN;

-- Clear existing relationship data
DELETE FROM co_consecrators;
DELETE FROM consecration;
DELETE FROM ordination;

-- Restore ordinations from legacy data
INSERT INTO ordination (clergy_id, date, ordaining_bishop_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at)
SELECT 
    id as clergy_id,
    COALESCE(date_of_ordination, CURRENT_DATE) as date,
    ordaining_bishop_id,
    false as is_sub_conditione,
    false as is_doubtful,
    false as is_invalid,
    'Restored from legacy data for ' || name as notes,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM clergy 
WHERE ordaining_bishop_id IS NOT NULL;

-- Restore consecrations from legacy data
INSERT INTO consecration (clergy_id, date, consecrator_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at)
SELECT 
    id as clergy_id,
    COALESCE(date_of_consecration, CURRENT_DATE) as date,
    consecrator_id,
    false as is_sub_conditione,
    false as is_doubtful,
    false as is_invalid,
    'Restored from legacy data for ' || name as notes,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM clergy 
WHERE consecrator_id IS NOT NULL;

-- Restore co-consecrators from legacy data
-- Note: This requires the co_consecrators field to contain valid JSON array of clergy IDs
INSERT INTO co_consecrators (consecration_id, co_consecrator_id)
SELECT 
    c.id as consecration_id,
    json_array_elements_text(co_consecrators::json)::integer as co_consecrator_id
FROM clergy cl
JOIN consecration c ON c.clergy_id = cl.id
WHERE cl.co_consecrators IS NOT NULL 
  AND cl.co_consecrators != 'null'
  AND cl.co_consecrators != ''
  AND json_array_length(cl.co_consecrators::json) > 0;

-- Verify restoration
SELECT 'Ordinations restored: ' || COUNT(*) FROM ordination;
SELECT 'Consecrations restored: ' || COUNT(*) FROM consecration;
SELECT 'Co-consecrator relationships restored: ' || COUNT(*) FROM co_consecrators;

COMMIT;
"""
    
    with open('/tmp/restore_relationships.sql', 'w') as f:
        f.write(restoration_sql)
    
    print("✅ Created restoration SQL script")
    return True

def restore_to_database(target_url, backup_file):
    """Restore backup and relationships to target database"""
    print(f"🔄 Restoring to target database...")
    
    try:
        # Step 1: Restore the backup file (this will restore clergy table with legacy fields)
        print("📥 Restoring backup file...")
        restore_cmd = f'psql "{target_url}" < {backup_file}'
        success, output = run_command(restore_cmd, "Restoring backup file")
        if not success:
            print(f"❌ Backup restoration failed: {output}")
            return False
        
        # Step 2: Run the relationship restoration SQL
        print("🔗 Restoring relationships...")
        relationship_cmd = f'psql "{target_url}" < /tmp/restore_relationships.sql'
        success, output = run_command(relationship_cmd, "Restoring relationships")
        if not success:
            print(f"❌ Relationship restoration failed: {output}")
            return False
        
        # Step 3: Verify the restoration
        print("🔍 Verifying restoration...")
        verify_cmd = f'psql "{target_url}" -c "SELECT COUNT(*) as ordinations FROM ordination; SELECT COUNT(*) as consecrations FROM consecration; SELECT COUNT(*) as co_consecrators FROM co_consecrators;"'
        success, output = run_command(verify_cmd, "Verifying restoration")
        if success:
            print("📊 Restoration results:")
            print(output)
            print("✅ Relationships restored successfully!")
        else:
            print(f"⚠️  Verification failed: {output}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during restoration: {e}")
        return False
    finally:
        # Clean up temporary files
        if os.path.exists('/tmp/restore_relationships.sql'):
            os.remove('/tmp/restore_relationships.sql')

def main():
    parser = argparse.ArgumentParser(description='Restore original lineage relationships from backup')
    parser.add_argument('--backup-file', required=True, help='Path to the database backup file')
    parser.add_argument('--target', choices=['staging', 'production'], required=True, 
                       help='Target database (staging or production)')
    parser.add_argument('--force', action='store_true', 
                       help='Skip confirmation prompts')
    
    args = parser.parse_args()
    
    # Load environment variables
    load_dotenv()
    
    # Set target database URL
    if args.target == 'staging':
        target_url = os.environ.get('STAGING_DATABASE_URL')
        target_name = 'staging'
    else:
        target_url = os.environ.get('PRODUCTION_DATABASE_URL')
        target_name = 'production'
    
    if not target_url:
        print(f"❌ {target_name.upper()}_DATABASE_URL not found in environment")
        return 1
    
    print(f"🔄 Restoring Original Relationships to {target_name.title()}")
    print("=" * 50)
    print(f"📁 Backup file: {args.backup_file}")
    print(f"🎯 Target: {target_name.title()}")
    print(f"📊 Database: {target_url[:50]}...")
    
    # Check if backup file exists
    if not os.path.exists(args.backup_file):
        print(f"❌ Backup file not found: {args.backup_file}")
        return 1
    
    # Confirmation prompt
    if not args.force:
        print(f"\n⚠️  WARNING: This will replace ALL existing data in {target_name.title()}!")
        print("This action cannot be undone.")
        response = input(f"Are you sure you want to proceed? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Operation cancelled")
            return 1
    
    try:
        # Create restoration SQL script
        if not create_restoration_sql():
            return 1
        
        # Restore to target database
        if not restore_to_database(target_url, args.backup_file):
            return 1
        
        print(f"\n🎉 Successfully restored original relationships to {target_name.title()}!")
        print("The lineage visualization should now display the original relationships.")
        
        return 0
        
    except Exception as e:
        print(f"💥 Restoration failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
