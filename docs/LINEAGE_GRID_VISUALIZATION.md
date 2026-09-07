# Lineage Grid Visualization — Progress & Algorithm

**Route:** `/succession`  
**Status:** Active development (client-side timeline packing)

Grid-based apostolic succession view. Layout, routing, and render run entirely in the browser from visible graph data.

---

## Progress summary

### Completed

| Area | What was done |
|------|----------------|
| **Single client module** | All viz logic in [`static/js/lineage-grid.js`](../static/js/lineage-grid.js) |
| **Layout engine** | Timeline packing: forest, first clergy, branch spacing, collision, buses |
| **Bus routing** | Trunks + vertical stubs only (no gutter/lane router) |
| **Visible-only backend payload** | Route sends `nodes`, `links` only — no pixel positions |
| **First clergy left edge** | No visualized consecration predecessor → left-edge seed at `x = PAD` |
| **Excluded clergy filter** | `_lineage_nodes_links()` drops `exclude_from_visualization` |
| **Orphan bishop coverage** | Bishops / `consecrations_count > 0` stay on chart |
| **Descendant ranking** | `direct_count`, `total_descendants`; largest trees first |
| **Timeline buses** | Grey horizontal trunk; children alternate above/below |
| **Succession forest** | One primary incoming edge per clergy; best validity then latest date |
| **Bus-only succession lines** | Ordination/consecration stubs from buses only |
| **Chronological branch order** | Direct children sorted by `event_sort_key`; origins advance LTR |
| **Adaptive branch spacing** | Leaf-only: even minimal pitch; hub: sequential min gap |
| **Multi-relation stubs** | Separate offset arrows for ordination + consecration on same pair |
| **Vertical stub routing** | Pure vertical segments to real card edge |
| **Card collision pass** | Post-placement AABB nudge (cluster bbox pre-check) |
| **Shared metrics** | [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) |
| **In-place priest toggle** | Re-layout without full page reload |
| **Tests** | 31 layout + 8 router tests |

### Intentionally not done (yet)

- Postgres metrics table
- Global calendar axis across whole chart
- Changing co-consecration display on other visualizations
- Ghost cards for excluded clergy

### Known limitations / follow-ups

- Exclusion creates more left-edge forests; disconnected clusters stack vertically → tall canvas
- Nested descendant buses may extend past parent trunk (by design)
- Static JS long-cached in production; bump `?v=` on changes (currently `?v=14`)
- Bus trunks stay on parent card midline; no lane-shift jog for overlapping Y
- `LineageRoot` table vs `exclude_from_visualization` — later migration/cleanup

---

## Architecture

```
GET /succession
    │
    ▼
routes/main.py::lineage_grid()
    │  nodes, links, show_priests (query param only)
    ▼
templates/lineage_grid.html  →  window.nodesData, linksData
    │
    ▼
static/js/lineage-grid.js
    computeLineageGridLayout()  — forest, packing, collision, buses
    routeAllEdges()             — trunk + vertical stubs
    render cards / SVG / pan-zoom
    │
    ▼ (after first paint)
GET /api/sprite-sheet           — clergy photo tiles
static/css/lineage-grid.css
```

**Server computes:** graph nodes/links from DB (names, dates, validity flags, `event_sort_key`, `is_bishop`).  
**Server does not compute:** positions, columns, buses, edge paths.  
**Unused on grid:** `is_lineage_root` (table view only).

---

## Algorithm

Entry: `computeLineageGridLayout(nodes, links, { showPriests })`.

1. **Layout nodes** — bishops / consecration participants; all visible nodes if `showPriests`.
2. **Forest** — one incoming succession link per target (bishop → consecration, priest → ordination); best validity then latest `event_sort_key`; co-consecration excluded; cycles broken by removing newest edge on each cycle.
3. **First clergy** — layout nodes with no layout parent; seeds sorted by `total_descendants` (largest first), each at `(PAD, cluster_y + extent_above)`.
4. **Pack** — children LTR by date, alternate above/below; leaf branches use even pitch at `MIN_BRANCH_GAP`; hub branches use sequential min gap; same-rail clearance via `railMinX`.
5. **Collide** — later clusters shift down until no card AABB overlap (cluster bbox pre-check, then member-level).
6. **Draw** — grey horizontal trunk at parent midline; vertical stub per ordination/consecration to real card edge (layout handles spacing; stubs always draw).

### Return payload

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

## Complexity notes

| Operation | Cost | Notes |
|-----------|------|-------|
| Cycle break | O(cycles · (V+E)) | One DFS per cycle; remove newest edge |
| Descendant metrics | O(N) | Post-order memo on forest |
| Link indexing | O(L) once | `buildLinksByPair` for routing |
| Collision | O(C² · members) worst case | Cluster bbox rejects most pairs early |
| Layout prepass | O(N) | Extents + subtree widths cached |

---

## Always-works checklist

### Input

- [x] Excluded clergy never in `nodes` or `links`
- [x] Both link endpoints exist in `nodes`
- [x] Layout does not receive hidden IDs

### Forest

- [x] One primary succession parent per target
- [x] Co-consecration never creates layout parent; not drawn on grid
- [x] Cycles broken deterministically
- [x] First clergy = no visualized succession predecessor

### Geometry

- [x] Every first clergy at left (`x = PAD`)
- [x] Children LTR by `event_sort_key`; alternate above/below
- [x] Leaf-only branches: even minimal bus origin pitch
- [x] Hub branches: sequential min origin gap
- [x] Same-rail cards never overlap
- [x] Nested extents; `GAP_Y` card-edge clearance
- [x] No overlapping cards after AABB pass
- [x] Repeat run → identical positions

### Coverage

- [x] Every layout-eligible visible node gets a position
- [x] `show_priests` adds non-consecrated nodes without breaking bishop rules

### Edges

- [x] Grey bus trunks; color-coded stubs
- [x] Succession lines only from bus stubs
- [x] Vertical stubs terminate on real card edge
- [x] Multi-relation offset stubs centered on `origin_x`
- [x] Bus stubs always draw

---

## Frontend rendering

### Cards

- Absolute `(x, y)` from layout; size from `--grid-card-w` / `--grid-card-h`
- Sprites applied after first paint when `/api/sprite-sheet` returns

### Bus edges

1. **Trunk (grey):** horizontal LTR at `timeline_y` (parent midline)
2. **Stubs:** single vertical segment from trunk to card top/bottom edge
3. **Multi-relation:** `attachX_i = origin_x + (i − (n−1)/2) × MULTI_STUB_GAP`

Co-consecration and gutter routing are not used.

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
| `DATE_SCALE` | 8 | Pixels per year for same-rail clearance |
| `MIN_BRANCH_GAP` | `CARD_W + GAP_X / 2` (194) | Min spacing between bus stub origin groups (derived in JS) |
| `MULTI_STUB_GAP` | 14 | Offset between ordination/consecration stubs |

---

## Tests

```bash
node tests/test_lineage_grid_layout.js
node tests/test_lineage_grid_router.js
```

---

## File reference

| File | Purpose |
|------|---------|
| [`static/js/lineage-grid.js`](../static/js/lineage-grid.js) | Layout, routing, page render |
| [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) | Shared dimensions |
| [`static/css/lineage-grid.css`](../static/css/lineage-grid.css) | Grid page styles |
| [`templates/lineage_grid.html`](../templates/lineage_grid.html) | Template + JSON bootstrap |
| [`routes/main.py`](../routes/main.py) | `/succession` route |
| [`tests/test_lineage_grid_layout.js`](../tests/test_lineage_grid_layout.js) | Layout tests |
| [`tests/test_lineage_grid_router.js`](../tests/test_lineage_grid_router.js) | Router tests |

---

## Evolution (brief)

1. **Original grid:** Generation rows + hub-comb; fixed `row ± 1`.
2. **Timeline packing (Python):** Descendant-ranked clusters; server-side pixels.
3. **Client layout:** JS packing + AABB collision; split layout/router/page modules.
4. **First clergy left edge:** Visible-only payload; no hidden reparenting.
5. **Succession buses:** Bus-only stubs; bishop consecration-only incoming.
6. **Consolidation (current):** Single JS file; dead gutter router removed; simplified cycle/seeds/metrics; in-place priest toggle.
