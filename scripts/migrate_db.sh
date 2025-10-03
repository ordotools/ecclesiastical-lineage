#!/bin/bash
#
# Flask-Migrate Database Management Script
# This script provides convenient commands for managing database migrations
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "app.py" ] || [ ! -d "migrations" ]; then
    print_error "Not in the project root directory. Please run this script from the project root."
    exit 1
fi

# Activate virtual environment
if [ -d "env" ]; then
    print_status "Activating virtual environment..."
    source env/bin/activate
elif [ -d "venv" ]; then
    print_status "Activating virtual environment..."
    source venv/bin/activate
else
    print_warning "No virtual environment found. Using system Python."
fi

# Set Flask app
export FLASK_APP=app.py

# Function to show help
show_help() {
    echo "Flask-Migrate Database Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  generate [message]  Generate a new migration with optional message"
    echo "  upgrade            Apply all pending migrations"
    echo "  downgrade [rev]    Downgrade to a specific revision (or -1 for previous)"
    echo "  current            Show current database revision"
    echo "  history            Show migration history"
    echo "  check              Check if migrations are up to date"
    echo "  auto-commit        Enable automatic migration on commit"
    echo "  manual-commit      Disable automatic migration on commit"
    echo "  status             Show migration status and git hook status"
    echo "  help               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AUTO_MIGRATE_ON_COMMIT=true    Enable automatic migration after commit"
    echo "  DATABASE_URL=postgresql://...  Database connection string"
}

# Function to check git hooks
check_git_hooks() {
    print_status "Checking git hooks..."
    
    if [ -f ".git/hooks/pre-commit" ] && [ -x ".git/hooks/pre-commit" ]; then
        print_success "Pre-commit hook is installed and executable"
    else
        print_warning "Pre-commit hook is not installed or not executable"
    fi
    
    if [ -f ".git/hooks/post-commit" ] && [ -x ".git/hooks/post-commit" ]; then
        print_success "Post-commit hook is installed and executable"
    else
        print_warning "Post-commit hook is not installed or not executable"
    fi
}

# Function to show migration status
show_status() {
    print_status "Migration Status:"
    echo ""
    
    # Check current revision
    if flask db current 2>/dev/null; then
        echo ""
    else
        print_warning "Could not determine current revision"
    fi
    
    # Check if there are pending migrations
    if flask db check 2>/dev/null; then
        print_success "Database is up to date"
    else
        print_warning "There are pending migrations"
    fi
    
    echo ""
    check_git_hooks
    
    echo ""
    print_status "Environment Variables:"
    if [ -n "$AUTO_MIGRATE_ON_COMMIT" ]; then
        echo "  AUTO_MIGRATE_ON_COMMIT=$AUTO_MIGRATE_ON_COMMIT"
    else
        echo "  AUTO_MIGRATE_ON_COMMIT (not set)"
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        echo "  DATABASE_URL=***hidden***"
    else
        echo "  DATABASE_URL (not set)"
    fi
}

# Main command handling
case "${1:-help}" in
    "generate")
        MESSAGE="${2:-Auto-generated migration}"
        print_status "Generating migration: $MESSAGE"
        if flask db migrate --message "$MESSAGE"; then
            print_success "Migration generated successfully"
            print_status "Don't forget to commit the new migration file!"
        else
            print_error "Failed to generate migration"
            exit 1
        fi
        ;;
    
    "upgrade")
        print_status "Applying migrations..."
        if flask db upgrade; then
            print_success "Migrations applied successfully"
        else
            print_error "Failed to apply migrations"
            exit 1
        fi
        ;;
    
    "downgrade")
        REV="${2:--1}"
        print_status "Downgrading to revision: $REV"
        if flask db downgrade "$REV"; then
            print_success "Downgrade completed successfully"
        else
            print_error "Failed to downgrade"
            exit 1
        fi
        ;;
    
    "current")
        print_status "Current database revision:"
        flask db current
        ;;
    
    "history")
        print_status "Migration history:"
        flask db history
        ;;
    
    "check")
        print_status "Checking migration status..."
        if flask db check; then
            print_success "Database is up to date"
        else
            print_warning "There are pending migrations"
            exit 1
        fi
        ;;
    
    "auto-commit")
        print_status "Enabling automatic migration on commit..."
        echo 'export AUTO_MIGRATE_ON_COMMIT=true' >> ~/.bashrc
        echo 'export AUTO_MIGRATE_ON_COMMIT=true' >> ~/.zshrc
        export AUTO_MIGRATE_ON_COMMIT=true
        print_success "Automatic migration on commit enabled"
        print_warning "You may need to restart your shell for changes to take effect"
        ;;
    
    "manual-commit")
        print_status "Disabling automatic migration on commit..."
        # Remove the export line from shell configs
        sed -i.bak '/export AUTO_MIGRATE_ON_COMMIT=true/d' ~/.bashrc 2>/dev/null || true
        sed -i.bak '/export AUTO_MIGRATE_ON_COMMIT=true/d' ~/.zshrc 2>/dev/null || true
        unset AUTO_MIGRATE_ON_COMMIT
        print_success "Automatic migration on commit disabled"
        print_warning "You may need to restart your shell for changes to take effect"
        ;;
    
    "status")
        show_status
        ;;
    
    "help"|*)
        show_help
        ;;
esac
