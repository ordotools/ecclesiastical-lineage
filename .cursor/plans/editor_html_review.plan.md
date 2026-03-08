---
name: Editor HTML review
overview: Fix bugs and duplication in templates/editor.html; exclude chapel-related work for later.
todos:
  - id: fix-clergy-selected-typo
    content: Rename event clergySeleced to clergySelected in editor.html, eventsPanel.js, editor-validation-impact.js
    status: completed
  - id: fix-constants-path
    content: Use app-root-aware path for constants.js import (editor.html and main_viz.html)
    status: completed
  - id: fix-outer-radius-fallback
    content: Align OUTER_RADIUS fallback (28) in highlightClergyInVisualization/clearClergyHighlights
    status: completed
  - id: move-scrollbar-tab-css
    content: Move panel-content/modal-body scrollbar and duplicate tab styles to editor-styles.css; remove from editor.html
    status: completed
  - id: move-inline-css-js
    content: Move large inline style and script blocks to editor-styles.css and editor-init.js (or split JS)
    status: completed
  - id: modal-helper
    content: Add openManagementModal(id, contentId, url) and closeManagementModal(id); refactor four modals to use them
    status: pending
  - id: viz-highlight-api
    content: Rely on editorVisualization.highlightNode/clearHighlights; remove or minimize inline D3 fallback in editor.html
    status: pending
  - id: script-defer
    content: Document or unify defer on editor scripts (globals, validity-rules, notification, etc.)
    status: completed
  - id: merge-root-css
    content: Merge duplicate :root blocks in editor.html into one
    status: completed
  - id: todo-1772999456902-2ah6ph7o9
    content: Document commented resizable-panes.js and ENABLE_EDITOR_* flags
    status: completed
  - id: bottom-panel-constants
    content: Single source for bottom strip height (40) and default expanded height (250); CSS var or shared constant
    status: completed
  - id: console-logs
    content: Remove or guard editor console.log/console.error with debug flag for production
    status: completed
isProject: false
---

# Editor template review: inconsistencies, bugs, and refactors

(Chapel-related items—button binding, toggleChapelList refactor, empty branches in chapel code—deferred for later.)

## Bugs (non-chapel)

- **Typo: `clergySeleced`** → rename to `clergySelected` in editor.html, eventsPanel.js, editor-validation-impact.js.
- **Constants path:** `/static/js/constants.js` breaks under subpath; use app-root-aware URL.
- **OUTER_RADIUS fallback:** Use 28 (match constants.js) in highlight/clear fallbacks.

## Duplicate logic / move to shared files

- **CSS:** Move `.panel-content` / `.modal-body` scrollbar and duplicate tab styles to editor-styles.css.
- **Inline CSS/JS:** Move large blocks to editor-styles.css and editor-init.js (or split).
- **Modals:** Single `openManagementModal` / `closeManagementModal` helper for the four modals.
- **Highlight:** Prefer `editorVisualization.highlightNode` / `clearHighlights`; minimize inline D3 fallback.

## Cleanup

- **Script defer:** Unify or document which scripts are blocking vs deferred.
- `**:root`:** Merge the two :root blocks in editor.html.
- **Dead code:** Commented resizable-panes.js and ENABLE_* flags—remove or document.
- **Magic numbers:** Single source for bottom panel 40px / 250px.
- **Console logs:** Strip or guard for production.

