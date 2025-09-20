#!/usr/bin/env python3
"""
Sync ordinations and consecrations data to staging
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Syncing Ordinations and Consecrations")
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
            
            # Sync ordinations
            print("📤 Syncing ordinations...")
            ordinations = prod_conn.execute(text("SELECT * FROM ordination")).fetchall()
            
            for ord in ordinations:
                try:
                    staging_conn.execute(text("""
                        INSERT INTO ordination (id, clergy_id, ordaining_bishop_id, date, location)
                        VALUES (:id, :clergy_id, :ordaining_bishop_id, :date, :location)
                    """), {
                        "id": ord[0], "clergy_id": ord[1], "ordaining_bishop_id": ord[2], 
                        "date": ord[3], "location": ord[4]
                    })
                except Exception as e:
                    print(f"  ⚠️  Skipping ordination {ord[0]} due to foreign key constraint: {e}")
                    continue
            
            staging_conn.commit()
            print(f"✅ Synced {len(ordinations)} ordinations")
            
            # Sync consecrations
            print("📤 Syncing consecrations...")
            consecrations = prod_conn.execute(text("SELECT * FROM consecration")).fetchall()
            
            for cons in consecrations:
                try:
                    staging_conn.execute(text("""
                        INSERT INTO consecration (id, clergy_id, consecrator_id, date, location)
                        VALUES (:id, :clergy_id, :consecrator_id, :date, :location)
                    """), {
                        "id": cons[0], "clergy_id": cons[1], "consecrator_id": cons[2], 
                        "date": cons[3], "location": cons[4]
                    })
                except Exception as e:
                    print(f"  ⚠️  Skipping consecration {cons[0]} due to foreign key constraint: {e}")
                    continue
            
            staging_conn.commit()
            print(f"✅ Synced {len(consecrations)} consecrations")
            
            # Verify final counts
            print("\n📊 Final verification:")
            ord_count = staging_conn.execute(text("SELECT COUNT(*) FROM ordination")).scalar()
            cons_count = staging_conn.execute(text("SELECT COUNT(*) FROM consecration")).scalar()
            print(f"  ordination: {ord_count} records")
            print(f"  consecration: {cons_count} records")
            
            print(f"\n✅ Ordinations and consecrations sync completed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
