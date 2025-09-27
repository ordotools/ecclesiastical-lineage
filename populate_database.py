#!/usr/bin/env python3
"""
Populate the existing database with scraped data
"""
import os
import sys
import json
from datetime import datetime, date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the models from the current models file
from models import db, Clergy, Rank, Organization, User, Role, Permission, AdminInvite, ClergyComment, AuditLog, Ordination, Consecration

def get_database_url():
    """Get database URL from environment or use default"""
    return os.getenv('DATABASE_URL', 'postgresql://localhost/ecclesiastical_lineage')

def populate_database():
    """Populate the existing database with scraped data"""
    
    print("Starting database population...")
    
    # Load the converted data
    with open('converted_database_data.json', 'r') as f:
        data = json.load(f)
    
    print(f"Loaded data: {data['conversion_metadata']['total_clergy']} clergy, {data['conversion_metadata']['total_relationships']} relationships")
    
    # Use Flask app context instead of direct database connection
    from app import app
    with app.app_context():
        session = db.session
        
        try:
            # Check if data already exists
            existing_clergy = session.query(Clergy).count()
            if existing_clergy > 0:
                print(f"Database already contains {existing_clergy} clergy members.")
                print("Skipping population as data already exists.")
                return
            
            # Create ranks (only if they don't exist)
            print("Creating ranks...")
            rank_map = {}
            for rank_data in data['ranks']:
                existing_rank = session.query(Rank).filter_by(name=rank_data['name']).first()
                if existing_rank:
                    rank_map[rank_data['name']] = existing_rank.id
                else:
                    rank = Rank(
                        name=rank_data['name'],
                        is_bishop=rank_data['is_bishop'],
                        color=rank_data['color']
                    )
                    session.add(rank)
                    session.flush()  # Get the ID
                    rank_map[rank_data['name']] = rank.id
            
            # Create organizations (only if they don't exist)
            print("Creating organizations...")
            org_map = {}
            for org_data in data['organizations']:
                existing_org = session.query(Organization).filter_by(name=org_data['name']).first()
                if existing_org:
                    org_map[org_data['name']] = existing_org.id
                else:
                    org = Organization(
                        name=org_data['name'],
                        color=org_data['color']
                    )
                    session.add(org)
                    session.flush()  # Get the ID
                    org_map[org_data['name']] = org.id
            
            session.commit()
            
            # Create clergy members
            print("Creating clergy members...")
            clergy_map = {}  # Map old IDs to new IDs
            
            for i, clergy_data in enumerate(data['clergy'], 1):
                clergy = Clergy(
                    name=clergy_data['name'],
                    rank=clergy_data['rank'],
                    organization=clergy_data['organization'],
                    image_url=clergy_data.get('image_url'),
                    notes=clergy_data.get('bio')
                )
                
                session.add(clergy)
                session.flush()  # Get the new ID
                clergy_map[clergy_data['id']] = clergy.id
            
            session.commit()
            
            # Create ordination and consecration records
            print("Creating ordination and consecration records...")
            ordination_count = 0
            consecration_count = 0
            
            for rel_data in data['relationships']:
                source_id = clergy_map.get(rel_data['source_id'])
                target_id = clergy_map.get(rel_data['target_id'])
                
                if source_id and target_id:
                    if rel_data['type'] == 'ordination':
                        # Create ordination record
                        ordination = Ordination(
                            clergy_id=target_id,
                            ordaining_bishop_id=source_id,
                            date=datetime.now().date(),  # Use current date as fallback
                            is_sub_conditione=False,
                            is_doubtful=False,
                            is_invalid=False,
                            notes=f"Migrated from legacy data",
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        session.add(ordination)
                        ordination_count += 1
                        
                    elif rel_data['type'] == 'consecration':
                        # Create consecration record
                        consecration = Consecration(
                            clergy_id=target_id,
                            consecrator_id=source_id,
                            date=datetime.now().date(),  # Use current date as fallback
                            is_sub_conditione=False,
                            is_doubtful=False,
                            is_invalid=False,
                            notes=f"Migrated from legacy data",
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        session.add(consecration)
                        consecration_count += 1
            
            print(f"Created {ordination_count} ordination records")
            print(f"Created {consecration_count} consecration records")
            
            session.commit()
            
            print("✓ Database population completed successfully!")
            print(f"  - {len(data['clergy'])} clergy members")
            print(f"  - {len(data['ranks'])} ranks")
            print(f"  - {len(data['organizations'])} organizations")
            print(f"  - {ordination_count} ordination records")
            print(f"  - {consecration_count} consecration records")
            
        except Exception as e:
            print(f"Error during database population: {str(e)}")
            session.rollback()
            raise

if __name__ == "__main__":
    populate_database()
