#!/usr/bin/env python3
"""
Comprehensive rank fix script that addresses all possible issues
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import app, db
from models import Rank

def comprehensive_rank_fix():
    """Comprehensive fix for rank data issues"""
    
    with app.app_context():
        print("🔧 COMPREHENSIVE RANK FIX")
        print("=" * 50)
        
        # Step 1: Check current state
        print("📊 Current rank data:")
        ranks = Rank.query.all()
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        # Step 2: Define what should be bishops
        bishop_keywords = ['bishop', 'archbishop', 'cardinal', 'pope', 'patriarch', 'metropolitan']
        
        print(f"\n🔍 Checking against keywords: {bishop_keywords}")
        
        # Step 3: Fix the data
        updated_count = 0
        for rank in ranks:
            should_be_bishop = any(keyword in rank.name.lower() for keyword in bishop_keywords)
            current_value = rank.is_bishop
            
            if should_be_bishop != current_value:
                print(f"🔄 Fixing {rank.name}: {current_value} -> {should_be_bishop}")
                rank.is_bishop = should_be_bishop
                updated_count += 1
            else:
                print(f"✅ {rank.name}: already correct ({current_value})")
        
        # Step 4: Commit changes
        if updated_count > 0:
            try:
                db.session.commit()
                print(f"\n✅ Successfully updated {updated_count} ranks")
            except Exception as e:
                print(f"\n❌ Error committing changes: {e}")
                db.session.rollback()
                return False
        else:
            print("\n✅ No changes needed - all ranks are correct")
        
        # Step 5: Verify final state
        print("\n📊 Final rank data:")
        ranks = Rank.query.all()
        for rank in ranks:
            print(f"  - {rank.name}: is_bishop = {rank.is_bishop}")
        
        # Step 6: Test template rendering
        print("\n🧪 Testing template rendering:")
        from flask import render_template_string
        
        template = """
        {% for rank in ranks %}
        <option value="{{ rank.name }}" data-is-bishop="{{ 'true' if rank.is_bishop else 'false' }}">
            {{ rank.name }} ({{ 'Bishop' if rank.is_bishop else 'Not Bishop' }})
        </option>
        {% endfor %}
        """
        
        rendered = render_template_string(template, ranks=ranks)
        print("Rendered template:")
        print(rendered)
        
        return True

if __name__ == "__main__":
    comprehensive_rank_fix()
