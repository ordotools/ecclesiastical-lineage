#!/bin/bash
# Setup script for staging/production workflow

set -e

echo "🚀 Setting up Staging/Production Workflow"
echo "========================================="

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

# Check if .env exists
if [ ! -f .env ]; then
    print_warning "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    print_success "✅ Created .env file from template"
    print_warning "⚠️  Please edit .env file with your actual database URLs"
else
    print_success "✅ .env file already exists"
fi

# Check if PostgreSQL is installed
print_status "🔍 Checking PostgreSQL installation..."
if command -v psql >/dev/null 2>&1; then
    print_success "✅ PostgreSQL is installed"
else
    print_error "❌ PostgreSQL is not installed"
    echo "Please install PostgreSQL:"
    echo "  brew install postgresql@16"
    echo "  brew services start postgresql@16"
    exit 1
fi

# Check if PostgreSQL is running
print_status "🔍 Checking PostgreSQL status..."
if pg_isready -q -h localhost; then
    print_success "✅ PostgreSQL is running"
else
    print_warning "⚠️  PostgreSQL is not running. Starting it..."
    brew services start postgresql@16
    sleep 3
    
    if pg_isready -q -h localhost; then
        print_success "✅ PostgreSQL started successfully"
    else
        print_error "❌ Failed to start PostgreSQL"
        echo "Please start it manually:"
        echo "  brew services start postgresql@16"
        exit 1
    fi
fi

# Create local database
print_status "🗄️  Setting up local database..."
LOCAL_DB_NAME="ecclesiastical_lineage_dev"

if psql -lqt | cut -d \| -f 1 | grep -qw "$LOCAL_DB_NAME"; then
    print_success "✅ Local database '$LOCAL_DB_NAME' already exists"
else
    print_status "📊 Creating local database '$LOCAL_DB_NAME'..."
    createdb "$LOCAL_DB_NAME"
    print_success "✅ Local database created"
fi

# Initialize local database
print_status "🔧 Initializing local database..."
if python3 init_postgres_db.py; then
    print_success "✅ Local database initialized"
else
    print_error "❌ Failed to initialize local database"
    exit 1
fi

# Make scripts executable
print_status "🔧 Making scripts executable..."
chmod +x deploy_staging.sh
chmod +x deploy_production.sh
chmod +x sync_staging_from_production.sh
chmod +x sync_dev_db.sh
print_success "✅ Scripts made executable"

echo ""
print_success "🎉 Setup completed successfully!"
echo ""
print_status "📋 Next steps:"
echo "1. Edit .env file with your database URLs:"
echo "   - PRODUCTION_DATABASE_URL (from Render production dashboard)"
echo "   - STAGING_DATABASE_URL (from Render staging dashboard)"
echo ""
echo "2. Set up Render services:"
echo "   - Create staging service using render-staging.yaml"
echo "   - Create production service using render-production.yaml"
echo "   - Connect staging service to 'staging' branch"
echo "   - Connect production service to 'main' branch"
echo ""
echo "3. Test the workflow:"
echo "   - Make changes locally"
echo "   - Push to staging branch"
echo "   - Test on staging environment"
echo "   - Merge to main for production"
echo ""
print_status "📖 For detailed instructions, see STAGING_PRODUCTION_WORKFLOW.md"
