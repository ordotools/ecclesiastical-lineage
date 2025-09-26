#!/bin/bash

# Deploy script for force merging scraped data
# This script safely backs up the current database and then performs the force merge

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required files exist
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if [ ! -f "advanced_scraped_data.json" ]; then
        print_error "advanced_scraped_data.json not found!"
        exit 1
    fi
    
    if [ ! -f "force_merge_scraped_data.py" ]; then
        print_error "force_merge_scraped_data.py not found!"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        exit 1
    fi
    
    print_success "All prerequisites found"
}

# Function to create backup
create_backup() {
    local env_name=$1
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="backup_${env_name}_before_force_merge_${timestamp}.sql"
    
    print_status "Creating backup of ${env_name} database..."
    
    # Load environment variables
    source .env
    
    # Determine database URL based on environment
    if [ "$env_name" = "staging" ]; then
        DATABASE_URL=$STAGING_DATABASE_URL
    elif [ "$env_name" = "production" ]; then
        DATABASE_URL=$PRODUCTION_DATABASE_URL
    else
        print_error "Invalid environment: $env_name. Use 'staging' or 'production'"
        exit 1
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "${env_name^^}_DATABASE_URL not found in .env file"
        exit 1
    fi
    
    # Create backup
    if pg_dump "$DATABASE_URL" > "$backup_file"; then
        print_success "Backup created: $backup_file"
        echo "$backup_file"
    else
        print_error "Failed to create backup"
        exit 1
    fi
}

# Function to run the force merge
run_force_merge() {
    print_status "Running force merge script..."
    
    # Activate virtual environment if it exists
    if [ -d "env" ]; then
        print_status "Activating virtual environment..."
        source env/bin/activate
    fi
    
    # Run the force merge script
    if python force_merge_scraped_data.py; then
        print_success "Force merge completed successfully"
    else
        print_error "Force merge failed"
        exit 1
    fi
}

# Function to verify the merge
verify_merge() {
    print_status "Verifying the merge..."
    
    # Check if we can connect to the database and verify counts
    if python -c "
from app import app
from models import Ordination, Consecration, db
with app.app_context():
    ord_count = Ordination.query.count()
    cons_count = Consecration.query.count()
    print(f'Ordinations: {ord_count}')
    print(f'Consecrations: {cons_count}')
    if ord_count == 27 and cons_count == 70:
        print('✅ Verification successful - expected counts match')
    else:
        print('❌ Verification failed - counts do not match expected values')
        exit(1)
"; then
        print_success "Merge verification successful"
    else
        print_error "Merge verification failed"
        exit 1
    fi
}

# Function to show rollback instructions
show_rollback_info() {
    local backup_file=$1
    local env_name=$2
    
    print_warning "If you need to rollback, run:"
    echo "  psql \"\$DATABASE_URL\" < $backup_file"
    echo ""
    print_status "Backup file: $backup_file"
    print_status "Environment: $env_name"
}

# Main function
main() {
    local env_name=$1
    
    if [ -z "$env_name" ]; then
        print_error "Usage: $0 <environment>"
        print_error "  environment: staging or production"
        exit 1
    fi
    
    if [ "$env_name" != "staging" ] && [ "$env_name" != "production" ]; then
        print_error "Environment must be 'staging' or 'production'"
        exit 1
    fi
    
    print_status "Starting force merge deployment for $env_name environment"
    print_warning "This will DELETE ALL existing relationships and replace them with scraped data!"
    echo ""
    
    # Confirmation prompt
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_status "Operation cancelled"
        exit 0
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    backup_file=$(create_backup "$env_name")
    
    # Run force merge
    run_force_merge
    
    # Verify the merge
    verify_merge
    
    # Show rollback info
    show_rollback_info "$backup_file" "$env_name"
    
    print_success "Force merge deployment completed successfully!"
    print_status "All relationships have been replaced with the 97 links from scraped data"
}

# Run main function with all arguments
main "$@"
