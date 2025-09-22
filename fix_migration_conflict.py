#!/usr/bin/env python3
"""
Fix migration conflict by handling the ordination/consecration table issue
"""
import os
import sys
from sqlalchemy import create_engine, text
from urllib.parse import urlparse

def get_database_url():
    """Get database URL from environment or use default"""
    return os.getenv('DATABASE_URL', 'postgresql://localhost/ecclesiastical_lineage')

def check_table_exists(engine, table_name):
    """Check if a table exists in the database"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table_name}'
                );
            """))
            return result.scalar()
    except Exception as e:
        print(f"Error checking table {table_name}: {e}")
        return False

def fix_migration_state():
    """Fix the migration state to handle existing tables"""
    
    print("Checking database state...")
    
    # Create database engine
    database_url = get_database_url()
    engine = create_engine(database_url)
    
    # Check if ordination and consecration tables exist
    ordination_exists = check_table_exists(engine, 'ordination')
    consecration_exists = check_table_exists(engine, 'consecration')
    
    print(f"Ordination table exists: {ordination_exists}")
    print(f"Consecration table exists: {consecration_exists}")
    
    if ordination_exists and consecration_exists:
        print("✓ Tables already exist - migration conflict detected")
        
        # Option 1: Mark the migration as already applied
        print("Marking migration abc123def456 as already applied...")
        try:
            with engine.connect() as conn:
                # Check if migration is already in alembic_version
                result = conn.execute(text("SELECT version_num FROM alembic_version;"))
                current_version = result.scalar()
                print(f"Current migration version: {current_version}")
                
                # If the problematic migration isn't applied, we need to handle it
                if current_version != 'abc123def456':
                    print("Migration abc123def456 is not yet applied, but tables exist.")
                    print("This suggests the database was created manually or with a different migration.")
                    
                    # We have a few options:
                    # 1. Skip the problematic migration
                    # 2. Drop and recreate the tables
                    # 3. Mark the migration as applied without running it
                    
                    print("\nOptions:")
                    print("1. Skip the problematic migration (recommended)")
                    print("2. Drop and recreate the ordination/consecration tables")
                    print("3. Mark migration as applied without running it")
                    
                    # For now, let's go with option 1 - skip the migration
                    print("\nSkipping migration abc123def456...")
                    
                    # Update the migration to be a no-op
                    migration_file = "migrations/versions/abc123def456_add_ordination_and_consecration_tables.py"
                    if os.path.exists(migration_file):
                        print(f"Modifying {migration_file} to skip table creation...")
                        
                        # Read the current migration
                        with open(migration_file, 'r') as f:
                            content = f.read()
                        
                        # Replace the upgrade function to check if tables exist first
                        new_upgrade = '''def upgrade():
    # Check if tables already exist before creating them
    from sqlalchemy import inspect
    inspector = inspect(op.get_bind())
    existing_tables = inspector.get_table_names()
    
    if 'ordination' not in existing_tables:
        # Create ordination table
        op.create_table('ordination',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('clergy_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('ordaining_bishop_id', sa.Integer(), nullable=True),
            sa.Column('is_sub_conditione', sa.Boolean(), nullable=False),
            sa.Column('is_doubtful', sa.Boolean(), nullable=False),
            sa.Column('is_invalid', sa.Boolean(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id'], ),
            sa.ForeignKeyConstraint(['ordaining_bishop_id'], ['clergy.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    else:
        print("Ordination table already exists, skipping creation")
    
    if 'consecration' not in existing_tables:
        # Create consecration table
        op.create_table('consecration',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('clergy_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('consecrator_id', sa.Integer(), nullable=True),
            sa.Column('is_sub_conditione', sa.Boolean(), nullable=False),
            sa.Column('is_doubtful', sa.Boolean(), nullable=False),
            sa.Column('is_invalid', sa.Boolean(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id'], ),
            sa.ForeignKeyConstraint(['consecrator_id'], ['clergy.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    else:
        print("Consecration table already exists, skipping creation")
    
    if 'co_consecrators' not in existing_tables:
        # Create co_consecrators association table
        op.create_table('co_consecrators',
            sa.Column('consecration_id', sa.Integer(), nullable=False),
            sa.Column('co_consecrator_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['consecration_id'], ['consecration.id'], ),
            sa.ForeignKeyConstraint(['co_consecrator_id'], ['clergy.id'], ),
            sa.PrimaryKeyConstraint('consecration_id', 'co_consecrator_id')
        )
    else:
        print("Co_consecrators table already exists, skipping creation")'''
                        
                        # Replace the upgrade function
                        import re
                        pattern = r'def upgrade\(\):.*?(?=def downgrade\(\):)'
                        new_content = re.sub(pattern, new_upgrade + '\n\n', content, flags=re.DOTALL)
                        
                        # Write the modified migration
                        with open(migration_file, 'w') as f:
                            f.write(new_content)
                        
                        print("✓ Migration file updated to handle existing tables")
                    else:
                        print(f"Migration file {migration_file} not found")
                
        except Exception as e:
            print(f"Error updating migration: {e}")
    
    else:
        print("Tables don't exist - migration should proceed normally")
    
    print("\nMigration conflict fix complete!")
    print("You can now try running the migration again.")

if __name__ == "__main__":
    fix_migration_state()
