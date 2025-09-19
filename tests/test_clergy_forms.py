#!/usr/bin/env python3
"""
Comprehensive test suite for clergy forms.
Tests all form contexts to ensure form actions work correctly.
"""

import os
import sys
import json
import requests
from datetime import datetime, date
from typing import Dict, Any, List, Tuple

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import test configuration
from test_config import BASE_URL, SAMPLE_CLERGY_DATA, SAMPLE_EDIT_DATA

# Test configuration
TEST_USER = {
    "username": "testuser",
    "password": "testpass123"
}

class ClergyFormTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = []
        self.created_clergy_ids = []
        
    def log_test(self, test_name: str, success: bool, message: str = "", details: Dict = None):
        """Log test result"""
        result = {
            "test_name": test_name,
            "success": success,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"    Details: {details}")
    
    def login(self) -> bool:
        """Login to get session"""
        try:
            # Get login page first to get CSRF token if needed
            login_page = self.session.get(f"{self.base_url}/login")
            if login_page.status_code != 200:
                self.log_test("Login Page Access", False, f"Status: {login_page.status_code}")
                return False
            
            # Try to login
            login_data = {
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            }
            
            login_response = self.session.post(f"{self.base_url}/login", data=login_data, allow_redirects=False)
            
            if login_response.status_code in [200, 302]:  # Success or redirect
                self.log_test("Login", True, "Successfully logged in")
                return True
            else:
                self.log_test("Login", False, f"Status: {login_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Login", False, f"Exception: {str(e)}")
            return False
    
    def test_add_clergy_page_form(self) -> bool:
        """Test the standalone add clergy page form"""
        try:
            # Get the add clergy page
            response = self.session.get(f"{self.base_url}/clergy/add")
            if response.status_code != 200:
                self.log_test("Add Clergy Page Access", False, f"Status: {response.status_code}")
                return False
            
            # Check if form action is present and correct
            if 'action="/clergy/add"' not in response.text and 'action="/clergy/add"' not in response.text:
                self.log_test("Add Clergy Form Action", False, "Form action not found or incorrect")
                return False
            
            # Submit the form
            form_data = SAMPLE_CLERGY_DATA.copy()
            submit_response = self.session.post(f"{self.base_url}/clergy/add", data=form_data, allow_redirects=False)
            
            if submit_response.status_code in [200, 302]:
                self.log_test("Add Clergy Form Submission", True, f"Status: {submit_response.status_code}")
                return True
            else:
                self.log_test("Add Clergy Form Submission", False, f"Status: {submit_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Add Clergy Page Form", False, f"Exception: {str(e)}")
            return False
    
    def test_edit_clergy_page_form(self, clergy_id: int) -> bool:
        """Test the edit clergy page form"""
        try:
            # Get the edit clergy page
            response = self.session.get(f"{self.base_url}/clergy/{clergy_id}/edit")
            if response.status_code != 200:
                self.log_test("Edit Clergy Page Access", False, f"Status: {response.status_code}")
                return False
            
            # Check if form action is present and correct
            expected_action = f'action="/clergy/{clergy_id}/edit"'
            if expected_action not in response.text:
                self.log_test("Edit Clergy Form Action", False, f"Expected: {expected_action}")
                return False
            
            # Submit the form
            form_data = SAMPLE_EDIT_DATA.copy()
            submit_response = self.session.post(f"{self.base_url}/clergy/{clergy_id}/edit", data=form_data, allow_redirects=False)
            
            if submit_response.status_code in [200, 302]:
                self.log_test("Edit Clergy Form Submission", True, f"Status: {submit_response.status_code}")
                return True
            else:
                self.log_test("Edit Clergy Form Submission", False, f"Status: {submit_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Edit Clergy Page Form", False, f"Exception: {str(e)}")
            return False
    
    def test_modal_add_form(self) -> bool:
        """Test the modal add clergy form"""
        try:
            # Get the modal add form
            response = self.session.get(f"{self.base_url}/clergy/modal/add")
            if response.status_code != 200:
                self.log_test("Modal Add Form Access", False, f"Status: {response.status_code}")
                return False
            
            # Check if form action is present and correct
            if 'action="/clergy/add"' not in response.text:
                self.log_test("Modal Add Form Action", False, "Form action not found or incorrect")
                return False
            
            # Submit the form
            form_data = SAMPLE_CLERGY_DATA.copy()
            submit_response = self.session.post(f"{self.base_url}/clergy/add", data=form_data, allow_redirects=False)
            
            if submit_response.status_code in [200, 302]:
                self.log_test("Modal Add Form Submission", True, f"Status: {submit_response.status_code}")
                return True
            else:
                self.log_test("Modal Add Form Submission", False, f"Status: {submit_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Modal Add Form", False, f"Exception: {str(e)}")
            return False
    
    def test_modal_edit_form(self, clergy_id: int) -> bool:
        """Test the modal edit clergy form"""
        try:
            # Get the modal edit form
            response = self.session.get(f"{self.base_url}/clergy/modal/{clergy_id}/edit")
            if response.status_code != 200:
                self.log_test("Modal Edit Form Access", False, f"Status: {response.status_code}")
                return False
            
            # Check if form action is present and correct
            expected_action = f'action="/clergy/{clergy_id}/edit"'
            if expected_action not in response.text:
                self.log_test("Modal Edit Form Action", False, f"Expected: {expected_action}")
                return False
            
            # Submit the form
            form_data = SAMPLE_EDIT_DATA.copy()
            submit_response = self.session.post(f"{self.base_url}/clergy/{clergy_id}/edit", data=form_data, allow_redirects=False)
            
            if submit_response.status_code in [200, 302]:
                self.log_test("Modal Edit Form Submission", True, f"Status: {submit_response.status_code}")
                return True
            else:
                self.log_test("Modal Edit Form Submission", False, f"Status: {submit_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Modal Edit Form", False, f"Exception: {str(e)}")
            return False
    
    def test_lineage_add_form(self) -> bool:
        """Test the lineage context add clergy form"""
        try:
            # Get the lineage add form with context
            response = self.session.get(f"{self.base_url}/clergy/add_from_lineage?context_type=ordination&context_clergy_id=1")
            if response.status_code != 200:
                self.log_test("Lineage Add Form Access", False, f"Status: {response.status_code}")
                return False
            
            # Check if form action is present and correct
            if 'action="/clergy/add_from_lineage"' not in response.text:
                self.log_test("Lineage Add Form Action", False, "Form action not found or incorrect")
                return False
            
            # Submit the form with context
            form_data = SAMPLE_CLERGY_DATA.copy()
            form_data.update({
                "context_type": "ordination",
                "context_clergy_id": "1"
            })
            submit_response = self.session.post(f"{self.base_url}/clergy/add_from_lineage", data=form_data, allow_redirects=False)
            
            if submit_response.status_code in [200, 302]:
                self.log_test("Lineage Add Form Submission", True, f"Status: {submit_response.status_code}")
                return True
            else:
                self.log_test("Lineage Add Form Submission", False, f"Status: {submit_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Lineage Add Form", False, f"Exception: {str(e)}")
            return False
    
    def test_form_actions_in_templates(self) -> bool:
        """Test that all templates have correct form actions"""
        templates_to_test = [
            ("/clergy/add", "add_clergy.html", "clergy.add_clergy"),
            ("/clergy/modal/add", "_clergy_modal.html", "clergy.add_clergy"),
            ("/clergy/add_from_lineage", "_clergy_form_modal.html", "main.add_clergy_from_lineage")
        ]
        
        all_passed = True
        
        for url, template_name, expected_route in templates_to_test:
            try:
                response = self.session.get(f"{self.base_url}{url}")
                if response.status_code != 200:
                    self.log_test(f"Template {template_name} Access", False, f"Status: {response.status_code}")
                    all_passed = False
                    continue
                
                # Check for form action presence
                if 'action=' not in response.text:
                    self.log_test(f"Template {template_name} Form Action", False, "No form action found")
                    all_passed = False
                else:
                    self.log_test(f"Template {template_name} Form Action", True, f"Form action present for {expected_route}")
                    
            except Exception as e:
                self.log_test(f"Template {template_name}", False, f"Exception: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all form tests"""
        print("🧪 Starting Clergy Forms Test Suite")
        print("=" * 50)
        
        # Login first
        if not self.login():
            print("❌ Cannot proceed without login")
            return {"success": False, "results": self.test_results}
        
        # Test form actions in templates
        self.test_form_actions_in_templates()
        
        # Test add clergy page form
        self.test_add_clergy_page_form()
        
        # Test modal add form
        self.test_modal_add_form()
        
        # Test lineage add form
        self.test_lineage_add_form()
        
        # For edit tests, we need a clergy ID - try to get one from the clergy list
        try:
            clergy_list_response = self.session.get(f"{self.base_url}/clergy")
            if clergy_list_response.status_code == 200:
                # Look for clergy IDs in the response (this is a simple approach)
                # In a real test, you'd parse the HTML or use an API
                clergy_id = 1  # Assume ID 1 exists for testing
                
                # Test edit forms
                self.test_edit_clergy_page_form(clergy_id)
                self.test_modal_edit_form(clergy_id)
            else:
                self.log_test("Clergy List Access", False, "Cannot get clergy list for edit tests")
        except Exception as e:
            self.log_test("Edit Tests Setup", False, f"Exception: {str(e)}")
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {passed_tests}/{total_tests} tests passed")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        if failed_tests > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test_name']}: {result['message']}")
        
        return {
            "success": failed_tests == 0,
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "results": self.test_results
        }

def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test clergy forms")
    parser.add_argument("--url", default=BASE_URL, help="Base URL of the application")
    parser.add_argument("--username", default=TEST_USER["username"], help="Test username")
    parser.add_argument("--password", default=TEST_USER["password"], help="Test password")
    parser.add_argument("--output", help="Output file for test results (JSON)")
    
    args = parser.parse_args()
    
    # Update test user if provided
    TEST_USER["username"] = args.username
    TEST_USER["password"] = args.password
    
    # Run tests
    tester = ClergyFormTester(args.url)
    results = tester.run_all_tests()
    
    # Save results if requested
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to {args.output}")
    
    # Exit with appropriate code
    sys.exit(0 if results["success"] else 1)

if __name__ == "__main__":
    main()
