#!/usr/bin/env python3
"""
Debug script to check environment variables and database connection
"""

import os
import sys

def debug_environment():
    """Debug environment variables and database connection"""
    print("🔍 Environment Debug Information")
    print("=" * 50)
    
    # Check critical environment variables
    critical_vars = ['DATABASE_URL', 'SECRET_KEY']
    for var in critical_vars:
        value = os.environ.get(var)
        if value:
            if var == 'DATABASE_URL':
                # Mask the password in DATABASE_URL
                if '@' in value:
                    parts = value.split('@')
                    if ':' in parts[0]:
                        user_pass = parts[0].split(':')
                        if len(user_pass) >= 3:
                            masked_value = f"{user_pass[0]}:{user_pass[1]}:***@{parts[1]}"
                            print(f"✅ {var}: {masked_value}")
                        else:
                            print(f"✅ {var}: {value}")
                    else:
                        print(f"✅ {var}: {value}")
                else:
                    print(f"✅ {var}: {value}")
            else:
                # For SECRET_KEY, just show if it exists
                print(f"✅ {var}: {'*' * len(value)}")
        else:
            print(f"❌ {var}: NOT SET")
    
    # Check Python version
    print(f"🐍 Python version: {sys.version}")
    
    # Check if we can import required modules
    try:
        import psycopg
        print("✅ psycopg3 imported successfully")
    except ImportError as e:
        print(f"❌ psycopg3 import failed: {e}")
    
    try:
        import sqlalchemy
        print(f"✅ SQLAlchemy imported successfully (version: {sqlalchemy.__version__})")
    except ImportError as e:
        print(f"❌ SQLAlchemy import failed: {e}")
    
    try:
        import flask
        print(f"✅ Flask imported successfully (version: {flask.__version__})")
    except ImportError as e:
        print(f"❌ Flask import failed: {e}")
    
    print("=" * 50)

if __name__ == '__main__':
    debug_environment() 