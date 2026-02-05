# Database Sync Setup Guide

For initial dev setup see [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). For schema migrations (Flask-Migrate) see [FLASK_MIGRATE_SETUP.md](FLASK_MIGRATE_SETUP.md). This guide covers **syncing** your local PostgreSQL with the remote database on Render.

## Prerequisites

PostgreSQL 16 and Python env as in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). For sync you also need `RENDER_PG_URL` in `.env` (Render dashboard → PostgreSQL → Connect). Use the same `SECRET_KEY` as Render for consistent sessions.

## Sync options

**Recommended:** Use `./start_dev.sh` (see LOCAL_DEVELOPMENT) for full setup including sync. For manual sync from remote: `./sync_postgres_local.sh` or `./sync_dev_db.sh` (PostgreSQL). Legacy SQLite sync: `sync_local_db.sh` (has conversion limitations).

## Usage

### PostgreSQL Approach (Recommended)

#### Quick Setup:
```bash
./setup_postgres_dev.sh
```

This script:
- Offers choice between syncing from remote or local setup
- Sets up PostgreSQL database with tables and data
- Creates admin user for testing
- Handles all the setup automatically

#### Manual Sync from Remote:
```bash
./sync_postgres_local.sh
```

This script:
- Syncs data from your remote PostgreSQL database to local PostgreSQL
- Uses `pg_dump` and `pg_restore` for reliable data transfer
- Overwrites your local database
- Only use when you want fresh data from production

#### Manual Local Setup:
```bash
python3 init_postgres_db.py
```

This script:
- Creates database tables
- Adds sample data
- Creates admin user

### SQLite Approach (Legacy)

#### For Local Development:
```bash
./dev_setup_local.sh
```

This script:
- Sets up a local SQLite database with sample data
- Creates an admin user for testing
- Does NOT sync from remote database
- Good for simple development

#### For Syncing from Remote:
```bash
./sync_local_db.sh
```

This script:
- Syncs data from your remote PostgreSQL database to local SQLite
- Overwrites your local database
- Has conversion limitations between PostgreSQL and SQLite

## Troubleshooting

### Common Issues and Solutions

#### 1. PostgreSQL Version Mismatch

**Error:**
```
pg_dump: error: server version: 16.9; pg_dump version: 14.18
pg_dump: error: aborting because of server version mismatch
```

**Solution:**
```bash
# Install PostgreSQL 16 client tools
brew install postgresql@16

# Update the script to use the correct pg_dump version
# The script now uses: /opt/homebrew/opt/postgresql@16/bin/pg_dump
```

#### 2. psycopg2-binary Installation Issues

**Error:**
```
Error: pg_config executable not found.
```

**Solution:**
```bash
# Install PostgreSQL development libraries
brew install postgresql

# Or downgrade Python to 3.12/3.11
pyenv install 3.12.3
pyenv shell 3.12.3
python -m venv env
```

#### 3. Missing Environment Variables

**Error:**
```
Error: RENDER_PG_URL environment variable not set.
```

**Solution:**
- Ensure your `.env` file exists and contains `RENDER_PG_URL`
- Check that the script is loading the `.env` file correctly
- Verify the URL format is correct

#### 4. Empty Database After Sync

**Symptom:** Database file is 0 bytes or tables are empty

**Possible Causes:**
- Remote database is empty (normal for new databases)
- Data import failed due to parsing errors
- Tables don't exist in local database

**Solution:**
- Check if remote database has data: `pg_dump --data-only | grep "INSERT INTO"`
- Ensure database tables are initialized before data import
- Add sample data locally for testing

#### 5. pgloader Compatibility Issues

**Error:**
```
ESRAP-PARSE-ERROR: Expected the string "pgsql" or "postgres" or "postgresql"
```

**Solution:**
- `pgloader` is designed for PostgreSQL-to-PostgreSQL migrations
- Use the current approach with `pg_dump` + Python script instead

## File Structure

```
ecclesiastical-lineage/
├── .env                          # Environment variables (not in git)
├── sync_local_db.sh              # Main sync script
├── init_db.py                    # Database initialization
├── app.py                        # Flask application
├── requirements.txt              # Python dependencies
└── instance/
    └── ecclesiastical_lineage.db # Local SQLite database
```

## Security Notes

- **Never commit `.env` file** to version control
- The sync script **only reads** from remote database
- **Always confirm** before overwriting local database
- Use **read-only database user** on Render if possible

## Development Workflow

1. **Develop locally** with Flask app using SQLite
2. **When you need fresh data** from production: `./sync_local_db.sh`
3. **Local database gets overwritten** with fresh copy from remote
4. **Continue development** with production-like data
5. **Repeat as needed** when remote data changes

## Maintenance

### Regular Tasks

- **Update PostgreSQL client tools** when remote server version changes
- **Test sync script** after major database schema changes
- **Backup local database** before syncing if you have important local changes
- **Monitor sync script performance** for large datasets

### Script Updates

The sync script may need updates when:
- Database schema changes
- New dependencies are added
- Python version changes
- PostgreSQL version changes

## Support

If you encounter issues not covered in this guide:

1. Check the error messages carefully
2. Verify all prerequisites are installed
3. Test individual components (pg_dump, Python script, etc.)
4. Check Render database connectivity
5. Review this troubleshooting guide

---

**Last Updated:** July 18, 2025  
**Script Version:** 1.0  
**Tested with:** PostgreSQL 16.9, Python 3.13, macOS 