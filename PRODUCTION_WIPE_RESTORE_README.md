# Production Database Wipe and Restore from Staging

This guide explains how to completely wipe the production database and restore it with data from the staging database using Flask-Migrate.

## ⚠️ WARNING

**This is a DESTRUCTIVE operation that will completely wipe all production data!**

- All production data will be permanently lost
- The operation cannot be undone
- Make sure you have a backup if needed
- Only use this when the production database has major issues

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file contains:
   ```bash
   DATABASE_URL=postgresql://user:pass@host:port/production_db
   STAGING_DATABASE_URL=postgresql://user:pass@host:port/staging_db
   ```

2. **Staging Database**: Make sure your staging database has the data you want to restore to production

3. **Dependencies**: Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Method 1: Using Flask-Migrate (Recommended)

This method uses a proper Flask-Migrate migration that can be tracked and managed.

### Step 1: Run the Migration

```bash
# Run the wipe and restore migration
flask db upgrade
```

This will execute the `wipe_restore_prod` migration that:
- Completely wipes the production database
- Copies all data from staging to production
- Verifies the data was copied correctly

### Step 2: Verify the Restore

The migration includes built-in verification that checks:
- Data counts match between staging and production
- All tables were copied successfully
- Database is functional

## Method 2: Using the Standalone Script

If you prefer not to use Flask-Migrate, you can use the standalone Python script.

### Step 1: Run the Script

```bash
python3 sync_staging_to_production.py
```

### Step 2: Follow the Prompts

The script will:
1. Ask for confirmation (type `WIPE_PRODUCTION`)
2. Verify staging database has data
3. Wipe production database
4. Copy all data from staging
5. Verify the restore was successful

## Method 3: Using the Deployment Script

For a complete deployment with additional checks and verification.

### Step 1: Run the Deployment Script

```bash
./deploy_wipe_restore.sh
```

### Step 2: Follow the Interactive Prompts

The script will:
1. Check environment variables
2. Verify staging database
3. Ask for final confirmation
4. Run the migration
5. Verify the restore
6. Test database functionality

## What Gets Copied

The migration copies all data from staging to production, including:

- **Users** - All user accounts and authentication data
- **Roles & Permissions** - RBAC system data
- **Organizations** - All organization records
- **Ranks** - All rank definitions
- **Clergy** - All clergy member records with images
- **Ordinations** - All ordination records
- **Consecrations** - All consecration records
- **Co-consecrators** - Association table data
- **Comments** - All clergy comments
- **Admin Invites** - Pending admin invitations
- **Audit Logs** - All audit trail data

## Safety Features

### Built-in Safeguards

1. **Confirmation Required**: All methods require explicit confirmation
2. **Staging Verification**: Checks that staging has data before proceeding
3. **Data Verification**: Compares record counts after restore
4. **Transaction Safety**: Uses database transactions for data integrity
5. **Foreign Key Handling**: Properly disables/enables foreign key checks

### Error Handling

- Graceful handling of missing tables
- Detailed error messages
- Transaction rollback on errors
- Verification of each step

## Troubleshooting

### Common Issues

1. **"Staging database is empty"**
   - Ensure staging database has data
   - Check STAGING_DATABASE_URL is correct

2. **"Data counts don't match"**
   - Check for foreign key constraint issues
   - Verify staging database integrity

3. **"Permission denied"**
   - Ensure database user has full permissions
   - Check database connection strings

### Recovery

If something goes wrong:
1. Check the error messages
2. Verify your environment variables
3. Ensure staging database is accessible
4. Consider restoring from a backup

## Files Created

- `migrations/versions/wipe_restore_prod.py` - Flask-Migrate migration
- `sync_staging_to_production.py` - Standalone Python script
- `deploy_wipe_restore.sh` - Deployment script with verification
- `PRODUCTION_WIPE_RESTORE_README.md` - This documentation

## Best Practices

1. **Test First**: Always test on a copy of production first
2. **Backup**: Create a backup before running (if needed)
3. **Verify Staging**: Ensure staging has the correct data
4. **Monitor**: Watch the output for any errors
5. **Test After**: Verify the application works after restore

## Rollback

**This operation cannot be rolled back using Flask-Migrate.**

The migration is marked as non-downgradable because it's destructive. If you need to restore previous data, you'll need to:

1. Restore from a database backup
2. Or run the migration again with different staging data

## Support

If you encounter issues:

1. Check the error messages carefully
2. Verify environment variables
3. Ensure database connectivity
4. Check staging database integrity
5. Review the migration logs

The scripts provide detailed output to help diagnose any problems.
