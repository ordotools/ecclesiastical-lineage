# Image Upload Fixes

## Issues Fixed

### 1. Double Prompt Issue
**Problem**: When accessing the image uploader from the lineage visualization, it prompted twice for file selection.

**Root Cause**: Event listeners were being attached multiple times without properly removing existing ones, causing duplicate event handlers.

**Solution**: 
- Modified `reattachFormEventListeners()` in `imageEditor.js` to properly remove existing event listeners before adding new ones
- Used element cloning technique to completely remove all event listeners from buttons
- Prevented duplication by using only the image editor's own method instead of the separate `attachImageEditorEventListeners()` function

### 2. Apply & Save Button Not Working
**Problem**: After cropping an image, the "Apply & Save" button did not work properly.

**Root Cause**: Modal stacking issues when the image editor modal was opened from within the clergy form modal, causing improper cleanup and focus management.

**Solution**:
- Enhanced modal cleanup in the `applyChanges()` method
- Added proper parent modal restoration after image editor modal closes
- Added debugging logs to help identify cropper initialization issues
- Improved error handling and modal state management

## Files Modified

1. **`static/js/imageEditor.js`**:
   - Fixed `reattachFormEventListeners()` to properly remove existing listeners
   - Enhanced `applyChanges()` method with better modal cleanup
   - Added debugging logs for cropper initialization and apply process

2. **`static/js/modals.js`**:
   - Replaced `attachImageEditorEventListeners()` calls with `reattachFormEventListeners()` to avoid duplication
   - Improved event listener management

## Testing

A test script `test_image_upload_fix.py` has been created to verify the fixes work correctly. The script:
- Opens the lineage visualization page
- Clicks on a clergy node to open the aside panel
- Opens the edit modal
- Tests the image upload button to ensure it only prompts once
- Checks for JavaScript errors

## Expected Behavior After Fixes

1. **Single File Prompt**: Clicking the upload button should only open the file dialog once
2. **Working Apply & Save**: After cropping an image, the "Apply & Save" button should work correctly
3. **Proper Modal Management**: The image editor modal should close properly and return focus to the parent modal
4. **No JavaScript Errors**: The console should be free of errors related to event listener duplication

## Memory References

The fixes align with the user's preferences for:
- Placing JavaScript files in a separate `/js` directory [[memory:8106243]]
- Using HTMX for dynamic functionality [[memory:3756505]]
