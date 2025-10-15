# ELK Layout Removal Summary

## Overview

Removed all ELK (Eclipse Layout Kernel) visualization code from `static/js/core.js` to simplify the codebase and focus solely on the D3 force-directed layout.

## What Was Removed

### Functions Deleted
1. **`toggleELKLayout()`** - Toggle function for switching between layouts
2. **`isELKEnabled()`** - Status check function
3. **`computeLayeredLayout()`** - ~217 lines of ELK layout computation logic
4. **`renderOrthogonalLinks()`** - ~52 lines of orthogonal link rendering for ELK

### Variables Removed
- `layoutMode` - Layout mode selector variable
- `elk` - ELK instance variable
- `elkEnabled` - Toggle state variable

### Conditional Logic Removed
- All `if (layoutMode === 'layered')` branches
- All `if (layoutMode === 'force')` branches  
- ELK viewBox calculations
- Layered layout node positioning
- Orthogonal link routing logic

## Code Statistics

- **Before**: 964 lines
- **After**: 501 lines
- **Removed**: 463 lines (~48% reduction)

## Benefits

✅ **Simpler codebase** - Single layout algorithm instead of two competing approaches  
✅ **Less complexity** - No layout mode switching or conditional logic  
✅ **Easier maintenance** - Fewer code paths to test and debug  
✅ **Faster loading** - No ELK library initialization or computation  
✅ **Cleaner code** - Focused on one well-tuned force layout  

## What Remains

The file now contains only:
- D3 force-directed layout with clustering optimizations
- Bishop-specific repulsion forces
- Parallel link handling
- Timeline constraints
- Standard drag, zoom, and pan interactions
- Filter integration (priests, backbone)

## Force Layout Features Retained

The force layout includes:
- **Clustering forces** - Nodes naturally group together
- **Bishop repulsion** - Bishops spread out for better visibility
- **Radial layout** - Subtle radial positioning
- **Collision detection** - Nodes don't overlap
- **Link distance optimization** - Set to 80px for tight clustering
- **Charge strength** - -200 for moderate repulsion
- **Center force** - Keeps graph centered
- **Velocity/alpha decay** - Smooth convergence

## Testing Checklist

- [x] No linter errors
- [x] No ELK references in code (grep confirmed 0 matches)
- [ ] Test visualization loads correctly
- [ ] Test drag and drop works
- [ ] Test zoom and pan work
- [ ] Test filters work (priests, backbone)
- [ ] Test center/reset buttons work
- [ ] Test window resize adapts correctly

## Future Considerations

If you ever want to add ELK back:
- The removed code is preserved in git history
- Would need to re-add ELK library CDN link in templates
- Would need to restore toggle UI elements
- Commit hash before removal: [check git log]

## Files Modified

1. **`static/js/core.js`** - Main changes (removed 463 lines)
   - Removed all ELK layout computation logic
   - Removed orthogonal link rendering
   - Removed layout mode switching
   - Simplified to force layout only

2. **`static/js/filters.js`** - Removed ELK UI handlers
   - Removed ELK toggle event listeners
   - Removed syncELKLayoutFilters function
   - Removed ELK control element references

## Files NOT Modified (Already Commented Out)

- `templates/lineage_visualization.html` - ELK toggle UI already commented out (lines 115-128, 215-229)
  - Mobile toggle: `elk-layout-toggle-mobile` (commented)
  - Desktop toggle: `elk-layout-toggle` (commented)

## Verification

✅ No linter errors  
✅ Zero ELK references in JavaScript code (only explanatory comments remain)  
✅ No broken function calls  
✅ Clean removal with no dangling references

