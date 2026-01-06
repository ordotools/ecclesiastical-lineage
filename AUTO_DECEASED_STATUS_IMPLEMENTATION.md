# Auto-Deceased Status Implementation

## Overview
Implemented automatic toggling of the "deceased" status indicator when a clergy member has a date of death entered in the form.

## What Was Implemented

### 1. Status Indicators in Form
Both clergy form templates now include status indicator toggles:
- **File**: `templates/_clergy_form.html` (lines 299-325)
- **File**: `templates/clergy_form_content.html` (lines 179-207)

The status indicators section displays all available statuses with:
- Checkbox toggles for each status
- FontAwesome icons with color coding
- Automatic pre-selection of clergy's existing statuses in edit mode

### 2. Auto-Deceased Functionality

#### JavaScript Implementation
Added JavaScript code that automatically manages the "deceased" status based on the date of death field:

**In `templates/_clergy_form.html`** (lines 622-660):
- Listens to changes on the `date_of_death` input field
- Automatically checks "deceased" status when a death date is entered
- Automatically unchecks "deceased" status when death date is removed
- Runs on page load to check existing data

**In `templates/clergy_form_content.html`** (lines 798-840):
- Same functionality for the editor panel form
- Ensures consistency across all form contexts

### 3. Backend Support

#### Models (`models.py`)
- `Status` model with fields: id, name, description, icon, color, badge_position (line 247)
- `clergy_statuses` association table for many-to-many relationship (line 239)
- `Clergy.statuses` relationship defined (line 102)

#### Services (`services/clergy.py`)
- Status handling in `create_clergy_from_form()` (lines 126-136)
- Status updating in `edit_clergy()` route (lines 614-624)
- Helper function `update_clergy_statuses()` (lines 1036-1059)

#### Routes
- `clergy_form_content()` endpoint passes statuses to form (line 300 in `routes/editor.py`)
- Status IDs retrieved from form submission via `getlist('status_ids[]')`

### 4. Database Migration
**File**: `migrations/versions/c8646ef3459c_add_clergy_status_system.py`

Defines 9 initial statuses including:
- **deceased** (line 120-126):
  - Icon: `fa-cross`
  - Color: `#34495e` (dark gray)
  - Badge position: 6
  - Description: "Deceased"

Other statuses: invalid, doubtful, not recommended, unknown, forbidden, pending, retired, resigned

### 5. Visualization Support
**File**: `static/js/statusBadges.js`

Module for rendering status badges around nodes in the lineage visualization:
- `renderStatusBadges()` - Renders badges using D3.js
- `calculateBadgePosition()` - Places badges around node perimeter
- Includes hover effects and tooltips

## How It Works

### User Experience
1. User opens clergy form (add or edit mode)
2. When user enters a date in the "Date of Death" field:
   - JavaScript automatically checks the "deceased" status checkbox
   - Console logs confirmation: "Auto-checked deceased status due to date of death: [date]"
3. When user removes the death date:
   - JavaScript automatically unchecks the "deceased" status checkbox
   - Console logs: "Auto-unchecked deceased status (no date of death)"
4. User can still manually toggle any status including deceased
5. On form submission, all selected statuses are saved to the database

### Technical Flow
```
Date of Death Input Change
    ↓
Event Listener Triggered (change/input)
    ↓
updateDeceasedStatus() Function
    ↓
Find "deceased" status checkbox by label text
    ↓
Check/Uncheck based on death date presence
    ↓
Form Submission
    ↓
Backend receives status_ids[]
    ↓
Database updated via clergy.statuses relationship
```

## Testing Checklist

### Manual Testing Steps
1. ✅ Open clergy form in add mode
2. ✅ Enter a date of death → Verify "deceased" is auto-checked
3. ✅ Clear date of death → Verify "deceased" is auto-unchecked
4. ✅ Open existing clergy in edit mode with death date → Verify "deceased" is checked on load
5. ✅ Open existing clergy without death date → Verify "deceased" is not checked
6. ✅ Save form with statuses → Verify statuses persist in database
7. ✅ Manually uncheck deceased with death date → Verify user override works
8. ✅ Check multiple statuses → Verify all are saved correctly

### Browser Console Verification
Look for these log messages:
- "✅ Auto-deceased status listener attached"
- "Auto-checked deceased status due to date of death: [date]"
- "Auto-unchecked deceased status (no date of death)"

### Database Verification
```sql
-- Check status table
SELECT * FROM status WHERE name = 'deceased';

-- Check clergy statuses
SELECT c.name, s.name as status_name, c.date_of_death
FROM clergy c
JOIN clergy_statuses cs ON c.id = cs.clergy_id
JOIN status s ON cs.status_id = s.id
WHERE s.name = 'deceased';
```

## Files Modified

1. `templates/_clergy_form.html` - Added auto-deceased JavaScript
2. `templates/clergy_form_content.html` - Added auto-deceased JavaScript
3. (Already existed) `models.py` - Status model and relationships
4. (Already existed) `services/clergy.py` - Status handling
5. (Already existed) `migrations/versions/c8646ef3459c_add_clergy_status_system.py` - Database schema

## Files Created

1. `static/js/statusBadges.js` - Status badge rendering for visualization (already existed)

## Future Enhancements

1. **Automatic Status Inference**: Could add similar auto-logic for other statuses:
   - Auto-check "retired" if clergy is over certain age and has end date
   - Auto-suggest "pending" for newly added clergy
   
2. **Status History**: Track when statuses were added/removed (using `created_at` and `created_by` in `clergy_statuses` table)

3. **Status Conflicts**: Add validation to prevent conflicting statuses (e.g., deceased + active)

4. **Bulk Status Updates**: Add ability to apply statuses to multiple clergy at once

## Notes

- The auto-deceased feature is a convenience that can be overridden by users
- Deceased status is purely informational and doesn't affect lineage calculations
- All status changes are tracked with timestamps in the `clergy_statuses` table
- The JavaScript uses a robust selector to find the deceased checkbox by label text, making it language-agnostic

