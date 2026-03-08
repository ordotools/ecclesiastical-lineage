---
name: Fix post-save lineage and audit
overview: "Fix lineage menu and audit logs not updating after creating a new clergy record: use selector for lineage target, and trigger audit logs reload when that tab is active after clergy-list refresh."
todos:
  - id: lineage-menu-selector
    content: In refreshEditorAfterClergySave (and clergyUpdated/viz-reload handlers), use target '#visualization-panel-content' (selector string) instead of menuTarget element
    status: completed
  - id: audit-logs-after-refresh
    content: In refreshEditorAfterClergySave Promise.all().then(), if
    status: completed
  - id: audit-logs-expose-optional
    content: (Optional) In clergy_list.html expose loadAuditLogsContent on window and call it when fragment loads if audit tab active
    status: pending
isProject: false
---

# Fix post-save lineage menu and audit logs refresh

## Current behavior

- **Save flow (new record):** [static/js/clergy-form-submission.js](static/js/clergy-form-submission.js) calls `refreshEditorAfterClergySave(data.clergy_id)` after success. In parallel, `switchToEditMode(data.clergy_id)` loads the form into the right panel via HTMX.
- **refreshEditorAfterClergySave** in [templates/editor.html](templates/editor.html) (lines 1452–1483) runs:
  - `updateStatusBar()`
  - `htmx.ajax('GET', '/editor/clergy-list', { target: leftPanelContent, swap: 'innerHTML' })`
  - `htmx.ajax('GET', '/editor/lineage-menu', { target: menuTarget, swap: 'innerHTML' })`
  - After `Promise.all([listPromise, menuPromise])`: clear validation caches, re-init validation panel, `softRefreshVisualization()`, highlight.

## Issue 1: Lineage menu does not update

**Likely causes:**

1. **Target type:** Code passes a DOM element (`menuTarget`) to `htmx.ajax(..., { target: menuTarget, swap: 'innerHTML' })`. HTMX docs typically show a selector string (e.g. `'#myDiv'`). Some versions or code paths may treat element vs selector differently.
2. **Race with form load:** Using a stable selector avoids any chance of a stale element reference.
3. **Silent failure:** If the lineage-menu request or swap fails, only the catch logs; no visible feedback.

**Recommended fixes:**

- Use a **selector string** for the lineage menu target: `target: '#visualization-panel-content'` in `refreshEditorAfterClergySave` (and the `clergyUpdated` and viz-reload handlers in editor.html).
- If the problem persists, add a short delay before the menu request and/or logging in the `.catch`.

## Issue 2: Audit logs do not update

**Cause:** Audit logs are a tab inside the left panel content from `/editor/clergy-list`. Refreshing the clergy list replaces that entire content with the template’s default “Loading audit logs...” state. Nothing triggers a reload of audit logs after the swap.

**Recommended fix:**

- After the clergy-list and lineage-menu refreshes complete in `refreshEditorAfterClergySave`, if `#clergy-audit-logs-content` exists and has class `active`, call `htmx.ajax('GET', '/editor/audit-logs', { target: '#clergy-audit-logs-content', swap: 'innerHTML' })` (or `window.loadAuditLogsContent()` if exposed from clergy_list.html).
- Optionally in [templates/editor_panels/clergy_list.html](templates/editor_panels/clergy_list.html): set `window.loadAuditLogsContent = loadAuditLogsContent` and at end of script call `loadAuditLogsContent()` when audit tab is active so fragment load also populates logs.

## Implementation summary


| Item             | Action                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lineage menu** | In `refreshEditorAfterClergySave` and in the `clergyUpdated` and viz-reload handlers in editor.html, use `target: '#visualization-panel-content'` (selector string) instead of `menuTarget`.                                                                |
| **Audit logs**   | In `refreshEditorAfterClergySave`, inside the `Promise.all([...]).then(...)` callback, if audit tab is active, trigger audit logs load via htmx.ajax or `window.loadAuditLogsContent()`. Optionally expose and call from clergy_list.html on fragment load. |


No backend changes required; endpoints `/editor/lineage-menu` and `/editor/audit-logs` already exist.