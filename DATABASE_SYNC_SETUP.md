# Database Sync Setup Guide

This guide documents the setup process for syncing your local SQLite database with the remote PostgreSQL database on Render for development purposes.

## Overview

This guide covers two approaches for syncing your local development environment with your remote PostgreSQL database on Render:

### **SQLite Approach (Original)**
- Uses `sync_local_db.sh` to sync from remote PostgreSQL to local SQLite
- Good for simple development, but has conversion limitations

### **PostgreSQL Approach (Recommended)**
- Uses `sync_postgres_local.sh` to sync from remote PostgreSQL to local PostgreSQL
- More reliable, same database type as production
- Better compatibility and performance
- Uses the same SECRET_KEY as production for consistent sessions

## Prerequisites

### 1. Install Required Tools

#### For SQLite Approach:
```bash
# Install PostgreSQL 16 client tools (to match remote server version)
brew install postgresql@16

# Install pgloader (for future reference, though not used in final solution)
brew install pgloader
```

#### For PostgreSQL Approach (Recommended):
```bash
# Install PostgreSQL 16 client tools and server
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16
```

### 2. Python Environment Setup

Ensure you have a virtual environment with the required dependencies:

```bash
# Create virtual environment (if not already done)
python3 -m venv env

# Activate virtual environment
source env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Note:** If you encounter `psycopg2-binary` installation issues with Python 3.13, consider downgrading to Python 3.12 or 3.11, as `psycopg2-binary==2.9.7` doesn't support Python 3.13 yet.

## Configuration

### 1. Environment Variables

Create a `.env` file in your project root:

#### For SQLite Approach:
```bash
# Flask configuration
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///ecclesiastical_lineage.db

# Remote PostgreSQL connection for syncing local database
RENDER_PG_URL=postgresql://your_user:your_password@your_host:your_port/your_database
```

#### For PostgreSQL Approach (Recommended):
```bash
# Flask configuration
# Use the same SECRET_KEY as your Render instance for consistent sessions
SECRET_KEY=your-render-secret-key-here
DATABASE_URL=postgresql://localhost:5432/ecclesiastical_lineage_dev

# Remote PostgreSQL connection for syncing local database
RENDER_PG_URL=postgresql://your_user:your_password@your_host:your_port/your_database
```

**To get your Render SECRET_KEY:**
1. Go to your Render dashboard
2. Navigate to your web service
3. Go to "Environment" tab
4. Copy the `SECRET_KEY` value

### 2. Get Your Render PostgreSQL URL

1. Go to your Render dashboard
2. Navigate to your PostgreSQL database
3. Click on "Connect" or "External Database URL"
4. Copy the connection string

The URL format will be:
```
postgresql://username:password@hostname:port/database_name
```

## How the Sync Script Works

The `sync_local_db.sh` script performs the following steps:

1. **Loads environment variables** from `.env` file
2. **Prompts for confirmation** before overwriting local database
3. **Removes old local database** if it exists
4. **Initializes database tables** using Flask-SQLAlchemy models
5. **Exports data** from remote PostgreSQL using `pg_dump`
6. **Imports data** into local SQLite using a Python script
7. **Cleans up** temporary files

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

### Starting the Development Server

```bash
source env/bin/activate && python3 app.py --port 5001
```

**Note:** We use port 5001 to avoid conflicts with macOS AirPlay service on port 5000.

### Adding Sample Data (Optional)

If you want to add sample data to your local database for testing:

```bash
source env/bin/activate
python3 init_db.py
```

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