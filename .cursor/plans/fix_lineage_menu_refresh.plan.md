---
name: Fix lineage menu refresh
overview: Lineage menu in the center panel does not update after save. Plan addresses target resolution, timing/race, and optional event-driven refresh.
todos:
  - id: lineage-use-element-target
    content: In refreshEditorAfterClergySave, resolve center panel with getElementById('visualization-panel-content') and pass element (not selector) to htmx.ajax for lineage-menu
    status: completed
  - id: lineage-refresh-after-settled
    content: Run lineage-menu request inside Promise.all().then() after list (and current menu) complete so DOM is settled; optionally make it explicitly sequential
    status: completed
  - id: lineage-clergyUpdated-viz-handlers
    content: In clergyUpdated and viz-reload handlers in editor.html, use same element reference for lineage-menu target (not selector)
    status: completed
  - id: lineage-event-driven-optional
    content: (Optional) Add editor:clergy-saved dispatch and listener to refresh lineage menu so center panel owns its refresh
    status: completed
isProject: false
---

# Fix lineage menu (center panel) not updating after save

## Current setup

- **Center panel:** [templates/editor.html](templates/editor.html) defines `#visualization-panel-content` with `hx-get="/editor/lineage-menu"` and `hx-trigger="load"`. Initial load works.
- **Post-save:** `refreshEditorAfterClergySave()` uses `target: '#visualization-panel-content'` (selector). Audit logs fix works; lineage menu still does not update.
- **Inconsistency:** Left panel uses an **element** for clergy-list target; center uses a **selector**; chapel toggle uses **element** for lineage-menu.

## Likely causes

1. **Target resolution:** Selector may resolve at request time; element reference matches working left-panel pattern.
2. **Race with parallel requests:** List, lineage-menu, and form load run in parallel; ordering may matter.
3. **No feedback:** Failures only in `.catch`; no confirmation that lineage request fires and swaps.

## Recommended approach

### 1. Use element reference and run lineage refresh after list settles

- In `refreshEditorAfterClergySave`: resolve `const centerPanelContent = document.getElementById('visualization-panel-content');`, use `target: centerPanelContent`.
- Run lineage-menu refresh inside `Promise.all([listPromise, menuPromise]).then(...)` (or start lineage request after list resolves and await it) so it runs after other swaps.

### 2. Event-driven refresh (optional rethink)

- Dispatch `editor:clergy-saved` after save; listener refreshes lineage menu via htmx.ajax with element reference. Center panel owns its refresh.

### 3. Same element reference in other handlers

- In `clergyUpdated` and viz-reload click handler, use element reference for lineage-menu target instead of selector.

## Files to touch

- [templates/editor.html](templates/editor.html): `refreshEditorAfterClergySave`, clergyUpdated listener, viz-reload handler.
- Optionally [static/js/clergy-form-submission.js](static/js/clergy-form-submission.js) or [static/js/editor-lineage-menu.js](static/js/editor-lineage-menu.js) for event-driven listener.

No backend changes for approaches above.
