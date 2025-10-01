#!/usr/bin/env python3
"""
Simple test runner for the ecclesiastical lineage project.
This script can be run from anywhere in the project to execute tests.
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    """Run tests from the tests directory"""
    # Get the project root directory
    project_root = Path(__file__).parent.absolute()
    tests_dir = project_root / "tests"
    
    # Check if tests directory exists
    if not tests_dir.exists():
        print("❌ Tests directory not found!")
        print(f"   Expected: {tests_dir}")
        return 1
    
    # Change to tests directory
    os.chdir(tests_dir)
    
    # Run the form tests
    print("🧪 Running clergy forms tests...")
    print(f"📁 Working directory: {tests_dir}")
    print("=" * 50)
    
    try:
        # Run the test script with all passed arguments
        result = subprocess.run([
            sys.executable, "test_clergy_forms.py"
        ] + sys.argv[1:], check=False)
        
        return result.returncode
        
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
