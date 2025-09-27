#!/usr/bin/env python3
"""
Quick script to sync production data to staging
Run this after you have the correct staging database URL
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Staging Database Data Sync")
    print("=" * 40)
    
    if not production_url:
        print("❌ PRODUCTION_DATABASE_URL not found")
        return
    
    if not staging_url:
        print("❌ STAGING_DATABASE_URL not found")
        print("Please set the correct staging database URL in your .env file")
        return
    
    print(f"📊 Production: {production_url[:50]}...")
    print(f"📊 Staging: {staging_url[:50]}...")
    
    try:
        # Test production connection
        prod_engine = create_engine(production_url)
        with prod_engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM clergy"))
            prod_count = result.scalar()
            print(f"✅ Production: {prod_count} clergy records")
        
        # Test staging connection
        staging_engine = create_engine(staging_url)
        with staging_engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM clergy"))
            staging_count = result.scalar()
            print(f"✅ Staging: {staging_count} clergy records")
        
        if staging_count == 0:
            print("\n🔄 Staging database is empty. Syncing data from production...")
            
            # Get all data from production
            with prod_engine.connect() as conn:
                # Get all clergy
                clergy_result = conn.execute(text("SELECT * FROM clergy"))
                clergy_data = clergy_result.fetchall()
                clergy_columns = clergy_result.keys()
                
                # Get all ordinations
                ordination_result = conn.execute(text("SELECT * FROM ordination"))
                ordination_data = ordination_result.fetchall()
                ordination_columns = ordination_result.keys()
                
                # Get all consecrations
                consecration_result = conn.execute(text("SELECT * FROM consecration"))
                consecration_data = consecration_result.fetchall()
                consecration_columns = consecration_result.keys()
                
                print(f"📤 Found {len(clergy_data)} clergy, {len(ordination_data)} ordinations, {len(consecration_data)} consecrations")
            
            # Insert data into staging
            with staging_engine.connect() as conn:
                # Clear existing data
                conn.execute(text("DELETE FROM consecration"))
                conn.execute(text("DELETE FROM ordination"))
                conn.execute(text("DELETE FROM clergy"))
                conn.commit()
                
                # Insert clergy
                for row in clergy_data:
                    values = [f"'{str(v).replace("'", "''")}'" if v is not None else 'NULL' for v in row]
                    insert_sql = f"INSERT INTO clergy ({', '.join(clergy_columns)}) VALUES ({', '.join(values)})"
                    conn.execute(text(insert_sql))
                
                # Insert ordinations
                for row in ordination_data:
                    values = [f"'{str(v).replace("'", "''")}'" if v is not None else 'NULL' for v in row]
                    insert_sql = f"INSERT INTO ordination ({', '.join(ordination_columns)}) VALUES ({', '.join(values)})"
                    conn.execute(text(insert_sql))
                
                # Insert consecrations
                for row in consecration_data:
                    values = [f"'{str(v).replace("'", "''")}'" if v is not None else 'NULL' for v in row]
                    insert_sql = f"INSERT INTO consecration ({', '.join(consecration_columns)}) VALUES ({', '.join(values)})"
                    conn.execute(text(insert_sql))
                
                conn.commit()
                print("✅ Data synced successfully!")
                
                # Verify
                result = conn.execute(text("SELECT COUNT(*) FROM clergy"))
                new_count = result.scalar()
                print(f"✅ Verification: Staging now has {new_count} clergy records")
        
        else:
            print(f"ℹ️  Staging already has {staging_count} records")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Check that your staging database URL is correct")
        print("2. Make sure the staging database is accessible")
        print("3. Verify the database has the correct tables")

if __name__ == "__main__":
    main()
