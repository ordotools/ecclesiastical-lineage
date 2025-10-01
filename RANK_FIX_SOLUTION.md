# Rank Fix Solution

## Problem
The consecration field is not showing for bishops because the production database has incorrect `is_bishop` values. The local database has the correct values, but the production server (Render) still has the old values.

## Root Cause
The production database on Render has `is_bishop=False` for all ranks, including "Bishop", "Archbishop", "Cardinal", and "Pope". This causes the template to render `data-is-bishop="false"` for these ranks, which prevents the consecration field from showing.

## Solution Options

### Option 1: Run the fix script on Render (Recommended)
1. Go to your Render dashboard
2. Open the shell for your production service
3. Run: `python3 fix_production_ranks_immediately.py`

### Option 2: One-liner fix on Render
1. Go to your Render dashboard
2. Open the shell for your production service
3. Run: `python3 one_liner_fix.py`

### Option 3: Deploy with the updated script
The deployment script has been updated to include the rank fix. The next deployment will automatically fix this issue.

## What the fix does
- Updates all ranks that should be bishops (Bishop, Archbishop, Cardinal, Pope, Patriarch, Metropolitan) to have `is_bishop=True`
- Updates all other ranks to have `is_bishop=False`
- Commits the changes to the production database

## Expected Result
After running the fix:
- The "Bishop" rank will have `data-is-bishop="true"` in the template
- The consecration field will show when a bishop rank is selected
- The form will work correctly for adding consecration information

## Verification
After running the fix, you can verify it worked by:
1. Opening the clergy form
2. Selecting "Bishop" from the rank dropdown
3. The consecration field should now appear

## Files Modified
- `scripts/deploy/deploy_flask_migrate_proper.sh` - Added rank fix to production deployment
- `scripts/database/fix_production_ranks_simple.py` - Simple fix script
- `fix_production_ranks_immediately.py` - Immediate fix script
- `one_liner_fix.py` - One-liner fix script
