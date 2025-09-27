#!/usr/bin/env python3
"""
Script to restore original lineage relationships from PostgreSQL .dat backup files.
This script handles the custom format dumps and restores them to staging first.

Usage:
    python restore_from_dat_files.py --recovery-dir recovery --target staging
    python restore_from_dat_files.py --recovery-dir recovery --target production
"""

import argparse
import glob
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


def find_dat_files(recovery_dir):
    """Find all .dat files in the recovery directory"""
    dat_pattern = os.path.join(recovery_dir, "*.dat")
    dat_files = glob.glob(dat_pattern)
    
    # Filter out toc.dat if it exists
    dat_files = [f for f in dat_files if not f.endswith('toc.dat')]
    
    if not dat_files:
        print(f"❌ No .dat files found in {recovery_dir}")
        return None
    
    print(f"📁 Found {len(dat_files)} .dat files:")
    for dat_file in dat_files:
        print(f"   - {os.path.basename(dat_file)}")
    
    return dat_files


def restore_dat_to_temp_db(dat_files, temp_db_name):
    """Restore .dat files to a temporary database"""
    print(f"📥 Restoring .dat files to temporary database: {temp_db_name}")
    
    try:
        # Create temporary database
        success, output = run_command(
            f'createdb {temp_db_name}',
            f"Creating temporary database {temp_db_name}"
        )
        if not success:
            print(f"❌ Could not create temporary database: {output}")
            return False
        
        # Restore each .dat file
        for dat_file in dat_files:
            filename = os.path.basename(dat_file)
            print(f"🔄 Restoring {filename}...")
            
            # Use pg_restore for custom format files
            success, output = run_command(
                f'pg_restore -d {temp_db_name} --clean --if-exists {dat_file}',
                f"Restoring {filename}"
            )
            if not success:
                print(f"⚠️  Warning: Could not restore {filename}: {output}")
                # Continue with other files
        
        print("✅ DAT files restored to temporary database")
        return True
        
    except Exception as e:
        print(f"❌ Error restoring DAT files: {e}")
        return False


def extract_legacy_data_from_temp_db(temp_db_name):
    """Extract legacy relationship data from temporary database"""
    print(f"📊 Extracting legacy data from temporary database...")
    
    try:
        # Check if legacy columns exist
        check_columns_sql = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clergy' 
        AND column_name IN ('ordaining_bishop_id', 'consecrator_id', 'date_of_ordination', 'date_of_consecration', 'co_consecrators')
        ORDER BY column_name;
        """
        
        success, output = run_command(
            f'psql {temp_db_name} -c "{check_columns_sql}" -t',
            "Checking for legacy columns"
        )
        
        if not success:
            print(f"❌ Could not check columns: {output}")
            return None
        
        legacy_columns = [line.strip() for line in output.strip().split('\n') if line.strip()]
        
        if len(legacy_columns) == 0:
            print("❌ No legacy columns found in clergy table")
            return None
        
        print(f"📊 Found legacy columns: {', '.join(legacy_columns)}")
        
        # Extract legacy relationship data
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
            f'psql {temp_db_name} -c "{extract_sql}" -t',
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
                    ordaining_bishop_id = int(parts[2]) if parts[2] and parts[2] != 'NULL' else None
                    date_of_ordination = parts[3] if parts[3] and parts[3] != 'NULL' else None
                    consecrator_id = int(parts[4]) if parts[4] and parts[4] != 'NULL' else None
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
                try:
                    ordination_date = datetime.strptime(data['date_of_ordination'], '%Y-%m-%d').date() if data['date_of_ordination'] else datetime.now().date()
                except ValueError:
                    ordination_date = datetime.now().date()
                
                ordination = Ordination(
                    clergy_id=clergy_id,
                    date=ordination_date,
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
                try:
                    consecration_date = datetime.strptime(data['date_of_consecration'], '%Y-%m-%d').date() if data['date_of_consecration'] else datetime.now().date()
                except ValueError:
                    consecration_date = datetime.now().date()
                
                consecration = Consecration(
                    clergy_id=clergy_id,
                    date=consecration_date,
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


def cleanup_temp_db(temp_db_name):
    """Clean up temporary database"""
    print(f"🧹 Cleaning up temporary database...")
    success, output = run_command(f'dropdb {temp_db_name}', f"Dropping temporary database {temp_db_name}")
    if success:
        print("✅ Temporary database cleaned up")
    else:
        print(f"⚠️  Warning: Could not clean up temporary database: {output}")


def main():
    parser = argparse.ArgumentParser(description='Restore original lineage relationships from .dat backup files')
    parser.add_argument('--recovery-dir', default='recovery', help='Directory containing .dat backup files')
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
    
    print(f"🔄 Restoring Original Relationships from .dat files to {target_name.title()}")
    print("=" * 60)
    print(f"📁 Recovery directory: {args.recovery_dir}")
    print(f"🎯 Target: {target_name.title()}")
    print(f"📊 Database: {target_url[:50]}...")
    
    # Check if recovery directory exists
    if not os.path.exists(args.recovery_dir):
        print(f"❌ Recovery directory not found: {args.recovery_dir}")
        return 1
    
    # Find .dat files
    dat_files = find_dat_files(args.recovery_dir)
    if not dat_files:
        return 1
    
    # Confirmation prompt
    if not args.force:
        print(f"\n⚠️  WARNING: This will replace ALL existing relationship data in {target_name.title()}!")
        print("This action cannot be undone.")
        response = input(f"Are you sure you want to proceed? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Operation cancelled")
            return 1
    
    # Create temporary database name
    temp_db_name = f"temp_restore_{target_name}_{int(datetime.now().timestamp())}"
    
    try:
        # Step 1: Restore .dat files to temporary database
        if not restore_dat_to_temp_db(dat_files, temp_db_name):
            return 1
        
        # Step 2: Extract legacy data from temporary database
        legacy_data = extract_legacy_data_from_temp_db(temp_db_name)
        if not legacy_data:
            print("❌ No legacy data found or extraction failed")
            return 1
        
        # Step 3: Connect to target database and restore relationships
        with app.app_context():
            # Update database URL for target
            app.config['SQLALCHEMY_DATABASE_URI'] = target_url
            
            # Clear existing relationships
            if not clear_existing_relationships():
                return 1
            
            # Restore relationships
            if not restore_relationships(legacy_data):
                return 1
            
            # Verify restoration
            if not verify_restoration():
                return 1
        
        print(f"\n🎉 Successfully restored original relationships to {target_name.title()}!")
        print("The lineage visualization should now display the original relationships.")
        
        return 0
        
    except Exception as e:
        print(f"💥 Restoration failed: {e}")
        return 1
    finally:
        # Always clean up temporary database
        cleanup_temp_db(temp_db_name)


if __name__ == "__main__":
    sys.exit(main())
