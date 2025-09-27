# Production Database Wipe and Restore from Staging

⚠️ **THIS FUNCTIONALITY HAS BEEN REMOVED** ⚠️

The wipe and restore functionality has been removed from the application to prevent accidental data loss. The database is now stable and this destructive operation is no longer needed.

## Previous Methods (Now Removed)

The following methods were previously available but have been removed:

1. ~~Flask-Migrate wipe and restore migration~~ - **REMOVED**
2. ~~Standalone sync script~~ - **REMOVED**  
3. ~~Deployment script with wipe and restore~~ - **REMOVED**

## Current Database Management

For database management, please use the standard Flask-Migrate commands:

```bash
# Apply new migrations
flask db upgrade

# Create new migrations
flask db migrate -m "description"

# View migration history
flask db history
```

## If You Need to Restore Data

If you need to restore data, please:

1. Use database backups
2. Contact the system administrator
3. Use proper database restoration procedures

**Do not attempt to recreate the wipe and restore functionality as it poses significant data loss risks.**