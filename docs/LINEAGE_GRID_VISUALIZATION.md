# Lineage Grid Visualization — Progress & Algorithm

**Route:** `/succession`  
**Status:** Active development (client-side grid layout via `MatrixBuilder`)

Grid-based apostolic succession view. Layout, routing, and render run entirely in the browser from visible graph data.

---

## Progress summary

### Completed

| Area | What was done |
|------|----------------|
| **Client modules** | Data, routing, render in [`static/js/lineage-grid.js`](../static/js/lineage-grid.js); cell layout in [`static/js/matrix-builder.js`](../static/js/matrix-builder.js) |
| **Grid layout** | Cards on a CSS grid; contour stacking places every card collision-free in one pass (replaced the pack / squeeze / heal passes) |
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
| **Multi-relation stubs** | Separate offset arrows for ordination + consecration on same pair |
| **Vertical stub routing** | Pure vertical segments to real card edge |
| **Shared metrics** | [`static/config/grid-metrics.json`](../static/config/grid-metrics.json) |
| **In-place priest toggle** | Re-layout without full page reload |
| **Tests** | 35 layout (incl. random-forest invariants + 5k timing) + 8 router tests |

### Intentionally not done (yet)

- Postgres metrics table
- Global calendar axis across whole chart
- Changing co-consecration display on other visualizations
- Ghost cards for excluded clergy

### Known limitations / follow-ups

- Lineage packing is bottom-left skyline: a lineage never tucks under another's overhang, so some pockets stay empty
- Rigid per-column contours don't interlock C-shapes, so some subtrees use more rows than a gap-filling packer would
- Nested descendant buses may extend past parent trunk (by design)
- Static JS long-cached in production; bump `?v=` on changes (currently JS `?v=24`, also on the `matrix-builder.js` and `grid-metrics.json` imports; CSS `?v=18`)
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
    computeLineageGridLayout()  — forest → buildSuccessionTrees → MatrixBuilder → x/y + buses
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
2. **Forest** — one incoming succession link per target (bishop → consecration, priest → ordination); best validity then latest `event_sort_key`; co-consecration excluded; cycles broken by removing newest edge on each cycle. Children sorted by `event_sort_key`.
3. **First clergy** — layout nodes with no layout parent; lineages sorted by `total_descendants` (largest first). `buildSuccessionTrees()` returns this forest as nested `{ id, children }` trees.
4. **Grid** — `MatrixBuilder` (`static/js/matrix-builder.js`) places each card in a cell:
   - A card spans `CARD_ROWS` rows in one column; its bus trunk runs along the card's middle row.
   - Child *j* takes column `parentCol + 1 + j`; even index above the trunk, odd below; near card edge `BUS_OFFSET_ROWS` rows from the trunk.
   - `measure()` (post-order) records each subtree's min/max row per column and stacks sibling blocks **nearest-first** (later siblings hug the trunk, earlier ones sit further out), so trunks and stubs never cross a card.
   - Lineages are skyline-packed side by side (largest first, top-left): each takes the column where its contour sits highest, with `LINEAGE_GAP` empty cells between lineages; canvas width targets `PACK_ASPECT` (pixel width / height).
   - No shifting, retries or repair passes: a second write to a cell throws.
5. **Pixels** — `x = PAD + col·(CARD_W + GAP_X)`, `y = PAD + row·(ROW_H + GAP_Y)`; `timeline_y` = centre of the trunk row. These match the CSS grid tracks exactly.
6. **Draw** — cards are CSS grid items (`grid-area` from row/col); SVG overlay draws grey trunks and vertical stubs to real card edges (multi-relation stubs offset by `MULTI_STUB_GAP`).

Chronological **order** is kept; spacing is one column per child, not date distance.

### Return payload

```javascript
{
  positions: { id: { x, y, row, col, side? } },
  primary_edges: [{ source, target }, ...],
  buses: [{
    source, timeline_y, timeline_start_x,   // trunk end computed by the router
    targets: [{ target, side, origin_x }, ...],
  }],
  layout_node_ids: [...],
  first_clergy_ids: [...],
  bounds: { width, height, min_y, rows, cols },
  metrics: { id: { direct_count, total_descendants } },
  grid_metrics: { CARD_W, CARD_H, ROW_H, CARD_ROWS, BUS_OFFSET_ROWS, GAP_X, GAP_Y, PAD, MULTI_STUB_GAP },
}
```

---

## Complexity notes

| Operation | Cost | Notes |
|-----------|------|-------|
| Cycle break | O(cycles · (V+E)) | One DFS per cycle; remove newest edge |
| Descendant metrics | O(N) | Post-order memo on forest |
| Link indexing | O(L) once | `buildLinksByPair` for routing |
| Grid layout | O(N · depth) | Per-column contour merge; ~2 ms for the real data, ~100–150 ms for 50k nodes |

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

- [x] Largest lineage at top-left; others packed beside/below with a `LINEAGE_GAP` cell margin
- [x] Every card on a grid cell; siblings in consecutive columns
- [x] Children LTR by `event_sort_key`; alternate above/below
- [x] Same-rail cards never overlap
- [x] No overlapping cards after occupancy pass
- [x] No trunk or stub passes through a card (by construction; asserted in tests)
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

- CSS grid items: `grid-area: row / col / span CARD_ROWS`; tracks from `--grid-card-w`, `--grid-row-h`, `--grid-gap-x/y`, `--grid-pad`
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
| `CARD_W` | 170 | Card width / column track (px) |
| `ROW_H` | 20 | Grid row track (px) |
| `CARD_ROWS` | 3 | Rows a card spans; trunk on the middle row |
| `BUS_OFFSET_ROWS` | 1 | Rows between a trunk and its children's near card edge |
| `GAP_X` | 22 | Column gap (px) |
| `GAP_Y` | 22 | Row gap (px) |
| `PAD` | 48 | Canvas padding |
| `LINEAGE_GAP` | 1 | Empty cells kept between separate lineages |
| `PACK_ASPECT` | 1.6 | Target canvas width / height (px) for lineage packing |
| `CARD_H` | 104 | Derived in JS: `CARD_ROWS·ROW_H + (CARD_ROWS−1)·GAP_Y` |
| `MULTI_STUB_GAP` | 14 | Offset between ordination/consecration stubs |

Values were tuned visually on real data in the "Succession Grid Tuner" artifact.

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
| [`static/js/lineage-grid.js`](../static/js/lineage-grid.js) | Forest, layout glue, routing, page render |
| [`static/js/matrix-builder.js`](../static/js/matrix-builder.js) | Collision-free cell layout |
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
6. **Consolidation:** Single JS file; dead gutter router removed; simplified cycle/seeds/metrics; in-place priest toggle.
7. **Occupancy packing:** Bus-piece LTR attach; hard zero ink overlap (cards + trunks + stubs); stub-stretch then extra origin; ink-aware heal / inter-cluster Y pockets.
8. **Matrix grid (current):** `MatrixBuilder` contour stacking on a CSS grid; one pass, no repair passes; metrics tuned on real data.
