#!/bin/bash
# Sync staging database from production database
# This script ensures staging has the same data as production

set -e

echo "🔄 Syncing Staging Database from Production"
echo "==========================================="

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

# Load environment variables from .env if present
if [ -f .env ]; then
  echo "📄 Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Check if PRODUCTION_DATABASE_URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
  print_error "❌ Error: PRODUCTION_DATABASE_URL environment variable not set."
  echo "Please set it in your .env file to your production PostgreSQL connection string."
  echo "Example: PRODUCTION_DATABASE_URL=postgresql://user:pass@host:port/dbname"
  echo ""
  echo "You can get this from your Render production dashboard."
  exit 1
fi

# Check if STAGING_DATABASE_URL is set
if [ -z "$STAGING_DATABASE_URL" ]; then
  print_error "❌ Error: STAGING_DATABASE_URL environment variable not set."
  echo "Please set it in your .env file to your staging PostgreSQL connection string."
  echo "Example: STAGING_DATABASE_URL=postgresql://user:pass@host:port/dbname"
  echo ""
  echo "You can get this from your Render staging dashboard."
  exit 1
fi

# Check for required tools
print_status "🔍 Checking required tools..."
command -v pg_dump >/dev/null 2>&1 || { print_error "❌ pg_dump is required but not installed. Install with: brew install postgresql@16"; exit 1; }
command -v psql >/dev/null 2>&1 || { print_error "❌ psql is required but not installed. Install with: brew install postgresql@16"; exit 1; }
print_success "✅ All required tools are available"

echo ""
print_status "🔄 Database Sync Configuration:"
echo "   Production: $PRODUCTION_DATABASE_URL"
echo "   Staging:    $STAGING_DATABASE_URL"
echo ""

# Confirm sync operation
print_warning "⚠️  This will OVERWRITE your staging database with data from production!"
read -p "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  print_error "❌ Aborted."
  exit 0
fi

echo ""
print_status "🔄 Starting database sync..."

# Export from production and import to staging
print_status "📤 Exporting data from production PostgreSQL..."
pg_dump --clean --if-exists --no-owner --no-privileges "$PRODUCTION_DATABASE_URL" > /tmp/production_dump.sql

print_status "📥 Importing data to staging PostgreSQL..."
psql "$STAGING_DATABASE_URL" < /tmp/production_dump.sql

# Clean up
rm -f /tmp/production_dump.sql

print_success "✅ Database sync completed successfully!"
echo ""
print_success "📊 Staging database is now synchronized with production:"
echo "   • All production data copied to staging"
echo "   • Staging is ready for testing"
echo "   • Deploy staging to test changes"
echo ""
print_status "🎯 Next steps:"
echo "   - Push changes to staging branch"
echo "   - Test on staging environment"
echo "   - When ready, merge to main for production"
