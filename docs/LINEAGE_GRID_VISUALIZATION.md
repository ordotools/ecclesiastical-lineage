# Lineage Grid Visualization — Progress & Algorithm

**Route:** `/succession`  
**Status:** Active development (timeline-packing layout)

This document tracks progress on the grid-based apostolic succession view, which replaces the older generation-row / hub-comb layout with descendant-ranked timeline packing.

---

## Progress summary

### Completed

| Area | What was done |
|------|----------------|
| **Layout engine** | Replaced Sugiyama-style rows + hub-comb with recursive timeline packing in [`services/lineage_grid_layout.py`](../services/lineage_grid_layout.py) |
| **Descendant ranking** | In-process metrics on every request: `direct_count`, `total_descendants`; largest trees placed first |
| **Timeline buses** | Each parent with children gets a horizontal timeline; children alternate above/below by date order |
| **Vertical spacing** | Bottom-up `extent_above` / `extent_below` from nested subtrees (not fixed ±1 rows) |
| **Date-scaled X** | Sibling spacing uses `max(MIN_CHILD_GAP, DATE_SCALE × year_delta)` from previous subtree’s right edge |
| **Pixel coordinates** | Layout emits `x`/`y` pixels (not grid rows/cols) plus `bounds` |
| **Shared metrics** | Single config [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) — Python layout + JS router + CSS vars |
| **Card sizing** | Cards 168×136px; CSS uses `--grid-card-w` / `--grid-card-h` set from layout metrics |
| **Edge routing** | [`static/js/lineage-grid-router.js`](../static/js/lineage-grid-router.js) draws bus trunks LTR from parent right edge; vertical stubs at each child X |
| **Bus trunk rendering** | Horizontal timeline drawn as SVG; fallback built from bus metadata if router cache is stale |
| **Tests** | 16 Python layout tests + 6 JS router tests |

### Intentionally not done (yet)

- Postgres worker / metrics table (counts computed on read; dataset is small enough)
- Global calendar axis across the whole chart (each parent bus is local)
- Changing primary-parent or co-consecration semantics

### Known limitations / follow-ups

- Disconnected forest clusters stack vertically; very large datasets produce tall canvases
- Ordination and co-consecration edges use gutter lane routing, not timeline buses
- Static JS is long-cached in production (`max-age=31536000`); debug mode uses `no-cache` for `.js`
- Visual polish (overlap, fit-to-view tuning) may still need iteration on real data

---

## Architecture

```
GET /succession
    │
    ▼
routes/main.py::lineage_grid()
    │  nodes, links, rank_links, lineage_root_ids
    ▼
services/lineage_grid_layout.py::compute_lineage_grid_layout()
    │  positions (x,y), buses, bounds, metrics, grid_metrics
    ▼
templates/lineage_grid.html  →  window.layoutData (JSON)
    │
    ▼
static/js/lineage-grid.js       — cards, pan/zoom, CSS vars
static/js/lineage-grid-router.js  — SVG edges + bus trunks
static/css/lineage-grid.css       — card chrome
```

---

## Algorithm (exact steps)

Entry point: `compute_lineage_grid_layout(nodes, links, rank_links=..., lineage_root_ids=..., show_priests=...)`.

### 1. Choose visible nodes

- Default: only clergy who participate in at least one consecration edge.
- With `show_priests=1`: all visible nodes from the page data.
- Hidden parents in `rank_links` still anchor depth for ranking but are not drawn as cards.

### 2. Build primary consecration forest

- **One parent per target:** `_select_primary_consecration_links` picks the earliest valid (non–sub conditione, non-invalid) consecration per consecrand; falls back to earliest overall.
- **Break cycles:** `_break_cycles` removes newest back-edges until the graph is a DAG.
- Result: directed forest of primary consecration edges only.

### 3. Compute descendant metrics (in memory)

For every visible node:

- `direct_count` = number of primary children
- `total_descendants` = size of reachable set below this node (BFS)

No database table; recomputed each request.

### 4. Bottom-up extent and width (before placement)

**Vertical extents** (`_compute_extents`): for each node, compute how much vertical space its subtree needs above and below its own card midline.

- Leaf: `extent_above = extent_below = 0`
- Children sorted by consecration date (same order as placement)
- Child index `i` → side `above` if even, `below` if odd
- Per side: `max(CARD_H + GAP_Y + child_extent_toward_parent)` over children on that side  
  (above child uses child’s `extent_below`; below child uses child’s `extent_above`)

**Subtree width** (`_compute_subtree_width`): width from parent’s left edge to rightmost point of any descendant.

- Leaf width = `CARD_W`
- Child relative X positions computed first (step 5), then `max(rel_x + child_subtree_width)`

### 5. Child X on parent timeline (local, left-to-right)

`_compute_child_x_positions` returns offsets relative to parent’s **left** edge.

- Children sorted by `event_sort_key` (consecration date), then id
- First child: `x = CARD_W + GAP_X` (just right of parent card)
- Each next child: `x = prev_end + gap` where:
  - `prev_end` = previous child’s left edge + that child’s full subtree width
  - `gap = max(MIN_CHILD_GAP, DATE_SCALE × (year − prev_year))` when both years known
  - else `gap = MIN_CHILD_GAP` (or `GAP_X` for the first slot)
- Unknown dates: sorted after dated siblings; use minimum slot width
- **Rule:** every child’s left edge is strictly to the right of the previous child’s entire subtree (LTR)

### 6. Cluster seeds and placement order

`_select_cluster_seeds` partitions the forest into disjoint subtrees:

- Repeatedly pick the unplaced node with **no unplaced primary parent** and highest `total_descendants` (tie-break: date, name, id)
- That node becomes a **seed** for one vertical cluster

Placement (`_place_subtree`), for each seed top-to-bottom on the page:

1. Seed Y = `cluster_y + extent_above[seed]` (room for above-timeline children)
2. Seed X = `PAD`
3. Recurse into children:
   - `timeline_y = parent.y + CARD_H / 2` (horizontal bus runs at card midline)
   - Child X = `parent.x + rel_x`
   - Child Y:
     - **Above:** `timeline_y − (GAP_Y + child.extent_below + CARD_H)`
     - **Below:** `timeline_y + GAP_Y + child.extent_above`
4. Emit **bus** metadata per parent with children:
   ```json
   {
     "source": <parent_id>,
     "timeline_y": <float>,
     "timeline_start_x": <parent.x + CARD_W>,
     "timeline_end_x": <parent.x + max(rel_x + subtree_width)>,
     "targets": [{ "target": <id>, "side": "above"|"below" }, ...]
   }
   ```
5. After each cluster: `cluster_y = seed_y + CARD_H + extent_below[seed] + CLUSTER_GAP`

### 7. Y normalization and bounds

- Shift all Y so the topmost card is at least `PAD`
- `bounds.width` / `bounds.height` from max card extents + `PAD`

### 8. Return payload

```python
{
  "positions": { id: {"x", "y", "side"?} },
  "primary_edges": [{"source", "target"}, ...],
  "buses": [...],
  "layout_node_ids": [...],
  "bounds": {"width", "height", "min_y"},
  "metrics": { id: {"direct_count", "total_descendants"} },
  "grid_metrics": { CARD_W, CARD_H, GAP_X, GAP_Y, PAD, ... },
}
```

---

## Frontend rendering

### Cards

- Absolute positioning at `(x, y)` from layout
- Size from `--grid-card-w` / `--grid-card-h` (defaults match `grid-metrics.json`)

### Bus edges (primary consecration children)

For each bus:

1. **Trunk (horizontal timeline):** parent right center → short exit → vertical to `timeline_y` → horizontal LTR to `timeline_end_x`
2. **Stubs:** vertical only from `(child_center_x, timeline_y)` to top/bottom of child card (above/below)

Trunk path key: `bus-trunk:{source_id}`. Rendered in `renderEdges` with class `lineage-grid-edge--bus-trunk`.

### Other edges

- Non-bus primary edges, ordinations, co-consecrations: orthogonal gutter lane router (`LaneRouter`)
- Bus-child consecration links skip duplicate routing (handled by bus stub)

---

## Configuration

All layout spacing reads [`static/config/grid-metrics.json`](../static/config/grid-metrics.json):

| Key | Default | Role |
|-----|---------|------|
| `CARD_W` | 168 | Card width (px) |
| `CARD_H` | 136 | Card height (px) |
| `GAP_X` | 52 | Minimum horizontal gap between cards |
| `GAP_Y` | 64 | Vertical gap between timeline and child |
| `PAD` | 48 | Canvas padding |
| `DATE_SCALE` | 8 | Pixels per year between consecutive dated siblings |
| `CARD_INSET` | 4 | Router collision inset |
| `LANE_PITCH` | 9 | Lane offset for overlapping segments |

Change this file to resize cards; reload `/succession` (layout passes `grid_metrics` to the client).

---

## Tests

```bash
python3 -m tests.test_lineage_grid_layout
node tests/test_lineage_grid_router.js
```

Layout tests cover: descendant ranking, LTR child order, date gaps, bus bounds, alternating sides, nested hub offset, cycle breaking, priests toggle.

Router tests cover: segment occupancy, bus trunk at parent midline, vertical-only stubs (no RTL fan from trunk end).

---

## File reference

| File | Purpose |
|------|---------|
| [`services/lineage_grid_layout.py`](../services/lineage_grid_layout.py) | Layout algorithm |
| [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) | Shared dimensions |
| [`static/js/lineage-grid.js`](../static/js/lineage-grid.js) | Page init, cards, edge render |
| [`static/js/lineage-grid-router.js`](../static/js/lineage-grid-router.js) | SVG path routing |
| [`static/css/lineage-grid.css`](../static/css/lineage-grid.css) | Grid page styles |
| [`templates/lineage_grid.html`](../templates/lineage_grid.html) | Template + JSON bootstrap |
| [`routes/main.py`](../routes/main.py) | `/succession` route |
| [`tests/test_lineage_grid_layout.py`](../tests/test_lineage_grid_layout.py) | Layout tests |
| [`tests/test_lineage_grid_router.js`](../tests/test_lineage_grid_router.js) | Router tests |

---

## Evolution (brief)

1. **Original grid:** Generation rows (Sugiyama-style) + hub-comb for nodes with ≥4 children; fixed `row ± 1` offsets.
2. **Timeline packing (current):** Descendant-ranked clusters; per-parent date-scaled horizontal buses; nested extent-based vertical spacing; pixel layout.
3. **Router fixes:** LTR trunks anchored at parent; vertical stubs at child X; explicit trunk SVG rendering.
