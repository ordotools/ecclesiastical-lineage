"""restore_legacy_relationships_from_dat

Revision ID: 6f1e117bd32f
Revises: 810871a86b33
Create Date: 2025-09-19 20:55:36.161255

"""
from alembic import op
import sqlalchemy as sa
import json
import os
import glob
import subprocess
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '6f1e117bd32f'
down_revision = '810871a86b33'
branch_labels = None
depends_on = None


def run_command(cmd):
    """Run a command and return success status"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def extract_legacy_data_from_dat_files():
    """Extract legacy relationship data from .dat files in recovery directory"""
    recovery_dir = "recovery"
    
    if not os.path.exists(recovery_dir):
        print("⚠️  No recovery directory found - skipping legacy data restoration")
        return []
    
    # Find .dat files
    dat_files = glob.glob(os.path.join(recovery_dir, "*.dat"))
    dat_files = [f for f in dat_files if not f.endswith('toc.dat')]
    
    if not dat_files:
        print("⚠️  No .dat files found in recovery directory - skipping legacy data restoration")
        return []
    
    print(f"📊 Found {len(dat_files)} .dat files in recovery directory")
    
    # Create temporary database for extraction
    temp_db = "temp_legacy_extract"
    
    try:
        # Create temporary database
        success, stdout, stderr = run_command(f'createdb {temp_db}')
        if not success:
            print(f"⚠️  Could not create temporary database: {stderr}")
            return []
        
        # Restore .dat files to temporary database
        success, stdout, stderr = run_command(f'pg_restore -d {temp_db} --clean --if-exists {recovery_dir}/toc.dat')
        if not success:
            print(f"⚠️  Could not restore .dat files: {stderr}")
            return []
        
        # Extract legacy data
        extract_sql = """
        SELECT 
            id, name, 
            ordaining_bishop_id, date_of_ordination,
            consecrator_id, date_of_consecration, co_consecrators
        FROM clergy 
        WHERE ordaining_bishop_id IS NOT NULL 
           OR consecrator_id IS NOT NULL
        ORDER BY id;
        """
        
        success, stdout, stderr = run_command(f'psql {temp_db} -c "{extract_sql}" -t')
        if not success:
            print(f"⚠️  Could not extract legacy data: {stderr}")
            return []
        
        # Parse the output
        legacy_data = []
        lines = stdout.strip().split('\n')
        
        for line in lines:
            if not line.strip():
                continue
            parts = [part.strip() for part in line.split('|')]
            if len(parts) >= 7:
                try:
                    clergy_id = int(parts[0]) if parts[0] else None
                    name = parts[1]
                    ordaining_bishop_id = int(parts[2]) if parts[2] and parts[2] != 'NULL' else None
                    date_of_ordination = parts[3] if parts[3] and parts[3] != 'NULL' else None
                    consecrator_id = int(parts[4]) if parts[4] and parts[4] != 'NULL' else None
                    date_of_consecration = parts[5] if parts[5] and parts[5] != 'NULL' else None
                    co_consecrators_json = parts[6] if parts[6] and parts[6] != 'NULL' else None
                    
                    legacy_data.append({
                        'clergy_id': clergy_id,
                        'name': name,
                        'ordaining_bishop_id': ordaining_bishop_id,
                        'date_of_ordination': date_of_ordination,
                        'consecrator_id': consecrator_id,
                        'date_of_consecration': date_of_consecration,
                        'co_consecrators_json': co_consecrators_json
                    })
                except (ValueError, IndexError) as e:
                    print(f"⚠️  Could not parse line: {line} - {e}")
                    continue
        
        print(f"✅ Extracted {len(legacy_data)} clergy records with legacy relationship data")
        return legacy_data
        
    except Exception as e:
        print(f"❌ Error extracting legacy data: {e}")
        return []
    finally:
        # Clean up temporary database
        run_command(f'dropdb {temp_db}')


def upgrade():
    """Restore legacy relationships from .dat files if available"""
    print("🔄 Checking for legacy relationship data to restore...")
    
    # Extract legacy data
    legacy_data = extract_legacy_data_from_dat_files()
    
    if not legacy_data:
        print("✅ No legacy data found - migration complete")
        return
    
    print(f"🔄 Restoring {len(legacy_data)} legacy relationships...")
    
    # Get database connection
    connection = op.get_bind()
    
    ordination_count = 0
    consecration_count = 0
    co_consecration_count = 0
    
    try:
        for data in legacy_data:
            clergy_id = data['clergy_id']
            name = data['name']
            
            # Create ordination record if ordaining bishop exists
            if data['ordaining_bishop_id']:
                try:
                    ordination_date = datetime.strptime(data['date_of_ordination'], '%Y-%m-%d').date() if data['date_of_ordination'] else datetime.now().date()
                except ValueError:
                    ordination_date = datetime.now().date()
                
                connection.execute(
                    sa.text("""
                        INSERT INTO ordination (clergy_id, date, ordaining_bishop_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at)
                        VALUES (:clergy_id, :date, :ordaining_bishop_id, false, false, false, :notes, :created_at, :updated_at)
                    """),
                    {
                        'clergy_id': clergy_id,
                        'date': ordination_date,
                        'ordaining_bishop_id': data['ordaining_bishop_id'],
                        'notes': f"Restored from legacy data for {name}",
                        'created_at': datetime.now(),
                        'updated_at': datetime.now()
                    }
                )
                ordination_count += 1
            
            # Create consecration record if consecrator exists
            if data['consecrator_id']:
                try:
                    consecration_date = datetime.strptime(data['date_of_consecration'], '%Y-%m-%d').date() if data['date_of_consecration'] else datetime.now().date()
                except ValueError:
                    consecration_date = datetime.now().date()
                
                # Insert consecration and get the ID
                result = connection.execute(
                    sa.text("""
                        INSERT INTO consecration (clergy_id, date, consecrator_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at)
                        VALUES (:clergy_id, :date, :consecrator_id, false, false, false, :notes, :created_at, :updated_at)
                        RETURNING id
                    """),
                    {
                        'clergy_id': clergy_id,
                        'date': consecration_date,
                        'consecrator_id': data['consecrator_id'],
                        'notes': f"Restored from legacy data for {name}",
                        'created_at': datetime.now(),
                        'updated_at': datetime.now()
                    }
                )
                
                consecration_id = result.fetchone()[0]
                consecration_count += 1
                
                # Handle co-consecrators if they exist
                if data['co_consecrators_json']:
                    try:
                        co_consecrator_ids = json.loads(data['co_consecrators_json'])
                        if isinstance(co_consecrator_ids, list):
                            for co_id in co_consecrator_ids:
                                if isinstance(co_id, int):
                                    connection.execute(
                                        sa.text("""
                                            INSERT INTO co_consecrators (consecration_id, co_consecrator_id)
                                            VALUES (:consecration_id, :co_consecrator_id)
                                            ON CONFLICT DO NOTHING
                                        """),
                                        {
                                            'consecration_id': consecration_id,
                                            'co_consecrator_id': co_id
                                        }
                                    )
                                    co_consecration_count += 1
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"⚠️  Could not parse co_consecrators for {name}: {data['co_consecrators_json']} - {e}")
        
        print(f"✅ Migration completed successfully!")
        print(f"   - Created {ordination_count} ordination records")
        print(f"   - Created {consecration_count} consecration records")
        print(f"   - Created {co_consecration_count} co-consecrator relationships")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise


def downgrade():
    """Remove restored legacy relationships"""
    print("🔄 Removing restored legacy relationships...")
    
    connection = op.get_bind()
    
    # Remove co-consecrators first
    connection.execute(sa.text("DELETE FROM co_consecrators"))
    
    # Remove consecrations
    connection.execute(sa.text("DELETE FROM consecration"))
    
    # Remove ordinations
    connection.execute(sa.text("DELETE FROM ordination"))
    
    print("✅ Legacy relationships removed")
