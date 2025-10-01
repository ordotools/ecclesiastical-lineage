#!/usr/bin/env python3
"""
Debug script to test consecration loading on production vs local
This script can be run to check if consecration data is being loaded properly
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import Clergy, Consecration, Ordination
from sqlalchemy.orm import joinedload

def debug_consecration_loading():
    app = create_app()
    
    with app.app_context():
        print("=== CONSECRATION LOADING DEBUG ===")
        
        # Get all clergy with bishop ranks
        bishop_ranks = ['Bishop', 'Archbishop', 'Cardinal', 'Pope']
        bishops = Clergy.query.filter(Clergy.rank.in_(bishop_ranks), Clergy.is_deleted == False).all()
        
        print(f"Found {len(bishops)} bishops in database")
        
        for bishop in bishops:
            print(f"\n--- Bishop: {bishop.name} (ID: {bishop.id}, Rank: {bishop.rank}) ---")
            
            # Load with eager loading like in the editor
            clergy_with_relations = Clergy.query.options(
                joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
                joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
                joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
            ).filter(Clergy.id == bishop.id).first()
            
            if clergy_with_relations:
                print(f"  Ordinations: {len(clergy_with_relations.ordinations)}")
                for ord in clergy_with_relations.ordinations:
                    print(f"    - {ord.date}: {ord.ordaining_bishop.name if ord.ordaining_bishop else 'Unknown'}")
                
                print(f"  Consecrations: {len(clergy_with_relations.consecrations)}")
                for cons in clergy_with_relations.consecrations:
                    print(f"    - {cons.date}: {cons.consecrator.name if cons.consecrator else 'Unknown'}")
                    print(f"      Co-consecrators: {[cc.name for cc in cons.co_consecrators]}")
                
                # Test the get_all_consecrations method
                all_consecrations = clergy_with_relations.get_all_consecrations()
                print(f"  get_all_consecrations() returns: {len(all_consecrations)} consecrations")
                
                # Test if consecrations are properly sorted
                if all_consecrations:
                    dates = [c.date for c in all_consecrations if c.date]
                    print(f"  Consecration dates: {dates}")
                    print(f"  Is sorted: {dates == sorted(dates)}")
            else:
                print("  ERROR: Could not load clergy with relations")
        
        print("\n=== END DEBUG ===")

if __name__ == "__main__":
    debug_consecration_loading()

