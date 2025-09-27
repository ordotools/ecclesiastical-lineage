# Restore Original Relationships

This directory contains scripts to restore the original lineage relationships from a previous database backup file to either staging or production environments.

## Overview

The ecclesiastical lineage application stores clergy relationships in separate `ordination` and `consecration` tables. If you need to restore the original relationships from a backup file that contains the legacy data structure, use these scripts.

## Files

- `restore_original_relationships.py` - Full-featured restoration script with temporary database extraction
- `restore_relationships_simple.py` - Simplified restoration script using direct SQL
- `deploy_restore_relationships.sh` - Deployment script with safety backups and confirmation prompts
- `RESTORE_RELATIONSHIPS_README.md` - This documentation

## Prerequisites

1. **Database Backup File**: You need a backup file (`.sql`) that contains the clergy table with legacy fields:
   - `ordaining_bishop_id` (foreign key to clergy.id)
   - `date_of_ordination`
   - `consecrator_id` (foreign key to clergy.id)  
   - `date_of_consecration`
   - `co_consecrators` (JSON text field with array of clergy IDs)

2. **Environment Variables**: Ensure your `.env` file contains:
   - `STAGING_DATABASE_URL` (for staging deployments)
   - `PRODUCTION_DATABASE_URL` (for production deployments)

3. **Dependencies**: 
   - PostgreSQL client tools (`psql`, `pg_dump`)
   - Python virtual environment activated
   - All project dependencies installed

## Usage

### Option 1: Using the Deployment Script (Recommended)

The deployment script provides the safest approach with automatic safety backups:

```bash
# Restore to staging
./deploy_restore_relationships.sh staging /path/to/backup.sql

# Restore to production  
./deploy_restore_relationships.sh production /path/to/backup.sql
```

**Features:**
- Creates automatic safety backup before restoration
- Interactive confirmation prompts
- Colored output for better visibility
- Error handling and rollback information

### Option 2: Using Python Scripts Directly

#### Simple Restoration Script

```bash
# Restore to staging
python restore_relationships_simple.py --backup-file /path/to/backup.sql --target staging

# Restore to production
python restore_relationships_simple.py --backup-file /path/to/backup.sql --target production

# Skip confirmation prompts (use with caution)
python restore_relationships_simple.py --backup-file /path/to/backup.sql --target staging --force
```

#### Full-Featured Restoration Script

```bash
# Restore to staging
python restore_original_relationships.py --backup-file /path/to/backup.sql --target staging

# Restore to production
python restore_original_relationships.py --backup-file /path/to/backup.sql --target production
```

## What the Scripts Do

1. **Extract Legacy Data**: Read the backup file and extract clergy records with legacy relationship fields
2. **Clear Existing Data**: Remove all existing ordination and consecration records
3. **Restore Relationships**: Create new ordination and consecration records from the legacy data
4. **Handle Co-consecrators**: Restore co-consecrator relationships from the JSON field
5. **Verify Restoration**: Test that lineage links are properly generated

## Safety Features

- **Safety Backups**: The deployment script automatically creates a backup before making changes
- **Confirmation Prompts**: Interactive prompts to prevent accidental execution
- **Verification**: Automatic testing of the restored relationships
- **Error Handling**: Comprehensive error handling with rollback information

## Expected Output

When successful, you should see output like:

```
🔄 Restoring Original Relationships to Staging
==================================================
📁 Backup file: backup_20240919.sql
🎯 Target: Staging
📊 Database: postgresql://user:pass@host:port/db...

✅ Safety backup created: backup_staging_before_restore_20240919_143022.sql
✅ Created 45 ordination records
✅ Created 23 consecration records  
✅ Created 12 co-consecrator relationships
📊 Generated 80 lineage links
✅ Lineage visualization should now work!

🎉 Successfully restored original relationships to Staging!
```

## Troubleshooting

### Common Issues

1. **"Backup file not found"**
   - Verify the path to your backup file is correct
   - Check file permissions

2. **"DATABASE_URL not found"**
   - Ensure your `.env` file contains the required database URLs
   - Check that environment variables are loaded

3. **"Could not extract legacy data"**
   - Verify your backup file contains the clergy table with legacy fields
   - Check that the backup file is a valid SQL dump

4. **"No links generated"**
   - This may indicate the backup file doesn't contain the expected legacy fields
   - Check that `ordaining_bishop_id` and `consecrator_id` fields exist in your backup

### Recovery

If something goes wrong, you can restore from the safety backup:

```bash
# Restore from safety backup
psql "your_database_url" < backup_staging_before_restore_TIMESTAMP.sql
```

## Technical Details

### Legacy Data Structure

The original clergy table contained these relationship fields:
- `ordaining_bishop_id`: Foreign key to clergy.id (who ordained this person)
- `date_of_ordination`: Date of ordination
- `consecrator_id`: Foreign key to clergy.id (who consecrated this person)
- `date_of_consecration`: Date of consecration
- `co_consecrators`: JSON array of clergy IDs (co-consecrators)

### New Data Structure

These are now stored in separate tables:
- `ordination` table: Links clergy to their ordaining bishop with dates and metadata
- `consecration` table: Links clergy to their consecrator with dates and metadata
- `co_consecrators` table: Association table linking consecrations to co-consecrators

### Migration Process

1. Extract clergy records with legacy relationship data from backup
2. Create corresponding records in the new `ordination` and `consecration` tables
3. Parse the `co_consecrators` JSON field and create association records
4. Verify that lineage links are properly generated for visualization

## Support

If you encounter issues:

1. Check the error messages carefully
2. Verify your backup file contains the expected legacy fields
3. Ensure database connectivity and permissions
4. Use the safety backup to restore if needed
5. Contact the development team with specific error messages

## Security Notes

- Never commit backup files containing sensitive data to version control
- Ensure database URLs are properly configured in environment variables
- Use the deployment script in production environments for safety
- Always test restorations in staging before production
