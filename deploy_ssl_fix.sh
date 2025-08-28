#!/bin/bash

# Deploy SSL Fix for Render PostgreSQL Connection
# This script deploys the fix for SSL connection issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "🚀 Deploying SSL Fix for Render PostgreSQL Connection"
echo "=================================================="

# Step 1: Check if we're in the right directory
if [ ! -f "app.py" ] || [ ! -f "requirements.txt" ]; then
    print_error "This script must be run from the project root directory!"
    exit 1
fi

print_success "✅ Project directory confirmed"

# Step 2: Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed or not in PATH"
    exit 1
fi

print_success "✅ Git is available"

# Step 3: Check git status
if [ -n "$(git status --porcelain)" ]; then
    print_warning "⚠️  You have uncommitted changes. Consider committing them first."
    echo "Current git status:"
    git status --short
    echo ""
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled by user"
        exit 0
    fi
fi

# Step 4: Check if we're on the main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    print_warning "⚠️  You're currently on branch '$current_branch', not 'main'"
    read -p "Continue with deployment from this branch? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled by user"
        exit 0
    fi
fi

print_success "✅ Git status confirmed"

# Step 5: Show what will be deployed
echo ""
print_info "📋 Changes to be deployed:"
echo "   - SSL connection fix for Render PostgreSQL"
echo "   - Updated database connection handling"
echo "   - Improved connection pooling and timeout settings"
echo "   - Updated requirements.txt with proper PostgreSQL driver"
echo ""

# Step 6: Commit changes if needed
if [ -n "$(git status --porcelain)" ]; then
    print_info "📝 Committing changes..."
    git add app.py requirements.txt
    git commit -m "🔧 Fix SSL connection issues for Render PostgreSQL

- Add SSL mode configuration for Render database connections
- Convert postgres:// URLs to postgresql:// for compatibility
- Add connection pooling and timeout settings
- Update requirements.txt to use psycopg2-binary
- Fix SSL decryption errors on Render deployment"
    
    print_success "✅ Changes committed"
else
    print_info "📝 No changes to commit"
fi

# Step 7: Push to remote
print_info "🚀 Pushing to remote repository..."
if git push origin "$current_branch"; then
    print_success "✅ Code pushed to remote repository"
else
    print_error "❌ Failed to push to remote repository"
    exit 1
fi

# Step 8: Check if Render auto-deploy is enabled
print_info "🔍 Checking Render deployment status..."
echo ""
echo "📋 Next steps:"
echo "   1. Render should automatically detect the push and start building"
echo "   2. Monitor the build logs in your Render dashboard"
echo "   3. The SSL fix should resolve the 'SSL error: decryption failed' issue"
echo ""
echo "🔗 Render Dashboard: https://dashboard.render.com/web/ecclesiastical-lineage"
echo "📊 Build Logs: Check the 'Events' tab in your Render service"
echo ""

# Step 9: Optional - Show how to check deployment status
print_info "💡 To monitor deployment:"
echo "   - Check Render dashboard for build progress"
echo "   - Monitor logs for any new errors"
echo "   - Test login functionality once deployment completes"
echo ""

print_success "🎉 Deployment script completed successfully!"
print_info "The SSL fix should resolve your database connection issues on Render."
