#!/bin/bash
"""
Deployment script for Render to restore relationships from .dat files.
This script is designed to run on Render's infrastructure.

Usage on Render:
    ./deploy_restore_render.sh staging
    ./deploy_restore_render.sh production
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
if [ $# -ne 1 ]; then
    print_error "Usage: $0 <staging|production>"
    exit 1
fi

TARGET=$1

# Validate target
if [[ "$TARGET" != "staging" && "$TARGET" != "production" ]]; then
    print_error "Target must be 'staging' or 'production'"
    exit 1
fi

print_status "Deploying Relationship Restoration to ${TARGET^} on Render"
echo "=============================================================="

# Check if recovery directory exists
if [ ! -d "recovery" ]; then
    print_error "Recovery directory not found!"
    echo "Please ensure you have uploaded the .dat backup files to the recovery directory."
    exit 1
fi

# Check for .dat files
DAT_COUNT=$(ls recovery/*.dat 2>/dev/null | wc -l)
if [ "$DAT_COUNT" -eq 0 ]; then
    print_error "No .dat files found in recovery directory!"
    exit 1
fi

print_success "Found $DAT_COUNT .dat files in recovery directory"

# Set target database URL based on environment
if [ "$TARGET" = "staging" ]; then
    if [ -z "$STAGING_DATABASE_URL" ]; then
        print_error "STAGING_DATABASE_URL not found in environment"
        exit 1
    fi
    TARGET_URL="$STAGING_DATABASE_URL"
    TARGET_NAME="staging"
else
    if [ -z "$PRODUCTION_DATABASE_URL" ]; then
        print_error "PRODUCTION_DATABASE_URL not found in environment"
        exit 1
    fi
    TARGET_URL="$PRODUCTION_DATABASE_URL"
    TARGET_NAME="production"
fi

print_success "Environment variables loaded"
echo "📊 ${TARGET_NAME^} Database: ${TARGET_URL:0:50}..."

# Create safety backup of current database
print_status "Creating safety backup of current ${TARGET_NAME} database..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SAFETY_BACKUP="backup_${TARGET_NAME}_before_restore_${TIMESTAMP}.sql"

if pg_dump "$TARGET_URL" --no-owner --no-privileges > "$SAFETY_BACKUP"; then
    print_success "Safety backup created: $SAFETY_BACKUP"
else
    print_error "Failed to create safety backup"
    exit 1
fi

# Run the restoration using pg_restore approach
print_status "Restoring relationships from .dat files..."

# Create temporary database for extraction
TEMP_DB="temp_restore_${TARGET_NAME}_${TIMESTAMP}"

# Create temporary database
if createdb "$TEMP_DB"; then
    print_success "Created temporary database: $TEMP_DB"
else
    print_error "Failed to create temporary database"
    exit 1
fi

# Restore .dat files to temporary database
print_status "Restoring .dat files to temporary database..."
if pg_restore -d "$TEMP_DB" --clean --if-exists recovery/toc.dat; then
    print_success "Restored .dat files to temporary database"
else
    print_error "Failed to restore .dat files"
    dropdb "$TEMP_DB" 2>/dev/null || true
    exit 1
fi

# Extract and restore relationships
print_status "Extracting legacy relationships and restoring to ${TARGET_NAME}..."

# Create restoration SQL
cat > /tmp/restore_relationships.sql << 'EOF'
BEGIN;

-- Clear existing relationship data
DELETE FROM co_consecrators;
DELETE FROM consecration;
DELETE FROM ordination;

-- Restore ordinations from legacy data
INSERT INTO ordination (clergy_id, date, ordaining_bishop_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at)
SELECT 
    id as clergy_id,
    COALESCE(date_of_ordination, CURRENT_DATE) as date,
    ordaining_bishop_id,
    false as is_sub_conditione,
    false as is_doubtful,
    false as is_invalid,
    'Restored from legacy data for ' || name as notes,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM clergy 
WHERE ordaining_bishop_id IS NOT NULL;

-- Restore consecrations from legacy data
INSERT INTO consecration (clergy_id, date, consecrator_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at)
SELECT 
    id as clergy_id,
    COALESCE(date_of_consecration, CURRENT_DATE) as date,
    consecrator_id,
    false as is_sub_conditione,
    false as is_doubtful,
    false as is_invalid,
    'Restored from legacy data for ' || name as notes,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM clergy 
WHERE consecrator_id IS NOT NULL;

-- Restore co-consecrators from legacy data
INSERT INTO co_consecrators (consecration_id, co_consecrator_id)
SELECT 
    c.id as consecration_id,
    json_array_elements_text(co_consecrators::json)::integer as co_consecrator_id
FROM clergy cl
JOIN consecration c ON c.clergy_id = cl.id
WHERE cl.co_consecrators IS NOT NULL 
  AND cl.co_consecrators != 'null'
  AND cl.co_consecrators != ''
  AND json_array_length(cl.co_consecrators::json) > 0;

-- Verify restoration
SELECT 'Ordinations restored: ' || COUNT(*) FROM ordination;
SELECT 'Consecrations restored: ' || COUNT(*) FROM consecration;
SELECT 'Co-consecrator relationships restored: ' || COUNT(*) FROM co_consecrators;

COMMIT;
EOF

# Copy clergy data from temporary database to target database
print_status "Copying clergy data with legacy fields to target database..."

# First, get the clergy data from temp database
pg_dump "$TEMP_DB" --data-only --table=clergy > /tmp/clergy_data.sql

# Restore clergy data to target database
if psql "$TARGET_URL" < /tmp/clergy_data.sql; then
    print_success "Clergy data restored to target database"
else
    print_error "Failed to restore clergy data"
    dropdb "$TEMP_DB" 2>/dev/null || true
    exit 1
fi

# Run the relationship restoration
if psql "$TARGET_URL" < /tmp/restore_relationships.sql; then
    print_success "Relationships restored successfully!"
else
    print_error "Failed to restore relationships"
    dropdb "$TEMP_DB" 2>/dev/null || true
    exit 1
fi

# Clean up temporary database
dropdb "$TEMP_DB" 2>/dev/null || true
print_success "Cleaned up temporary database"

# Verify the restoration
print_status "Verifying restoration..."
VERIFY_OUTPUT=$(psql "$TARGET_URL" -c "SELECT COUNT(*) as ordinations FROM ordination; SELECT COUNT(*) as consecrations FROM consecration; SELECT COUNT(*) as co_consecrators FROM co_consecrators;" 2>/dev/null)

if [ $? -eq 0 ]; then
    print_success "Verification completed"
    echo "📊 Restoration results:"
    echo "$VERIFY_OUTPUT"
else
    print_warning "Verification failed, but restoration may have succeeded"
fi

print_success "🎉 Deployment completed successfully!"
echo ""
print_warning "Safety backup saved as: $SAFETY_BACKUP"
echo "You can restore from this backup if needed."

# Clean up temporary files
rm -f /tmp/restore_relationships.sql /tmp/clergy_data.sql

print_status "Next steps:"
echo "1. Test the lineage visualization in your ${TARGET_NAME} environment"
echo "2. If everything looks good, the relationships have been restored successfully"
echo "3. If there are issues, you can restore from the safety backup"
