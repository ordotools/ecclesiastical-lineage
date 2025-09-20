#!/usr/bin/env python3
"""
Script to add lineage data to the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import Clergy, Ordination, Consecration
from datetime import datetime
import json

def add_ordination(clergy_name, ordaining_bishop_name, date_str, notes=""):
    """Add an ordination record"""
    
    with app.app_context():
        # Find clergy
        clergy = Clergy.query.filter(Clergy.name.ilike(f"%{clergy_name}%")).first()
        if not clergy:
            print(f"❌ Clergy not found: {clergy_name}")
            return False
        
        # Find ordaining bishop
        ordaining_bishop = Clergy.query.filter(Clergy.name.ilike(f"%{ordaining_bishop_name}%")).first()
        if not ordaining_bishop:
            print(f"❌ Ordaining bishop not found: {ordaining_bishop_name}")
            return False
        
        # Parse date
        try:
            if '-' in date_str:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            print(f"❌ Invalid date format: {date_str}. Use YYYY-MM-DD")
            return False
        
        # Check if ordination already exists
        existing = Ordination.query.filter_by(
            clergy_id=clergy.id,
            ordaining_bishop_id=ordaining_bishop.id,
            date=date_obj
        ).first()
        
        if existing:
            print(f"⚠️  Ordination already exists: {clergy.name} ordained by {ordaining_bishop.name} on {date_obj}")
            return False
        
        # Create ordination
        ordination = Ordination(
            clergy_id=clergy.id,
            date=date_obj,
            ordaining_bishop_id=ordaining_bishop.id,
            is_sub_conditione=False,
            is_doubtful=False,
            is_invalid=False,
            notes=notes,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.session.add(ordination)
        db.session.commit()
        
        print(f"✅ Added ordination: {clergy.name} ordained by {ordaining_bishop.name} on {date_obj}")
        return True

def add_consecration(clergy_name, consecrator_name, date_str, notes=""):
    """Add a consecration record"""
    
    with app.app_context():
        # Find clergy
        clergy = Clergy.query.filter(Clergy.name.ilike(f"%{clergy_name}%")).first()
        if not clergy:
            print(f"❌ Clergy not found: {clergy_name}")
            return False
        
        # Find consecrator
        consecrator = Clergy.query.filter(Clergy.name.ilike(f"%{consecrator_name}%")).first()
        if not consecrator:
            print(f"❌ Consecrator not found: {consecrator_name}")
            return False
        
        # Parse date
        try:
            if '-' in date_str:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            print(f"❌ Invalid date format: {date_str}. Use YYYY-MM-DD")
            return False
        
        # Check if consecration already exists
        existing = Consecration.query.filter_by(
            clergy_id=clergy.id,
            consecrator_id=consecrator.id,
            date=date_obj
        ).first()
        
        if existing:
            print(f"⚠️  Consecration already exists: {clergy.name} consecrated by {consecrator.name} on {date_obj}")
            return False
        
        # Create consecration
        consecration = Consecration(
            clergy_id=clergy.id,
            date=date_obj,
            consecrator_id=consecrator.id,
            is_sub_conditione=False,
            is_doubtful=False,
            is_invalid=False,
            notes=notes,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.session.add(consecration)
        db.session.commit()
        
        print(f"✅ Added consecration: {clergy.name} consecrated by {consecrator.name} on {date_obj}")
        return True

def add_from_json_file(filename):
    """Add lineage data from a JSON file"""
    
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        print(f"📄 Loading data from {filename}")
        
        ordinations_added = 0
        consecrations_added = 0
        
        # Process ordinations
        for ord_data in data.get('ordinations', []):
            if add_ordination(
                ord_data['clergy_name'],
                ord_data['ordaining_bishop_name'],
                ord_data['date'],
                ord_data.get('notes', '')
            ):
                ordinations_added += 1
        
        # Process consecrations
        for cons_data in data.get('consecrations', []):
            if add_consecration(
                cons_data['clergy_name'],
                cons_data['consecrator_name'],
                cons_data['date'],
                cons_data.get('notes', '')
            ):
                consecrations_added += 1
        
        print(f"\n✅ Summary:")
        print(f"   Ordinations added: {ordinations_added}")
        print(f"   Consecrations added: {consecrations_added}")
        
    except FileNotFoundError:
        print(f"❌ File not found: {filename}")
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {filename}: {e}")
    except Exception as e:
        print(f"❌ Error processing {filename}: {e}")

def create_sample_json():
    """Create a sample JSON file for adding lineage data"""
    
    sample_data = {
        "ordinations": [
            {
                "clergy_name": "Bernard Fellay",
                "ordaining_bishop_name": "Marcel Lefebvre",
                "date": "1988-06-29",
                "notes": "Ordained priest by Archbishop Lefebvre"
            }
        ],
        "consecrations": [
            {
                "clergy_name": "Bernard Fellay",
                "consecrator_name": "Marcel Lefebvre", 
                "date": "1988-06-30",
                "notes": "Consecrated bishop by Archbishop Lefebvre"
            },
            {
                "clergy_name": "Bernard Tissier de Mallerais",
                "consecrator_name": "Marcel Lefebvre",
                "date": "1988-06-30", 
                "notes": "Consecrated bishop by Archbishop Lefebvre"
            }
        ]
    }
    
    with open('sample_lineage_data.json', 'w') as f:
        json.dump(sample_data, f, indent=2)
    
    print("📄 Created sample_lineage_data.json")
    print("   Edit this file with your research findings, then run:")
    print("   python add_lineage_data.py sample_lineage_data.json")

def interactive_add():
    """Interactive mode for adding lineage data"""
    
    print("🔧 Interactive Lineage Data Addition")
    print("=" * 40)
    
    while True:
        print("\nOptions:")
        print("1. Add ordination")
        print("2. Add consecration") 
        print("3. Exit")
        
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == '1':
            clergy_name = input("Clergy name: ").strip()
            ordaining_bishop = input("Ordaining bishop name: ").strip()
            date = input("Date (YYYY-MM-DD): ").strip()
            notes = input("Notes (optional): ").strip()
            
            add_ordination(clergy_name, ordaining_bishop, date, notes)
            
        elif choice == '2':
            clergy_name = input("Clergy name: ").strip()
            consecrator = input("Consecrator name: ").strip()
            date = input("Date (YYYY-MM-DD): ").strip()
            notes = input("Notes (optional): ").strip()
            
            add_consecration(clergy_name, consecrator, date, notes)
            
        elif choice == '3':
            break
        else:
            print("Invalid choice")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("📋 Lineage Data Addition Tool")
        print("=" * 30)
        print("Usage:")
        print("  python add_lineage_data.py <json_file>     # Add from JSON file")
        print("  python add_lineage_data.py --sample       # Create sample JSON")
        print("  python add_lineage_data.py --interactive  # Interactive mode")
        print()
        print("Examples:")
        print("  python add_lineage_data.py --sample")
        print("  python add_lineage_data.py sample_lineage_data.json")
        print("  python add_lineage_data.py --interactive")
        
    elif sys.argv[1] == '--sample':
        create_sample_json()
        
    elif sys.argv[1] == '--interactive':
        interactive_add()
        
    else:
        filename = sys.argv[1]
        add_from_json_file(filename)
