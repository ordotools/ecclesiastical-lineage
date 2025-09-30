#!/usr/bin/env python3
"""
Update bishop ranks in the production database
This script should be run on the production server
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import app, db
from models import Rank

def update_production_bishop_ranks():
    """Update the is_bishop field for all ranks in production"""
    
    with app.app_context():
        print("🔍 Checking current rank data in production...")
        
        # Get all ranks
        ranks = Rank.query.all()
        
        print(f"Found {len(ranks)} ranks:")
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        # Update ranks that should be bishops
        bishop_keywords = ['bishop', 'archbishop', 'cardinal', 'pope', 'patriarch', 'metropolitan']
        
        updated_count = 0
        for rank in ranks:
            should_be_bishop = any(keyword in rank.name.lower() for keyword in bishop_keywords)
            
            if should_be_bishop and not rank.is_bishop:
                print(f"🔄 Updating {rank.name} to is_bishop = True")
                rank.is_bishop = True
                updated_count += 1
            elif not should_be_bishop and rank.is_bishop:
                print(f"🔄 Updating {rank.name} to is_bishop = False")
                rank.is_bishop = False
                updated_count += 1
        
        if updated_count > 0:
            db.session.commit()
            print(f"✅ Updated {updated_count} ranks in production database")
        else:
            print("✅ All ranks already have correct is_bishop values in production")
        
        # Show final state
        print("\nFinal rank data in production:")
        ranks = Rank.query.all()
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")

if __name__ == "__main__":
    update_production_bishop_ranks()
