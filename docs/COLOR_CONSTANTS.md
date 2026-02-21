# Color Constants Configuration

## Overview

This application uses a centralized color constant system to ensure consistency across all visualizations (lineage graph, editor visualization, etc.). All lineage-related colors are defined in a single location and automatically propagate throughout the application.

**Locked colors (plan):**
- **Consecration/bishop green:** `#0b9f2f`
- **Background/surface:** `#1a1a1a`

## How to Change Colors

To change the lineage visualization colors across the entire application, you only need to update **TWO files** (and keep CSS/API defaults in sync):

### 1. JavaScript Constants (Frontend)

**File:** `static/js/constants.js`

```javascript
// Color constants - these must match the backend colors
export const GREEN_COLOR = '#0b9f2f';  // Consecration/bishop green (locked)
export const BLACK_COLOR = '#0d0d0d';  // Dark gray/black for ordination links
```

### 2. Python Constants (Backend)

**File:** `constants.py` (in root directory)

```python
# Lineage visualization colors
# These must match the values in static/js/constants.js
GREEN_COLOR = '#0b9f2f'  # Consecration/bishop green (locked)
BLACK_COLOR = '#0d0d0d'  # Dark gray/black for ordination links
```

### 3. Shared visualization CSS

**File:** `static/css/visualization-dynamic.css`

- `--viz-link-consecration-color`: `#0b9f2f`
- `--viz-arrow-consecration-color`: same as link consecration
- `--viz-surface`: `#1a1a1a` (graph background)

### Important Notes

- **Keep both files in sync!** The values in both files must match exactly.
- After changing colors, restart the Flask server for backend changes to take effect.
- Frontend changes (JS file) may require a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).
- Defaults in `static/js/visualization-styles-loader.js`, `routes/editor_visualization_api.py`, and editor style panel should use the same consecration green and surface values.

## Color Usage Throughout Application

### Backend (Python)
- `routes/main.py` - Lineage visualization endpoint
- `routes/editor.py` - Editor visualization endpoint
- `routes/editor_visualization_api.py` - Styles API (default_styles use GREEN_COLOR)
- All import from `constants.py`

### Frontend (JavaScript)
- `static/js/constants.js` - Source of truth for JS
- `static/js/core.js` - Main lineage visualization (imports from constants.js)
- `static/js/editor-visualization.js` - Editor panel visualization (reads CSS variables, fallback green)
- `static/js/visualization-styles-loader.js` - Sets --viz-* and --viz-surface from API/defaults
- `static/js/wiki-lineage-chart.js` - Uses GREEN constant

### Templates (HTML)
- `templates/main_viz.html` - Sets CSS variables from JS constants
- `templates/editor.html` - Sets CSS variables from JS constants

### CSS
- `static/css/visualization-dynamic.css` - `--viz-surface`, `--viz-link-consecration-color`, etc.
- `static/css/visualizer.css` - Editor and chapel_view only; uses `var(--lineage-green, #0b9f2f)` and related fallbacks (main page uses main-ui.css + force-directed)

## Technical Implementation

1. **JavaScript constants** are defined in `constants.js` and exported as ES6 modules
2. **Python constants** are defined in `constants.py` and imported by route handlers
3. **CSS variables** (`--lineage-green`, `--lineage-black`, `--viz-surface`, `--viz-link-consecration-color`) are set from JS constants on page load or from the styles API
4. **Link data** includes color values from Python constants
5. **Arrowhead markers** are created based on color constants in JavaScript
6. **Surface/background** is fixed at `#1a1a1a` in visualization-dynamic.css and in the styles loader/API defaults

## Color Meaning

- **GREEN_COLOR** (`#0b9f2f`): Used for consecration relationships (locked)
- **BLACK_COLOR** (`#0d0d0d`): Used for ordination relationships
- **Surface** (`#1a1a1a`): Graph/viz background (locked)

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
