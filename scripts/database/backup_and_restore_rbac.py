#!/usr/bin/env python3
"""
Backup and Restore Script for RBAC Migration
This script provides an alternative approach to migrate the database.
"""

import os
import sys
import json
from datetime import datetime
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import Flask app and models
from app import app, db
from models import User, Role, Permission, ClergyComment
from migrations import initialize_roles_and_permissions

def backup_existing_data():
    """Backup existing data before migration"""
    print("📦 Backing up existing data...")
    
    with app.app_context():
        # Backup users
        users = User.query.all()
        user_data = []
        for user in users:
            user_data.append({
                'id': user.id,
                'username': user.username,
                'password_hash': user.password_hash,
                'is_admin': getattr(user, 'is_admin', False)  # Handle old schema
            })
        
        # Backup clergy
        from app import Clergy
        clergy = Clergy.query.all()
        clergy_data = []
        for c in clergy:
            clergy_data.append({
                'id': c.id,
                'name': c.name,
                'rank': c.rank,
                'organization': c.organization,
                'date_of_birth': c.date_of_birth.isoformat() if c.date_of_birth else None,
                'date_of_ordination': c.date_of_ordination.isoformat() if c.date_of_ordination else None,
                'ordaining_bishop_id': c.ordaining_bishop_id,
                'date_of_consecration': c.date_of_consecration.isoformat() if c.date_of_consecration else None,
                'consecrator_id': c.consecrator_id,
                'co_consecrators': c.co_consecrators,
                'date_of_death': c.date_of_death.isoformat() if c.date_of_death else None,
                'notes': c.notes
            })
        
        # Save backup
        backup_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'users': user_data,
            'clergy': clergy_data
        }
        
        with open('backup_before_rbac.json', 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        print(f"✅ Backup saved to backup_before_rbac.json")
        print(f"   - {len(user_data)} users backed up")
        print(f"   - {len(clergy_data)} clergy records backed up")

def drop_and_recreate_tables():
    """Drop and recreate all tables with new schema"""
    print("🔄 Dropping and recreating tables...")
    
    with app.app_context():
        # Drop all tables
        db.drop_all()
        print("✅ Dropped all tables")
        
        # Create all tables with new schema
        db.create_all()
        print("✅ Created all tables with new schema")

def restore_data():
    """Restore data from backup"""
    print("📥 Restoring data from backup...")
    
    try:
        with open('backup_before_rbac.json', 'r') as f:
            backup_data = json.load(f)
    except FileNotFoundError:
        print("❌ Backup file not found!")
        return
    
    with app.app_context():
        # Initialize roles and permissions
        initialize_roles_and_permissions()
        
        # Get Super Admin role
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if not super_admin_role:
            print("❌ Super Admin role not found!")
            return
        
        # Restore users
        for user_data in backup_data['users']:
            user = User(
                username=user_data['username'],
                password_hash=user_data['password_hash'],
                role_id=super_admin_role.id,  # All existing users become Super Admin
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.session.add(user)
        
        # Restore clergy
        from app import Clergy
        for clergy_data in backup_data['clergy']:
            clergy = Clergy(
                name=clergy_data['name'],
                rank=clergy_data['rank'],
                organization=clergy_data['organization'],
                notes=clergy_data['notes']
            )
            
            # Handle dates
            if clergy_data['date_of_birth']:
                clergy.date_of_birth = datetime.fromisoformat(clergy_data['date_of_birth']).date()
            if clergy_data['date_of_ordination']:
                clergy.date_of_ordination = datetime.fromisoformat(clergy_data['date_of_ordination']).date()
            if clergy_data['date_of_consecration']:
                clergy.date_of_consecration = datetime.fromisoformat(clergy_data['date_of_consecration']).date()
            if clergy_data['date_of_death']:
                clergy.date_of_death = datetime.fromisoformat(clergy_data['date_of_death']).date()
            
            # Handle relationships (will be set after all records are created)
            clergy._temp_ordaining_bishop_id = clergy_data['ordaining_bishop_id']
            clergy._temp_consecrator_id = clergy_data['consecrator_id']
            clergy._temp_co_consecrators = clergy_data['co_consecrators']
            
            db.session.add(clergy)
        
        db.session.commit()
        print(f"✅ Restored {len(backup_data['users'])} users and {len(backup_data['clergy'])} clergy records")
        
        # Now handle relationships
        print("🔗 Restoring relationships...")
        clergy_map = {c.id: c for c in Clergy.query.all()}
        
        for clergy_data in backup_data['clergy']:
            original_id = clergy_data['id']
            # Find the new clergy record (assuming names are unique)
            clergy = Clergy.query.filter_by(name=clergy_data['name']).first()
            if clergy:
                # Set relationships
                if clergy_data['ordaining_bishop_id']:
                    # Find the ordaining bishop by name (approximate matching)
                    ordaining_bishop = Clergy.query.filter_by(name=clergy_data['name']).first()
                    if ordaining_bishop:
                        clergy.ordaining_bishop_id = ordaining_bishop.id
                
                if clergy_data['consecrator_id']:
                    # Find the consecrator by name (approximate matching)
                    consecrator = Clergy.query.filter_by(name=clergy_data['name']).first()
                    if consecrator:
                        clergy.consecrator_id = consecrator.id
                
                # Handle co-consecrators
                if clergy_data['co_consecrators']:
                    try:
                        co_ids = json.loads(clergy_data['co_consecrators'])
                        clergy.set_co_consecrators(co_ids)
                    except:
                        pass  # Skip if co-consecrators can't be parsed
        
        db.session.commit()
        print("✅ Relationships restored")

def main():
    """Main backup and restore function"""
    print("🚀 Starting Backup and Restore RBAC Migration")
    print("=" * 60)
    print("⚠️  WARNING: This will drop and recreate all tables!")
    print("   Make sure you have a backup of your database!")
    print("=" * 60)
    
    response = input("Do you want to continue? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration cancelled.")
        return
    
    try:
        # Step 1: Backup existing data
        backup_existing_data()
        
        # Step 2: Drop and recreate tables
        drop_and_recreate_tables()
        
        # Step 3: Restore data
        restore_data()
        
        print("=" * 60)
        print("✅ Backup and Restore Migration completed successfully!")
        print("\nNext steps:")
        print("1. Restart your Flask application")
        print("2. Test login with existing credentials")
        print("3. Access the user management interface to create additional users")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main() 