# Tests Directory

This directory contains all test files for the ecclesiastical lineage project.

## Quick Start

From the project root:

```bash
# Run all tests
./run_tests.sh

# Run tests with custom settings
./run_tests.sh --url http://localhost:8000 --username admin --password admin
```

From the tests directory:

```bash
# Run form tests directly
./run_form_tests.sh

# Quick validation
python3 validate_form_actions.py

# Demo
python3 demo_test.py
```

## Files

- `test_clergy_forms.py` - Main comprehensive test suite
- `run_form_tests.sh` - Form tests runner
- `validate_form_actions.py` - Quick form action validation
- `demo_test.py` - Simple demo script
- `setup_test_data.py` - Test data setup helper
- `test_requirements.txt` - Python dependencies
- `TESTING_README.md` - Detailed testing documentation

## Dependencies

Install test dependencies:

```bash
pip install -r tests/test_requirements.txt
```

## Documentation

See `TESTING_README.md` for complete testing documentation.
