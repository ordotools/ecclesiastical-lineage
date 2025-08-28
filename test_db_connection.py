#!/usr/bin/env python3
"""
Test script to verify database connection with SSL configuration
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from urllib.parse import urlparse, urlunparse

load_dotenv()

def fix_database_url(url):
    """Fix database URL to handle SSL connections properly on Render"""
    if url.startswith('postgres://'):
        # Convert postgres:// to postgresql://
        url = url.replace('postgres://', 'postgresql://', 1)
    
    # Parse the URL
    parsed = urlparse(url)
    
    # Add SSL mode parameters for Render PostgreSQL
    if 'onrender.com' in parsed.hostname or 'render.com' in parsed.hostname:
        # Add SSL mode and other parameters for Render
        if parsed.query:
            query = parsed.query + '&sslmode=require'
        else:
            query = 'sslmode=require'
        
        # Reconstruct URL with SSL parameters
        fixed_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            query,
            parsed.fragment
        ))
        return fixed_url
    
    return url

def test_connection():
    """Test the database connection"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return False
    
    print(f"🔗 Original DATABASE_URL: {database_url}")
    
    # Apply the fix
    fixed_url = fix_database_url(database_url)
    print(f"🔧 Fixed DATABASE_URL: {fixed_url}")
    
    try:
        # Create engine with SSL configuration
        engine = create_engine(
            fixed_url,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={
                'connect_timeout': 10,
                'application_name': 'ecclesiastical_lineage_test'
            }
        )
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version_row = result.fetchone()
            if version_row:
                version = version_row[0]
                print(f"✅ Database connection successful!")
                print(f"📊 PostgreSQL version: {version}")
            else:
                print("⚠️  Could not retrieve PostgreSQL version")
            
            # Test a simple query
            result = conn.execute(text("SELECT current_database(), current_user"))
            db_info = result.fetchone()
            if db_info:
                print(f"🗄️  Connected to database: {db_info[0]}")
                print(f"👤 Connected as user: {db_info[1]}")
            else:
                print("⚠️  Could not retrieve database info")
            
            return True
            
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing database connection with SSL configuration...")
    success = test_connection()
    
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n💥 Tests failed!")
        exit(1)
