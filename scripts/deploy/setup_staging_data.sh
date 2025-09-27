#!/bin/bash
# Setup staging database with production data
# Run this after creating your staging service and database on Render

set -e

echo "🚀 Setting up Staging Database with Production Data"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error "❌ .env file not found. Please create one first."
    exit 1
fi

# Load environment variables
source .env

# Check if staging database URL is set
if [ -z "$STAGING_DATABASE_URL" ]; then
    print_error "❌ STAGING_DATABASE_URL not set in .env file"
    print_warning "Please add your staging database URL to .env file:"
    print_warning "STAGING_DATABASE_URL=postgresql://user:pass@host:port/database"
    exit 1
fi

# Check if production database URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
    print_error "❌ PRODUCTION_DATABASE_URL not set in .env file"
    exit 1
fi

print_status "📊 Production database: ${PRODUCTION_DATABASE_URL:0:50}..."
print_status "📊 Staging database: ${STAGING_DATABASE_URL:0:50}..."

# Create temporary dump file
DUMP_FILE="temp_production_dump.sql"

print_status "📤 Dumping production database..."
if pg_dump --no-owner --no-privileges --clean --if-exists --create "$PRODUCTION_DATABASE_URL" -f "$DUMP_FILE"; then
    print_success "✅ Production database dumped successfully"
else
    print_error "❌ Failed to dump production database"
    exit 1
fi

print_status "📥 Restoring to staging database..."
if psql "$STAGING_DATABASE_URL" -f "$DUMP_FILE"; then
    print_success "✅ Staging database restored successfully"
else
    print_error "❌ Failed to restore to staging database"
    exit 1
fi

# Clean up
rm -f "$DUMP_FILE"
print_success "🧹 Cleaned up temporary files"

print_success "🎉 Staging database setup completed!"
print_warning "⚠️  Your staging service should now have the same data as production"
print_status "🔗 Check your staging URL to verify the data is loading correctly"
