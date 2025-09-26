# Force Merge Deployment Guide

This guide explains how to deploy the force merge of scraped data to Render.

## 🎯 What This Does

- Deletes all existing relationships (ordinations, consecrations, co-consecrators)
- Imports all 97 links from `advanced_scraped_data.json`
- Ensures data consistency between scraped data and database

## 🚀 Deployment Steps

### Step 1: Commit Files to Git

```bash
# Add the new files
git add force_merge_scraped_data.py
git add run_force_merge_on_render.py
git add deploy_force_merge.sh
git add advanced_scraped_data.json

# Commit the changes
git commit -m "Add force merge scripts for scraped data"

# Push to your branch
git push origin staging  # or main for production
```

### Step 2: Deploy to Render

The deployment will automatically run the force merge because it's now included in `deploy_with_migration.sh`.

**For Staging:**
- Push to `staging` branch
- Render will automatically deploy and run the force merge

**For Production:**
- Push to `main` branch (or your production branch)
- Render will automatically deploy and run the force merge

### Step 3: Verify Deployment

After deployment, check the Render logs to see:
```
🔄 Force merging scraped data...
✅ Force merge of scraped data completed!
```

## 📊 Expected Results

After successful deployment, you should have:
- **27 ordination relationships**
- **70 consecration relationships**
- **0 co-consecration relationships**
- **Total: 97 relationships** (matching the scraped data)

## 🔍 Verification

You can verify the deployment worked by:
1. Checking the lineage visualization on your site
2. Looking at the Render logs for success messages
3. Running a database query to count relationships

## 🛡️ Safety Features

- **Automatic backup**: The script creates backups before making changes
- **Error handling**: If anything fails, the database is rolled back
- **Verification**: The script verifies the import was successful

## 🚨 Important Notes

- This is a **one-time operation** - it will only run during deployment
- All existing relationships will be **permanently deleted**
- The scraped data will **completely replace** the current relationships
- Make sure `advanced_scraped_data.json` is up-to-date before deploying

## 🔄 Rollback (If Needed)

If something goes wrong, you can rollback by:
1. Restoring from a database backup
2. Reverting the git commit
3. Redeploying the previous version

## 📝 Files Modified

- `deploy_with_migration.sh` - Added force merge step
- `run_force_merge_on_render.py` - New script for Render deployment
- `force_merge_scraped_data.py` - Main force merge script
- `deploy_force_merge.sh` - Local deployment script (optional)
