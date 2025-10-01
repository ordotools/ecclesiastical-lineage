#!/usr/bin/env python3
"""
Test script to verify that the rank fix works correctly
"""

import os
import sys
sys.path.append(os.getcwd())

from app import app, db
from models import Rank

def test_rank_fix():
    """Test that the rank fix works correctly"""
    
    with app.app_context():
        print("🧪 TESTING RANK FIX")
        print("=" * 30)
        
        # Get all ranks
        ranks = Rank.query.all()
        
        # Define expected bishop ranks
        expected_bishops = ['Bishop', 'Archbishop', 'Cardinal', 'Pope', 'Patriarch', 'Metropolitan']
        
        print("Testing rank data:")
        all_correct = True
        
        for rank in ranks:
            should_be_bishop = rank.name in expected_bishops
            actual_value = rank.is_bishop
            
            if should_be_bishop == actual_value:
                print(f"✅ {rank.name}: {actual_value} (correct)")
            else:
                print(f"❌ {rank.name}: {actual_value} (should be {should_be_bishop})")
                all_correct = False
        
        if all_correct:
            print("\n🎉 All ranks have correct is_bishop values!")
            print("The consecration field should now work correctly.")
        else:
            print("\n⚠️  Some ranks have incorrect values. Run the fix script.")
        
        return all_correct

if __name__ == "__main__":
    test_rank_fix()
