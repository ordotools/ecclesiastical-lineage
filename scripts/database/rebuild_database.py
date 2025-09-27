#!/usr/bin/env python3
"""
Rebuild database using models from commit 7b31976 and scraped data
"""
import os
import sys
import json
from datetime import datetime, date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the models from the saved file
from models_7b31976 import db, Clergy, Rank, Organization, User, Role, Permission, AdminInvite, ClergyComment, AuditLog

def get_database_url():
    """Get database URL from environment or use default"""
    return os.getenv('DATABASE_URL', 'postgresql://localhost/ecclesiastical_lineage')

def rebuild_database():
    """Rebuild the database with scraped data"""
    
    print("Starting database rebuild...")
    
    # Load the converted data
    with open('converted_database_data.json', 'r') as f:
        data = json.load(f)
    
    print(f"Loaded data: {data['conversion_metadata']['total_clergy']} clergy, {data['conversion_metadata']['total_relationships']} relationships")
    
    # Create database engine
    database_url = get_database_url()
    engine = create_engine(database_url)
    
    # Drop all tables and recreate
    print("Dropping existing tables...")
    db.metadata.drop_all(bind=engine)
    
    print("Creating new tables...")
    db.metadata.create_all(bind=engine)
    
    # Create session
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create basic roles and permissions
        print("Creating roles and permissions...")
        
        # Create permissions
        permissions = [
            Permission(name='edit_clergy', description='Edit clergy information'),
            Permission(name='delete_clergy', description='Delete clergy records'),
            Permission(name='manage_metadata', description='Manage ranks and organizations'),
            Permission(name='manage_users', description='Manage user accounts'),
            Permission(name='add_comments', description='Add comments'),
            Permission(name='resolve_comments', description='Resolve comments'),
            Permission(name='view_audit_logs', description='View audit logs')
        ]
        
        for perm in permissions:
            session.add(perm)
        
        # Create roles
        super_admin_role = Role(
            name='Super Admin',
            description='Full system access',
            permissions=permissions
        )
        session.add(super_admin_role)
        
        admin_role = Role(
            name='Admin',
            description='Administrative access',
            permissions=[p for p in permissions if p.name != 'manage_users']
        )
        session.add(admin_role)
        
        # Create ranks
        print("Creating ranks...")
        for rank_data in data['ranks']:
            rank = Rank(
                name=rank_data['name'],
                is_bishop=rank_data['is_bishop'],
                color=rank_data['color']
            )
            session.add(rank)
        
        # Create organizations
        print("Creating organizations...")
        for org_data in data['organizations']:
            org = Organization(
                name=org_data['name'],
                color=org_data['color']
            )
            session.add(org)
        
        session.commit()
        
        # Create clergy members
        print("Creating clergy members...")
        clergy_map = {}  # Map old IDs to new IDs
        
        for i, clergy_data in enumerate(data['clergy'], 1):
            # Parse dates
            ordination_date = None
            consecration_date = None
            
            if clergy_data.get('ordination_date') and clergy_data['ordination_date'] != 'Date unknown':
                try:
                    ordination_date = datetime.strptime(clergy_data['ordination_date'], '%Y-%m-%d').date()
                except:
                    pass
            
            if clergy_data.get('consecration_date') and clergy_data['consecration_date'] != 'Date unknown':
                try:
                    consecration_date = datetime.strptime(clergy_data['consecration_date'], '%Y-%m-%d').date()
                except:
                    pass
            
            clergy = Clergy(
                name=clergy_data['name'],
                rank=clergy_data['rank'],
                organization=clergy_data['organization'],
                image_url=clergy_data.get('image_url'),
                date_of_ordination=ordination_date,
                date_of_consecration=consecration_date,
                notes=clergy_data.get('bio')
            )
            
            session.add(clergy)
            session.flush()  # Get the new ID
            clergy_map[clergy_data['id']] = clergy.id
        
        session.commit()
        
        # Create relationships
        print("Creating relationships...")
        for rel_data in data['relationships']:
            source_id = clergy_map.get(rel_data['source_id'])
            target_id = clergy_map.get(rel_data['target_id'])
            
            if source_id and target_id:
                # Find the target clergy and update their ordaining/consecrating bishop
                target_clergy = session.query(Clergy).get(target_id)
                if target_clergy:
                    if rel_data['type'] == 'ordination':
                        target_clergy.ordaining_bishop_id = source_id
                    elif rel_data['type'] == 'consecration':
                        target_clergy.consecrator_id = source_id
        
        session.commit()
        
        # Create a default admin user
        print("Creating default admin user...")
        admin_user = User(
            username='admin',
            email='admin@example.com',
            full_name='System Administrator',
            role_id=super_admin_role.id
        )
        admin_user.set_password('admin123')  # Change this in production!
        session.add(admin_user)
        
        session.commit()
        
        print("✓ Database rebuild completed successfully!")
        print(f"  - {len(data['clergy'])} clergy members")
        print(f"  - {len(data['ranks'])} ranks")
        print(f"  - {len(data['organizations'])} organizations")
        print(f"  - {len(data['relationships'])} relationships")
        print("  - Default admin user created (username: admin, password: admin123)")
        
    except Exception as e:
        print(f"Error during database rebuild: {str(e)}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    rebuild_database()
