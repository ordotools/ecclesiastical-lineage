# Staging Environment Setup Guide

This guide will help you set up a staging environment that mirrors your production data.

## 🎯 Overview

You'll create:
1. **Staging Web Service** - Runs your app from the `staging` branch
2. **Staging Database** - Separate PostgreSQL database for testing
3. **Data Synchronization** - Copy production data to staging

## 📋 Step-by-Step Setup

### Step 1: Create Staging Web Service on Render

1. **Go to [Render Dashboard](https://dashboard.render.com)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name**: `ecclesiastical-lineage-staging`
   - **Branch**: `staging`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `chmod +x deploy_staging.sh && ./deploy_staging.sh`
   - **Environment**: `Python 3.12.11`

### Step 2: Create Staging Database

1. **In Render Dashboard, click "New +" → "PostgreSQL"**
2. **Configure the database:**
   - **Name**: `ecclesiastical-lineage-staging-db`
   - **Database**: `ecclesiastical_lineage_staging`
   - **User**: `ecclesiastical_lineage_staging_user`

### Step 3: Connect Database to Web Service

1. **Go to your staging web service settings**
2. **Add environment variable:**
   - **Key**: `DATABASE_URL`
   - **Value**: Copy the connection string from your staging database

### Step 4: Update Your Local Environment

1. **Get the staging database URL from Render**
2. **Update your `.env` file:**
   ```bash
   # Add this line to your .env file
   STAGING_DATABASE_URL=postgresql://user:pass@host:port/database
   ```

### Step 5: Sync Production Data to Staging

Once both services are running, sync the data:

```bash
# Option 1: Use the automated script
./setup_staging_data.sh

# Option 2: Use the Python script
python3 sync_staging_database.py
```

## 🔄 Your Complete Workflow

### Development Workflow:
1. **Make changes locally**
2. **Test locally** with your local database
3. **Push to `staging` branch** → Auto-deploys to staging
4. **Test on staging** with production data
5. **Push to `main` branch** → Auto-deploys to production

### Database Sync Workflow:
- **Staging → Production**: Never (staging is for testing)
- **Production → Staging**: Run sync script when needed
- **Local → Staging**: Not needed (staging uses production data)

## 🛠️ Useful Commands

### Check Staging Service Status:
```bash
curl -s "https://your-staging-url.onrender.com" | head -10
```

### Sync Data from Production to Staging:
```bash
./setup_staging_data.sh
```

### Check Database Connection:
```bash
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text

# Test staging connection
staging_url = os.environ.get('STAGING_DATABASE_URL')
if staging_url:
    engine = create_engine(staging_url)
    with engine.connect() as conn:
        result = conn.execute(text('SELECT COUNT(*) FROM clergy'))
        count = result.scalar()
        print(f'Staging database: {count} clergy records')
else:
    print('STAGING_DATABASE_URL not set')
"
```

## 🚨 Troubleshooting

### Staging Service Not Loading Data:
1. **Check if staging database is connected**
2. **Verify environment variables are set**
3. **Run the data sync script**
4. **Check Render logs for errors**

### Database Sync Fails:
1. **Ensure both database URLs are correct**
2. **Check that you have `pg_dump` and `psql` installed**
3. **Verify database permissions**

### Staging Service Won't Start:
1. **Check the start command in Render settings**
2. **Verify the `deploy_staging.sh` script is executable**
3. **Check the Render build logs**

## 📊 Environment URLs

After setup, you'll have:
- **Production**: `https://el-production.onrender.com` (main branch)
- **Staging**: `https://ecclesiastical-lineage-staging.onrender.com` (staging branch)
- **Local**: `http://localhost:5001` (development)

## 🔐 Security Notes

- **Never sync staging data to production**
- **Staging database should be separate from production**
- **Use different database credentials for staging**
- **Staging is for testing only**

## 📝 Next Steps

1. **Create the staging services on Render**
2. **Update your `.env` file with staging database URL**
3. **Run the data sync script**
4. **Test your staging environment**
5. **Start using the staging/production workflow**

Your staging environment will be a perfect testing ground with real production data!
