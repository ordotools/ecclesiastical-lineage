#!/usr/bin/env python3
"""
One-liner script to fix rank data immediately
Run this on Render: python3 fix_ranks_now.py
"""

import os
import sys
sys.path.append(os.getcwd())

from app import app, db
from models import Rank

with app.app_context():
    print("🔧 FIXING RANKS NOW")
    ranks = Rank.query.all()
    bishop_keywords = ['bishop', 'archbishop', 'cardinal', 'pope', 'patriarch', 'metropolitan']
    
    updated = 0
    for rank in ranks:
        should_be_bishop = any(keyword in rank.name.lower() for keyword in bishop_keywords)
        if should_be_bishop != rank.is_bishop:
            print(f"Updating {rank.name}: {rank.is_bishop} -> {should_be_bishop}")
            rank.is_bishop = should_be_bishop
            updated += 1
    
    if updated > 0:
        db.session.commit()
        print(f"✅ Updated {updated} ranks")
    else:
        print("✅ All ranks already correct")
    
    print("\nFinal state:")
    for rank in Rank.query.all():
        print(f"  {rank.name}: {rank.is_bishop}")
