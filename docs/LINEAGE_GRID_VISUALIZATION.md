# Lineage Grid Visualization — Progress & Algorithm

**Route:** `/succession`  
**Status:** Active development (client-side timeline packing)

Grid-based apostolic succession view. Layout runs in the browser from visible graph data only.

---

## Progress summary

### Completed

| Area | What was done |
|------|----------------|
| **Layout engine** | Client-side timeline packing in [`static/js/lineage-grid-layout.js`](../static/js/lineage-grid-layout.js) |
| **Visible-only backend payload** | Route sends `nodes`, `links` only — no pixel positions, no hidden IDs |
| **First clergy left edge** | No visualized consecration predecessor → left-edge seed at `x = PAD` |
| **Excluded clergy filter** | `_lineage_nodes_links()` drops `exclude_from_visualization` from nodes and links |
| **Orphan bishop coverage** | Bishops / `consecrations_count > 0` stay on chart even with no visible consecration parent |
| **Descendant ranking** | `direct_count`, `total_descendants`; largest trees placed first |
| **Timeline buses** | Per-parent red horizontal trunk; children alternate above/below; two-rail X packing |
| **Succession forest** | One primary incoming edge per clergy (consecration for bishops, ordination for priests); best validity then latest date |
| **Bus-only succession lines** | Ordination/consecration stubs from buses only; co-consecration not drawn on grid |
| **Vertical spacing** | Full nested `extent_above` / `extent_below`; `GAP_Y` = card-edge clearance |
| **Card collision pass** | Post-placement AABB nudge pushes overlapping clusters down |
| **Date-scaled X** | `max(MIN_CHILD_GAP, DATE_SCALE × year_delta)` between siblings |
| **Shared metrics** | [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) — layout + router + CSS |
| **Edge routing** | [`static/js/lineage-grid-router.js`](../static/js/lineage-grid-router.js) — bus trunks + gutter lanes |
| **Tests** | 28 JS layout tests + 6 JS router tests |

### Intentionally not done (yet)

- Postgres metrics table
- Global calendar axis across whole chart
- Changing co-consecration display on other visualizations
- Ghost cards for excluded clergy
- Hidden-parent reparenting (removed; successors of excluded consecrators are first clergy)

### Known limitations / follow-ups

- Exclusion creates more left-edge forests; disconnected clusters stack vertically → tall canvas
- Nested descendant buses may extend past parent trunk (by design)
- Static JS long-cached in production; bump `?v=` on layout JS changes
- Edge router may give up after 24 lane attempts (edges omitted)
- `LineageRoot` table vs `exclude_from_visualization` — later migration/cleanup

---

## Architecture

```
GET /succession
    │
    ▼
routes/main.py::lineage_grid()
    │  nodes, links, show_priests
    ▼
templates/lineage_grid.html  →  window.nodesData, linksData
    │
    ▼
static/js/lineage-grid-layout.js  — forest, first clergy, packing, collision, buses
    │
    ▼
static/js/lineage-grid.js         — cards, pan/zoom, CSS vars
static/js/lineage-grid-router.js  — SVG edges + bus trunks
static/css/lineage-grid.css
```

---

## Algorithm

Entry: `computeLineageGridLayout(nodes, links, { showPriests })`.

### 1. Choose layout nodes

- Backend already excludes `exclude_from_visualization` clergy from `nodes` and `links`.
- Default layout set: consecration participants **or** bishops **or** `consecrations_count > 0`.
- `show_priests=1`: all visible nodes.
- Priests with zero consecrations still require `show_priests`.

### 2. Build layout forest

- Primary links = one incoming succession edge per target via `selectPrimarySuccessionLinks`.
- **Bishops** (`is_bishop` or `consecrations_count > 0`): incoming = consecration only (own consecration).
- **Priests / others**: incoming = ordination only.
- Conflict resolution among multiple candidates: most valid (`valid` > `sub_conditione` > `doubtful_event` > `doubtfully_valid` > `invalid`), then latest `event_sort_key`. Invalid-only succession still included.
- Co-consecration never a layout parent and not drawn on grid.
- Break cycles deterministically (remove newest back-edges).
- Layout edges = broken primary edges with both endpoints in layout set.
- **First clergy** = layout nodes with no layout parent.

### 3. Descendant metrics

- `direct_count`, `total_descendants` via BFS on layout forest.

### 4. Extents and width (bottom-up)

- Leaf: `extent_above = extent_below = 0`
- Per child slot: `CARD_H + GAP_Y + child.extent_above + child.extent_below`
- **Two-rail X packing:** children alternate above/below; each rail tracks its own occupied width; opposite rails may share X
- Subtree width: max over children of `childX + childSubtreeWidth` (same-rail trees do not overlap)
- **Bus trunk end:** max over direct child card rights (`childX + CARD_W`), not nested descendant width

### 5. First clergy and cluster placement

- Seeds = first clergy; prefer largest `total_descendants` when ordering clusters.
- Every seed at `(PAD, cluster_y + extent_above)`.
- Children alternate above/below; Y from parent **card edge** + `GAP_Y`.
- Bus metadata per parent with layout children.

### 6. Collision resolution

- AABB pass: later clusters pushed down if overlapping earlier cards.
- Y normalized so top card ≥ `PAD`.

### 7. Return payload

```javascript
{
  positions: { id: { x, y, side? } },
  primary_edges: [{ source, target }, ...],
  buses: [...],
  layout_node_ids: [...],
  first_clergy_ids: [...],
  bounds: { width, height, min_y },
  metrics: { id: { direct_count, total_descendants } },
  grid_metrics: { CARD_W, CARD_H, GAP_X, GAP_Y, PAD, ... },
}
```

---

## Always-works checklist

Contract the algorithm must keep. Slice 1 (first clergy + exclusion) covers most items; open items marked **later**.

### Input

- [x] Excluded clergy never in `nodes` or `links`
- [x] Both link endpoints exist in `nodes`
- [x] Layout does not receive hidden IDs

### Forest

- [x] One primary succession parent per target (bishop → consecration, priest → ordination; best validity then latest)
- [x] Co-consecration never creates layout parent; not drawn on grid
- [x] Cycles broken deterministically; cycle orphans become first clergy
- [x] First clergy = no visualized succession predecessor

### Geometry

- [x] Every first clergy at left (`x = PAD`)
- [x] Children LTR by date on same rail; opposite rails may share X; min gap + date scale
- [x] Alternate above/below; nested extents; `GAP_Y` card-edge clearance
- [x] No overlapping cards after AABB pass
- [x] Repeat run → identical positions

### Coverage

- [x] Every layout-eligible visible node gets a position (orphaned bishops included)
- [x] `show_priests` adds non-consecrated nodes without stealing bishop seed rules

### Edges

- [x] Red bus trunks; color-coded stubs (validity + type)
- [x] Succession lines (ordination/consecration) only from bus stubs
- [ ] Router never drops edges under normal load — **later** (24-lane limit remains)

---

## Later considerations

- **More left-edge forests:** exclusion removes shared hidden parents; vertical stack grows. May need date-aligned Y for first clergy or a global calendar axis instead of “largest tree on top, push rest down.”
- **Ghost cards:** collapsed marker for excluded ancestor would restore lineage story without drawing excluded clergy.
- **Long cross-cluster gutters:** removed — grid no longer gutters succession edges
- **`selectClusterSeeds` simplification:** now equivalent to “all parentless nodes, sort by descendants, place at PAD” — optional refactor.
- **`is_lineage_root`:** used by table view only; grid must not reuse it (ordination-only incoming edges differ from consecration forest).
- **`LineageRoot` vs `exclude_from_visualization`:** consolidate in a later migration.

---

## Frontend rendering

### Cards

- Absolute `(x, y)` from layout
- Size from `--grid-card-w` / `--grid-card-h`

### Bus edges

1. **Trunk (red):** parent right center → exit → vertical to `timeline_y` → horizontal LTR to last direct child card
2. **Stubs (color-coded):** vertical from `(child_center_x, timeline_y)` to child card; validity colors on stubs only

### Other edges

- Co-consecration and gutter routing are not used on the succession grid

---

## Configuration

[`static/config/grid-metrics.json`](../static/config/grid-metrics.json):

| Key | Default | Role |
|-----|---------|------|
| `CARD_W` | 168 | Card width (px) |
| `CARD_H` | 136 | Card height (px) |
| `GAP_X` | 52 | Min horizontal gap |
| `GAP_Y` | 64 | Card-edge vertical clearance |
| `PAD` | 48 | Canvas padding |
| `DATE_SCALE` | 8 | Pixels per year between dated siblings |
| `CARD_INSET` | 4 | Router collision inset |
| `LANE_PITCH` | 9 | Lane offset for overlapping segments |

---

## Tests

```bash
node tests/test_lineage_grid_layout.js
node tests/test_lineage_grid_router.js
```

Layout: first clergy left edge, orphan bishops, descendant ranking, two-rail packing, compact bus trunks, primary succession selection, date gaps, buses, alternating sides, nested hubs, cycle break, priests toggle, AABB no-overlap.

Router: segment occupancy, bus trunk at midline, vertical stubs.

---

## File reference

| File | Purpose |
|------|---------|
| [`static/js/lineage-grid-layout.js`](../static/js/lineage-grid-layout.js) | Client layout algorithm |
| [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) | Shared dimensions |
| [`static/js/lineage-grid.js`](../static/js/lineage-grid.js) | Page init, cards, edge render |
| [`static/js/lineage-grid-router.js`](../static/js/lineage-grid-router.js) | SVG path routing |
| [`static/css/lineage-grid.css`](../static/css/lineage-grid.css) | Grid page styles |
| [`templates/lineage_grid.html`](../templates/lineage_grid.html) | Template + JSON bootstrap |
| [`routes/main.py`](../routes/main.py) | `/succession` route |
| [`tests/test_lineage_grid_layout.js`](../tests/test_lineage_grid_layout.js) | Layout tests |
| [`tests/test_lineage_grid_router.js`](../tests/test_lineage_grid_router.js) | Router tests |

---

## Evolution (brief)

1. **Original grid:** Generation rows + hub-comb; fixed `row ± 1`.
2. **Timeline packing (Python):** Descendant-ranked clusters; date-scaled buses; pixel layout server-side.
3. **Client layout:** Generic graph from backend; JS packing + AABB collision.
4. **First clergy left edge:** Visible-only payload; no hidden reparenting; excluded predecessors → left-edge seeds.
5. **Succession buses (current):** Red trunks; bus-only succession stubs; two-rail compact packing; bishop consecration-only incoming.
