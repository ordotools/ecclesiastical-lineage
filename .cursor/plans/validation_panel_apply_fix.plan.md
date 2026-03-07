---
name: Validation panel apply fix
overview: "The Validation Status panel reports 'No validity changes to apply' because ordination/consecration records in the clergy list JSON lack an id field; the frontend needs that id to build the bulk-update payload."
todos:
  - id: add-ordination-id
    content: In routes/editor.py clergy_list_panel(), add 'id': ordination.id to each ordinations_data dict
    status: pending
  - id: add-consecration-id
    content: In routes/editor.py clergy_list_panel(), add 'id': consecration.id to each consecrations_data dict
    status: pending
  - id: verify-apply-flow
    content: Manually verify Apply to all affected sends non-empty changes and backend returns updated_count > 0
    status: pending
isProject: false
---

# Fix Validation Status panel not applying changes

## Root cause

- **Backend** ([routes/editor.py](routes/editor.py) ~lines 142–170): The clergy-list endpoint builds `ordinations_data` and `consecrations_data` but **does not include `id`** for each ordination/consecration. So `window.clergyListData` has ordination/consecration objects without an `id` property.
- **Frontend** ([static/js/editor-validation-impact.js](static/js/editor-validation-impact.js) ~1901–1932): `applyBulkChanges()` builds a `changes` array from `impact.descendants` and each event's `evt.record`. It pushes a change only when `evt.record.id` is a finite number. Because `record.id` is always undefined, no changes are ever pushed, so `changes.length === 0` and the user sees "No validity changes to apply for the selected descendants."
- **Bulk-update API** ([routes/editor.py](routes/editor.py) ~262–267) correctly expects `change.id` (ordination/consecration ID); the missing piece is the client never having those IDs.

## Change

**File: [routes/editor.py](routes/editor.py)**

1. In `clergy_list_panel()`, when building each ordination/consecration dict, add the record's primary key:
   - In the loop over `clergy.ordinations` (~line 146): add `'id': ordination.id` to the dict passed to `ordinations_data.append(...)`.
   - In the loop over `clergy.consecrations` (~line 161): add `'id': consecration.id` to the dict passed to `consecrations_data.append(...)`.

## Verification

Reload the editor, open a clergy with descendants that have validity violations, ensure "Update this clergy" rows show and checkboxes are selected, then click "Apply to all affected." The request body should contain a non-empty `changes` array with `type`, `id`, and `new_validity`; the backend should return 200 with `updated_count` > 0.
