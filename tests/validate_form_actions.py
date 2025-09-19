#!/usr/bin/env python3
"""
Quick validation script to check if form actions are working correctly.
This script checks the HTML output of all form templates to ensure
the auto-generated form actions are present and correct.
"""

import requests
import re
from urllib.parse import urljoin

BASE_URL = "http://localhost:5000"

def check_form_action(html_content, expected_pattern, form_name):
    """Check if form action matches expected pattern"""
    # Look for form action attribute
    action_match = re.search(r'action="([^"]*)"', html_content)
    
    if not action_match:
        return False, f"No form action found in {form_name}"
    
    actual_action = action_match.group(1)
    
    # Check if it matches expected pattern
    if re.search(expected_pattern, actual_action):
        return True, f"✅ {form_name}: {actual_action}"
    else:
        return False, f"❌ {form_name}: Expected pattern '{expected_pattern}', got '{actual_action}'"

def validate_all_forms():
    """Validate all clergy forms"""
    print("🔍 Validating Clergy Form Actions")
    print("=" * 40)
    
    results = []
    
    # Test cases: (url, form_name, expected_pattern)
    test_cases = [
        ("/clergy/add", "Add Clergy Page", r"/clergy/add"),
        ("/clergy/modal/add", "Modal Add Form", r"/clergy/add"),
        ("/clergy/add_from_lineage?context_type=ordination&context_clergy_id=1", 
         "Lineage Add Form", r"/clergy/add_from_lineage"),
    ]
    
    for url, form_name, expected_pattern in test_cases:
        try:
            print(f"\n📋 Testing {form_name}...")
            response = requests.get(urljoin(BASE_URL, url))
            
            if response.status_code != 200:
                results.append((form_name, False, f"HTTP {response.status_code}"))
                print(f"   ❌ HTTP {response.status_code}")
                continue
            
            success, message = check_form_action(response.text, expected_pattern, form_name)
            results.append((form_name, success, message))
            print(f"   {message}")
            
        except Exception as e:
            results.append((form_name, False, f"Error: {e}"))
            print(f"   ❌ Error: {e}")
    
    # Summary
    print("\n" + "=" * 40)
    print("📊 Validation Summary")
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed < total:
        print("\n❌ Failed validations:")
        for form_name, success, message in results:
            if not success:
                print(f"   - {form_name}: {message}")
    
    return passed == total

def main():
    """Main validation function"""
    print("🚀 Starting form action validation...")
    
    # Check if app is running
    try:
        response = requests.get(BASE_URL)
        if response.status_code != 200:
            print(f"❌ Application not running at {BASE_URL}")
            print("   Please start your Flask application first")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to application: {e}")
        return False
    
    print("✅ Application is running")
    
    # Run validation
    success = validate_all_forms()
    
    if success:
        print("\n🎉 All form actions are working correctly!")
    else:
        print("\n❌ Some form actions need attention!")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
