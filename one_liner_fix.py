#!/usr/bin/env python3
# One-liner fix for production rank data
import os, sys; sys.path.append(os.getcwd()); from app import app, db; from models import Rank; exec("""
with app.app_context():
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
    print("Final state:")
    for rank in Rank.query.all():
        print(f"  {rank.name}: {rank.is_bishop}")
""")
