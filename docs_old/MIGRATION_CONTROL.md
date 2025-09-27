# Database Migration Control

## Overview

Automatic database migrations on application startup have been **disabled by default** to prevent unexpected database changes. Flask-Migrate functionality remains fully available for manual use.

## Current Behavior

### Default (Automatic Migrations Disabled)
- Application starts without running migrations
- Database schema remains unchanged during startup
- Flask-Migrate commands remain available for manual use

### When Automatic Migrations Are Enabled
- Set `AUTO_MIGRATE_ON_STARTUP=true` in your environment
- Application will run `flask db upgrade` on startup
- Useful for development or when you need automatic schema updates

## Manual Migration Commands

All standard Flask-Migrate commands are available:

```bash
# Apply pending migrations
flask db upgrade

# Create a new migration
flask db migrate -m "description of changes"

# Rollback migrations
flask db downgrade [revision]

# Show current migration
flask db current

# Show migration history
flask db history

# Show details of a specific migration
flask db show [revision]
```

## Environment Configuration

Add to your `.env` file:

```bash
# Disable automatic migrations (default)
AUTO_MIGRATE_ON_STARTUP=false

# Enable automatic migrations
AUTO_MIGRATE_ON_STARTUP=true
```

## Best Practices

1. **Development**: Keep `AUTO_MIGRATE_ON_STARTUP=false` and run migrations manually
2. **Production**: Keep `AUTO_MIGRATE_ON_STARTUP=false` and run migrations as part of deployment process
3. **Testing**: Enable `AUTO_MIGRATE_ON_STARTUP=true` for automated testing environments

## Migration Workflow

1. Make database schema changes in your models
2. Create migration: `flask db migrate -m "description"`
3. Review the generated migration file
4. Apply migration: `flask db upgrade`
5. Test your application

## Troubleshooting

If you encounter migration issues:

1. Check current migration status: `flask db current`
2. Review migration history: `flask db history`
3. Check for pending migrations: `flask db show`
4. Rollback if needed: `flask db downgrade`

## Security Note

Keeping automatic migrations disabled by default prevents:
- Unexpected database schema changes
- Potential data loss from unverified migrations
- Unauthorized database modifications
