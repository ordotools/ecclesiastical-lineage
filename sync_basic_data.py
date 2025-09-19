#!/usr/bin/env python3
"""
Sync basic data without foreign key relationships
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Basic Data Sync (No Foreign Keys)")
    print("=" * 40)
    
    if not production_url or not staging_url:
        print("❌ Database URLs not found")
        return
    
    try:
        prod_engine = create_engine(production_url)
        staging_engine = create_engine(staging_url)
        
        with prod_engine.connect() as prod_conn, staging_engine.connect() as staging_conn:
            # Clear staging tables
            print("🧹 Clearing staging tables...")
            staging_conn.execute(text("DELETE FROM clergy_comment"))
            staging_conn.execute(text("DELETE FROM consecration"))
            staging_conn.execute(text("DELETE FROM ordination"))
            staging_conn.execute(text("DELETE FROM clergy"))
            staging_conn.execute(text("DELETE FROM organization"))
            staging_conn.execute(text("DELETE FROM rank"))
            staging_conn.commit()
            
            # Sync organizations
            print("📤 Syncing organizations...")
            orgs = prod_conn.execute(text("""
                SELECT id, name, abbreviation, description, color, created_at 
                FROM organization
            """)).fetchall()
            
            for org in orgs:
                staging_conn.execute(text("""
                    INSERT INTO organization (id, name, abbreviation, description, color, created_at) 
                    VALUES (:id, :name, :abbreviation, :description, :color, :created_at)
                """), {
                    "id": org[0], "name": org[1], "abbreviation": org[2], 
                    "description": org[3], "color": org[4], "created_at": org[5]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(orgs)} organizations")
            
            # Sync ranks
            print("📤 Syncing ranks...")
            ranks = prod_conn.execute(text("""
                SELECT id, name, description, color, created_at, is_bishop 
                FROM rank
            """)).fetchall()
            
            for rank in ranks:
                staging_conn.execute(text("""
                    INSERT INTO rank (id, name, description, color, created_at, is_bishop) 
                    VALUES (:id, :name, :description, :color, :created_at, :is_bishop)
                """), {
                    "id": rank[0], "name": rank[1], "description": rank[2], 
                    "color": rank[3], "created_at": rank[4], "is_bishop": rank[5]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(ranks)} ranks")
            
            # Sync clergy without foreign key references
            print("📤 Syncing clergy (without foreign keys)...")
            clergy = prod_conn.execute(text("""
                SELECT id, name, rank, organization, date_of_birth, date_of_ordination, 
                       date_of_consecration, co_consecrators, date_of_death, notes, 
                       is_deleted, deleted_at, papal_name
                FROM clergy
            """)).fetchall()
            
            for cl in clergy:
                staging_conn.execute(text("""
                    INSERT INTO clergy (id, name, rank, organization, date_of_birth, date_of_ordination, 
                                       date_of_consecration, co_consecrators, date_of_death, notes, 
                                       is_deleted, deleted_at, papal_name)
                    VALUES (:id, :name, :rank, :organization, :date_of_birth, :date_of_ordination, 
                            :date_of_consecration, :co_consecrators, :date_of_death, :notes, 
                            :is_deleted, :deleted_at, :papal_name)
                """), {
                    "id": cl[0], "name": cl[1], "rank": cl[2], "organization": cl[3], 
                    "date_of_birth": cl[4], "date_of_ordination": cl[5], 
                    "date_of_consecration": cl[6], "co_consecrators": cl[7],
                    "date_of_death": cl[8], "notes": cl[9], "is_deleted": cl[10], 
                    "deleted_at": cl[11], "papal_name": cl[12]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(clergy)} clergy")
            
            # Verify final counts
            print("\n📊 Final verification:")
            tables = ['clergy', 'organization', 'rank']
            for table in tables:
                result = staging_conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  {table}: {count} records")
            
            print(f"\n✅ Basic data sync completed successfully!")
            print(f"ℹ️  Note: Foreign key relationships (ordinations, consecrations) were skipped")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
