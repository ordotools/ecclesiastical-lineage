#!/usr/bin/env python3
"""
One-time script to run force merge on Render deployment.
This script will be executed during deployment to perform the force merge.
"""

import os
import sys
import json
from datetime import datetime
from sqlalchemy import text

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, Clergy, Ordination, Consecration, co_consecrators

def main():
    """Run the force merge on Render."""
    print("🚀 Running force merge on Render...")
    
    with app.app_context():
        try:
            # Load scraped data
            with open('advanced_scraped_data.json', 'r') as f:
                data = json.load(f)
            
            links_data = data['approaches']['Selenium-style HTML parsing']['linksData']
            print(f"📄 Loaded {len(links_data)} links from scraped data")
            
            # Delete all existing relationships
            print("🗑️  Deleting existing relationships...")
            db.session.execute(text("DELETE FROM co_consecrators"))
            db.session.execute(text("DELETE FROM ordination"))
            db.session.execute(text("DELETE FROM consecration"))
            db.session.commit()
            print("✅ Existing relationships deleted")
            
            # Import new relationships
            print("📥 Importing scraped relationships...")
            
            ordination_count = 0
            consecration_count = 0
            
            for link in links_data:
                # Parse date
                date_value = None
                if link['date'] and link['date'] != 'Date unknown':
                    try:
                        date_value = datetime.strptime(link['date'], '%Y-%m-%d').date()
                    except ValueError:
                        date_value = datetime.now().date()
                else:
                    date_value = datetime.now().date()
                
                if link['type'] == 'ordination':
                    ordination = Ordination(
                        clergy_id=link['target'],
                        date=date_value,
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
                
                elif link['type'] == 'consecration':
                    consecration = Consecration(
                        clergy_id=link['target'],
                        date=date_value,
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
            
            db.session.commit()
            
            print(f"✅ Imported {ordination_count} ordinations and {consecration_count} consecrations")
            print("🎉 Force merge completed successfully on Render!")
            
        except Exception as e:
            print(f"❌ Error during force merge: {e}")
            db.session.rollback()
            sys.exit(1)

if __name__ == "__main__":
    main()
