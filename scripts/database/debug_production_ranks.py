#!/usr/bin/env python3
"""
Debug script to check and fix production rank data
This script will show the current state and fix any issues
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import app, db
from models import Rank

def debug_production_ranks():
    """Debug and fix the is_bishop field for all ranks in production"""
    
    with app.app_context():
        print("🔍 DEBUGGING PRODUCTION RANK DATA")
        print("=" * 50)
        
        # Get all ranks
        ranks = Rank.query.all()
        
        print(f"Found {len(ranks)} ranks in production database:")
        print("-" * 30)
        
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        print("\n🔧 CHECKING WHAT SHOULD BE BISHOPS")
        print("-" * 30)
        
        # Define bishop keywords
        bishop_keywords = ['bishop', 'archbishop', 'cardinal', 'pope', 'patriarch', 'metropolitan']
        
        needs_fix = []
        for rank in ranks:
            should_be_bishop = any(keyword in rank.name.lower() for keyword in bishop_keywords)
            current_value = rank.is_bishop
            
            print(f"  - {rank.name}:")
            print(f"    Should be bishop: {should_be_bishop}")
            print(f"    Current value: {current_value}")
            print(f"    Needs fix: {should_be_bishop != current_value}")
            
            if should_be_bishop != current_value:
                needs_fix.append((rank, should_be_bishop))
        
        if needs_fix:
            print(f"\n🔧 FIXING {len(needs_fix)} RANKS")
            print("-" * 30)
            
            for rank, should_be_bishop in needs_fix:
                print(f"  Updating {rank.name}: {rank.is_bishop} -> {should_be_bishop}")
                rank.is_bishop = should_be_bishop
            
            try:
                db.session.commit()
                print("✅ Changes committed to database")
            except Exception as e:
                print(f"❌ Error committing changes: {e}")
                db.session.rollback()
                return False
        else:
            print("\n✅ All ranks already have correct is_bishop values")
        
        print("\n📊 FINAL STATE")
        print("-" * 30)
        
        # Show final state
        ranks = Rank.query.all()
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        return True

if __name__ == "__main__":
    debug_production_ranks()
