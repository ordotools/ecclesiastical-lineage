#!/usr/bin/env python3
"""
Test script to check remote database connection and contents.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_remote_db():
    from app import app, db
    from sqlalchemy import inspect, text
    
    with app.app_context():
        print("🔍 Testing remote database connection...")
        
        try:
            # Test connection
            result = db.session.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✅ Connected to PostgreSQL: {version}")
            
            # Check if tables exist
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"📊 Tables found: {tables}")
            
            if 'clergy' in tables:
                # Count clergy records
                result = db.session.execute(text("SELECT COUNT(*) FROM clergy"))
                count = result.fetchone()[0]
                print(f"👥 Clergy records: {count}")
                
                # Show some sample clergy
                if count > 0:
                    result = db.session.execute(text("SELECT name, rank FROM clergy LIMIT 5"))
                    clergy = result.fetchall()
                    print("📋 Sample clergy:")
                    for name, rank in clergy:
                        print(f"   - {name} ({rank})")
                else:
                    print("⚠️  No clergy records found")
            
            if 'user' in tables:
                # Count users
                result = db.session.execute(text("SELECT COUNT(*) FROM \"user\""))
                count = result.fetchone()[0]
                print(f"👤 Users: {count}")
            
        except Exception as e:
            print(f"❌ Error connecting to database: {e}")
            return False
        
        return True

if __name__ == '__main__':
    test_remote_db() 