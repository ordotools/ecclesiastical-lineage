# Restore Relationships from .dat Files - Quick Start

## Overview
You have .dat backup files in the `recovery` directory that contain your original database with legacy relationship fields. This guide will help you restore those relationships to staging first.

## Files Found
- **3455.dat** (11 MB) - Main data file (likely contains clergy table)
- **toc.dat** (29 KB) - Table of contents
- **Other .dat files** - Supporting data files

## Quick Start - Restore to Staging

### Option 1: Use the Deployment Script (Recommended)
```bash
# Activate virtual environment and run
source env/bin/activate
./deploy_restore_dat_staging.sh
```

This script will:
- ✅ Check for .dat files in recovery directory
- ✅ Create a safety backup of current staging database
- ✅ Restore relationships from .dat files
- ✅ Verify the restoration worked
- ✅ Provide next steps

### Option 2: Run Python Script Directly
```bash
# Activate virtual environment
source env/bin/activate

# Run restoration to staging
python restore_from_dat_files.py --recovery-dir recovery --target staging
```

## What Will Happen

1. **Extract Legacy Data**: The script will restore your .dat files to a temporary database and extract the legacy relationship fields:
   - `ordaining_bishop_id` - Who ordained each person
   - `date_of_ordination` - When they were ordained
   - `consecrator_id` - Who consecrated each person  
   - `date_of_consecration` - When they were consecrated
   - `co_consecrators` - Co-consecrators (JSON array)

2. **Clear Current Data**: Remove existing ordination/consecration records from staging

3. **Restore Relationships**: Create new records in the modern relationship tables

4. **Verify Success**: Test that lineage links are generated correctly

## Expected Output
```
🔄 Restoring Original Relationships from .dat files to Staging
==============================================================
📁 Found 10 .dat files:
   - 3453.dat
   - 3455.dat
   - 3457.dat
   ...
✅ Found legacy columns: consecrator_id, co_consecrators, date_of_consecration, date_of_ordination, ordaining_bishop_id
✅ Extracted 45 clergy records with legacy relationship data
✅ Created 23 ordination records
✅ Created 18 consecration records
✅ Created 12 co-consecrator relationships
📊 Generated 53 lineage links
✅ Lineage visualization should now work!
```

## After Staging Success

Once staging works correctly, you can restore to production:

```bash
# Create production deployment script (copy staging script)
cp deploy_restore_dat_staging.sh deploy_restore_dat_production.sh

# Edit the production script to target production instead of staging
# Then run:
./deploy_restore_dat_production.sh
```

## Safety Features

- **Automatic Backup**: Creates safety backup before making changes
- **Confirmation Prompt**: Asks for confirmation before proceeding
- **Error Handling**: Comprehensive error checking and cleanup
- **Verification**: Tests that restoration worked correctly

## Troubleshooting

### If you get "No legacy columns found":
- Your .dat files might not contain the legacy relationship fields
- Check if the backup was created before the migration to separate tables

### If you get "Could not create temporary database":
- Make sure PostgreSQL is running
- Check database permissions

### If restoration fails:
- Check the safety backup file that was created
- You can restore from it using: `psql "your_database_url" < backup_file.sql`

## Files Created
- `restore_from_dat_files.py` - Main restoration script for .dat files
- `deploy_restore_dat_staging.sh` - Deployment script for staging
- `RESTORE_DAT_INSTRUCTIONS.md` - This instruction file

## Ready to Start?
Run this command to begin:
```bash
source env/bin/activate && ./deploy_restore_dat_staging.sh
```
