#!/usr/bin/env python3
"""
Final staging sync with all required fields
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Final Staging Database Sync")
    print("=" * 40)
    
    if not production_url or not staging_url:
        print("❌ Database URLs not found")
        return
    
    try:
        prod_engine = create_engine(production_url)
        staging_engine = create_engine(staging_url)
        
        with prod_engine.connect() as prod_conn, staging_engine.connect() as staging_conn:
            # Clear staging tables (in correct order for foreign keys)
            print("🧹 Clearing staging tables...")
            staging_conn.execute(text("DELETE FROM clergy_comment"))
            staging_conn.execute(text("DELETE FROM consecration"))
            staging_conn.execute(text("DELETE FROM ordination"))
            staging_conn.execute(text("DELETE FROM clergy"))
            staging_conn.execute(text("DELETE FROM organization"))
            staging_conn.execute(text("DELETE FROM rank"))
            staging_conn.commit()
            
            # Sync organizations (with all fields)
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
            
            # Sync ranks (with all fields)
            print("📤 Syncing ranks...")
            ranks = prod_conn.execute(text("""
                SELECT id, name, abbreviation, description, color, created_at 
                FROM rank
            """)).fetchall()
            
            for rank in ranks:
                staging_conn.execute(text("""
                    INSERT INTO rank (id, name, abbreviation, description, color, created_at) 
                    VALUES (:id, :name, :abbreviation, :description, :color, :created_at)
                """), {
                    "id": rank[0], "name": rank[1], "abbreviation": rank[2], 
                    "description": rank[3], "color": rank[4], "created_at": rank[5]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(ranks)} ranks")
            
            # Sync clergy (without image data)
            print("📤 Syncing clergy...")
            clergy = prod_conn.execute(text("""
                SELECT id, name, rank, organization, date_of_birth, date_of_ordination, 
                       ordaining_bishop_id, date_of_consecration, consecrator_id, 
                       co_consecrators, date_of_death, notes, is_deleted, deleted_at, papal_name
                FROM clergy
            """)).fetchall()
            
            for cl in clergy:
                staging_conn.execute(text("""
                    INSERT INTO clergy (id, name, rank, organization, date_of_birth, date_of_ordination, 
                                       ordaining_bishop_id, date_of_consecration, consecrator_id, 
                                       co_consecrators, date_of_death, notes, is_deleted, deleted_at, papal_name)
                    VALUES (:id, :name, :rank, :organization, :date_of_birth, :date_of_ordination, 
                            :ordaining_bishop_id, :date_of_consecration, :consecrator_id, 
                            :co_consecrators, :date_of_death, :notes, :is_deleted, :deleted_at, :papal_name)
                """), {
                    "id": cl[0], "name": cl[1], "rank": cl[2], "organization": cl[3], 
                    "date_of_birth": cl[4], "date_of_ordination": cl[5], "ordaining_bishop_id": cl[6],
                    "date_of_consecration": cl[7], "consecrator_id": cl[8], "co_consecrators": cl[9],
                    "date_of_death": cl[10], "notes": cl[11], "is_deleted": cl[12], 
                    "deleted_at": cl[13], "papal_name": cl[14]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(clergy)} clergy")
            
            # Sync ordinations
            print("📤 Syncing ordinations...")
            ordinations = prod_conn.execute(text("SELECT * FROM ordination")).fetchall()
            for ord in ordinations:
                staging_conn.execute(text("""
                    INSERT INTO ordination (id, clergy_id, ordaining_bishop_id, date, location)
                    VALUES (:id, :clergy_id, :ordaining_bishop_id, :date, :location)
                """), {
                    "id": ord[0], "clergy_id": ord[1], "ordaining_bishop_id": ord[2], 
                    "date": ord[3], "location": ord[4]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(ordinations)} ordinations")
            
            # Sync consecrations
            print("📤 Syncing consecrations...")
            consecrations = prod_conn.execute(text("SELECT * FROM consecration")).fetchall()
            for cons in consecrations:
                staging_conn.execute(text("""
                    INSERT INTO consecration (id, clergy_id, consecrator_id, date, location)
                    VALUES (:id, :clergy_id, :consecrator_id, :date, :location)
                """), {
                    "id": cons[0], "clergy_id": cons[1], "consecrator_id": cons[2], 
                    "date": cons[3], "location": cons[4]
                })
            staging_conn.commit()
            print(f"✅ Synced {len(consecrations)} consecrations")
            
            # Verify final counts
            print("\n📊 Final verification:")
            tables = ['clergy', 'ordination', 'consecration', 'organization', 'rank']
            for table in tables:
                result = staging_conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  {table}: {count} records")
            
            print(f"\n✅ Staging database sync completed successfully!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
