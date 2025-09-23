#!/bin/bash
"""
Deployment script for restoring original relationships to staging or production.
This script provides a safe way to deploy the relationship restoration.

Usage:
    ./deploy_restore_relationships.sh staging backup_file.sql
    ./deploy_restore_relationships.sh production backup_file.sql
"""

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔄${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Check arguments
if [ $# -ne 2 ]; then
    print_error "Usage: $0 <staging|production> <backup_file>"
    exit 1
fi

TARGET=$1
BACKUP_FILE=$2

# Validate target
if [[ "$TARGET" != "staging" && "$TARGET" != "production" ]]; then
    print_error "Target must be 'staging' or 'production'"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_error ".env file not found"
    exit 1
fi

# Set target database URL
if [ "$TARGET" = "staging" ]; then
    TARGET_URL="$STAGING_DATABASE_URL"
    TARGET_NAME="staging"
else
    TARGET_URL="$PRODUCTION_DATABASE_URL"
    TARGET_NAME="production"
fi

if [ -z "$TARGET_URL" ]; then
    print_error "${TARGET_NAME^^}_DATABASE_URL not found in environment"
    exit 1
fi

print_status "Deploying Relationship Restoration to ${TARGET_NAME^}"
echo "=================================================="
echo "📁 Backup file: $BACKUP_FILE"
echo "🎯 Target: ${TARGET_NAME^}"
echo "📊 Database: ${TARGET_URL:0:50}..."
echo ""

# Confirmation prompt
print_warning "This will replace ALL existing data in ${TARGET_NAME^}!"
echo "This action cannot be undone."
read -p "Are you sure you want to proceed? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_error "Operation cancelled"
    exit 1
fi

# Create backup of current database (safety measure)
print_status "Creating safety backup of current ${TARGET_NAME} database..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SAFETY_BACKUP="backup_${TARGET_NAME}_before_restore_${TIMESTAMP}.sql"

if pg_dump "$TARGET_URL" --no-owner --no-privileges > "$SAFETY_BACKUP"; then
    print_success "Safety backup created: $SAFETY_BACKUP"
else
    print_error "Failed to create safety backup"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "env" ]; then
    print_status "Activating virtual environment..."
    source env/bin/activate
fi

# Run the restoration script
print_status "Running relationship restoration..."
if python restore_relationships_simple.py --backup-file "$BACKUP_FILE" --target "$TARGET" --force; then
    print_success "Relationship restoration completed successfully!"
    
    # Optional: Test the application
    print_status "Testing lineage visualization..."
    # Add your test commands here if needed
    
    print_success "Deployment completed successfully!"
    echo ""
    print_warning "Safety backup saved as: $SAFETY_BACKUP"
    echo "You can restore from this backup if needed."
    
else
    print_error "Relationship restoration failed!"
    print_warning "Consider restoring from safety backup: $SAFETY_BACKUP"
    exit 1
fi
