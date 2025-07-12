#!/usr/bin/env python3
"""
Database migration script for Ecclesiastical Lineage
Handles database rename and initial metadata setup
"""

import os
import shutil
import sqlite3
from datetime import datetime

def migrate_database():
    """Migrate from users.db to ecclesiastical_lineage.db"""
    
    old_db_path = 'instance/users.db'
    new_db_path = 'instance/ecclesiastical_lineage.db'
    
    print("Starting database migration...")
    
    # Check if old database exists
    if not os.path.exists(old_db_path):
        print(f"Old database {old_db_path} not found. Creating new database...")
        return
    
    # Check if new database already exists
    if os.path.exists(new_db_path):
        print(f"New database {new_db_path} already exists. Skipping migration.")
        return
    
    try:
        # Copy the old database to the new location
        shutil.copy2(old_db_path, new_db_path)
        print(f"Database copied from {old_db_path} to {new_db_path}")
        
        # Connect to the new database
        conn = sqlite3.connect(new_db_path)
        cursor = conn.cursor()
        
        # Create new tables for metadata
        print("Creating metadata tables...")
        
        # Create ranks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rank (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create organizations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS organization (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Migrate existing ranks and organizations from clergy table
        print("Migrating existing ranks and organizations...")
        
        # Get unique ranks from clergy table
        cursor.execute('SELECT DISTINCT rank FROM clergy WHERE rank IS NOT NULL AND rank != ""')
        existing_ranks = cursor.fetchall()
        
        for rank_row in existing_ranks:
            rank_name = rank_row[0]
            try:
                cursor.execute('INSERT INTO rank (name) VALUES (?)', (rank_name,))
                print(f"  Added rank: {rank_name}")
            except sqlite3.IntegrityError:
                print(f"  Rank already exists: {rank_name}")
        
        # Get unique organizations from clergy table
        cursor.execute('SELECT DISTINCT organization FROM clergy WHERE organization IS NOT NULL AND organization != ""')
        existing_organizations = cursor.fetchall()
        
        for org_row in existing_organizations:
            org_name = org_row[0]
            try:
                cursor.execute('INSERT INTO organization (name) VALUES (?)', (org_name,))
                print(f"  Added organization: {org_name}")
            except sqlite3.IntegrityError:
                print(f"  Organization already exists: {org_name}")
        
        # Add some common ranks if none exist
        cursor.execute('SELECT COUNT(*) FROM rank')
        if cursor.fetchone()[0] == 0:
            print("Adding common ranks...")
            common_ranks = [
                ('Bishop', 'Episcopal rank'),
                ('Priest', 'Presbyteral rank'),
                ('Deacon', 'Diaconal rank'),
                ('Archbishop', 'Senior bishop'),
                ('Cardinal', 'Senior ecclesiastical official'),
                ('Pope', 'Bishop of Rome'),
                ('Metropolitan', 'Senior bishop of a province'),
                ('Patriarch', 'Senior bishop of a patriarchate')
            ]
            
            for rank_name, description in common_ranks:
                try:
                    cursor.execute('INSERT INTO rank (name, description) VALUES (?, ?)', (rank_name, description))
                    print(f"  Added common rank: {rank_name}")
                except sqlite3.IntegrityError:
                    print(f"  Rank already exists: {rank_name}")
        
        # Add some common organizations if none exist
        cursor.execute('SELECT COUNT(*) FROM organization')
        if cursor.fetchone()[0] == 0:
            print("Adding common organizations...")
            common_organizations = [
                ('Episcopal Church', 'Anglican Communion member'),
                ('Roman Catholic Church', 'Catholic Church'),
                ('Orthodox Church', 'Eastern Orthodox Christianity'),
                ('Anglican Communion', 'Worldwide Anglican fellowship'),
                ('Lutheran Church', 'Protestant denomination'),
                ('Methodist Church', 'Protestant denomination'),
                ('Presbyterian Church', 'Reformed Protestant denomination'),
                ('Baptist Church', 'Protestant denomination')
            ]
            
            for org_name, description in common_organizations:
                try:
                    cursor.execute('INSERT INTO organization (name, description) VALUES (?, ?)', (org_name, description))
                    print(f"  Added common organization: {org_name}")
                except sqlite3.IntegrityError:
                    print(f"  Organization already exists: {org_name}")
        
        # Commit changes
        conn.commit()
        conn.close()
        
        print("Database migration completed successfully!")
        print(f"New database: {new_db_path}")
        
        # Optionally backup the old database
        backup_path = f"{old_db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(old_db_path, backup_path)
        print(f"Old database backed up to: {backup_path}")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        if os.path.exists(new_db_path):
            os.remove(new_db_path)
            print("Cleaned up partial migration")

def add_abbreviation_column():
    """Add abbreviation column to organization table"""
    
    db_path = 'instance/ecclesiastical_lineage.db'
    
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found. Please run the main migration first.")
        return
    
    print("Adding abbreviation column to organization table...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if abbreviation column already exists
        cursor.execute("PRAGMA table_info(organization)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'abbreviation' not in columns:
            # Create a new table with the abbreviation column
            cursor.execute('''
                CREATE TABLE organization_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) UNIQUE NOT NULL,
                    abbreviation VARCHAR(20) UNIQUE,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Copy data from old table to new table
            cursor.execute('SELECT id, name, description, created_at FROM organization')
            organizations = cursor.fetchall()
            
            for org in organizations:
                cursor.execute('''
                    INSERT INTO organization_new (id, name, description, created_at) 
                    VALUES (?, ?, ?, ?)
                ''', org)
            
            # Drop old table and rename new table
            cursor.execute('DROP TABLE organization')
            cursor.execute('ALTER TABLE organization_new RENAME TO organization')
            
            print("  Added abbreviation column to organization table")
            
            # Add some common abbreviations for existing organizations
            common_abbreviations = {
                'Episcopal Church': 'EC',
                'Roman Catholic Church': 'RCC',
                'Orthodox Church': 'OC',
                'Anglican Communion': 'AC',
                'Lutheran Church': 'LC',
                'Methodist Church': 'MC',
                'Presbyterian Church': 'PC',
                'Baptist Church': 'BC'
            }
            
            for org_name, abbr in common_abbreviations.items():
                try:
                    cursor.execute('UPDATE organization SET abbreviation = ? WHERE name = ?', (abbr, org_name))
                    print(f"  Added abbreviation '{abbr}' for '{org_name}'")
                except sqlite3.IntegrityError:
                    print(f"  Abbreviation '{abbr}' already exists, skipping")
        else:
            print("  Abbreviation column already exists")
        
        conn.commit()
        conn.close()
        print("Abbreviation column migration completed successfully!")
        
    except Exception as e:
        print(f"Error during abbreviation migration: {e}")

if __name__ == '__main__':
    migrate_database()
    add_abbreviation_column() 