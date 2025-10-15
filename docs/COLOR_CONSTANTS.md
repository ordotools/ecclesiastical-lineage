# Color Constants Configuration

## Overview

This application uses a centralized color constant system to ensure consistency across all visualizations (lineage graph, editor visualization, etc.). All lineage-related colors are defined in a single location and automatically propagate throughout the application.

## How to Change Colors

To change the lineage visualization colors across the entire application, you only need to update **TWO files**:

### 1. JavaScript Constants (Frontend)

**File:** `static/js/constants.js`

```javascript
// Color constants - these must match the backend colors
export const GREEN_COLOR = '#11451e';  // Dark green for consecration links
export const BLACK_COLOR = '#1c1c1c';  // Dark gray/black for ordination links
```

### 2. Python Constants (Backend)

**File:** `constants.py` (in root directory)

```python
# Lineage visualization colors
# These must match the values in static/js/constants.js
GREEN_COLOR = '#11451e'  # Dark green for consecration links
BLACK_COLOR = '#1c1c1c'  # Dark gray/black for ordination links
```

### Important Notes

- **Keep both files in sync!** The values in both files must match exactly.
- After changing colors, restart the Flask server for backend changes to take effect.
- Frontend changes (JS file) may require a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

## Color Usage Throughout Application

### Backend (Python)
- `routes/main.py` - Lineage visualization endpoint
- `routes/editor.py` - Editor visualization endpoint
- Both import from `constants.py`

### Frontend (JavaScript)
- `static/js/constants.js` - Source of truth for JS
- `static/js/core.js` - Main lineage visualization (imports from constants.js)
- `static/js/editor-visualization.js` - Editor panel visualization (reads CSS variables)

### Templates (HTML)
- `templates/lineage_visualization.html` - Sets CSS variables from JS constants
- `templates/editor.html` - Sets CSS variables from JS constants

### CSS
- `static/css/visualizer.css` - Uses CSS variables with fallbacks
- All CSS uses `var(--lineage-green)` and `var(--lineage-black)`

## Technical Implementation

1. **JavaScript constants** are defined in `constants.js` and exported as ES6 modules
2. **Python constants** are defined in `constants.py` and imported by route handlers
3. **CSS variables** (`--lineage-green`, `--lineage-black`) are dynamically set from JS constants on page load
4. **Link data** includes color values from Python constants
5. **Arrowhead markers** are created based on color constants in JavaScript
6. **Comparison logic** matches link colors to constants to select correct arrowhead style

## Color Meaning

- **GREEN_COLOR** (`#11451e` - dark green): Used for consecration relationships
- **BLACK_COLOR** (`#1c1c1c` - dark gray): Used for ordination relationships

Co-consecrations use GREEN_COLOR with dashed lines to indicate secondary consecrators.

## Testing Changes

After updating colors, verify they appear correctly in:

1. **Lineage Visualization** (`/`) - Main graph view
2. **Editor Visualization** (`/editor`) - Right panel graph
3. **Link arrows** - Both line color and arrowhead color should match
4. **CSS toggles/buttons** - Any UI elements using lineage colors

## Troubleshooting

**If colors don't match between arrows and lines:**
- Verify both `constants.py` and `constants.js` have identical values
- Check browser console for JavaScript errors
- Hard refresh the page to clear cached JS files
- Restart Flask server to reload Python constants

**If colors don't update:**
- Clear browser cache
- Check that CSS variables are being set (inspect element → :root)
- Verify JS module imports are working (no 404 errors in console)

