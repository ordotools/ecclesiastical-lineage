#!/usr/bin/env python3
"""
Simple script to fix production rank data
This script can be run directly on the production server
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import app, db
from models import Rank

def fix_production_ranks():
    """Fix the is_bishop field for all ranks in production"""
    
    with app.app_context():
        print("🔧 FIXING PRODUCTION RANK DATA")
        print("=" * 40)
        
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
            try:
                db.session.commit()
                print(f"✅ Updated {updated_count} ranks in production database")
            except Exception as e:
                print(f"❌ Error committing changes: {e}")
                db.session.rollback()
                return False
        else:
            print("✅ All ranks already have correct is_bishop values")
        
        # Show final state
        print("\nFinal rank data:")
        ranks = Rank.query.all()
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        return True

if __name__ == "__main__":
    fix_production_ranks()
