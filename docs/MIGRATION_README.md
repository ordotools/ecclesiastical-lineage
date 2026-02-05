# Database Migration Guide for RBAC System

**One-time migration** for the RBAC system. For ongoing schema changes use [FLASK_MIGRATE_SETUP.md](FLASK_MIGRATE_SETUP.md).

## Overview

The new role-based access control (RBAC) system requires database schema changes. This guide provides two approaches to migrate your existing database.

## Option 1: Incremental Migration (Recommended)

Use the incremental migration script to add new columns and tables without losing data.

### Steps:

1. **Stop your Flask application**
   ```bash
   # Stop the running Flask app
   ```

2. **Run the migration script**
   ```bash
   python migrate_to_rbac.py
   ```

3. **Verify the migration**
   The script will automatically verify that all required tables and columns exist.

4. **Restart your Flask application**
   ```bash
   python app.py
   ```

5. **Test login**
   Try logging in with your existing credentials.

## Option 2: Backup and Restore (If Option 1 Fails)

If the incremental migration encounters issues, use the backup and restore approach.

### Steps:

1. **Stop your Flask application**

2. **Run the backup and restore script**
   ```bash
   python backup_and_restore_rbac.py
   ```
   
   ⚠️ **WARNING**: This will drop and recreate all tables!

3. **Follow the prompts**
   The script will ask for confirmation before proceeding.

4. **Restart your Flask application**
   ```bash
   python app.py
   ```

## What the Migration Does

### New Database Schema

The migration adds the following to your existing database:

#### User Table Changes:
- `email` (VARCHAR, optional)
- `full_name` (VARCHAR, optional) 
- `is_active` (BOOLEAN, default true)
- `created_at` (TIMESTAMP, default now)
- `last_login` (TIMESTAMP, optional)
- `role_id` (INTEGER, foreign key to role table)

#### New Tables:
- `role` - Defines user roles (Super Admin, Editor, etc.)
- `permission` - Defines system permissions
- `role_permissions` - Links roles to permissions
- `clergy_comment` - Stores comments on clergy records

### Role Assignment

All existing users will be assigned the "Super Admin" role, giving them full access to the system.

## Troubleshooting

### Common Issues:

1. **"column user.email does not exist"**
   - Run the migration script to add the missing columns

2. **"table role does not exist"**
   - The migration script will create all required tables

3. **Permission errors after migration**
   - All existing users become Super Admins automatically
   - Check that the migration completed successfully

### If Migration Fails:

1. **Check database connection**
   - Ensure your `DATABASE_URL` environment variable is correct
   - Verify the database is accessible

2. **Check permissions**
   - Ensure your database user has ALTER TABLE permissions

3. **Use backup and restore**
   - If incremental migration fails, use the backup and restore approach

## After Migration

### Verify Everything Works:

1. **Login test**
   - Try logging in with existing credentials
   - Check that you can access the dashboard

2. **User management**
   - Go to Settings → User Management (if you're a Super Admin)
   - Create additional users with different roles

3. **Test permissions**
   - Create a test user with "Viewer" role
   - Verify they can only view data, not edit

### Creating New Users:

1. **Super Admin users** can access `/users` to manage user accounts
2. **Use the user management interface** to create users with appropriate roles
3. **Assign roles based on responsibilities**:
   - **Editor**: For clergy who manage records
   - **Contributor**: For researchers who add data
   - **Reviewer**: For scholars who provide feedback
   - **Viewer**: For general public access

## Rollback (If Needed)

If you need to rollback the changes:

1. **Restore from backup**
   - Use the `backup_before_rbac.json` file created during migration
   - Manually restore the original database schema

2. **Revert code changes**
   - Checkout the previous version of `app.py`
   - Remove the new template files

## Support

If you encounter issues:

1. **Check the migration logs** for specific error messages
2. **Verify database connectivity** and permissions
3. **Use the backup and restore approach** if incremental migration fails
4. **Check the application logs** for any runtime errors

## Next Steps

After successful migration:

1. **Create additional users** with appropriate roles
2. **Test the comment system** on clergy records
3. **Explore the new user management features**
4. **Review the role-based permissions** in the settings page 