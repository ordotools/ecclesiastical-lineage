---
name: Batch update inherited checkbox
overview: When batch-updating clergy validity from the validation status panel ("Apply to all affected"), ensure a downgrade to invalid/doubtfully valid sets and shows "Inherited" checked. Backend already sets is_inherited; include root's own violating events in the apply list so the visible form updates.
todos:
  - id: verify-backend-inherited
    content: In routes/editor.py validation_impact_bulk_update, confirm record.is_inherited is set when new_validity is invalid/doubtfully_valid (True) or valid (False); add if missing
    status: completed
  - id: expose-root-violating-events
    content: In editor-validation-impact.js, extend impact/panel data so root clergy's own ordination/consecration events with isAllowed === false and targetValidity are available (e.g. from eventImpactsByChildId.get(rootId) or evaluateCascadeImpact)
    status: completed
  - id: include-root-in-changes
    content: In applyBulkChanges (editor-validation-impact.js), when building the changes array, add root's violating events with same shape { type, id, new_validity } so root form can be updated
    status: completed
  - id: refresh-after-apply
    content: Ensure after bulk-update success we call refreshClergyFormSmooth(refreshedRootId) so root form reloads with updated validity and Inherited (already present; verify)
    status: completed
  - id: verify-db-and-ui
    content: Manually verify Apply to all affected sets is_inherited in DB for updated records and form shows Inherited checked for root and descendants
    status: pending
isProject: false
---

# Batch-update "Inherited" not checked from validation panel

## Current behavior

- **Validation Impact panel** ("Apply to all affected") builds a `changes` list only from **descendants** ([editor-validation-impact.js](static/js/editor-validation-impact.js): `impact.descendants` → events with `evt.isAllowed === false` and `evt.targetValidity` → POST to `/editor/api/validation-impact/bulk-update`).
- **Backend** ([routes/editor.py](routes/editor.py) `validation_impact_bulk_update`) already sets `record.is_inherited = True` when `new_validity in ('invalid', 'doubtfully_valid')` and `record.is_inherited = False` when `new_validity == 'valid'` (lines 294–297). So persisted data for **updated** records is correct.
- After apply, the frontend refreshes only the **root** clergy form (`refreshClergyFormSmooth(refreshedRootId)`). The root’s own ordination/consecration events are **not** in `impact.descendants` (descendants are from BFS starting at root, so root is excluded). So:
  - If the user expected the **root’s** form to show "Inherited" after a downgrade, that never happens because the root’s own violating events are never sent in the bulk update.
  - For **descendants**, records are updated and `is_inherited` is set in the DB; when the user later opens that descendant, the form loads from the server and should show the checkbox (form template in [clergy_form_content.html](templates/clergy_form_content.html) sets `isInheritedInput.checked = !!ordination.is_inherited` / consecration equivalent).

## Likely causes of "inherited not checked"

1. **Root’s own events not in apply list** – The only form visible after "Apply to all affected" is the root’s. The root’s own violating events (e.g. root’s consecration should be downgraded) are never added to `changes`, so the root form never gets those updates and "Inherited" never appears for the root’s entries.
2. **Backend not in use** – If the codebase the user runs doesn’t have the `is_inherited` assignment in `validation_impact_bulk_update`, then even descendant updates wouldn’t set it (add/verify that block).
3. **Form refresh / sync** – After HTMX form load, `syncValidityExtraForEntry` and population must run so the validity-extra block (including "Inherited") is visible and checked; this is already wired in [clergy_form_content.html](templates/clergy_form_content.html) and [clergy-form-validity-extra.js](static/js/clergy-form-validity-extra.js).

## Recommended changes

### 1. Confirm backend sets `is_inherited` on bulk-update (required)

In [routes/editor.py](routes/editor.py), in `validation_impact_bulk_update`, ensure that for each applied change:

- If `new_validity in ('invalid', 'doubtfully_valid')`: set `record.is_inherited = True`.
- If `new_validity == 'valid'`: set `record.is_inherited = False`.

This block already exists at lines 294–297; if the user’s branch doesn’t have it, add it so batch-update always flips `is_inherited` with the validity change.

### 2. Include root’s own violating events in "Apply to all affected" (recommended)

So that the **root** clergy’s form (the one visible after apply) can show updated validity and "Inherited" without opening another record:

- In [static/js/editor-validation-impact.js](static/js/editor-validation-impact.js), when building `changes` in `applyBulkChanges` (or the function that builds the payload):
  - Keep building changes from `impact.descendants` as today.
  - **Also** compute the root’s own ordination/consecration events that have `isAllowed === false` and `targetValidity` (using the same logic as for descendants, but for `rootId`). If the panel’s data structure doesn’t currently expose "root events", extend `evaluateCascadeImpact` (or the code that builds the list for the panel) to include the root’s violating events in a structure that can be iterated when building `changes`.
- Add those root events to `changes` with the same shape: `{ type, id: eventId, new_validity }`.
- Ensure the "Include all affected" selection (e.g. select-all checkbox) is defined so that including "root" in the apply set is clear (e.g. root is always included when their events are in the list, or a separate "Include root" option).

After this, when the user clicks "Apply to all affected", the root’s own downgraded events are updated in the DB (with `is_inherited` set by the backend), and the subsequent `refreshClergyFormSmooth(refreshedRootId)` will reload the root form with the new validity and "Inherited" checked.

### 3. Optional: refresh form when current clergy is in `affected_clergy_ids`

Today we always refresh the root. If in the future the UI can show a different clergy’s form (e.g. a selected descendant), then after bulk-update, if the currently selected clergy ID is in `data.affected_clergy_ids`, refresh that clergy’s form so the user sees the updated "Inherited" without re-opening. For the current "single form = root" design, no change is required once (2) is done.

## Files to touch

- [routes/editor.py](routes/editor.py): Verify/add `is_inherited` assignment in `validation_impact_bulk_update` (lines 294–297).
- [static/js/editor-validation-impact.js](static/js/editor-validation-impact.js): Include root’s violating events in the `changes` array (and, if needed, extend impact computation to expose root events with `targetValidity` / `isAllowed === false`).

## Verification

- Apply "Apply to all affected" with at least one descendant (and, after (2), with the root having a violating event). Confirm in DB that updated ordination/consecration rows have `is_inherited = true` when `new_validity` was invalid/doubtfully_valid.
- Open an affected clergy (root after (2), or a descendant). Confirm the form shows the correct validity and "Inherited" checked for the downgraded entries.
- After apply, confirm the root form refresh shows updated validity and "Inherited" for the root’s own entries when they were included in the apply list.
