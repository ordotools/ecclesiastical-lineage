"""Migrate production lineage data

Revision ID: 1f45b673ab3c
Revises: 810871a86b33
Create Date: 2025-09-21 05:13:22.166739

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import requests
import json
import re
from datetime import datetime, date


# revision identifiers, used by Alembic.
revision = '1f45b673ab3c'
down_revision = '810871a86b33'
branch_labels = None
depends_on = None


def fetch_production_data():
    """Fetch data from the production API endpoint"""
    print("🔄 Fetching data from production API...")
    
    try:
        response = requests.get("https://ecclesiastical-lineage.onrender.com/clergy/lineage-data", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if not data.get('success'):
            raise Exception(f"API returned error: {data.get('message', 'Unknown error')}")
        
        print(f"✅ Successfully fetched data: {len(data.get('nodes', []))} nodes, {len(data.get('links', []))} links")
        return data
        
    except Exception as e:
        print(f"⚠️  Warning: Could not fetch data from production API: {e}")
        print("🔄 Continuing migration without data fetch - database will be created with empty tables")
        return None


def parse_date(date_str):
    """Parse date string in various formats"""
    if not date_str or date_str == 'Date unknown':
        return None
    
    try:
        # Try YYYY-MM-DD format first
        if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Try YYYY-MM format
        if re.match(r'\d{4}-\d{2}', date_str):
            return datetime.strptime(date_str, '%Y-%m').date()
        
        # Try YYYY format
        if re.match(r'\d{4}', date_str):
            return datetime.strptime(date_str, '%Y').date()
        
        return None
    except ValueError:
        return None


def extract_image_data(node):
    """Extract and process image data from a node"""
    image_url = node.get('image_url', '')
    high_res_image_url = node.get('high_res_image_url', '')
    
    # If we have a high-res image URL, use that
    if high_res_image_url and not high_res_image_url.startswith('data:'):
        return high_res_image_url
    
    # If we have a regular image URL, use that
    if image_url and not image_url.startswith('data:'):
        return image_url
    
    # If it's a data URL (base64), store it as is
    if image_url.startswith('data:'):
        return image_url
    
    return None


def upgrade():
    """Migrate production lineage data"""
    print("🚀 Starting production data migration...")
    
    try:
        # Fetch production data
        production_data = fetch_production_data()
        
        if production_data is None:
            print("⚠️  Skipping data migration due to API fetch failure")
            print("✅ Database schema migration completed successfully")
            return
            
        nodes = production_data.get('nodes', [])
        links = production_data.get('links', [])
        
        if not nodes:
            print("❌ No nodes found in production data")
            return
        
        # Clear existing lineage data
        print("🧹 Clearing existing lineage data...")
        op.execute(text("DELETE FROM co_consecrators"))
        op.execute(text("DELETE FROM consecration"))
        op.execute(text("DELETE FROM ordination"))
        print("✅ Cleared existing lineage data")
        
        # Get connection for data operations
        connection = op.get_bind()
        
        # Track ID mappings
        clergy_id_mapping = {}
        organizations = {}
        ranks = {}
        
        # Ensure organizations and ranks exist
        print("🏢 Ensuring organizations and ranks exist...")
        
        # Get unique organizations and ranks from nodes
        org_names = set()
        rank_names = set()
        
        for node in nodes:
            if node.get('organization'):
                org_names.add(node['organization'])
            if node.get('rank'):
                rank_names.add(node['rank'])
        
        # Create organizations
        for org_name in org_names:
            result = connection.execute(text("SELECT id FROM organization WHERE name = :name"), {"name": org_name})
            org_id = result.fetchone()
            
            if not org_id:
                connection.execute(text("""
                    INSERT INTO organization (name, color, created_at) 
                    VALUES (:name, :color, :created_at)
                """), {
                    "name": org_name,
                    "color": "#27ae60",
                    "created_at": datetime.utcnow()
                })
                print(f"  ➕ Created organization: {org_name}")
            
            # Get the organization ID
            result = connection.execute(text("SELECT id FROM organization WHERE name = :name"), {"name": org_name})
            org_id = result.fetchone()[0]
            organizations[org_name] = org_id
        
        # Create ranks
        for rank_name in rank_names:
            result = connection.execute(text("SELECT id FROM rank WHERE name = :name"), {"name": rank_name})
            rank_id = result.fetchone()
            
            if not rank_id:
                is_bishop = 'bishop' in rank_name.lower() or 'pope' in rank_name.lower()
                connection.execute(text("""
                    INSERT INTO rank (name, color, is_bishop, created_at) 
                    VALUES (:name, :color, :is_bishop, :created_at)
                """), {
                    "name": rank_name,
                    "color": "#888888",
                    "is_bishop": is_bishop,
                    "created_at": datetime.utcnow()
                })
                print(f"  ➕ Created rank: {rank_name} (is_bishop: {is_bishop})")
            
            # Get the rank ID
            result = connection.execute(text("SELECT id FROM rank WHERE name = :name"), {"name": rank_name})
            rank_id = result.fetchone()[0]
            ranks[rank_name] = rank_id
        
        print(f"✅ Ensured {len(organizations)} organizations and {len(ranks)} ranks exist")
        
        # Create clergy records
        print(f"👥 Creating {len(nodes)} clergy records...")
        
        for node in nodes:
            name = node.get('name', '')
            if not name:
                print(f"  ⚠️  Skipping node with no name: {node}")
                continue
            
            rank = node.get('rank', '')
            organization = node.get('organization', '')
            image_url = extract_image_data(node)
            notes = node.get('bio', '')
            production_id = node.get('id')
            
            # Insert clergy record
            result = connection.execute(text("""
                INSERT INTO clergy (name, rank, organization, image_url, notes, is_deleted)
                VALUES (:name, :rank, :organization, :image_url, :notes, :is_deleted)
                RETURNING id
            """), {
                "name": name,
                "rank": rank,
                "organization": organization,
                "image_url": image_url,
                "notes": notes,
                "is_deleted": False
            })
            
            local_id = result.fetchone()[0]
            
            # Map production ID to local ID
            if production_id:
                clergy_id_mapping[production_id] = local_id
            
            print(f"  ➕ Created clergy: {name} (ID: {local_id})")
        
        print(f"✅ Created {len(clergy_id_mapping)} clergy records")
        
        # Create lineage records
        print(f"🔗 Creating lineage records from {len(links)} links...")
        
        ordination_count = 0
        consecration_count = 0
        
        for link in links:
            source_id = link.get('source')
            target_id = link.get('target')
            link_type = link.get('type', '')
            date_str = link.get('date', '')
            
            # Map production IDs to local IDs
            local_source_id = clergy_id_mapping.get(source_id)
            local_target_id = clergy_id_mapping.get(target_id)
            
            if not local_source_id or not local_target_id:
                print(f"  ⚠️  Skipping link with unmapped IDs: source={source_id}, target={target_id}")
                continue
            
            # Parse date
            link_date = parse_date(date_str)
            if not link_date:
                link_date = date.today()
            
            if link_type == 'ordination':
                connection.execute(text("""
                    INSERT INTO ordination (clergy_id, date, ordaining_bishop_id, is_sub_conditione, 
                                         is_doubtful, is_invalid, notes)
                    VALUES (:clergy_id, :date, :ordaining_bishop_id, :is_sub_conditione, 
                           :is_doubtful, :is_invalid, :notes)
                """), {
                    "clergy_id": local_target_id,
                    "date": link_date,
                    "ordaining_bishop_id": local_source_id,
                    "is_sub_conditione": False,
                    "is_doubtful": False,
                    "is_invalid": False,
                    "notes": f"Migrated from production data (original date: {date_str})"
                })
                ordination_count += 1
                
            elif link_type == 'consecration':
                connection.execute(text("""
                    INSERT INTO consecration (clergy_id, date, consecrator_id, is_sub_conditione, 
                                           is_doubtful, is_invalid, notes)
                    VALUES (:clergy_id, :date, :consecrator_id, :is_sub_conditione, 
                           :is_doubtful, :is_invalid, :notes)
                """), {
                    "clergy_id": local_target_id,
                    "date": link_date,
                    "consecrator_id": local_source_id,
                    "is_sub_conditione": False,
                    "is_doubtful": False,
                    "is_invalid": False,
                    "notes": f"Migrated from production data (original date: {date_str})"
                })
                consecration_count += 1
        
        print(f"✅ Created lineage records:")
        print(f"   - Ordinations: {ordination_count}")
        print(f"   - Consecrations: {consecration_count}")
        
        print("🎉 Migration completed successfully!")
        print(f"   - Migrated {len(clergy_id_mapping)} clergy members")
        print(f"   - Created {len(links)} lineage relationships")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise


def downgrade():
    """Remove migrated production data"""
    print("🔄 Removing migrated production data...")
    
    try:
        # Delete in correct order to respect foreign key constraints
        op.execute(text("DELETE FROM co_consecrators"))
        op.execute(text("DELETE FROM consecration"))
        op.execute(text("DELETE FROM ordination"))
        
        # Optionally remove clergy records that were migrated
        # (This is commented out to preserve any manually added clergy)
        # op.execute(text("DELETE FROM clergy WHERE created_at >= :cutoff"), {
        #     "cutoff": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        # })
        
        print("✅ Production data removed successfully")
        
    except Exception as e:
        print(f"❌ Error removing production data: {e}")
        raise
