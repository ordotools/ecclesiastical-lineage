"""Rebuild database with preserved user credentials

Revision ID: rebuild_db_users
Revises: ffca03f86792
Create Date: 2025-09-22 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'rebuild_db_users'
down_revision = '661e8e29471e'
branch_labels = None
depends_on = None


def upgrade():
    """Rebuild database while preserving user credentials."""
    print("🚀 Starting database rebuild with user preservation...")
    
    # Get database connection
    conn = op.get_bind()
    
    # Backup user data
    print("🔍 Backing up user credentials and roles...")
    
    # Backup users
    users_result = conn.execute(text("""
        SELECT username, password_hash, email, full_name, is_active, 
               created_at, last_login, role_id
        FROM "user"
    """))
    users_data = [dict(row._mapping) for row in users_result]
    
    # Backup roles
    roles_result = conn.execute(text("""
        SELECT name, description, created_at
        FROM role
    """))
    roles_data = [dict(row._mapping) for row in roles_result]
    
    # Backup permissions
    permissions_result = conn.execute(text("""
        SELECT name, description, created_at
        FROM permission
    """))
    permissions_data = [dict(row._mapping) for row in permissions_result]
    
    # Backup role-permission relationships
    rp_result = conn.execute(text("""
        SELECT role_id, permission_id
        FROM role_permissions
    """))
    role_permissions_data = [dict(row._mapping) for row in rp_result]
    
    print(f"📊 Backed up {len(users_data)} users, {len(roles_data)} roles, {len(permissions_data)} permissions")
    
    # Drop all tables except alembic_version
    print("🗑️  Dropping all data tables...")
    
    # Drop tables in reverse dependency order
    tables_to_drop = [
        'co_consecrators',
        'consecration', 
        'ordination',
        'clergy_comment',
        'audit_log',
        'admin_invite',
        'clergy',
        'organization',
        'rank',
        'role_permissions',
        'permission',
        'role',
        'user'
    ]
    
    for table in tables_to_drop:
        try:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
            print(f"✅ Dropped table: {table}")
        except Exception as e:
            print(f"⚠️  Could not drop {table}: {e}")
    
    # Recreate all tables
    print("🏗️  Recreating database schema...")
    
    # Create role table
    conn.execute(text("""
        CREATE TABLE role (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create permission table
    conn.execute(text("""
        CREATE TABLE permission (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create role_permissions table
    conn.execute(text("""
        CREATE TABLE role_permissions (
            role_id INTEGER REFERENCES role(id),
            permission_id INTEGER REFERENCES permission(id),
            PRIMARY KEY (role_id, permission_id)
        )
    """))
    
    # Create user table
    conn.execute(text("""
        CREATE TABLE "user" (
            id SERIAL PRIMARY KEY,
            username VARCHAR(80) UNIQUE NOT NULL,
            password_hash VARCHAR(120) NOT NULL,
            email VARCHAR(120) UNIQUE,
            full_name VARCHAR(200),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            role_id INTEGER REFERENCES role(id) NOT NULL
        )
    """))
    
    # Create other tables
    conn.execute(text("""
        CREATE TABLE rank (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            color VARCHAR(7) NOT NULL DEFAULT '#000000',
            is_bishop BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE organization (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) UNIQUE NOT NULL,
            abbreviation VARCHAR(20) UNIQUE,
            description TEXT,
            color VARCHAR(7) NOT NULL DEFAULT '#27ae60',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE clergy (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            rank VARCHAR(100) NOT NULL,
            papal_name VARCHAR(200),
            organization VARCHAR(200),
            date_of_birth DATE,
            date_of_death DATE,
            notes TEXT,
            image_url TEXT,
            image_data TEXT,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE ordination (
            id SERIAL PRIMARY KEY,
            clergy_id INTEGER REFERENCES clergy(id) NOT NULL,
            date DATE NOT NULL,
            ordaining_bishop_id INTEGER REFERENCES clergy(id),
            is_sub_conditione BOOLEAN DEFAULT FALSE NOT NULL,
            is_doubtful BOOLEAN DEFAULT FALSE NOT NULL,
            is_invalid BOOLEAN DEFAULT FALSE NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE consecration (
            id SERIAL PRIMARY KEY,
            clergy_id INTEGER REFERENCES clergy(id) NOT NULL,
            date DATE NOT NULL,
            consecrator_id INTEGER REFERENCES clergy(id),
            is_sub_conditione BOOLEAN DEFAULT FALSE NOT NULL,
            is_doubtful BOOLEAN DEFAULT FALSE NOT NULL,
            is_invalid BOOLEAN DEFAULT FALSE NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE co_consecrators (
            consecration_id INTEGER REFERENCES consecration(id),
            co_consecrator_id INTEGER REFERENCES clergy(id),
            PRIMARY KEY (consecration_id, co_consecrator_id)
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE admin_invite (
            id SERIAL PRIMARY KEY,
            token VARCHAR(128) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            invited_by INTEGER REFERENCES "user"(id),
            role_id INTEGER REFERENCES role(id),
            max_uses INTEGER DEFAULT 1,
            current_uses INTEGER DEFAULT 0,
            expires_in_hours INTEGER DEFAULT 24
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE clergy_comment (
            id SERIAL PRIMARY KEY,
            clergy_id INTEGER REFERENCES clergy(id) NOT NULL,
            author_id INTEGER REFERENCES "user"(id) NOT NULL,
            content TEXT NOT NULL,
            field_name VARCHAR(50),
            is_public BOOLEAN DEFAULT TRUE,
            is_resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    conn.execute(text("""
        CREATE TABLE audit_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES "user"(id) NOT NULL,
            action VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INTEGER,
            entity_name VARCHAR(200),
            details TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    print("✅ Database schema recreated successfully")
    
    # Restore user data
    print("🔄 Restoring user credentials and roles...")
    
    # Restore roles
    role_id_mapping = {}
    for role_data in roles_data:
        result = conn.execute(text("""
            INSERT INTO role (name, description, created_at)
            VALUES (:name, :description, :created_at)
            RETURNING id
        """), role_data)
        new_role_id = result.fetchone()[0]
        role_id_mapping[role_data['name']] = new_role_id
    
    # Restore permissions
    permission_id_mapping = {}
    for permission_data in permissions_data:
        result = conn.execute(text("""
            INSERT INTO permission (name, description, created_at)
            VALUES (:name, :description, :created_at)
            RETURNING id
        """), permission_data)
        new_permission_id = result.fetchone()[0]
        permission_id_mapping[permission_data['name']] = new_permission_id
    
    # Restore role-permission relationships
    for rp_data in role_permissions_data:
        # Find the new role and permission IDs
        role_name = None
        permission_name = None
        
        # Get role name by old ID
        for role_data in roles_data:
            if role_data.get('id') == rp_data['role_id']:
                role_name = role_data['name']
                break
        
        # Get permission name by old ID  
        for permission_data in permissions_data:
            if permission_data.get('id') == rp_data['permission_id']:
                permission_name = permission_data['name']
                break
        
        if role_name and permission_name:
            new_role_id = role_id_mapping.get(role_name)
            new_permission_id = permission_id_mapping.get(permission_name)
            
            if new_role_id and new_permission_id:
                conn.execute(text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                """), {'role_id': new_role_id, 'permission_id': new_permission_id})
    
    # Restore users
    for user_data in users_data:
        # Find the new role ID
        role_name = None
        for role_data in roles_data:
            if role_data.get('id') == user_data['role_id']:
                role_name = role_data['name']
                break
        
        if role_name:
            new_role_id = role_id_mapping.get(role_name)
            if new_role_id:
                conn.execute(text("""
                    INSERT INTO "user" (username, password_hash, email, full_name, 
                                      is_active, created_at, last_login, role_id)
                    VALUES (:username, :password_hash, :email, :full_name,
                            :is_active, :created_at, :last_login, :role_id)
                """), {
                    'username': user_data['username'],
                    'password_hash': user_data['password_hash'],
                    'email': user_data['email'],
                    'full_name': user_data['full_name'],
                    'is_active': user_data['is_active'],
                    'created_at': user_data['created_at'],
                    'last_login': user_data['last_login'],
                    'role_id': new_role_id
                })
    
    print("✅ User data restored successfully")
    print("🎉 Database rebuild completed with preserved user credentials!")


def downgrade():
    """This migration cannot be downgraded as it rebuilds the entire database."""
    print("⚠️  This migration cannot be downgraded - it rebuilds the entire database")
    pass
