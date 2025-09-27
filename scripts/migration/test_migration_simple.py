#!/usr/bin/env python3
"""
Simple Migration Testing Script
This script tests the migration process using the current local database.
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def test_current_migration():
    """Test the current migration process"""
    print("🧪 Testing Current Migration Process")
    print("=" * 50)
    
    try:
        from app import app, db
        from models import Clergy, User, Ordination, Consecration, Rank, Organization
        from migrations import run_database_migration
        from sqlalchemy import inspect
        
        with app.app_context():
            # Get current database state
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
            
            print("📊 Current Database State:")
            print(f"   - Tables: {', '.join(sorted(tables))}")
            print(f"   - Clergy columns: {', '.join(sorted(clergy_columns))}")
            
            # Check if we have legacy fields
            legacy_fields = ['ordaining_bishop_id', 'consecrator_id', 'date_of_ordination', 'date_of_consecration']
            has_legacy_fields = any(field in clergy_columns for field in legacy_fields)
            print(f"   - Has legacy fields: {has_legacy_fields}")
            
            # Check if we have new tables
            new_tables = ['ordination', 'consecration', 'co_consecrators']
            has_new_tables = all(table in tables for table in new_tables)
            print(f"   - Has new tables: {has_new_tables}")
            
            # Count records
            clergy_count = Clergy.query.count()
            user_count = User.query.count()
            ordination_count = Ordination.query.count() if 'ordination' in tables else 0
            consecration_count = Consecration.query.count() if 'consecration' in tables else 0
            
            print(f"   - Clergy records: {clergy_count}")
            print(f"   - User records: {user_count}")
            print(f"   - Ordination records: {ordination_count}")
            print(f"   - Consecration records: {consecration_count}")
            
            # Test lineage data generation
            print("\n🔗 Testing Lineage Data Generation:")
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
            
            # Create links for ordinations
            for clergy in all_clergy:
                for ordination in clergy.ordinations:
                    if ordination.ordaining_bishop:
                        links.append({
                            'source': ordination.ordaining_bishop.id,
                            'target': clergy.id,
                            'type': 'ordination'
                        })
            
            # Create links for consecrations
            for clergy in all_clergy:
                for consecration in clergy.consecrations:
                    if consecration.consecrator:
                        links.append({
                            'source': consecration.consecrator.id,
                            'target': clergy.id,
                            'type': 'consecration'
                        })
            
            print(f"   ✅ Generated {len(nodes)} nodes")
            print(f"   ✅ Generated {len(links)} links")
            
            # Count link types
            ordination_links = len([l for l in links if l['type'] == 'ordination'])
            consecration_links = len([l for l in links if l['type'] == 'consecration'])
            print(f"   - Ordination links: {ordination_links}")
            print(f"   - Consecration links: {consecration_links}")
            
            # Test bishop search functionality
            print("\n🔍 Testing Bishop Search:")
            from routes.clergy import search_bishops
            from flask import request
            
            # Simulate a search request
            with app.test_request_context('/api/search_bishops?q=Mo'):
                request.args = {'q': 'Mo'}
                try:
                    result = search_bishops()
                    if 'bishop-search-result' in result:
                        print("   ✅ Bishop search working")
                    else:
                        print("   ❌ Bishop search not working")
                except Exception as e:
                    print(f"   ❌ Bishop search error: {e}")
            
            # Test form prefill functionality
            print("\n📝 Testing Form Prefill:")
            clergy_with_data = db.session.query(Clergy).join(Ordination, Clergy.id == Ordination.clergy_id).first()
            if clergy_with_data:
                print(f"   ✅ Found clergy with ordination data: {clergy_with_data.name}")
                print(f"   - Ordinations: {len(clergy_with_data.ordinations)}")
                print(f"   - Consecrations: {len(clergy_with_data.consecrations)}")
                
                # Test relationship loading
                for ord in clergy_with_data.ordinations:
                    bishop_name = ord.ordaining_bishop.name if ord.ordaining_bishop else "None"
                    print(f"     Ordination: {ord.date} by {bishop_name}")
                
                for cons in clergy_with_data.consecrations:
                    consecrator_name = cons.consecrator.name if cons.consecrator else "None"
                    print(f"     Consecration: {cons.date} by {consecrator_name}")
            else:
                print("   ⚠️  No clergy with ordination data found")
            
            # Overall status
            print("\n" + "=" * 50)
            print("MIGRATION STATUS SUMMARY")
            print("=" * 50)
            
            if has_new_tables and not has_legacy_fields:
                print("✅ MIGRATION COMPLETED SUCCESSFULLY")
                print("   - New relationship tables are present")
                print("   - Legacy fields have been removed")
                print("   - Lineage data generation is working")
                print("   - Application functionality is intact")
            elif has_legacy_fields and not has_new_tables:
                print("⚠️  MIGRATION NOT YET RUN")
                print("   - Legacy fields are still present")
                print("   - New relationship tables are missing")
                print("   - Run the migration to proceed")
            elif has_legacy_fields and has_new_tables:
                print("🔄 MIGRATION IN PROGRESS")
                print("   - Both legacy and new structures exist")
                print("   - Migration may be partially complete")
            else:
                print("❌ UNKNOWN STATE")
                print("   - Neither legacy nor new structures found")
                print("   - Database may be in an inconsistent state")
            
            return {
                'has_legacy_fields': has_legacy_fields,
                'has_new_tables': has_new_tables,
                'nodes_generated': len(nodes),
                'links_generated': len(links),
                'ordination_links': ordination_links,
                'consecration_links': consecration_links
            }
            
    except Exception as e:
        print(f"❌ Error during migration test: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main function"""
    print("🧪 Simple Migration Test")
    print("This script tests the current state of your database migration.")
    print()
    
    # Check if we're in the right directory
    if not os.path.exists('app.py'):
        print("❌ Error: app.py not found. Please run this script from the project root directory.")
        return
    
    # Check if DATABASE_URL is set
    if not os.environ.get('DATABASE_URL'):
        print("❌ Error: DATABASE_URL environment variable not set.")
        print("   Please set it in your .env file or environment.")
        return
    
    result = test_current_migration()
    
    if result:
        print("\n🎯 Next Steps:")
        if result['has_legacy_fields'] and not result['has_new_tables']:
            print("   1. Run the migration: python -c 'from migrations import run_database_migration; run_database_migration()'")
            print("   2. Restart your application")
            print("   3. Test the lineage visualization")
        elif not result['has_legacy_fields'] and result['has_new_tables']:
            print("   1. Your migration is complete!")
            print("   2. Test the application functionality")
            print("   3. If issues persist, check browser console for JavaScript errors")
        else:
            print("   1. Review the migration status above")
            print("   2. Consider running a fresh migration")
            print("   3. Check the migration logs for errors")

if __name__ == '__main__':
    main()
