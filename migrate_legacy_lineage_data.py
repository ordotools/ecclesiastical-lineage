#!/usr/bin/env python3
"""
One-time data migration script for production deployment.
Transfers legacy ordination and consecration data from clergy table fields 
to new relationship tables.

This script is safe to run multiple times - it checks for existing data
before creating new records.

Usage:
    python migrate_legacy_lineage_data.py
"""

import json
import sys
from datetime import datetime
from sqlalchemy import text

from app import app, db
from models import Clergy, Ordination, Consecration


def migrate_legacy_lineage_data():
    """Migrate legacy ordination and consecration data to new relationship tables."""
    
    with app.app_context():
        print("🔄 Starting legacy lineage data migration...")
        
        # Check if legacy columns still exist
        result = db.session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clergy' 
            AND column_name IN ('ordaining_bishop_id', 'consecrator_id', 'date_of_ordination', 'date_of_consecration', 'co_consecrators')
            ORDER BY column_name;
        """))
        
        legacy_columns = [row[0] for row in result.fetchall()]
        
        if len(legacy_columns) == 0:
            print("✅ Legacy columns not found. Data migration may have already been completed.")
            return
        
        print(f"📊 Found legacy columns: {', '.join(legacy_columns)}")
        
        # Check if we have any data to migrate
        result = db.session.execute(text("""
            SELECT COUNT(*) as count 
            FROM clergy 
            WHERE ordaining_bishop_id IS NOT NULL OR consecrator_id IS NOT NULL;
        """))
        
        clergy_with_legacy_data = result.fetchone()[0]
        
        if clergy_with_legacy_data == 0:
            print("✅ No legacy data found to migrate.")
            return
        
        print(f"📊 Found {clergy_with_legacy_data} clergy records with legacy data")
        
        # Check if data has already been migrated
        existing_ordinations = Ordination.query.count()
        existing_consecrations = Consecration.query.count()
        
        if existing_ordinations > 0 or existing_consecrations > 0:
            print(f"⚠️  Found existing data in new tables:")
            print(f"   - Ordinations: {existing_ordinations}")
            print(f"   - Consecrations: {existing_consecrations}")
            print("✅ Data migration appears to have already been completed.")
            return
        
        print("🔄 Starting data migration...")
        
        # Migrate ordinations
        print("\n🔄 Migrating ordinations...")
        ordination_count = 0
        
        result = db.session.execute(text("""
            SELECT id, name, ordaining_bishop_id, date_of_ordination 
            FROM clergy 
            WHERE ordaining_bishop_id IS NOT NULL;
        """))
        
        for row in result.fetchall():
            clergy_id, name, ordaining_bishop_id, date_of_ordination = row
            
            # Create new ordination record
            ordination = Ordination(
                clergy_id=clergy_id,
                date=date_of_ordination or datetime.now().date(),
                ordaining_bishop_id=ordaining_bishop_id,
                is_sub_conditione=False,
                is_doubtful=False,
                is_invalid=False,
                notes=f"Migrated from legacy data for {name}",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(ordination)
            ordination_count += 1
        
        print(f"✅ Created {ordination_count} ordination records")
        
        # Migrate consecrations
        print("\n🔄 Migrating consecrations...")
        consecration_count = 0
        co_consecration_count = 0
        
        result = db.session.execute(text("""
            SELECT id, name, consecrator_id, date_of_consecration, co_consecrators 
            FROM clergy 
            WHERE consecrator_id IS NOT NULL;
        """))
        
        for row in result.fetchall():
            clergy_id, name, consecrator_id, date_of_consecration, co_consecrators_json = row
            
            # Create new consecration record
            consecration = Consecration(
                clergy_id=clergy_id,
                date=date_of_consecration or datetime.now().date(),
                consecrator_id=consecrator_id,
                is_sub_conditione=False,
                is_doubtful=False,
                is_invalid=False,
                notes=f"Migrated from legacy data for {name}",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(consecration)
            db.session.flush()  # Get the ID
            
            consecration_count += 1
            
            # Handle co-consecrators if they exist
            if co_consecrators_json:
                try:
                    co_consecrator_ids = json.loads(co_consecrators_json)
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
                except (json.JSONDecodeError, TypeError):
                    print(f"⚠️  Could not parse co_consecrators for {name}: {co_consecrators_json}")
        
        print(f"✅ Created {consecration_count} consecration records")
        print(f"✅ Created {co_consecration_count} co-consecrator relationships")
        
        # Commit all changes
        try:
            db.session.commit()
            print("\n🎉 Migration completed successfully!")
            
            # Verify the migration
            print("\n📊 Verification:")
            ordinations = Ordination.query.count()
            consecrations = Consecration.query.count()
            print(f"   - Ordinations in new table: {ordinations}")
            print(f"   - Consecrations in new table: {consecrations}")
            
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
            else:
                print("❌ No links generated - there may be an issue")
                
        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    try:
        migrate_legacy_lineage_data()
        print("\n✅ Migration script completed successfully!")
    except Exception as e:
        print(f"💥 Migration script failed: {e}")
        sys.exit(1)
