"""Smart production data migration with existing clergy matching

Revision ID: ffca03f86792
Revises: 1f45b673ab3c
Create Date: 2025-09-21 05:36:50.854233

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import requests
import json
import re
import time
from datetime import datetime, date


# revision identifiers, used by Alembic.
revision = 'ffca03f86792'
down_revision = '1f45b673ab3c'
branch_labels = None
depends_on = None


def fetch_production_data():
    """Fetch basic data from the production API endpoint"""
    print("🔄 Fetching basic lineage data from production API...")
    
    try:
        response = requests.get("https://ecclesiastical-lineage.onrender.com/clergy/lineage-data", timeout=30)
        response.raise_for_status()
        
        data = response.json()
        if not data.get('success'):
            raise Exception(f"API returned error: {data.get('message', 'Unknown error')}")
        
        print(f"✅ Successfully fetched basic data: {len(data.get('nodes', []))} nodes, {len(data.get('links', []))} links")
        return data
        
    except Exception as e:
        print(f"❌ Error fetching basic data from production API: {e}")
        raise


def parse_date(date_str):
    """Parse date string in various formats"""
    if not date_str or date_str in ['Not specified', 'Date unknown', '']:
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


def find_existing_clergy(connection, name, clergy_name_mapping):
    """Find existing clergy by name"""
    # Try exact match first
    if name.lower() in clergy_name_mapping:
        return clergy_name_mapping[name.lower()]
    
    # Try partial matches for names with titles
    for existing_name, clergy_id in clergy_name_mapping.items():
        # Remove common titles and compare
        clean_name = re.sub(r'\b(Rev\.?|Fr\.?|Bishop|Archbishop|Cardinal|Pope|St\.?)\b\.?\s*', '', name.lower())
        clean_existing = re.sub(r'\b(Rev\.?|Fr\.?|Bishop|Archbishop|Cardinal|Pope|St\.?)\b\.?\s*', '', existing_name)
        
        if clean_name == clean_existing:
            return clergy_id
    
    return None


def upgrade():
    """Smart production data migration with existing clergy matching"""
    print("🚀 Starting smart production data migration...")
    
    try:
        # Get connection
        connection = op.get_bind()
        
        # Build clergy name mapping from existing database
        print("🗂️  Building clergy name mapping from existing database...")
        clergy_name_mapping = {}
        
        result = connection.execute(text("SELECT id, name, papal_name FROM clergy WHERE is_deleted != true"))
        existing_clergy = result.fetchall()
        
        for clergy in existing_clergy:
            clergy_id, name, papal_name = clergy
            # Use both regular name and papal name for matching
            clergy_name_mapping[name.lower()] = clergy_id
            if papal_name:
                clergy_name_mapping[papal_name.lower()] = clergy_id
        
        print(f"✅ Mapped {len(existing_clergy)} existing clergy records")
        
        # Fetch production data
        production_data = fetch_production_data()
        nodes = production_data.get('nodes', [])
        links = production_data.get('links', [])
        
        if not nodes:
            print("❌ No nodes found in production data")
            return
        
        # Track mappings and updates
        production_to_local_mapping = {}
        updated_count = 0
        new_clergy_count = 0
        
        # Update existing clergy with production data
        print(f"🔄 Updating existing clergy records with production data...")
        
        for i, node in enumerate(nodes):
            try:
                name = node.get('name', '')
                if not name:
                    continue
                
                production_id = node.get('id')
                
                # Find existing clergy by name
                existing_clergy_id = find_existing_clergy(connection, name, clergy_name_mapping)
                
                if existing_clergy_id:
                    # Update existing clergy record
                    image_url = extract_image_data(node)
                    
                    # Update with production data
                    updates = []
                    params = {}
                    
                    if image_url:
                        # Check if clergy already has an image
                        check_result = connection.execute(
                            text("SELECT image_url FROM clergy WHERE id = :id"), 
                            {"id": existing_clergy_id}
                        ).fetchone()
                        
                        if not check_result[0]:  # No existing image
                            updates.append("image_url = :image_url")
                            params["image_url"] = image_url
                    
                    # Update organization if provided
                    if node.get('organization'):
                        updates.append("organization = :organization")
                        params["organization"] = node.get('organization')
                    
                    # Update rank if provided
                    if node.get('rank'):
                        updates.append("rank = :rank")
                        params["rank"] = node.get('rank')
                    
                    # Update notes if we have bio data
                    if node.get('bio'):
                        # Check if clergy already has notes
                        check_result = connection.execute(
                            text("SELECT notes FROM clergy WHERE id = :id"), 
                            {"id": existing_clergy_id}
                        ).fetchone()
                        
                        if not check_result[0]:  # No existing notes
                            updates.append("notes = :notes")
                            params["notes"] = node.get('bio')
                    
                    if updates:
                        params["id"] = existing_clergy_id
                        update_sql = f"UPDATE clergy SET {', '.join(updates)} WHERE id = :id"
                        connection.execute(text(update_sql), params)
                    
                    # Map production ID to local ID
                    if production_id:
                        production_to_local_mapping[production_id] = existing_clergy_id
                    
                    updated_count += 1
                    print(f"  ✅ Updated: {name} (ID: {existing_clergy_id})")
                else:
                    # Create new clergy record if not found
                    print(f"  ➕ Creating new clergy: {name}")
                    
                    rank = node.get('rank', '')
                    organization = node.get('organization', '')
                    image_url = extract_image_data(node)
                    notes = node.get('bio', '')
                    
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
                        production_to_local_mapping[production_id] = local_id
                    
                    # Add to name mapping for future lookups
                    clergy_name_mapping[name.lower()] = local_id
                    
                    new_clergy_count += 1
                
                # Add a small delay to be respectful to the server
                time.sleep(0.05)
                
            except Exception as e:
                print(f"  ❌ Error processing clergy {node.get('name', 'Unknown')}: {e}")
                continue
        
        print(f"✅ Clergy update complete:")
        print(f"   - Updated existing: {updated_count}")
        print(f"   - Created new: {new_clergy_count}")
        print(f"   - Total mapped: {len(production_to_local_mapping)}")
        
        # Create lineage records
        print(f"🔗 Creating lineage records from {len(links)} links...")
        
        # Create a lookup for node data to get dates
        node_lookup = {node['id']: node for node in nodes}
        
        ordination_count = 0
        consecration_count = 0
        skipped_count = 0
        
        for link in links:
            try:
                source_id = link.get('source')
                target_id = link.get('target')
                link_type = link.get('type', '')
                date_str = link.get('date', '')
                
                # Map production IDs to local IDs
                local_source_id = production_to_local_mapping.get(source_id)
                local_target_id = production_to_local_mapping.get(target_id)
                
                if not local_source_id or not local_target_id:
                    skipped_count += 1
                    continue
                
                # Parse date from link
                link_date = parse_date(date_str)
                
                # If no date from link, try to get it from node data
                if not link_date:
                    target_node = node_lookup.get(target_id, {})
                    if link_type == 'ordination':
                        link_date = parse_date(target_node.get('ordination_date'))
                    elif link_type == 'consecration':
                        link_date = parse_date(target_node.get('consecration_date'))
                
                # If still no date, use today's date as fallback
                if not link_date:
                    link_date = date.today()
                
                # Check if relationship already exists
                if link_type == 'ordination':
                    existing = connection.execute(text("""
                        SELECT id FROM ordination 
                        WHERE clergy_id = :clergy_id AND ordaining_bishop_id = :ordaining_bishop_id
                    """), {
                        "clergy_id": local_target_id,
                        "ordaining_bishop_id": local_source_id
                    }).fetchone()
                    
                    if not existing:
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
                    existing = connection.execute(text("""
                        SELECT id FROM consecration 
                        WHERE clergy_id = :clergy_id AND consecrator_id = :consecrator_id
                    """), {
                        "clergy_id": local_target_id,
                        "consecrator_id": local_source_id
                    }).fetchone()
                    
                    if not existing:
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
                
            except Exception as e:
                print(f"  ❌ Error creating lineage record for link {link}: {e}")
                continue
        
        print(f"✅ Created lineage records:")
        print(f"   - New ordinations: {ordination_count}")
        print(f"   - New consecrations: {consecration_count}")
        print(f"   - Skipped (no mapping): {skipped_count}")
        
        print("🎉 Smart migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Smart migration failed: {e}")
        raise


def downgrade():
    """Remove migrated production data"""
    print("🔄 Removing smart migrated production data...")
    
    try:
        connection = op.get_bind()
        
        # Delete in correct order to respect foreign key constraints
        connection.execute(text("DELETE FROM co_consecrators"))
        
        # Delete ordinations and consecrations created by this migration
        # We'll identify them by their notes containing "Migrated from production data"
        connection.execute(text("""
            DELETE FROM ordination 
            WHERE notes LIKE 'Migrated from production data%'
        """))
        
        connection.execute(text("""
            DELETE FROM consecration 
            WHERE notes LIKE 'Migrated from production data%'
        """))
        
        # Optionally remove clergy records that were created by this migration
        # (This is commented out to preserve any manually added clergy)
        # connection.execute(text("""
        #     DELETE FROM clergy 
        #     WHERE created_at >= :cutoff AND notes LIKE 'Migrated from production data%'
        # """), {
        #     "cutoff": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        # })
        
        print("✅ Smart production data removed successfully")
        
    except Exception as e:
        print(f"❌ Error removing smart production data: {e}")
        raise
