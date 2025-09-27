#!/usr/bin/env python3
"""
Debug script to check database sync status and data availability
"""

import os
import psycopg2
from sqlalchemy import create_engine, text
import sys

def test_remote_connection():
    """Test connection to remote database and check data"""
    print("🔍 Testing remote database connection...")
    
    # Load environment variables
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    
    remote_url = os.getenv('RENDER_PG_URL')
    if not remote_url:
        print("❌ RENDER_PG_URL not found in environment")
        return False
    
    print(f"📡 Remote URL: {remote_url}")
    
    try:
        # Test connection
        engine = create_engine(remote_url)
        with engine.connect() as conn:
            print("✅ Remote database connection successful")
            
            # Check if tables exist
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]
            print(f"📊 Tables found: {tables}")
            
            # Check data in key tables
            key_tables = ['clergy', 'user', 'role', 'permission']
            for table in key_tables:
                if table in tables:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    print(f"   {table}: {count} records")
                else:
                    print(f"   {table}: table not found")
            
            return True
            
    except Exception as e:
        print(f"❌ Remote database connection failed: {e}")
        return False

def test_local_connection():
    """Test connection to local database and check data"""
    print("\n🔍 Testing local database connection...")
    
    local_url = "postgresql://localhost:5432/ecclesiastical_lineage_dev"
    print(f"📡 Local URL: {local_url}")
    
    try:
        engine = create_engine(local_url)
        with engine.connect() as conn:
            print("✅ Local database connection successful")
            
            # Check if tables exist
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]
            print(f"📊 Tables found: {tables}")
            
            # Check data in key tables
            key_tables = ['clergy', 'user', 'role', 'permission']
            for table in key_tables:
                if table in tables:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    print(f"   {table}: {count} records")
                else:
                    print(f"   {table}: table not found")
            
            return True
            
    except Exception as e:
        print(f"❌ Local database connection failed: {e}")
        return False

def test_pg_dump():
    """Test if pg_dump can export from remote database"""
    print("\n🔍 Testing pg_dump export...")
    
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    
    remote_url = os.getenv('RENDER_PG_URL')
    if not remote_url:
        print("❌ RENDER_PG_URL not found")
        return False
    
    try:
        import subprocess
        result = subprocess.run([
            'pg_dump', '--clean', '--if-exists', '--no-owner', '--no-privileges', 
            remote_url
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ pg_dump export successful")
            print(f"📄 Export size: {len(result.stdout)} characters")
            
            # Check if export contains data
            if 'INSERT INTO' in result.stdout:
                print("✅ Export contains INSERT statements (has data)")
            else:
                print("⚠️  Export does not contain INSERT statements (no data)")
            
            return True
        else:
            print(f"❌ pg_dump failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ pg_dump test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Database Sync Debug Tool")
    print("=" * 50)
    
    # Test remote connection
    remote_ok = test_remote_connection()
    
    # Test local connection
    local_ok = test_local_connection()
    
    # Test pg_dump
    dump_ok = test_pg_dump()
    
    print("\n📋 Summary:")
    print(f"   Remote DB: {'✅' if remote_ok else '❌'}")
    print(f"   Local DB:  {'✅' if local_ok else '❌'}")
    print(f"   pg_dump:   {'✅' if dump_ok else '❌'}")
    
    if not remote_ok:
        print("\n❌ Issue: Cannot connect to remote database")
        print("   Check your RENDER_PG_URL in .env file")
    elif not dump_ok:
        print("\n❌ Issue: pg_dump cannot export from remote database")
        print("   Check your PostgreSQL client installation")
    elif not local_ok:
        print("\n❌ Issue: Cannot connect to local database")
        print("   Make sure PostgreSQL is running locally")
    else:
        print("\n✅ All tests passed - sync should work")
