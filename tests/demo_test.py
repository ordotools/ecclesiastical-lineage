#!/usr/bin/env python3
"""
Demo script showing how to use the clergy forms testing system.
This is a simplified example for demonstration purposes.
"""

import os
import sys
import requests
import json
from datetime import datetime

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import test configuration
from test_config import BASE_URL, SAMPLE_CLERGY_DATA

def demo_form_test():
    """Simple demo of testing a single form"""
    print("🎯 Clergy Forms Testing Demo")
    print("=" * 40)
    
    base_url = BASE_URL
    
    # Test data
    test_data = SAMPLE_CLERGY_DATA.copy()
    test_data["name"] = "Demo Bishop John"
    test_data["notes"] = "Demo clergy member"
    
    print("1. Testing application connectivity...")
    try:
        response = requests.get(base_url)
        if response.status_code == 200:
            print("   ✅ Application is running")
        else:
            print(f"   ❌ Application returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Cannot connect to application: {e}")
        return False
    
    print("\n2. Testing add clergy page...")
    try:
        response = requests.get(f"{base_url}/clergy/add")
        if response.status_code == 200:
            print("   ✅ Add clergy page accessible")
            
            # Check for form action
            if 'action=' in response.text:
                print("   ✅ Form action found in page")
            else:
                print("   ❌ No form action found")
                return False
        else:
            print(f"   ❌ Add clergy page returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error accessing add clergy page: {e}")
        return False
    
    print("\n3. Testing form submission...")
    try:
        response = requests.post(f"{base_url}/clergy/add", data=test_data, allow_redirects=False)
        if response.status_code in [200, 302]:
            print("   ✅ Form submission successful")
            print(f"   📊 Response status: {response.status_code}")
        else:
            print(f"   ❌ Form submission failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error submitting form: {e}")
        return False
    
    print("\n4. Testing modal forms...")
    try:
        # Test modal add form
        response = requests.get(f"{base_url}/clergy/modal/add")
        if response.status_code == 200:
            print("   ✅ Modal add form accessible")
        else:
            print(f"   ❌ Modal add form returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error accessing modal form: {e}")
        return False
    
    print("\n5. Testing lineage forms...")
    try:
        # Test lineage add form
        response = requests.get(f"{base_url}/clergy/add_from_lineage?context_type=ordination&context_clergy_id=1")
        if response.status_code == 200:
            print("   ✅ Lineage add form accessible")
        else:
            print(f"   ❌ Lineage add form returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error accessing lineage form: {e}")
        return False
    
    print("\n🎉 Demo completed successfully!")
    print("\n💡 To run the full test suite:")
    print("   ./run_form_tests.sh")
    
    return True

if __name__ == "__main__":
    success = demo_form_test()
    exit(0 if success else 1)
