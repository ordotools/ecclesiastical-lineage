# Quick Guide: Changing Lineage Colors

## Step 1: Update JavaScript Constants

**File:** `static/js/constants.js`

Find and update these lines:
```javascript
export const GREEN_COLOR = '#11451e';  // Dark green for consecration links
export const BLACK_COLOR = '#1c1c1c';  // Dark gray/black for ordination links
```

## Step 2: Update Python Constants

**File:** `constants.py` (in root directory)

Find and update these lines:
```python
GREEN_COLOR = '#11451e'  # Dark green for consecration links
BLACK_COLOR = '#1c1c1c'  # Dark gray/black for ordination links
```

## Step 3: Apply Changes

1. Save both files
2. Restart Flask server
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

## That's It!

Colors will now be updated across:
- Main lineage visualization
- Editor panel visualization
- All link arrows and arrowheads
- CSS variables used throughout the UI

---

**Note:** Both files must have identical color values, or you'll see mismatches between links and arrowheads.

For detailed documentation, see `docs/COLOR_CONSTANTS.md`

