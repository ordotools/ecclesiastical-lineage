# Testing Guide

This project includes a comprehensive testing system for all clergy forms. All test files are organized in the `/tests` directory.

## Quick Start

### From Project Root

```bash
# Run all tests
./run_tests.sh

# Run tests with custom settings
./run_tests.sh --url http://localhost:8000 --username admin --password admin

# Run tests using Python
python test.py

# Run tests with specific options
python test.py --url http://localhost:8000 --username admin --password admin
```

### From Tests Directory

```bash
cd tests

# Run form tests
./run_form_tests.sh

# Quick validation
python3 validate_form_actions.py

# Demo
python3 demo_test.py

# Setup test data
python3 setup_test_data.py
```

## Test Structure

```
/tests/
├── README.md                 # Tests directory documentation
├── TESTING_README.md         # Detailed testing documentation
├── test_clergy_forms.py      # Main comprehensive test suite
├── run_form_tests.sh         # Form tests runner script
├── validate_form_actions.py  # Quick form action validation
├── demo_test.py              # Simple demo script
├── setup_test_data.py        # Test data setup helper
├── test_config.py            # Centralized test configuration
└── test_requirements.txt     # Python dependencies
```

## What Gets Tested

✅ **All Clergy Forms:**
- Standalone add clergy page (`add_clergy.html`)
- Edit clergy page with comments (`edit_clergy_with_comments.html`)
- Modal add/edit forms (`_clergy_modal.html`)
- Lineage context forms (`_clergy_form_modal.html`)

✅ **Form Actions:**
- Auto-generated form actions work correctly
- Forms submit to correct endpoints
- HTTP responses are handled properly

✅ **Form Submissions:**
- Sample data submission works
- Error handling works correctly
- Authentication and permissions work

## Configuration

Test configuration is centralized in `tests/test_config.py`:

```python
BASE_URL = "http://localhost:5000"
DEFAULT_USERNAME = "testuser"
DEFAULT_PASSWORD = "testpass123"
```

You can override these with environment variables:

```bash
export TEST_BASE_URL="http://localhost:8000"
export TEST_USERNAME="admin"
export TEST_PASSWORD="admin"
```

## Dependencies

Install test dependencies:

```bash
pip install -r tests/test_requirements.txt
```

## Output

Tests produce both console output and JSON results:

- **Console**: Real-time test progress and results
- **JSON**: Detailed results saved to `test_results.json`

## Integration

The testing system is designed to integrate with CI/CD pipelines:

- Proper exit codes (0 = success, 1 = failure)
- JSON output for parsing
- Configurable via environment variables
- Comprehensive error reporting

## Documentation

- `tests/README.md` - Quick reference
- `tests/TESTING_README.md` - Complete documentation
- `TESTING.md` - This file (project-level overview)
