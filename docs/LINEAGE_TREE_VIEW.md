# Lineage Tree View

## Overview

The **lineage tree view** (`lineageTreeView.js`) is a D3-based hierarchical visualization of ecclesiastical consecration lineage. It shows consecration relationships as a tree (parent = consecrator, child = consecrated bishop), with a single default view mode alongside an alternative force-directed graph.

---

## Files

| File | Role |
|------|------|
| `static/js/lineageTreeView.js` | Core tree implementation (D3 tree layout, SVG rendering) |
| `static/js/viewController.js` | Switches between tree and force graph; calls `initializeTreeView()` |
| `static/js/lineageVisualization.js` | Entry point; loads styles, UI, filters, search; calls `initializeView()` |
| `static/js/constants.js` | `TREE_NODE_DX`, `TREE_NODE_DY`, radii, colors, viewport size |
| `static/js/modals.js` | `handleNodeClick` — opens clergy info windows on node click |
| `static/js/statusBadges.js` | `renderStatusBadges` — status indicators around nodes |
| `static/js/highlightLineage.js` | Highlight mode — graph view only; tree view prompts user to switch |
| `templates/lineage_visualization.html` | Page shell; embeds `graph-container`, passes `links_json`/`nodes_json` |

---

## Data Flow

1. **Backend** (`lineage_api.py`, lineage routes) builds `nodes` and `links` from Clergy, Consecration, Organization, Rank.
2. **Template** injects JSON into `window.linksData` and `window.nodesData`.
3. **Tree view** reads these globals, filters by `window.selectedOrganization`, keeps only `type === 'consecration'` links.
4. **Hierarchy** is built from consecration links (source = consecrator, target = consecrated).

---

## Implementation

### Hierarchy Building

- `buildHierarchy(nodes, consecrationLinks, nodeMap, linkDateByEdge)`:
  - Builds `targetsBySource` and `hasIncoming`.
  - Roots: nodes with `is_lineage_root`, or else nodes with no incoming links.
  - Produces either `{ single: rootNode }` or `{ multi: rootNodes[] }`.
  - Children sorted by consecration year (via `linkDateByEdge`).
  - Multiple links between same pair: `buildLinkToValidityMap()` keeps link with highest status priority (invalid > doubtfully_valid > doubtful_event > sub_conditione > valid).
- Multi-root trees are laid out horizontally, each with its own D3 tree, then concatenated with a gap.

### Layout

- Uses `d3.tree()` with `nodeSize([TREE_NODE_DY, TREE_NODE_DX])`.
- Custom `separation()`: siblings spaced by subtree size to reduce overlap.
- `applyTimelinePositions()`: adjusts node depth by decade when link dates exist (multi-root: depth on y; single: depth on x).
- Single root: vertical links (`d3.linkVertical`).
- Multi-root: horizontal links (`d3.linkHorizontal`).
- Initial transform centers and scales the tree in the viewport.

### Node Shape

- `useSquareNode(d)`: square nodes for `is_pre_1968_consecration` or `is_lineage_root`.
- Otherwise circular nodes.
- Pre-1968 flags from `computePre1968Flags()` (consecrations before 1968 or inferred from links).

### Node Rendering

Each node has:

- Outer shape: circle or rect (org color, rank stroke).
- Inner shape: small circle/rect (rank color).
- Avatar: sprite sheet (if available) or `image_url`, clipped to circle or square.
- Label: clergy name.
- Status badges: via `renderStatusBadges()` when `data.statuses` exists.

### Link Rendering

- Links use `marker-end: url(#arrowhead-tree)`.
- **Link status icons**: Non-valid consecration links show icons along the path: invalid (✕), doubtfully_valid (?), doubtful_event (~), sub_conditione (SC). Icons placed via `findPointAtDistanceFromTarget()`; background uses `--viz-surface`.

### Interactions

- **Zoom/pan**: `d3.zoom()` with `scaleExtent([0.3, 3])`.
- **Node click**: `handleNodeClick` → clergy info window. In highlight mode (graph view only), lineage chain is highlighted instead.
- **Reset/Center**: event listeners on `#reset-zoom` and `#center-graph`; side menu is commented out in template (controls unavailable).

---

## Dependencies

- D3.js v7
- `constants.js`
- `modals.js` (handleNodeClick)
- `statusBadges.js` (renderStatusBadges)
- Sprite sheet: `/api/sprite-sheet` or `window.getSpriteSheetData()`
- CSS vars: `--viz-label-dy`, `--viz-link-consecration-color`, `--viz-node-outer-radius`, `--viz-node-stroke-width`, `--viz-surface` (link status icon backgrounds)

---

## Current State

- **Default view**: Tree is the default (set in `viewController.js`, `currentView = 'tree'`).
- **View toggle**: “Tree” vs “Graph” in the bottom filter menu changes between tree and force graph.
- **Filters**: Organization filter and “View Priests” apply; tree view uses only consecration links (no ordination).
- **Highlight Lineage**: Graph view only. When enabled there, clicking a node highlights its consecration chain instead of opening the info window. In tree view, shows "Switch to Graph view to highlight lineage."
- **Reset/Center**: Buttons are wired in `lineageTreeView.js` to `#reset-zoom` and `#center-graph`, but the side menu containing them is commented out in `lineage_visualization.html`, so those controls are effectively unavailable. `window.currentZoom` is exposed for external use.
- **Performance**: Uses sprite sheet for avatars when present; initialization time is logged with `console.time`.

---

## Plans / Gaps (from code and docs)

- `LINEAGE_VISUALIZATION.md` mentions “Hierarchical Layout” as a future enhancement; the tree view implements that.
- Tree view does not support the “Hide Priests” or “Backbone Only” filters used by the force graph.
- Tree does not use the ELK layout; it relies on D3’s built-in tree layout.
- Mobile controls (reset/center) are referenced but commented out in the template.
