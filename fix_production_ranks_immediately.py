#!/usr/bin/env python3
"""
Immediate fix for production rank data
Run this on the production server to fix the rank data immediately
"""

import os
import sys
sys.path.append(os.getcwd())

from app import app, db
from models import Rank

def fix_production_ranks_immediately():
    """Fix production rank data immediately"""
    
    with app.app_context():
        print("🚨 IMMEDIATE PRODUCTION RANK FIX")
        print("=" * 50)
        
        # Get all ranks
        ranks = Rank.query.all()
        
        print(f"Found {len(ranks)} ranks in production database:")
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        # Define bishop keywords
        bishop_keywords = ['bishop', 'archbishop', 'cardinal', 'pope', 'patriarch', 'metropolitan']
        
        print(f"\n🔧 Fixing ranks based on keywords: {bishop_keywords}")
        
        # Fix the data
        updated_count = 0
        for rank in ranks:
            should_be_bishop = any(keyword in rank.name.lower() for keyword in bishop_keywords)
            current_value = rank.is_bishop
            
            if should_be_bishop != current_value:
                print(f"🔄 UPDATING {rank.name}: {current_value} -> {should_be_bishop}")
                rank.is_bishop = should_be_bishop
                updated_count += 1
            else:
                print(f"✅ {rank.name}: already correct")
        
        # Commit changes
        if updated_count > 0:
            try:
                db.session.commit()
                print(f"\n✅ SUCCESS: Updated {updated_count} ranks in production database")
            except Exception as e:
                print(f"\n❌ ERROR: Failed to commit changes: {e}")
                db.session.rollback()
                return False
        else:
            print("\n✅ All ranks already have correct values")
        
        # Show final state
        print("\n📊 FINAL PRODUCTION RANK DATA:")
        ranks = Rank.query.all()
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        print("\n🎯 This should fix the consecration field issue!")
        return True

if __name__ == "__main__":
    fix_production_ranks_immediately()
