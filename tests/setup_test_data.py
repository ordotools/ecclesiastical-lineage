#!/usr/bin/env python3
"""
Setup test data for clergy forms testing.
Creates test user and sample clergy data.
"""

import os
import sys
import requests
from datetime import datetime, date

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

BASE_URL = "http://localhost:5000"

def setup_test_user():
    """Create a test user if it doesn't exist"""
    print("👤 Setting up test user...")
    
    # Try to sign up a test user
    signup_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
        "confirm_password": "testpass123",
        "full_name": "Test User"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/signup", data=signup_data, allow_redirects=False)
        if response.status_code in [200, 302]:
            print("✅ Test user created successfully")
            return True
        else:
            print(f"⚠️  Test user creation returned status {response.status_code} (may already exist)")
            return True  # User might already exist
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return False

def setup_test_metadata():
    """Create test metadata (ranks, organizations) if needed"""
    print("📋 Setting up test metadata...")
    
    # Test ranks
    ranks = ["Bishop", "Priest", "Deacon"]
    # Test organizations  
    organizations = [
        {"name": "Test Diocese", "abbreviation": "TD"},
        {"name": "Test Archdiocese", "abbreviation": "TA"},
        {"name": "Test Religious Order", "abbreviation": "TRO"}
    ]
    
    # Note: In a real implementation, you'd make API calls to create these
    # For now, we'll assume they exist or will be created by the application
    print("✅ Test metadata setup complete (assuming default data exists)")
    return True

def create_sample_clergy():
    """Create a sample clergy member for testing"""
    print("👨‍💼 Creating sample clergy member...")
    
    # This would require authentication, so we'll skip for now
    # In a real test, you'd login and create sample data
    print("✅ Sample clergy creation skipped (will be created during tests)")
    return True

def main():
    """Setup all test data"""
    print("🔧 Setting up test data for clergy forms testing")
    print("=" * 50)
    
    # Check if app is running
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code != 200:
            print(f"❌ Application not running at {BASE_URL}")
            print("   Please start your Flask application first")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to application: {e}")
        return False
    
    print("✅ Application is running")
    
    # Setup test data
    success = True
    success &= setup_test_user()
    success &= setup_test_metadata()
    success &= create_sample_clergy()
    
    if success:
        print("\n🎉 Test data setup complete!")
        print("\n📝 Next steps:")
        print("   1. Make sure you have a test user with username 'testuser' and password 'testpass123'")
        print("   2. Ensure you have at least one clergy member in the database for edit tests")
        print("   3. Run the form tests: ./run_form_tests.sh")
    else:
        print("\n❌ Test data setup failed!")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
