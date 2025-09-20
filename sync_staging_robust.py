#!/usr/bin/env python3
"""
Robust script to sync production data to staging
Handles large data fields and column size limits
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.exc import DataError

def truncate_string(value, max_length=1000):
    """Truncate string if it's too long"""
    if isinstance(value, str) and len(value) > max_length:
        return value[:max_length-3] + "..."
    return value

def sync_table(prod_conn, staging_conn, table_name, max_string_length=1000):
    """Sync a single table from production to staging"""
    print(f"🔄 Syncing {table_name}...")
    
    try:
        # Get table structure
        prod_meta = MetaData()
        staging_meta = MetaData()
        
        prod_table = Table(table_name, prod_meta, autoload_with=prod_conn)
        staging_table = Table(table_name, staging_meta, autoload_with=staging_conn)
        
        # Clear staging table
        staging_conn.execute(text(f"DELETE FROM {table_name}"))
        staging_conn.commit()
        
        # Get all data from production
        result = prod_conn.execute(text(f"SELECT * FROM {table_name}"))
        rows = result.fetchall()
        columns = result.keys()
        
        print(f"  📤 Found {len(rows)} records in production")
        
        if len(rows) == 0:
            print(f"  ✅ {table_name} is empty, skipping")
            return
        
        # Insert data into staging
        inserted = 0
        for i, row in enumerate(rows):
            try:
                # Prepare values, truncating long strings
                values = []
                for j, value in enumerate(row):
                    col_name = columns[j]
                    if isinstance(value, str):
                        # Truncate very long strings
                        if col_name in ['image_data', 'image_url']:
                            value = truncate_string(value, 50000)  # Allow larger for images
                        else:
                            value = truncate_string(value, max_string_length)
                    values.append(value)
                
                # Build insert statement
                placeholders = ', '.join(['%s'] * len(values))
                insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
                
                staging_conn.execute(text(insert_sql), values)
                inserted += 1
                
                if (i + 1) % 10 == 0:
                    print(f"  📝 Processed {i + 1}/{len(rows)} records...")
                    
            except DataError as e:
                print(f"  ⚠️  Skipping record {i + 1} due to data error: {e}")
                continue
            except Exception as e:
                print(f"  ❌ Error inserting record {i + 1}: {e}")
                continue
        
        staging_conn.commit()
        print(f"  ✅ Successfully inserted {inserted}/{len(rows)} records into {table_name}")
        
    except Exception as e:
        print(f"  ❌ Error syncing {table_name}: {e}")
        staging_conn.rollback()

def main():
    load_dotenv()
    
    production_url = os.environ.get('PRODUCTION_DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    print("🔄 Robust Staging Database Sync")
    print("=" * 50)
    
    if not production_url:
        print("❌ PRODUCTION_DATABASE_URL not found")
        return
    
    if not staging_url:
        print("❌ STAGING_DATABASE_URL not found")
        return
    
    print(f"📊 Production: {production_url[:50]}...")
    print(f"📊 Staging: {staging_url[:50]}...")
    
    try:
        # Connect to databases
        prod_engine = create_engine(production_url)
        staging_engine = create_engine(staging_url)
        
        with prod_engine.connect() as prod_conn, staging_engine.connect() as staging_conn:
            # Test connections
            prod_result = prod_conn.execute(text("SELECT COUNT(*) FROM clergy"))
            prod_count = prod_result.scalar()
            print(f"✅ Production: {prod_count} clergy records")
            
            staging_result = staging_conn.execute(text("SELECT COUNT(*) FROM clergy"))
            staging_count = staging_result.scalar()
            print(f"✅ Staging: {staging_count} clergy records")
            
            if staging_count > 0:
                print(f"\n⚠️  Staging already has {staging_count} records")
                response = input("Do you want to clear and resync? (y/N): ")
                if response.lower() != 'y':
                    print("❌ Sync cancelled")
                    return
            
            print(f"\n🔄 Starting sync...")
            
            # Sync tables in order (respecting foreign key constraints)
            tables_to_sync = [
                'clergy',
                'ordination', 
                'consecration',
                'organization',
                'rank',
                'user',
                'role',
                'permission',
                'clergy_comment'
            ]
            
            for table_name in tables_to_sync:
                try:
                    sync_table(prod_conn, staging_conn, table_name)
                except Exception as e:
                    print(f"⚠️  Could not sync {table_name}: {e}")
                    continue
            
            # Verify final counts
            print(f"\n📊 Final verification:")
            for table_name in tables_to_sync:
                try:
                    staging_result = staging_conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    staging_count = staging_result.scalar()
                    print(f"  {table_name}: {staging_count} records")
                except:
                    print(f"  {table_name}: table not found")
            
            print(f"\n✅ Sync completed successfully!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
