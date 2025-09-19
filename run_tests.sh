#!/bin/bash

# Main test runner for the ecclesiastical lineage project
# This script runs all tests from the /tests directory

echo "🧪 Ecclesiastical Lineage Test Suite"
echo "===================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"

# Check if tests directory exists
if [ ! -d "$TESTS_DIR" ]; then
    echo "❌ Tests directory not found: $TESTS_DIR"
    exit 1
fi

# Change to tests directory and run the form tests
cd "$TESTS_DIR"

# Check if the test runner exists
if [ ! -f "run_form_tests.sh" ]; then
    echo "❌ Test runner not found: run_form_tests.sh"
    exit 1
fi

# Make sure the test runner is executable
chmod +x run_form_tests.sh

# Run the tests with all passed arguments
echo "🚀 Running clergy forms tests..."
./run_form_tests.sh "$@"

# Capture exit code
EXIT_CODE=$?

# Return to original directory
cd "$SCRIPT_DIR"

# Exit with the same code as the tests
exit $EXIT_CODE
