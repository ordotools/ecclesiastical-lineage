"""
Test configuration for clergy forms testing.
Centralized configuration for all test files.
"""

import os

# Base configuration
BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:5000")
DEFAULT_USERNAME = os.getenv("TEST_USERNAME", "testuser")
DEFAULT_PASSWORD = os.getenv("TEST_PASSWORD", "testpass123")

# Test data
SAMPLE_CLERGY_DATA = {
    "name": "Test Bishop John",
    "rank": "Bishop",
    "organization": "Test Diocese",
    "date_of_birth": "1950-01-01",
    "date_of_ordination": "1975-06-15",
    "date_of_consecration": "1990-12-25",
    "date_of_death": None,
    "notes": "Test clergy member for form testing"
}

SAMPLE_EDIT_DATA = {
    "name": "Updated Test Bishop John",
    "rank": "Bishop", 
    "organization": "Updated Test Diocese",
    "date_of_birth": "1950-01-01",
    "date_of_ordination": "1975-06-15",
    "date_of_consecration": "1990-12-25",
    "date_of_death": None,
    "notes": "Updated test clergy member"
}

# Test timeouts
REQUEST_TIMEOUT = 30  # seconds
CONNECTION_TIMEOUT = 10  # seconds

# Expected form actions
EXPECTED_FORM_ACTIONS = {
    "add_clergy": "/clergy/add",
    "edit_clergy": "/clergy/{id}/edit",
    "modal_add": "/clergy/add",
    "modal_edit": "/clergy/{id}/edit",
    "lineage_add": "/clergy/add_from_lineage"
}
