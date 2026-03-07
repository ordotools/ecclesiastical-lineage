---
name: Inherited Other Validity Fix
overview: The "Inherited" and "Other" block visibility can stay wrong when status-inheritance changes the validity dropdown or when sync runs in the wrong order. Sync block visibility from status-inheritance and after refreshFormRestrictions.
todos:
  - id: sync-after-restrictions
    content: In status-inheritance.js applyValidityRestrictions, after updating the dropdown and setEntryNotice, call window.syncValidityExtraForEntry(entryElement) when defined
    status: completed
  - id: sync-after-refresh
    content: After refreshFormRestrictions completes (all entries processed), run syncValidityExtraForEntry on every .ordination-entry and .consecration-entry in the form
    status: completed
  - id: verify-script-runs
    content: Confirm clergy_form_content inline script runs when loaded via HTMX; if not, move syncValidityExtraForEntry and change delegation to a global script
    status: completed
  - id: verify-ui
    content: Manually verify invalid/doubtfully valid entries show Inherited/Other block; changing validity and bishop selection keeps block in sync
    status: pending
isProject: false
---

# Fix "Inherited" / "Other" not applying for invalid or doubtfully valid clergy

## Context

- **Inherited** and **Other** are checkboxes inside a **validity-extra block** shown only when Validity is not "Valid" (Doubtfully valid or Invalid).
- Visibility is controlled in [templates/clergy_form_content.html](templates/clergy_form_content.html) by `syncValidityExtraForEntry(entry)`:
  - `showBlock = validitySelect.value !== 'valid'`
  - `block.style.display = showBlock ? 'block' : 'none'`
- The block is `.validity-extra-block` inside each ordination/consecration entry.

## Likely causes

1. **Status-inheritance runs after populate and never syncs block visibility**
  [static/js/status-inheritance.js](static/js/status-inheritance.js) runs `refreshFormRestrictions` 150ms after HTMX swap. `applyValidityRestrictions` can change the validity dropdown but does **not** call `syncValidityExtraForEntry`, so the block can stay hidden or visible incorrectly.
2. **Script execution in HTMX-swapped content**
  `syncValidityExtraForEntry` and the change listener live in an inline script in `clergy_form_content.html`. If that script does not run when content is loaded via `hx-swap="innerHTML"`, the block would never show.

## Recommended changes

1. **Sync block visibility when restrictions change validity**
  In [static/js/status-inheritance.js](static/js/status-inheritance.js), inside `applyValidityRestrictions`, after updating the dropdown and `setEntryNotice`, call  
   `if (typeof window.syncValidityExtraForEntry === 'function') window.syncValidityExtraForEntry(entryElement);`
2. **Sync all entries after refreshFormRestrictions**
  After restrictions are applied to all entries, run `syncValidityExtraForEntry` on every `.ordination-entry` and `.consecration-entry` in the form.
3. **Confirm script execution**
  If the form-content script does not run under HTMX, move `syncValidityExtraForEntry` and the change delegation to a script always loaded on the editor (e.g. clergy_form.html or a small JS file in editor.html).

## Files to touch

- [static/js/status-inheritance.js](static/js/status-inheritance.js): call `syncValidityExtraForEntry` from `applyValidityRestrictions`; after `refreshFormRestrictions` (or when its async work completes), sync all form entries.
- [templates/clergy_form_content.html](templates/clergy_form_content.html): only if script execution is missing—then move sync logic to a global script.

## Verification

- Open a clergy with an ordination/consecration that is Invalid or Doubtfully valid and has Inherited or Other set; block should be visible.
- Change validity to Valid and back to Doubtfully valid; block should hide then show.
- Select a bishop who cannot validly ordain/consecrate; validity may adjust and Inherited be checked; block should be visible.

