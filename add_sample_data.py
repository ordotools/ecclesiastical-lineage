#!/usr/bin/env python3
"""
Script to add sample clergy data with relationships for testing the lineage visualization.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Clergy
from datetime import datetime

def add_sample_data():
    """Add sample clergy data with relationships."""
    
    with app.app_context():
        # Clear existing data
        Clergy.query.delete()
        db.session.commit()
        
        print("Adding sample clergy data...")
        
        # Create clergy members
        bishop1 = Clergy(
            name="Bishop John Smith",
            rank="Bishop",
            organization="Anglican Church",
            date_of_birth=datetime.strptime('1950-01-15', '%Y-%m-%d').date(),
            date_of_consecration=datetime.strptime('1990-06-10', '%Y-%m-%d').date()
        )
        
        bishop2 = Clergy(
            name="Bishop Mary Johnson",
            rank="Bishop", 
            organization="Anglican Church",
            date_of_birth=datetime.strptime('1960-03-20', '%Y-%m-%d').date(),
            date_of_ordination=datetime.strptime('1985-05-15', '%Y-%m-%d').date(),
            ordaining_bishop_id=None,  # Will be set after creation
            date_of_consecration=datetime.strptime('1995-09-20', '%Y-%m-%d').date(),
            consecrator_id=None  # Will be set after creation
        )
        
        priest1 = Clergy(
            name="Father Robert Brown",
            rank="Priest",
            organization="Anglican Church", 
            date_of_birth=datetime.strptime('1970-07-10', '%Y-%m-%d').date(),
            date_of_ordination=datetime.strptime('1995-12-01', '%Y-%m-%d').date(),
            ordaining_bishop_id=None,  # Will be set after creation
            date_of_consecration=datetime.strptime('2010-03-15', '%Y-%m-%d').date(),
            consecrator_id=None,  # Will be set after creation
            co_consecrators=None  # Will be set after creation
        )
        
        # Add to database
        db.session.add(bishop1)
        db.session.add(bishop2)
        db.session.add(priest1)
        db.session.commit()
        
        # Now set up relationships
        bishop2.ordaining_bishop_id = bishop1.id
        bishop2.consecrator_id = bishop1.id
        
        priest1.ordaining_bishop_id = bishop2.id
        priest1.consecrator_id = bishop2.id
        priest1.set_co_consecrators([bishop1.id])  # Bishop1 co-consecrated with Bishop2
        
        db.session.commit()
        
        print("Sample data added successfully!")
        print(f"Created {Clergy.query.count()} clergy members")
        
        # Print the relationships
        print("\nRelationships created:")
        for clergy in Clergy.query.all():
            print(f"- {clergy.name} ({clergy.rank})")
            if clergy.ordaining_bishop_id:
                ordaining = Clergy.query.get(clergy.ordaining_bishop_id)
                print(f"  Ordained by: {ordaining.name} on {clergy.date_of_ordination}")
            if clergy.consecrator_id:
                consecrator = Clergy.query.get(clergy.consecrator_id)
                print(f"  Consecrated by: {consecrator.name} on {clergy.date_of_consecration}")
            if clergy.co_consecrators:
                co_consecrators = clergy.get_co_consecrators()
                for co_id in co_consecrators:
                    co_consecrator = Clergy.query.get(co_id)
                    print(f"  Co-consecrated by: {co_consecrator.name}")

if __name__ == "__main__":
    add_sample_data() 