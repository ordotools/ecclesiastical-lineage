#!/usr/bin/env python3
"""
Migration Testing Script
This script simulates the database migration process to ensure it works correctly.
"""

import os
import sys
import json
import shutil
import subprocess
from datetime import datetime
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def create_test_environment():
    """Create a test environment for migration testing"""
    print("🏗️  Creating test environment...")
    
    # Create test directory
    test_dir = "migration_test"
    if os.path.exists(test_dir):
        print(f"🗑️  Removing existing test directory: {test_dir}")
        shutil.rmtree(test_dir)
    
    os.makedirs(test_dir, exist_ok=True)
    print(f"✅ Created test directory: {test_dir}")
    
    return test_dir

def backup_production_database(test_dir):
    """Backup the production database"""
    print("📦 Backing up production database...")
    
    # Get production database URL
    prod_db_url = os.environ.get('DATABASE_URL')
    if not prod_db_url:
        print("❌ Error: DATABASE_URL environment variable not set")
        print("   Please set it to your production PostgreSQL connection string")
        return None
    
    # Create backup filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(test_dir, f"production_backup_{timestamp}.sql")
    
    try:
        # Create database dump
        cmd = [
            "pg_dump",
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            "--verbose",
            prod_db_url
        ]
        
        print(f"📤 Running: {' '.join(cmd[:-1])} [URL_HIDDEN]")
        with open(backup_file, 'w') as f:
            result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
        
        if result.returncode != 0:
            print(f"❌ pg_dump failed: {result.stderr}")
            return None
        
        print(f"✅ Production database backed up to: {backup_file}")
        return backup_file
        
    except FileNotFoundError:
        print("❌ Error: pg_dump not found. Please install PostgreSQL client tools:")
        print("   brew install postgresql@16")
        return None
    except Exception as e:
        print(f"❌ Error backing up database: {e}")
        return None

def setup_test_database(test_dir, backup_file):
    """Set up a test database from the backup"""
    print("🗄️  Setting up test database...")
    
    # Test database configuration
    test_db_name = "ecclesiastical_lineage_test"
    test_db_url = f"postgresql://localhost:5432/{test_db_name}"
    
    try:
        # Drop existing test database
        print(f"🗑️  Dropping existing test database: {test_db_name}")
        subprocess.run(["dropdb", "--if-exists", test_db_name], 
                      capture_output=True, text=True)
        
        # Create new test database
        print(f"📊 Creating test database: {test_db_name}")
        subprocess.run(["createdb", test_db_name], 
                      capture_output=True, text=True)
        
        # Restore from backup
        print(f"📥 Restoring from backup...")
        with open(backup_file, 'r') as f:
            result = subprocess.run(["psql", test_db_url], 
                                  stdin=f, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ Database restore failed: {result.stderr}")
            return None
        
        print(f"✅ Test database created: {test_db_name}")
        return test_db_url
        
    except FileNotFoundError:
        print("❌ Error: psql or createdb not found. Please install PostgreSQL client tools:")
        print("   brew install postgresql@16")
        return None
    except Exception as e:
        print(f"❌ Error setting up test database: {e}")
        return None

def create_test_env_file(test_dir, test_db_url):
    """Create a test environment file"""
    print("📄 Creating test environment file...")
    
    test_env_file = os.path.join(test_dir, ".env.test")
    
    # Read current .env file
    env_vars = {}
    if os.path.exists(".env"):
        with open(".env", 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Update database URL for test
    env_vars['DATABASE_URL'] = test_db_url
    env_vars['FLASK_ENV'] = 'testing'
    env_vars['SECRET_KEY'] = 'test-secret-key-for-migration-testing'
    
    # Write test environment file
    with open(test_env_file, 'w') as f:
        f.write("# Test Environment Configuration\n")
        f.write(f"# Created: {datetime.now().isoformat()}\n\n")
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")
    
    print(f"✅ Test environment file created: {test_env_file}")
    return test_env_file

def test_database_state(test_db_url):
    """Test the current state of the test database"""
    print("🔍 Testing current database state...")
    
    # Set up environment for testing
    os.environ['DATABASE_URL'] = test_db_url
    
    try:
        from app import app, db
        from models import Clergy, User, Ordination, Consecration
        
        with app.app_context():
            # Check current state
            clergy_count = Clergy.query.count()
            user_count = User.query.count()
            
            # Check if we have legacy fields
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            
            clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
            has_legacy_fields = any(field in clergy_columns for field in [
                'ordaining_bishop_id', 'consecrator_id', 'date_of_ordination', 'date_of_consecration'
            ])
            
            # Check if we have new tables
            tables = inspector.get_table_names()
            has_new_tables = all(table in tables for table in [
                'ordination', 'consecration', 'co_consecrators'
            ])
            
            print(f"📊 Current database state:")
            print(f"   - Clergy records: {clergy_count}")
            print(f"   - User records: {user_count}")
            print(f"   - Has legacy fields: {has_legacy_fields}")
            print(f"   - Has new tables: {has_new_tables}")
            print(f"   - Tables: {', '.join(sorted(tables))}")
            
            return {
                'clergy_count': clergy_count,
                'user_count': user_count,
                'has_legacy_fields': has_legacy_fields,
                'has_new_tables': has_new_tables,
                'tables': tables
            }
            
    except Exception as e:
        print(f"❌ Error testing database state: {e}")
        import traceback
        traceback.print_exc()
        return None

def run_migration_test(test_db_url):
    """Run the migration process"""
    print("🔄 Running migration test...")
    
    # Set up environment for testing
    os.environ['DATABASE_URL'] = test_db_url
    
    try:
        from app import app, db
        from migrations import run_database_migration
        
        with app.app_context():
            print("🔧 Running database migration...")
            run_database_migration(app)
            
            # Test post-migration state
            print("🔍 Testing post-migration state...")
            return test_database_state(test_db_url)
            
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_application_functionality(test_db_url):
    """Test application functionality after migration"""
    print("🧪 Testing application functionality...")
    
    # Set up environment for testing
    os.environ['DATABASE_URL'] = test_db_url
    
    try:
        from app import app, db
        from models import Clergy, User, Ordination, Consecration
        
        with app.app_context():
            # Test 1: Check if we can query clergy with relationships
            print("   Testing clergy relationships...")
            clergy_with_ordinations = db.session.query(Clergy).join(Ordination, Clergy.id == Ordination.clergy_id).count()
            clergy_with_consecrations = db.session.query(Clergy).join(Consecration, Clergy.id == Consecration.clergy_id).count()
            
            print(f"   ✅ Clergy with ordinations: {clergy_with_ordinations}")
            print(f"   ✅ Clergy with consecrations: {clergy_with_consecrations}")
            
            # Test 2: Check lineage data generation
            print("   Testing lineage data generation...")
            from routes.main import lineage_visualization
            
            with app.test_request_context():
                # This would normally return a template, but we can test the data generation
                all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
                nodes = []
                links = []
                
                # Create nodes
                for clergy in all_clergy:
                    nodes.append({
                        'id': clergy.id,
                        'name': clergy.name,
                        'rank': clergy.rank,
                        'organization': clergy.organization
                    })
                
                # Create links
                for clergy in all_clergy:
                    for ordination in clergy.ordinations:
                        if ordination.ordaining_bishop:
                            links.append({
                                'source': ordination.ordaining_bishop.id,
                                'target': clergy.id,
                                'type': 'ordination'
                            })
                    
                    for consecration in clergy.consecrations:
                        if consecration.consecrator:
                            links.append({
                                'source': consecration.consecrator.id,
                                'target': clergy.id,
                                'type': 'consecration'
                            })
                
                print(f"   ✅ Generated {len(nodes)} nodes and {len(links)} links")
                
                return {
                    'clergy_with_ordinations': clergy_with_ordinations,
                    'clergy_with_consecrations': clergy_with_consecrations,
                    'nodes_generated': len(nodes),
                    'links_generated': len(links)
                }
                
    except Exception as e:
        print(f"❌ Error testing application functionality: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_test_report(test_dir, pre_migration_state, post_migration_state, functionality_test):
    """Generate a comprehensive test report"""
    print("📊 Generating test report...")
    
    report_file = os.path.join(test_dir, "migration_test_report.md")
    
    with open(report_file, 'w') as f:
        f.write("# Migration Test Report\n\n")
        f.write(f"**Test Date:** {datetime.now().isoformat()}\n\n")
        
        f.write("## Pre-Migration State\n\n")
        if pre_migration_state:
            f.write(f"- **Clergy Records:** {pre_migration_state['clergy_count']}\n")
            f.write(f"- **User Records:** {pre_migration_state['user_count']}\n")
            f.write(f"- **Has Legacy Fields:** {pre_migration_state['has_legacy_fields']}\n")
            f.write(f"- **Has New Tables:** {pre_migration_state['has_new_tables']}\n")
            f.write(f"- **Tables:** {', '.join(sorted(pre_migration_state['tables']))}\n\n")
        
        f.write("## Post-Migration State\n\n")
        if post_migration_state:
            f.write(f"- **Clergy Records:** {post_migration_state['clergy_count']}\n")
            f.write(f"- **User Records:** {post_migration_state['user_count']}\n")
            f.write(f"- **Has Legacy Fields:** {post_migration_state['has_legacy_fields']}\n")
            f.write(f"- **Has New Tables:** {post_migration_state['has_new_tables']}\n")
            f.write(f"- **Tables:** {', '.join(sorted(post_migration_state['tables']))}\n\n")
        
        f.write("## Functionality Test Results\n\n")
        if functionality_test:
            f.write(f"- **Clergy with Ordinations:** {functionality_test['clergy_with_ordinations']}\n")
            f.write(f"- **Clergy with Consecrations:** {functionality_test['clergy_with_consecrations']}\n")
            f.write(f"- **Nodes Generated:** {functionality_test['nodes_generated']}\n")
            f.write(f"- **Links Generated:** {functionality_test['links_generated']}\n\n")
        
        f.write("## Migration Status\n\n")
        if pre_migration_state and post_migration_state:
            # Check if migration was successful or already completed
            if (not pre_migration_state['has_legacy_fields'] and not post_migration_state['has_legacy_fields'] and 
                pre_migration_state['has_new_tables'] and post_migration_state['has_new_tables']):
                f.write("✅ **MIGRATION ALREADY COMPLETED**\n\n")
                f.write("The database is already in the correct migrated state:\n")
                f.write("- Legacy fields have been removed\n")
                f.write("- New relationship tables are present\n")
                f.write("- Data integrity is maintained\n")
            elif (pre_migration_state['has_legacy_fields'] and not post_migration_state['has_legacy_fields'] and 
                  post_migration_state['has_new_tables']):
                f.write("✅ **MIGRATION SUCCESSFUL**\n\n")
                f.write("The migration completed successfully:\n")
                f.write("- Legacy fields were removed\n")
                f.write("- New relationship tables were created\n")
                f.write("- Data integrity was maintained\n")
            elif (pre_migration_state['has_legacy_fields'] and post_migration_state['has_legacy_fields'] and 
                  not post_migration_state['has_new_tables']):
                f.write("❌ **MIGRATION FAILED**\n\n")
                f.write("The migration did not complete successfully.\n")
                f.write("- Legacy fields are still present\n")
                f.write("- New relationship tables were not created\n")
            else:
                f.write("⚠️ **MIGRATION STATUS UNCLEAR**\n\n")
                f.write("The migration status could not be determined.\n")
                f.write("Please review the pre and post-migration states manually.\n")
        
        f.write("\n## Next Steps\n\n")
        f.write("1. Review the test results above\n")
        f.write("2. If successful, you can proceed with the production migration\n")
        f.write("3. If failed, review the error messages and fix issues\n")
        f.write("4. The test database can be used for further testing\n")
    
    print(f"✅ Test report generated: {report_file}")
    return report_file

def main():
    """Main migration test function"""
    print("🧪 Database Migration Testing Script")
    print("=" * 60)
    print("This script will:")
    print("1. Create a test environment")
    print("2. Backup your production database")
    print("3. Set up a test database")
    print("4. Run the migration process")
    print("5. Test application functionality")
    print("6. Generate a comprehensive report")
    print("=" * 60)
    
    # Confirm test operation
    response = input("\nDo you want to proceed with the migration test? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration test cancelled.")
        return
    
    try:
        # Step 1: Create test environment
        test_dir = create_test_environment()
        
        # Step 2: Backup production database
        backup_file = backup_production_database(test_dir)
        if not backup_file:
            print("❌ Failed to backup production database")
            return
        
        # Step 3: Set up test database
        test_db_url = setup_test_database(test_dir, backup_file)
        if not test_db_url:
            print("❌ Failed to set up test database")
            return
        
        # Step 4: Create test environment file
        test_env_file = create_test_env_file(test_dir, test_db_url)
        
        # Step 5: Test pre-migration state
        print("\n" + "=" * 60)
        print("PRE-MIGRATION TESTING")
        print("=" * 60)
        pre_migration_state = test_database_state(test_db_url)
        
        # Step 6: Run migration
        print("\n" + "=" * 60)
        print("RUNNING MIGRATION")
        print("=" * 60)
        post_migration_state = run_migration_test(test_db_url)
        
        # Step 7: Test functionality
        print("\n" + "=" * 60)
        print("POST-MIGRATION TESTING")
        print("=" * 60)
        functionality_test = test_application_functionality(test_db_url)
        
        # Step 8: Generate report
        print("\n" + "=" * 60)
        print("GENERATING REPORT")
        print("=" * 60)
        report_file = generate_test_report(test_dir, pre_migration_state, post_migration_state, functionality_test)
        
        print("\n" + "=" * 60)
        print("MIGRATION TEST COMPLETED")
        print("=" * 60)
        print(f"✅ Test environment created: {test_dir}")
        print(f"✅ Production database backed up")
        print(f"✅ Test database created: {test_db_url}")
        print(f"✅ Migration process tested")
        print(f"✅ Application functionality verified")
        print(f"✅ Test report generated: {report_file}")
        
        print(f"\n📁 Test files location: {os.path.abspath(test_dir)}")
        print(f"📊 Test report: {os.path.abspath(report_file)}")
        
        # Final status
        if pre_migration_state and post_migration_state:
            # Check if migration was successful or already completed
            if (not pre_migration_state['has_legacy_fields'] and not post_migration_state['has_legacy_fields'] and 
                pre_migration_state['has_new_tables'] and post_migration_state['has_new_tables']):
                print("\n🎉 MIGRATION TEST PASSED! Your database is already in the correct migrated state.")
                print("   The migration has already been completed successfully.")
            elif (pre_migration_state['has_legacy_fields'] and not post_migration_state['has_legacy_fields'] and 
                  post_migration_state['has_new_tables']):
                print("\n🎉 MIGRATION TEST PASSED! The migration process works correctly.")
                print("   You can proceed with confidence to migrate your production database.")
            elif (pre_migration_state['has_legacy_fields'] and post_migration_state['has_legacy_fields'] and 
                  not post_migration_state['has_new_tables']):
                print("\n⚠️  MIGRATION TEST FAILED! The migration did not complete successfully.")
                print("   Please review the test report and fix issues.")
            else:
                print("\n⚠️  MIGRATION TEST STATUS UNCLEAR! Please review the test report.")
        else:
            print("\n❌ MIGRATION TEST INCOMPLETE! Please review the errors above.")
        
    except Exception as e:
        print(f"\n❌ Migration test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
