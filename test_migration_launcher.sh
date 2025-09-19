#!/bin/bash
# Migration Testing Launcher Script

echo "🧪 Database Migration Testing Launcher"
echo "======================================"
echo ""
echo "Choose an option:"
echo ""
echo "1. Test current migration status (quick check)"
echo "2. Set up fresh test database with sample data"
echo "3. Full migration test (downloads production data)"
echo "4. Run application with test database"
echo "5. Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo "🔍 Testing current migration status..."
        python test_migration_simple.py
        ;;
    2)
        echo "🏗️  Setting up fresh test database..."
        python setup_test_database.py
        ;;
    3)
        echo "🔄 Running full migration test..."
        python test_migration.py
        ;;
    4)
        echo "🚀 Starting application with test database..."
        echo "Make sure you have set DATABASE_URL to your test database"
        echo "Example: export DATABASE_URL='postgresql://localhost:5432/ecclesiastical_lineage_test'"
        echo ""
        read -p "Press Enter to continue..."
        python run_local.py
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac
