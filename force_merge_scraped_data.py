#!/usr/bin/env python3
"""
Force merge scraped data into database.

This script:
1. Deletes all existing relationships from ordination and consecration tables
2. Imports the 97 links from advanced_scraped_data.json into the proper tables
3. Handles data transformation and validation
"""

import json
import sys
from datetime import datetime
from sqlalchemy import text

from app import app
from models import db, Clergy, Ordination, Consecration, co_consecrators

def delete_all_relationships():
    """Delete all existing relationships from ordination and consecration tables."""
    print("🗑️  Deleting all existing relationships...")
    
    try:
        # Delete co-consecrators first (foreign key constraint)
        db.session.execute(text("DELETE FROM co_consecrators"))
        print("   ✅ Deleted co-consecrators")
        
        # Delete ordinations
        db.session.execute(text("DELETE FROM ordination"))
        print("   ✅ Deleted ordinations")
        
        # Delete consecrations
        db.session.execute(text("DELETE FROM consecration"))
        print("   ✅ Deleted consecrations")
        
        db.session.commit()
        print("✅ All existing relationships deleted successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error deleting relationships: {e}")
        db.session.rollback()
        return False

def load_scraped_data():
    """Load and parse the scraped data from JSON file."""
    print("📄 Loading scraped data...")
    
    try:
        with open('advanced_scraped_data.json', 'r') as f:
            data = json.load(f)
        
        links_data = data['approaches']['Selenium-style HTML parsing']['linksData']
        print(f"   ✅ Loaded {len(links_data)} links from scraped data")
        return links_data
        
    except Exception as e:
        print(f"❌ Error loading scraped data: {e}")
        return None

def validate_clergy_ids(links_data):
    """Validate that all clergy IDs in the scraped data exist in the database."""
    print("🔍 Validating clergy IDs...")
    
    # Get all clergy IDs from scraped data
    scraped_ids = set()
    for link in links_data:
        scraped_ids.add(link['source'])
        scraped_ids.add(link['target'])
    
    # Get all clergy IDs from database
    db_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    db_ids = {c.id for c in db_clergy}
    
    # Check for missing IDs
    missing_ids = scraped_ids - db_ids
    if missing_ids:
        print(f"❌ Missing clergy IDs in database: {sorted(missing_ids)}")
        return False
    
    print(f"   ✅ All {len(scraped_ids)} clergy IDs validated")
    return True

def import_relationships(links_data):
    """Import the scraped relationships into the proper database tables."""
    print("📥 Importing relationships...")
    
    ordination_count = 0
    consecration_count = 0
    co_consecration_count = 0
    
    try:
        # Group links by type
        ordination_links = [l for l in links_data if l['type'] == 'ordination']
        consecration_links = [l for l in links_data if l['type'] == 'consecration']
        co_consecration_links = [l for l in links_data if l['type'] == 'co-consecration']
        
        print(f"   📊 Found {len(ordination_links)} ordination links")
        print(f"   📊 Found {len(consecration_links)} consecration links")
        print(f"   📊 Found {len(co_consecration_links)} co-consecration links")
        
        # Import ordinations
        for link in ordination_links:
            # Parse date - handle "Date unknown" case
            date_value = None
            if link['date'] and link['date'] != 'Date unknown':
                try:
                    date_value = datetime.strptime(link['date'], '%Y-%m-%d').date()
                except ValueError:
                    print(f"   ⚠️  Invalid date format for ordination {link['source']} -> {link['target']}: {link['date']}")
                    continue
            
            # Create ordination record
            ordination = Ordination(
                clergy_id=link['target'],
                date=date_value or datetime.now().date(),  # Use current date if unknown
                ordaining_bishop_id=link['source'],
                is_sub_conditione=False,
                is_doubtful=False,
                is_invalid=False,
                notes=f"Imported from scraped data on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(ordination)
            ordination_count += 1
        
        # Import consecrations
        for link in consecration_links:
            # Parse date - handle "Date unknown" case
            date_value = None
            if link['date'] and link['date'] != 'Date unknown':
                try:
                    date_value = datetime.strptime(link['date'], '%Y-%m-%d').date()
                except ValueError:
                    print(f"   ⚠️  Invalid date format for consecration {link['source']} -> {link['target']}: {link['date']}")
                    continue
            
            # Create consecration record
            consecration = Consecration(
                clergy_id=link['target'],
                date=date_value or datetime.now().date(),  # Use current date if unknown
                consecrator_id=link['source'],
                is_sub_conditione=False,
                is_doubtful=False,
                is_invalid=False,
                notes=f"Imported from scraped data on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(consecration)
            consecration_count += 1
        
        # Import co-consecrations (if any)
        for link in co_consecration_links:
            # Find the corresponding consecration
            consecration = Consecration.query.filter_by(
                clergy_id=link['target'],
                consecrator_id=link['source']
            ).first()
            
            if consecration:
                # Add co-consecrator relationship
                co_consecrator_id = link.get('co_consecrator_id', link['source'])
                db.session.execute(
                    co_consecrators.insert().values(
                        consecration_id=consecration.id,
                        co_consecrator_id=co_consecrator_id
                    )
                )
                co_consecration_count += 1
            else:
                print(f"   ⚠️  Could not find consecration for co-consecration link: {link}")
        
        # Commit all changes
        db.session.commit()
        
        print(f"   ✅ Imported {ordination_count} ordinations")
        print(f"   ✅ Imported {consecration_count} consecrations")
        print(f"   ✅ Imported {co_consecration_count} co-consecrations")
        
        return True
        
    except Exception as e:
        print(f"❌ Error importing relationships: {e}")
        db.session.rollback()
        return False

def verify_import():
    """Verify that the import was successful."""
    print("🔍 Verifying import...")
    
    try:
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        
        # Count co-consecrators
        co_consecrator_count = db.session.execute(text("SELECT COUNT(*) FROM co_consecrators")).scalar()
        
        print(f"   📊 Final counts:")
        print(f"      - Ordinations: {ordination_count}")
        print(f"      - Consecrations: {consecration_count}")
        print(f"      - Co-consecrators: {co_consecrator_count}")
        
        if ordination_count > 0 and consecration_count > 0:
            print("   ✅ Import verification successful")
            return True
        else:
            print("   ❌ Import verification failed - no relationships found")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying import: {e}")
        return False

def main():
    """Main function to execute the force merge."""
    print("🚀 Starting force merge of scraped data...")
    print("=" * 50)
    
    with app.app_context():
        try:
            # Step 1: Load scraped data
            links_data = load_scraped_data()
            if not links_data:
                print("❌ Failed to load scraped data")
                sys.exit(1)
            
            # Step 2: Validate clergy IDs
            if not validate_clergy_ids(links_data):
                print("❌ Clergy ID validation failed")
                sys.exit(1)
            
            # Step 3: Delete existing relationships
            if not delete_all_relationships():
                print("❌ Failed to delete existing relationships")
                sys.exit(1)
            
            # Step 4: Import new relationships
            if not import_relationships(links_data):
                print("❌ Failed to import relationships")
                sys.exit(1)
            
            # Step 5: Verify import
            if not verify_import():
                print("❌ Import verification failed")
                sys.exit(1)
            
            print("=" * 50)
            print("🎉 Force merge completed successfully!")
            print("   All relationships have been replaced with scraped data.")
            
        except Exception as e:
            print(f"❌ Unexpected error during force merge: {e}")
            db.session.rollback()
            sys.exit(1)

if __name__ == "__main__":
    main()
