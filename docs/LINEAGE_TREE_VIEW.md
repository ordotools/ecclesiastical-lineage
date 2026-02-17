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

- Links are curved paths; no arrowheads.
- **Link status icons**: Non-valid consecration links show icons along the path: invalid (✕), doubtfully_valid (?), doubtful_event (~), sub_conditione (SC). Icons placed via `findPointAtDistanceFromTarget()`; background uses `--viz-surface`.

### Visibility Model and Re-Layout

- **`collapsedNodeIds: Set<string>`** — IDs of nodes whose children are hidden. Used via a custom children accessor so D3 treats collapsed nodes as leaves.
- **`summaryExpandedIds: Set<string>`** — IDs of summary nodes that have been expanded (replaced with actual leaf nodes).
- **`rootHierarchy`** — Raw hierarchy from `buildHierarchy`; used to rebuild the display hierarchy on each update.
- **`createDisplayHierarchy(rootData, collapsedNodeIds, summaryExpandedIds)`** — Clones hierarchy and applies collapse/summary state; returns structure for layout.
- **`updateTree()`** — Re-runs layout and re-renders nodes/links with D3 enter/update/exit joins and transitions.

### Summary Nodes

- **`applyDefaultSummaries(hierarchy, linkDateByEdge)`** — For each node with >5 children, groups leaf children into a synthetic summary node positioned at the oldest leaf's decade.
- Leaf children become `[summaryNode, ...parentNodes]` (sorted by decade).
- Summary node data: `{ isSummary: true, id, leafIds, leafNodes, decade, count }`.
- **Rendering**: dashed rect, label `N consecrations (YYYYs)`; distinct from clergy nodes (`.viz-node-summary`, `.viz-node-summary-rect`).
- Clicking a summary node (or its chevron) expands it: `summaryExpandedIds.add(id)` → `updateTree()`.

### Collapse/Expand Controls

- **Chevron button**: Small chevron (`.viz-collapse-btn`) on nodes with children or summary nodes; positioned at top-right. Toggles collapse/expand. Uses `stopPropagation` so it does not trigger `handleNodeClick`.
- **Right-click context menu**: `contextmenu` on node groups; shows "Collapse subtree" / "Expand subtree" (or "Collapse" / "Expand" for summary nodes). Dismissed on outside click or after action.

### Animations

- **`TREE_ANIMATION`** (350ms expand/collapse, cubic bezier ease, `collapseArcStrength: 0.25`) controls transitions.
- **Unified path tween**: `makePathTween(d, getNodePos, getParentPos, arcStrength, collapse)` — single function for both expand and collapse node motion along a curved Bezier path.
- **Collapse**: Children collapse to their **immediate parent** only (not a higher ancestor). Each node animates toward its parent's current position.
- **Expand**: Children expand from their parent's **current (pre-expand) position** — the position at click time, before layout recomputes.
- **Links**: Animate in sync with their endpoints. Enter with lengthening tween (expand) or fade-in (non-expand); update with path interpolation; exit with shrinking tween (collapse) or fade-out.

### Interaction Model

- **Clergy nodes**: Click opens info window; chevron toggles children visibility; right-click shows context menu.
- **Summary nodes**: Click or chevron expands to show individual consecrations; right-click shows "Collapse"/"Expand". No info window.
- **Build flow**: `buildHierarchy` → `applyDefaultSummaries` → `createDisplayHierarchy` (applies `collapsedNodeIds`, `summaryExpandedIds`) → layout → `updateTree()`.
- **Edge cases**: Summary applies at initial state; once expanded, leaves become normal children. Parent can still be collapsed (hides all children). Multi-root: each subtree collapses independently.

### Interactions

- **Zoom/pan**: `d3.zoom()` with `scaleExtent([0.3, 3])`.
- **Node click**: `handleNodeClick` → clergy info window. Summary node click expands/collapses; does not open info window.
- **Reset/Center**: event listeners on `#reset-zoom` and `#center-graph`; side menu is commented out in template (controls unavailable).

---

## Dependencies

- D3.js v7
- `constants.js`
- `modals.js` (handleNodeClick)
- `statusBadges.js` (renderStatusBadges)
- Sprite sheet: `/api/sprite-sheet` or `window.getSpriteSheetData()`
- CSS vars: `--viz-label-dy`, `--viz-link-consecration-color`, `--viz-node-outer-radius`, `--viz-node-stroke-width`, `--viz-surface` (link status icon backgrounds)
- `visualization-dynamic.css`: `.viz-context-menu`, `.viz-context-menu-item`, `.viz-node-summary-rect`, `.viz-node-summary-label`

---

## Current State

- **Default view**: Tree is the default (set in `viewController.js`, `currentView = 'tree'`).
- **View toggle**: “Tree” vs “Graph” in the bottom filter menu changes between tree and force graph.
- **Filters**: Organization filter and “View Priests” apply; tree view uses only consecration links (no ordination).
- **Collapse/expand**: Chevron on parent nodes and summary nodes; right-click context menu for "Collapse subtree" / "Expand subtree".
- **Summary nodes**: Parents with >5 children show a summary node by default (`N consecrations (YYYYs)`); click to expand into individual nodes.
- **Animations**: D3 transitions (350ms) on expand/collapse; nodes and links share curved Bezier path tweens; collapse to immediate parent, expand from parent's pre-expand position; links move with their nodes.
- **Highlight Lineage**: Graph view only. When enabled there, clicking a node highlights its consecration chain instead of opening the info window. In tree view, shows "Switch to Graph view to highlight lineage."
- **Reset/Center**: Buttons are wired in `lineageTreeView.js` to `#reset-zoom` and `#center-graph`, but the side menu containing them is commented out in `lineage_visualization.html`, so those controls are effectively unavailable. `window.currentZoom` is exposed for external use.
- **Performance**: Uses sprite sheet for avatars when present; initialization time is logged with `console.time`.

---

## Plans / Gaps (from code and docs)

- `LINEAGE_VISUALIZATION.md` mentions “Hierarchical Layout” as a future enhancement; the tree view implements that.
- Tree view does not support the “Hide Priests” or “Backbone Only” filters used by the force graph.
- Tree does not use the ELK layout; it relies on D3’s built-in tree layout.
- Mobile controls (reset/center) are referenced but commented out in the template.
