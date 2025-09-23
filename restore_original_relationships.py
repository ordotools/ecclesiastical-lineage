#!/usr/bin/env python3
"""
Script to restore original lineage relationships from a previous database backup.
This script can restore the legacy ordination and consecration data from a backup file
to either staging or production databases.

Usage:
    python restore_original_relationships.py --backup-file backup.sql --target staging
    python restore_original_relationships.py --backup-file backup.sql --target production
    
The script will:
1. Extract legacy relationship data from the backup file
2. Clear existing ordination/consecration tables in target database
3. Restore the original relationships
4. Verify the restoration was successful

Requirements:
- The backup file must contain the clergy table with legacy fields:
  - ordaining_bishop_id
  - date_of_ordination  
  - consecrator_id
  - date_of_consecration
  - co_consecrators
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import text

from app import app, db
from models import Clergy, Ordination, Consecration


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


def extract_legacy_data_from_backup(backup_file):
    """Extract legacy relationship data from backup file"""
    print(f"📊 Extracting legacy data from {backup_file}...")
    
    # Create a temporary database to load the backup
    temp_db_url = "postgresql://temp:temp@localhost/temp_restore_db"
    
    try:
        # Create temporary database
        success, output = run_command(
            f'createdb -h localhost temp_restore_db',
            "Creating temporary database"
        )
        if not success:
            # Try without -h localhost for local connections
            success, output = run_command(
                f'createdb temp_restore_db',
                "Creating temporary database (local connection)"
            )
            if not success:
                print(f"❌ Could not create temporary database: {output}")
                return None
        
        # Restore backup to temporary database
        success, output = run_command(
            f'psql temp_restore_db < {backup_file}',
            "Restoring backup to temporary database"
        )
        if not success:
            print(f"❌ Could not restore backup: {output}")
            return None
        
        # Extract legacy data from temporary database
        extract_sql = """
        SELECT 
            id, name, 
            ordaining_bishop_id, date_of_ordination,
            consecrator_id, date_of_consecration, co_consecrators
        FROM clergy 
        WHERE ordaining_bishop_id IS NOT NULL 
           OR consecrator_id IS NOT NULL
        ORDER BY id;
        """
        
        success, output = run_command(
            f'psql temp_restore_db -c "{extract_sql}" -t',
            "Extracting legacy relationship data"
        )
        
        if not success:
            print(f"❌ Could not extract legacy data: {output}")
            return None
        
        # Parse the output
        legacy_data = []
        lines = output.strip().split('\n')
        
        for line in lines:
            if not line.strip():
                continue
            parts = [part.strip() for part in line.split('|')]
            if len(parts) >= 7:
                try:
                    clergy_id = int(parts[0]) if parts[0] else None
                    name = parts[1]
                    ordaining_bishop_id = int(parts[2]) if parts[2] else None
                    date_of_ordination = parts[3] if parts[3] and parts[3] != 'NULL' else None
                    consecrator_id = int(parts[4]) if parts[4] else None
                    date_of_consecration = parts[5] if parts[5] and parts[5] != 'NULL' else None
                    co_consecrators_json = parts[6] if parts[6] and parts[6] != 'NULL' else None
                    
                    legacy_data.append({
                        'clergy_id': clergy_id,
                        'name': name,
                        'ordaining_bishop_id': ordaining_bishop_id,
                        'date_of_ordination': date_of_ordination,
                        'consecrator_id': consecrator_id,
                        'date_of_consecration': date_of_consecration,
                        'co_consecrators_json': co_consecrators_json
                    })
                except (ValueError, IndexError) as e:
                    print(f"⚠️  Could not parse line: {line} - {e}")
                    continue
        
        print(f"✅ Extracted {len(legacy_data)} clergy records with legacy relationship data")
        return legacy_data
        
    except Exception as e:
        print(f"❌ Error extracting legacy data: {e}")
        return None
    finally:
        # Clean up temporary database
        run_command('dropdb temp_restore_db', "Cleaning up temporary database")


def clear_existing_relationships():
    """Clear existing ordination and consecration data"""
    print("🗑️  Clearing existing relationship data...")
    
    try:
        # Clear co-consecrators first (due to foreign key constraints)
        db.session.execute(text("DELETE FROM co_consecrators"))
        db.session.execute(text("DELETE FROM consecration"))
        db.session.execute(text("DELETE FROM ordination"))
        db.session.commit()
        
        print("✅ Cleared existing relationship data")
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error clearing existing data: {e}")
        return False


def restore_relationships(legacy_data):
    """Restore relationships from legacy data"""
    print("🔄 Restoring relationships from legacy data...")
    
    ordination_count = 0
    consecration_count = 0
    co_consecration_count = 0
    
    try:
        for data in legacy_data:
            clergy_id = data['clergy_id']
            name = data['name']
            
            # Create ordination record if ordaining bishop exists
            if data['ordaining_bishop_id']:
                ordination = Ordination(
                    clergy_id=clergy_id,
                    date=datetime.strptime(data['date_of_ordination'], '%Y-%m-%d').date() if data['date_of_ordination'] else datetime.now().date(),
                    ordaining_bishop_id=data['ordaining_bishop_id'],
                    is_sub_conditione=False,
                    is_doubtful=False,
                    is_invalid=False,
                    notes=f"Restored from legacy data for {name}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(ordination)
                ordination_count += 1
            
            # Create consecration record if consecrator exists
            if data['consecrator_id']:
                consecration = Consecration(
                    clergy_id=clergy_id,
                    date=datetime.strptime(data['date_of_consecration'], '%Y-%m-%d').date() if data['date_of_consecration'] else datetime.now().date(),
                    consecrator_id=data['consecrator_id'],
                    is_sub_conditione=False,
                    is_doubtful=False,
                    is_invalid=False,
                    notes=f"Restored from legacy data for {name}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(consecration)
                db.session.flush()  # Get the ID
                
                consecration_count += 1
                
                # Handle co-consecrators if they exist
                if data['co_consecrators_json']:
                    try:
                        co_consecrator_ids = json.loads(data['co_consecrators_json'])
                        if isinstance(co_consecrator_ids, list):
                            for co_id in co_consecrator_ids:
                                if isinstance(co_id, int):
                                    # Add co-consecrator relationship
                                    db.session.execute(text("""
                                        INSERT INTO co_consecrators (consecration_id, co_consecrator_id)
                                        VALUES (:consecration_id, :co_consecrator_id)
                                        ON CONFLICT DO NOTHING
                                    """), {
                                        'consecration_id': consecration.id,
                                        'co_consecrator_id': co_id
                                    })
                                    co_consecration_count += 1
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"⚠️  Could not parse co_consecrators for {name}: {data['co_consecrators_json']} - {e}")
        
        # Commit all changes
        db.session.commit()
        
        print(f"✅ Created {ordination_count} ordination records")
        print(f"✅ Created {consecration_count} consecration records")
        print(f"✅ Created {co_consecration_count} co-consecrator relationships")
        
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error restoring relationships: {e}")
        return False


def verify_restoration():
    """Verify that the restoration was successful"""
    print("🔍 Verifying restoration...")
    
    try:
        # Count restored data
        ordinations = Ordination.query.count()
        consecrations = Consecration.query.count()
        co_consecrators = db.session.execute(text("SELECT COUNT(*) FROM co_consecrators")).scalar()
        
        print(f"📊 Restoration results:")
        print(f"   - Ordinations: {ordinations}")
        print(f"   - Consecrations: {consecrations}")
        print(f"   - Co-consecrator relationships: {co_consecrators}")
        
        # Test lineage data generation
        print("\n🔗 Testing lineage data generation...")
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        links = []
        
        # Count ordination links
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination'
                    })
        
        # Count consecration links
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration'
                    })
        
        print(f"   - Generated {len(links)} lineage links")
        
        if len(links) > 0:
            print("✅ Lineage visualization should now work!")
            return True
        else:
            print("❌ No links generated - there may be an issue")
            return False
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False


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
        print(f"\n⚠️  WARNING: This will replace ALL existing relationship data in {target_name.title()}!")
        print("This action cannot be undone.")
        response = input(f"Are you sure you want to proceed? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Operation cancelled")
            return 1
    
    try:
        # Step 1: Extract legacy data from backup
        legacy_data = extract_legacy_data_from_backup(args.backup_file)
        if not legacy_data:
            print("❌ No legacy data found or extraction failed")
            return 1
        
        # Step 2: Connect to target database and clear existing data
        with app.app_context():
            # Update database URL for target
            app.config['SQLALCHEMY_DATABASE_URI'] = target_url
            
            # Clear existing relationships
            if not clear_existing_relationships():
                return 1
            
            # Step 3: Restore relationships
            if not restore_relationships(legacy_data):
                return 1
            
            # Step 4: Verify restoration
            if not verify_restoration():
                return 1
        
        print(f"\n🎉 Successfully restored original relationships to {target_name.title()}!")
        print("The lineage visualization should now display the original relationships.")
        
        return 0
        
    except Exception as e:
        print(f"💥 Restoration failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
