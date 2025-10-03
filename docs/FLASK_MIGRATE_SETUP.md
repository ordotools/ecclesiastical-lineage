# Flask-Migrate Setup for Remote Database Updates

This document describes the Flask-Migrate setup that automatically updates the remote database on commit.

## Overview

The project now includes:
- **Pre-commit hook**: Automatically generates new migrations based on model changes
- **Post-commit hook**: Optionally applies migrations to the remote database
- **Migration management script**: Convenient commands for database management
- **Environment-based configuration**: Control migration behavior via environment variables

## Files Added/Modified

### Git Hooks
- `.git/hooks/pre-commit` - Generates migrations before commit
- `.git/hooks/post-commit` - Applies migrations after commit (optional)

### Scripts
- `scripts/migrate_db.sh` - Migration management script

### Documentation
- `docs/FLASK_MIGRATE_SETUP.md` - This documentation

## How It Works

### Pre-Commit Hook
The pre-commit hook automatically:
1. Activates the virtual environment
2. Checks for Flask-Migrate availability
3. Generates new migrations based on model changes
4. Adds new migration files to the commit
5. Validates migration syntax

### Post-Commit Hook
The post-commit hook (when enabled):
1. Checks if `AUTO_MIGRATE_ON_COMMIT=true`
2. Applies migrations to the remote database
3. Provides feedback on migration status

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string for the remote database

### Optional
- `AUTO_MIGRATE_ON_COMMIT` - Set to `true` to automatically apply migrations after commit
- `FLASK_APP` - Set to `app.py` (automatically set by hooks)

## Usage

### Basic Workflow
1. Make changes to your models in `models.py`
2. Commit your changes: `git commit -m "Update models"`
3. The pre-commit hook will automatically generate migration files
4. If `AUTO_MIGRATE_ON_COMMIT=true`, migrations will be applied to the remote database

### Manual Migration Management
Use the migration script for manual control:

```bash
# Show help
./scripts/migrate_db.sh help

# Generate a new migration
./scripts/migrate_db.sh generate "Add new field to User model"

# Apply all pending migrations
./scripts/migrate_db.sh upgrade

# Check migration status
./scripts/migrate_db.sh status

# Enable automatic migration on commit
./scripts/migrate_db.sh auto-commit

# Disable automatic migration on commit
./scripts/migrate_db.sh manual-commit
```

### Direct Flask-Migrate Commands
You can also use Flask-Migrate directly:

```bash
# Activate virtual environment
source env/bin/activate

# Set Flask app
export FLASK_APP=app.py

# Generate migration
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Check current revision
flask db current

# Show migration history
flask db history
```

## Configuration

### Enable Automatic Migration on Commit
To automatically apply migrations to the remote database after each commit:

```bash
# Set environment variable
export AUTO_MIGRATE_ON_COMMIT=true

# Or use the helper script
./scripts/migrate_db.sh auto-commit
```

### Disable Automatic Migration on Commit
To disable automatic migration (migrations will only be generated, not applied):

```bash
# Unset environment variable
unset AUTO_MIGRATE_ON_COMMIT

# Or use the helper script
./scripts/migrate_db.sh manual-commit
```

## Safety Features

### Pre-Commit Validation
- Validates migration syntax before commit
- Ensures Flask-Migrate is available
- Checks for proper project structure

### Error Handling
- Hooks exit gracefully on errors
- Detailed error messages for troubleshooting
- Fallback to manual migration if automatic fails

### Database Safety
- Migrations are validated before application
- Clear feedback on migration status
- Option to disable automatic application

## Troubleshooting

### Common Issues

#### "Flask-Migrate not found"
```bash
# Install Flask-Migrate
pip install flask-migrate

# Or activate virtual environment first
source env/bin/activate
pip install flask-migrate
```

#### "DATABASE_URL not set"
```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Or add to your .env file
echo "DATABASE_URL=postgresql://user:password@host:port/database" >> .env
```

#### "Not in project root directory"
Make sure you're running commands from the project root directory where `app.py` and `migrations/` folder exist.

#### "Migration failed"
```bash
# Check migration status
./scripts/migrate_db.sh status

# Check for syntax errors
flask db check

# Review migration files
ls -la migrations/versions/
```

### Debug Mode
To debug migration issues:

```bash
# Enable Flask debug mode
export FLASK_DEBUG=1

# Run migration with verbose output
flask db upgrade --verbose

# Check database connection
python -c "from app import app; print(app.config['SQLALCHEMY_DATABASE_URI'])"
```

## Best Practices

### Before Committing
1. Test your model changes locally
2. Generate migrations manually if needed: `flask db migrate -m "Description"`
3. Review generated migration files
4. Test migrations on a development database

### During Development
1. Use descriptive migration messages
2. Keep migrations small and focused
3. Test migrations before committing
4. Use version control for migration files

### In Production
1. Always backup the database before applying migrations
2. Test migrations on a staging environment first
3. Monitor migration application in production
4. Have a rollback plan ready

## Migration File Management

### Generated Files
Migration files are automatically generated in `migrations/versions/` with timestamps and descriptive names.

### Version Control
- Always commit migration files with your code changes
- Never edit migration files manually after generation
- Use descriptive commit messages for migration changes

### Cleanup
Old migration files should generally be kept for database history, but can be cleaned up if necessary:

```bash
# List all migrations
flask db history

# Remove old migration files (be careful!)
rm migrations/versions/old_migration_file.py
```

## Integration with Deployment

### Render.com
The setup works with Render.com deployment:

1. Set `AUTO_MIGRATE_ON_STARTUP=true` in Render environment variables
2. Set `DATABASE_URL` to your Render PostgreSQL URL
3. Migrations will be applied automatically on deployment

### Other Platforms
For other deployment platforms, ensure:
1. `DATABASE_URL` is set correctly
2. Flask-Migrate is installed in requirements.txt
3. Migration files are included in deployment

## Security Considerations

### Database Credentials
- Never commit database credentials to version control
- Use environment variables for sensitive information
- Rotate database passwords regularly

### Migration Access
- Ensure only authorized users can run migrations
- Use proper database user permissions
- Monitor migration execution in production

## Monitoring and Logging

### Migration Logs
Migration execution is logged and can be monitored:
- Pre-commit hook logs to stderr
- Post-commit hook provides status feedback
- Flask-Migrate logs migration details

### Database Monitoring
Monitor your database for:
- Migration execution times
- Database size changes
- Performance impact of migrations
- Error rates during migration

## Support

For issues with the Flask-Migrate setup:
1. Check the troubleshooting section above
2. Review migration logs and error messages
3. Test with manual Flask-Migrate commands
4. Check database connectivity and permissions

## Related Documentation

- [Flask-Migrate Documentation](https://flask-migrate.readthedocs.io/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Database Migration Best Practices](https://docs.djangoproject.com/en/stable/topics/migrations/)
