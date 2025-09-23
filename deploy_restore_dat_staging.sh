#!/bin/bash
# Deployment script for restoring original relationships from .dat files to staging.
# This script is specifically designed for the recovery directory with .dat files.
#
# Usage:
#     ./deploy_restore_dat_staging.sh

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

print_status "Deploying Relationship Restoration from .dat files to Staging"
echo "=============================================================="

# Check if recovery directory exists
if [ ! -d "recovery" ]; then
    print_error "Recovery directory not found!"
    echo "Please ensure you have the .dat backup files in the 'recovery' directory."
    exit 1
fi

# Check for .dat files
DAT_COUNT=$(ls recovery/*.dat 2>/dev/null | wc -l)
if [ "$DAT_COUNT" -eq 0 ]; then
    print_error "No .dat files found in recovery directory!"
    exit 1
fi

print_success "Found $DAT_COUNT .dat files in recovery directory"

# List the .dat files
echo "📁 .dat files found:"
ls -la recovery/*.dat | while read line; do
    echo "   $line"
done

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_error ".env file not found"
    exit 1
fi

# Check for staging database URL
if [ -z "$STAGING_DATABASE_URL" ]; then
    print_error "STAGING_DATABASE_URL not found in environment"
    exit 1
fi

print_success "Environment variables loaded"
echo "📊 Staging Database: ${STAGING_DATABASE_URL:0:50}..."

# Confirmation prompt
echo ""
print_warning "This will replace ALL existing relationship data in STAGING!"
echo "This action cannot be undone."
echo ""
read -p "Are you sure you want to proceed? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_error "Operation cancelled"
    exit 1
fi

# Create safety backup of current staging database
print_status "Creating safety backup of current staging database..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SAFETY_BACKUP="backup_staging_before_dat_restore_${TIMESTAMP}.sql"

if pg_dump "$STAGING_DATABASE_URL" --no-owner --no-privileges > "$SAFETY_BACKUP"; then
    print_success "Safety backup created: $SAFETY_BACKUP"
else
    print_error "Failed to create safety backup"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "env" ]; then
    print_status "Activating virtual environment..."
    source env/bin/activate
    print_success "Virtual environment activated"
fi

# Run the restoration script
print_status "Running .dat file restoration to staging..."
if python restore_from_dat_files.py --recovery-dir recovery --target staging --force; then
    print_success "Relationship restoration completed successfully!"
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    print_warning "Safety backup saved as: $SAFETY_BACKUP"
    echo "You can restore from this backup if needed."
    echo ""
    print_status "Next steps:"
    echo "1. Test the lineage visualization in staging"
    echo "2. If everything looks good, run the same process for production"
    echo "3. Use: ./deploy_restore_dat_production.sh (when ready)"
    
else
    print_error "Relationship restoration failed!"
    print_warning "Consider restoring from safety backup: $SAFETY_BACKUP"
    exit 1
fi
