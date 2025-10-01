#!/usr/bin/env python3
"""
Setup Test Database Script
This script creates a fresh test database with sample data to test the migration.
"""

import os
import sys
from datetime import datetime, date
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def create_test_database():
    """Create a fresh test database"""
    print("🗄️  Creating test database...")
    
    # Test database configuration
    test_db_name = "ecclesiastical_lineage_test"
    test_db_url = f"postgresql://localhost:5432/{test_db_name}"
    
    try:
        # Drop existing test database
        print(f"🗑️  Dropping existing test database: {test_db_name}")
        import subprocess
        subprocess.run(["dropdb", "--if-exists", test_db_name], 
                      capture_output=True, text=True)
        
        # Create new test database
        print(f"📊 Creating test database: {test_db_name}")
        subprocess.run(["createdb", test_db_name], 
                      capture_output=True, text=True)
        
        print(f"✅ Test database created: {test_db_name}")
        return test_db_url
        
    except FileNotFoundError:
        print("❌ Error: psql or createdb not found. Please install PostgreSQL client tools:")
        print("   brew install postgresql@16")
        return None
    except Exception as e:
        print(f"❌ Error creating test database: {e}")
        return None

def populate_test_database(test_db_url):
    """Populate the test database with sample data"""
    print("📝 Populating test database with sample data...")
    
    # Set up environment for testing
    os.environ['DATABASE_URL'] = test_db_url
    
    try:
        from app import app, db
        from models import Clergy, User, Rank, Organization, Ordination, Consecration
        from migrations import run_database_migration
        
        with app.app_context():
            # Run migration to set up schema
            print("🔧 Setting up database schema...")
            run_database_migration(app)
            
            # Create sample organizations
            print("📊 Creating sample organizations...")
            organizations = [
                Organization(name="Roman Catholic Institute", abbreviation="RCI", color="#930101"),
                Organization(name="Independent", abbreviation="IND", color="#919191"),
                Organization(name="Society of St. Pius X", abbreviation="SSPX", color="#0066cc")
            ]
            for org in organizations:
                db.session.add(org)
            
            # Create sample ranks
            print("📊 Creating sample ranks...")
            ranks = [
                Rank(name="Pope", color="#ffd700", is_bishop=True),
                Rank(name="Cardinal", color="#8b0000", is_bishop=True),
                Rank(name="Archbishop", color="#000080", is_bishop=True),
                Rank(name="Bishop", color="#008f3e", is_bishop=True),
                Rank(name="Priest", color="#000000", is_bishop=False)
            ]
            for rank in ranks:
                db.session.add(rank)
            
            db.session.commit()
            
            # Create sample clergy
            print("👥 Creating sample clergy...")
            clergy_data = [
                {
                    'name': 'Marcel Lefebvre',
                    'rank': 'Archbishop',
                    'organization': 'Society of St. Pius X',
                    'date_of_birth': date(1905, 11, 29),
                    'date_of_death': date(1991, 3, 25),
                    'notes': 'Founder of the Society of St. Pius X'
                },
                {
                    'name': 'Richard Williamson',
                    'rank': 'Bishop',
                    'organization': 'Society of St. Pius X',
                    'date_of_birth': date(1940, 3, 8),
                    'notes': 'Traditionalist Catholic bishop'
                },
                {
                    'name': 'Clarence Kelly',
                    'rank': 'Bishop',
                    'organization': 'Society of St. Pius X',
                    'date_of_birth': date(1941, 7, 19),
                    'notes': 'Traditionalist Catholic bishop'
                },
                {
                    'name': 'Robert L. Neville',
                    'rank': 'Bishop',
                    'organization': 'Independent',
                    'date_of_birth': date(1945, 1, 15),
                    'notes': 'Independent traditionalist bishop'
                },
                {
                    'name': 'Timothy Hennebery',
                    'rank': 'Priest',
                    'organization': 'Roman Catholic Institute',
                    'date_of_birth': date(1950, 5, 20),
                    'notes': 'Traditionalist Catholic priest'
                },
                {
                    'name': 'Andrès Morello',
                    'rank': 'Bishop',
                    'organization': 'Independent',
                    'date_of_birth': date(1955, 8, 10),
                    'notes': 'Independent traditionalist bishop'
                }
            ]
            
            clergy_objects = []
            for data in clergy_data:
                clergy = Clergy(**data)
                db.session.add(clergy)
                clergy_objects.append(clergy)
            
            db.session.commit()
            
            # Create sample ordinations
            print("📜 Creating sample ordinations...")
            ordinations = [
                {
                    'clergy_id': clergy_objects[4].id,  # Timothy Hennebery
                    'date': date(1990, 10, 17),
                    'ordaining_bishop_id': clergy_objects[2].id,  # Clarence Kelly
                    'notes': 'Ordained to the priesthood'
                }
            ]
            
            for ord_data in ordinations:
                ordination = Ordination(**ord_data)
                db.session.add(ordination)
            
            # Create sample consecrations
            print("🏛️  Creating sample consecrations...")
            consecrations = [
                {
                    'clergy_id': clergy_objects[1].id,  # Richard Williamson
                    'date': date(1988, 6, 30),
                    'consecrator_id': clergy_objects[0].id,  # Marcel Lefebvre
                    'notes': 'Consecrated as bishop'
                },
                {
                    'clergy_id': clergy_objects[2].id,  # Clarence Kelly
                    'date': date(1993, 4, 14),
                    'consecrator_id': clergy_objects[1].id,  # Richard Williamson
                    'notes': 'Consecrated as bishop'
                },
                {
                    'clergy_id': clergy_objects[3].id,  # Robert L. Neville
                    'date': date(1996, 6, 22),
                    'consecrator_id': clergy_objects[1].id,  # Richard Williamson
                    'notes': 'Consecrated as bishop'
                },
                {
                    'clergy_id': clergy_objects[5].id,  # Andrès Morello
                    'date': date(2006, 11, 30),
                    'consecrator_id': clergy_objects[3].id,  # Robert L. Neville
                    'notes': 'Consecrated as bishop'
                }
            ]
            
            for cons_data in consecrations:
                consecration = Consecration(**cons_data)
                db.session.add(consecration)
            
            db.session.commit()
            
            # Create sample user
            print("👤 Creating sample user...")
            from models import Role
            super_admin_role = Role.query.filter_by(name='Super Admin').first()
            
            user = User(
                username='admin',
                email='admin@example.com',
                full_name='Administrator',
                role_id=super_admin_role.id,
                is_active=True
            )
            user.set_password('admin123')
            db.session.add(user)
            
            db.session.commit()
            
            print("✅ Test database populated successfully!")
            return True
            
    except Exception as e:
        print(f"❌ Error populating test database: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_migration_with_sample_data(test_db_url):
    """Test the migration process with sample data"""
    print("🧪 Testing migration with sample data...")
    
    # Set up environment for testing
    os.environ['DATABASE_URL'] = test_db_url
    
    try:
        from app import app, db
        from models import Clergy, Ordination, Consecration
        
        with app.app_context():
            # Test lineage data generation
            print("🔗 Testing lineage data generation...")
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
            
            # Show the lineage structure
            print("\n📊 Sample Lineage Structure:")
            for link in links:
                source_clergy = next(c for c in all_clergy if c.id == link['source'])
                target_clergy = next(c for c in all_clergy if c.id == link['target'])
                print(f"   {source_clergy.name} -> {target_clergy.name} ({link['type']})")
            
            return True
            
    except Exception as e:
        print(f"❌ Error testing migration: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function"""
    print("🧪 Test Database Setup Script")
    print("=" * 50)
    print("This script will:")
    print("1. Create a fresh test database")
    print("2. Populate it with sample data")
    print("3. Test the migration process")
    print("4. Verify lineage data generation")
    print("=" * 50)
    
    # Confirm setup operation
    response = input("\nDo you want to proceed with setting up the test database? (yes/no): ")
    if response.lower() != 'yes':
        print("Test database setup cancelled.")
        return
    
    try:
        # Step 1: Create test database
        test_db_url = create_test_database()
        if not test_db_url:
            print("❌ Failed to create test database")
            return
        
        # Step 2: Populate with sample data
        if not populate_test_database(test_db_url):
            print("❌ Failed to populate test database")
            return
        
        # Step 3: Test migration
        if not test_migration_with_sample_data(test_db_url):
            print("❌ Failed to test migration")
            return
        
        print("\n" + "=" * 50)
        print("TEST DATABASE SETUP COMPLETED")
        print("=" * 50)
        print(f"✅ Test database created: {test_db_url}")
        print("✅ Sample data populated")
        print("✅ Migration process verified")
        print("✅ Lineage data generation working")
        
        print(f"\n🎯 Next Steps:")
        print(f"   1. Set DATABASE_URL={test_db_url} in your environment")
        print(f"   2. Run your application: python run_local.py")
        print(f"   3. Login with: admin / admin123")
        print(f"   4. Test the lineage visualization")
        print(f"   5. Test the clergy form functionality")
        
        print(f"\n📁 Database Connection:")
        print(f"   {test_db_url}")
        
    except Exception as e:
        print(f"\n❌ Test database setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
