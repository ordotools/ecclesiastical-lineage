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
| **Timeline buses** | Per-parent red horizontal trunk; children alternate above/below; adaptive branch origin spacing |
| **Succession forest** | One primary incoming edge per clergy (consecration for bishops, ordination for priests); best validity then latest date |
| **Bus-only succession lines** | Ordination/consecration stubs from buses only; co-consecration not drawn on grid |
| **Chronological branch order** | Direct children sorted by `event_sort_key`; origins advance LTR |
| **Adaptive branch spacing** | Leaf-only branches: even minimal pitch (`MIN_BRANCH_GAP`); hub branches: sequential min gap, bumped only by same-rail subtree interference |
| **Multi-relation stubs** | Same source→target ordination + consecration draws separate offset arrows, group centered on origin |
| **Vertical stub routing** | Pure vertical segments to real card edge; no horizontal jog at card (arrowheads stay aligned) |
| **Vertical spacing** | Full nested `extent_above` / `extent_below`; `GAP_Y` = card-edge clearance |
| **Card collision pass** | Post-placement AABB nudge pushes overlapping clusters down |
| **Same-rail X clearance** | `max(MIN_CHILD_GAP, DATE_SCALE × year_delta)` when same-rail siblings would overlap |
| **Shared metrics** | [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) — layout + router + CSS |
| **Edge routing** | [`static/js/lineage-grid-router.js`](../static/js/lineage-grid-router.js) — bus trunks + vertical stubs |
| **Tests** | 31 JS layout tests + 7 JS router tests |

### Intentionally not done (yet)

- Postgres metrics table
- Global calendar axis across whole chart
- Changing co-consecration display on other visualizations
- Ghost cards for excluded clergy
- Hidden-parent reparenting (removed; successors of excluded consecrators are first clergy)

### Known limitations / follow-ups

- Exclusion creates more left-edge forests; disconnected clusters stack vertically → tall canvas
- Nested descendant buses may extend past parent trunk (by design)
- Static JS long-cached in production; bump `?v=` on layout JS changes (currently `?v=12` on template, `?v=9` on module imports)
- Edge router may give up after 24 lane attempts on trunk horizontal lanes (stubs always draw)
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
- **Child sort:** direct children sorted ascending by `event_sort_key` (nulls last); tie-break by target id
- **Alternate above/below:** even index → above, odd → below
- **Adaptive branch origin spacing** (`computeChildXPositions`):

  | Parent's direct children | Origin placement |
  |---|---|
  | **All leaves** (no layout grandchildren) | Even pitch at `branchMinPitch` = `max(MIN_BRANCH_GAP, multi-relation group width)`; card `x = max(originX − CARD_W/2, railMinX)` only when same-rail subtree would overlap |
  | **Any bus-hub child** (has layout children) | Sequential minimum gap: `originX = prevOriginX + prevGroupHalf + MIN_BRANCH_GAP + groupHalf`; card bumped right only via `railMinX` when same-rail subtree interferes |

- **Same-rail clearance** (`siblingGap`): `max(MIN_CHILD_GAP, DATE_SCALE × year_delta)` applied via `railMinX`, not as a global uniform pitch
- **Multi-relation width:** `buildRelationCounts` counts ordination + consecration links per source→target; widens min pitch / group half-width for offset stub clusters
- Subtree width: max over children of `childX + childSubtreeWidth`
- **Bus trunk end:** max over direct child card rights (`childX + CARD_W`), not nested descendant width
- **Bus target metadata:** each target carries `origin_x` (absolute stub center after any rail bump)

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
  buses: [{
    source, timeline_y, timeline_start_x, timeline_end_x,
    targets: [{ target, side, origin_x }, ...],
  }],
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
- [x] Children LTR by `event_sort_key`; alternate above/below
- [x] Leaf-only branches: even minimal bus origin pitch (`MIN_BRANCH_GAP`)
- [x] Hub branches: sequential min origin gap; displaced only by same-rail subtree interference
- [x] Same-rail cards never overlap (`MIN_CHILD_GAP` / date scale via `railMinX`)
- [x] Nested extents; `GAP_Y` card-edge clearance
- [x] No overlapping cards after AABB pass
- [x] Repeat run → identical positions

### Coverage

- [x] Every layout-eligible visible node gets a position (orphaned bishops included)
- [x] `show_priests` adds non-consecrated nodes without stealing bishop seed rules

### Edges

- [x] Red bus trunks; color-coded stubs (validity + type)
- [x] Succession lines (ordination/consecration) only from bus stubs
- [x] Vertical stubs terminate on real card edge (not inflated collision rect)
- [x] Arrowheads point into cards (`markerUnits="userSpaceOnUse"`, vertical last segment)
- [x] Multiple ordination/consecration links same pair → separate offset stubs, group centered on `origin_x`
- [x] Bus stubs always draw (layout handles spacing; stubs do not use collision-gated `reservePath`)

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

1. **Trunk (red):** parent right center → exit → vertical to `timeline_y` → horizontal LTR to last direct child extent
2. **Stubs (color-coded):** single vertical segment from `(attachX, timeline_y)` to real card top/bottom edge
3. **Origin X:** from bus target `origin_x` when present, else card center
4. **Multi-relation:** for `n` ordination/consecration links on same bus→child, `attachX_i = origin_x + (i − (n−1)/2) × MULTI_STUB_GAP`; path keys `source->target:type:index`
5. **Arrowheads:** SVG `marker-end` with `orient="auto"` on vertical segment; `refX` at triangle tip

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
| `DATE_SCALE` | 8 | Pixels per year for same-rail `siblingGap` |
| `MIN_BRANCH_GAP` | 48 | Min spacing between bus stub origin groups |
| `MULTI_STUB_GAP` | 14 | Offset between ordination/consecration stubs on same child |
| `CARD_INSET` | 4 | Router collision inset (trunks only; stub endpoints use real card edge) |
| `LANE_PITCH` | 9 | Lane offset for overlapping trunk segments |

---

## Tests

```bash
node tests/test_lineage_grid_layout.js
node tests/test_lineage_grid_router.js
```

Layout: first clergy left edge, orphan bishops, descendant ranking, adaptive branch spacing (leaf vs hub), compact bus trunks, primary succession selection, chronological origins, multi-relation pitch, buses, alternating sides, nested hubs, cycle break, priests toggle, AABB no-overlap.

Router: segment occupancy, bus trunk at midline, vertical-only stubs, real card-edge endpoints, multi-relation stub keys.

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
5. **Succession buses:** Red trunks; bus-only succession stubs; bishop consecration-only incoming.
6. **Branch layout refinements (current):** Chronological LTR origins; adaptive leaf/hub spacing; vertical stubs with aligned arrowheads; multi-relation offset stubs; `MIN_BRANCH_GAP` / `MULTI_STUB_GAP` metrics.
