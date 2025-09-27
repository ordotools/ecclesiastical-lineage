#!/usr/bin/env python3
"""
Sync with correct staging schema
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Syncing with Correct Staging Schema")
    print("=" * 40)
    
    if not production_url or not staging_url:
        print("❌ Database URLs not found")
        return
    
    try:
        prod_engine = create_engine(production_url)
        staging_engine = create_engine(staging_url)
        
        with prod_engine.connect() as prod_conn, staging_engine.connect() as staging_conn:
            # Clear existing ordinations and consecrations
            print("🧹 Clearing existing ordinations and consecrations...")
            staging_conn.execute(text("DELETE FROM consecration"))
            staging_conn.execute(text("DELETE FROM ordination"))
            staging_conn.commit()
            
            # Sync ordinations (matching staging schema)
            print("📤 Syncing ordinations...")
            ordinations = prod_conn.execute(text("SELECT * FROM ordination")).fetchall()
            
            for ord in ordinations:
                try:
                    # Map production columns to staging schema
                    staging_conn.execute(text("""
                        INSERT INTO ordination (id, clergy_id, date, ordaining_bishop_id, 
                                              is_sub_conditione, is_doubtful, is_invalid, notes, 
                                              created_at, updated_at)
                        VALUES (:id, :clergy_id, :date, :ordaining_bishop_id, 
                                :is_sub_conditione, :is_doubtful, :is_invalid, :notes, 
                                :created_at, :updated_at)
                    """), {
                        "id": ord[0], 
                        "clergy_id": ord[1], 
                        "date": ord[3],  # date is 3rd column in production
                        "ordaining_bishop_id": ord[2],  # ordaining_bishop_id is 2nd column
                        "is_sub_conditione": False,  # default values
                        "is_doubtful": False,
                        "is_invalid": False,
                        "notes": None,
                        "created_at": None,
                        "updated_at": None
                    })
                except Exception as e:
                    print(f"  ⚠️  Skipping ordination {ord[0]}: {e}")
                    continue
            
            staging_conn.commit()
            print(f"✅ Synced ordinations")
            
            # Sync consecrations (matching staging schema)
            print("📤 Syncing consecrations...")
            consecrations = prod_conn.execute(text("SELECT * FROM consecration")).fetchall()
            
            for cons in consecrations:
                try:
                    # Map production columns to staging schema
                    staging_conn.execute(text("""
                        INSERT INTO consecration (id, clergy_id, date, consecrator_id, 
                                                is_sub_conditione, is_doubtful, is_invalid, notes, 
                                                created_at, updated_at)
                        VALUES (:id, :clergy_id, :date, :consecrator_id, 
                                :is_sub_conditione, :is_doubtful, :is_invalid, :notes, 
                                :created_at, :updated_at)
                    """), {
                        "id": cons[0], 
                        "clergy_id": cons[1], 
                        "date": cons[3],  # date is 3rd column in production
                        "consecrator_id": cons[2],  # consecrator_id is 2nd column
                        "is_sub_conditione": False,  # default values
                        "is_doubtful": False,
                        "is_invalid": False,
                        "notes": None,
                        "created_at": None,
                        "updated_at": None
                    })
                except Exception as e:
                    print(f"  ⚠️  Skipping consecration {cons[0]}: {e}")
                    continue
            
            staging_conn.commit()
            print(f"✅ Synced consecrations")
            
            # Verify final counts
            print("\n📊 Final verification:")
            ord_count = staging_conn.execute(text("SELECT COUNT(*) FROM ordination")).scalar()
            cons_count = staging_conn.execute(text("SELECT COUNT(*) FROM consecration")).scalar()
            print(f"  ordination: {ord_count} records")
            print(f"  consecration: {cons_count} records")
            
            print(f"\n✅ Sync completed successfully!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
