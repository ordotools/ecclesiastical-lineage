/**
 * Succession grid — client-side layout, bus routing, and page render.
 *
 * Pipeline (computeLineageGridLayout):
 * 1. Layout nodes — bishops / consecration participants; all if showPriests.
 * 2. Forest — one incoming succession link per person; break cycles (newest edge).
 * 3. First clergy — no layout parent; lineages ranked largest first, packed side by side.
 * 4. Grid — MatrixBuilder places every card in a grid cell (collision-free by construction).
 * 5. Draw — cards as CSS grid items; grey trunk on the card's middle row; vertical stubs to card edges.
 */
import gridMetrics from '../config/grid-metrics.json?v=25' with { type: 'json' };
import { MatrixBuilder } from './matrix-builder.js?v=25';

export const GRID_METRICS = { ...gridMetrics };
GRID_METRICS.CARD_H = GRID_METRICS.CARD_ROWS * GRID_METRICS.ROW_H
  + (GRID_METRICS.CARD_ROWS - 1) * GRID_METRICS.GAP_Y;

const GREEN_COLOR = '#0b9f2f';
const RED_COLOR = '#e74c3c';
const ORANGE_COLOR = '#f39c12';
const ORDINATION_STROKE = '#c8d4dc';
const BUS_T_CAP_HALF = 10;
const MIN_ZOOM = 0.08;

const {
  CARD_W,
  CARD_H,
  ROW_H,
  CARD_ROWS,
  BUS_OFFSET_ROWS,
  LINEAGE_GAP,
  PACK_ASPECT,
  GAP_X,
  GAP_Y,
  PAD,
} = GRID_METRICS;

/** Higher rank = more valid (Table A inverted for selection). */
const VALIDITY_RANK = {
  valid: 5,
  sub_conditione: 4,
  doubtful_event: 3,
  doubtfully_valid: 2,
  invalid: 1,
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function linkEndpoint(value) {
  if (value != null && typeof value === 'object') return value.id ?? null;
  return value ?? null;
}

function linkEndpoints(link) {
  return {
    source: linkEndpoint(link.source),
    target: linkEndpoint(link.target),
  };
}

function eventSortKey(link) {
  const key = link.event_sort_key;
  return [key == null, key != null ? key : 0];
}

function compareEventSort(a, b) {
  const ka = eventSortKey(a);
  const kb = eventSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] ? 1 : -1;
  return ka[1] - kb[1];
}

function compareLinkEventSort(a, b) {
  const ka = a.event_sort_key;
  const kb = b.event_sort_key;
  const aNull = ka == null;
  const bNull = kb == null;
  if (aNull !== bNull) return aNull ? 1 : -1;
  if (ka !== kb) return ka - kb;
  const typeOrder = { ordination: 0, consecration: 1 };
  return (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2);
}

export function positionX(position, metrics = GRID_METRICS) {
  const x = Number(position.x);
  return Number.isFinite(x) ? x : metrics.PAD;
}

export function positionY(position, metrics = GRID_METRICS) {
  const y = Number(position.y);
  return Number.isFinite(y) ? y : metrics.PAD;
}

function pointsToPath(points) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  rest.forEach((p) => { d += ` L ${p.x} ${p.y}`; });
  return d;
}

export function stubPathKey(sourceId, targetId, link, index) {
  return `${sourceId}->${targetId}:${link.type}:${index}`;
}

/** Card rect for routing hit-tests (no inset — stubs use real card edges). */
export function inflatedCardRect(position, metrics = GRID_METRICS) {
  return {
    x: positionX(position, metrics),
    y: positionY(position, metrics),
    w: metrics.CARD_W,
    h: metrics.CARD_H,
  };
}

export function rectIntersectsSegment(rect, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const rectRight = rect.x + rect.w;
  const rectBottom = rect.y + rect.h;
  if (maxX < rect.x || minX > rectRight || maxY < rect.y || minY > rectBottom) {
    return false;
  }
  if (y1 === y2) {
    const y = y1;
    if (y <= rect.y || y >= rectBottom) return false;
    return maxX > rect.x && minX < rectRight;
  }
  const x = x1;
  if (x <= rect.x || x >= rectRight) return false;
  return maxY > rect.y && minY < rectBottom;
}

function rightCenter(rect) {
  return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
}

// ---------------------------------------------------------------------------
// Layout — forest
// ---------------------------------------------------------------------------

function linkValidityRank(link) {
  if (link.is_invalid) return VALIDITY_RANK.invalid;
  if (link.is_doubtfully_valid) return VALIDITY_RANK.doubtfully_valid;
  if (link.is_doubtful_event) return VALIDITY_RANK.doubtful_event;
  if (link.is_sub_conditione) return VALIDITY_RANK.sub_conditione;
  return VALIDITY_RANK.valid;
}

function isBishopNode(node) {
  if (!node) return false;
  return !!node.is_bishop || (node.consecrations_count || 0) > 0;
}

function incomingSuccessionType(node) {
  return isBishopNode(node) ? 'consecration' : 'ordination';
}

function comparePrimarySuccession(a, b) {
  const rankDiff = linkValidityRank(b) - linkValidityRank(a);
  if (rankDiff !== 0) return rankDiff;
  const ka = eventSortKey(a);
  const kb = eventSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] ? -1 : 1;
  return kb[1] - ka[1];
}

function selectPrimarySuccessionLinks(links, nodeById) {
  const byTarget = new Map();
  links.forEach((link) => {
    if (link.type === 'co-consecration') return;
    if (link.type !== 'ordination' && link.type !== 'consecration') return;
    const target = linkEndpoint(link.target);
    const source = linkEndpoint(link.source);
    if (target == null || source == null) return;
    const node = nodeById.get(target);
    if (link.type !== incomingSuccessionType(node)) return;
    if (!byTarget.has(target)) byTarget.set(target, []);
    byTarget.get(target).push(link);
  });

  const primaryLinks = [];
  byTarget.forEach((targetLinks) => {
    const ordered = [...targetLinks].sort(comparePrimarySuccession);
    if (ordered.length) primaryLinks.push(ordered[0]);
  });
  return primaryLinks;
}

function edgesEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

/** Return edges forming one directed cycle, or null. O(V+E) per call. */
function findCycleEdges(edges) {
  const graph = new Map();
  const nodes = new Set();
  edges.forEach(([source, target]) => {
    if (!graph.has(source)) graph.set(source, []);
    graph.get(source).push(target);
    nodes.add(source);
    nodes.add(target);
  });

  const visiting = new Set();
  const visited = new Set();
  const parent = new Map();

  function dfs(node) {
    visiting.add(node);
    const children = (graph.get(node) || []).slice().sort((a, b) => a - b);
    for (const child of children) {
      if (visiting.has(child)) {
        const cycle = [[node, child]];
        let cur = node;
        while (cur !== child) {
          const p = parent.get(cur);
          cycle.push([p, cur]);
          cur = p;
        }
        return cycle;
      }
      if (!visited.has(child)) {
        parent.set(child, node);
        const found = dfs(child);
        if (found) return found;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of [...nodes].sort((a, b) => a - b)) {
    if (!visited.has(node)) {
      const found = dfs(node);
      if (found) return found;
    }
  }
  return null;
}

/** Break cycles by removing the newest edge on each cycle. */
function breakCycles(edges, linksByPair) {
  let remaining = [...edges];

  function removalKey(edge) {
    const meta = linksByPair.get(`${edge[0]}:${edge[1]}`) || {};
    return [
      meta.event_sort_key == null ? 1 : 0,
      meta.event_sort_key || 0,
      edge[1],
      edge[0],
    ];
  }

  function pickNewestEdge(cycleEdges) {
    return cycleEdges.reduce((best, edge) => {
      const bk = removalKey(best);
      const ek = removalKey(edge);
      for (let i = 0; i < ek.length; i += 1) {
        if (ek[i] > bk[i]) return edge;
        if (ek[i] < bk[i]) return best;
      }
      return best;
    });
  }

  while (true) {
    const cycle = findCycleEdges(remaining);
    if (!cycle) break;
    const toRemove = pickNewestEdge(cycle);
    remaining = remaining.filter((e) => !edgesEqual(e, toRemove));
  }
  return remaining;
}

function buildLayoutForest(layoutNodeIds, primaryLinks) {
  const linksByPair = new Map();
  primaryLinks.forEach((l) => {
    const s = linkEndpoint(l.source);
    const t = linkEndpoint(l.target);
    if (s != null && t != null) linksByPair.set(`${s}:${t}`, l);
  });

  const edgePairs = primaryLinks.map((l) => [linkEndpoint(l.source), linkEndpoint(l.target)]);
  const brokenEdges = breakCycles(edgePairs, linksByPair);

  const layoutEdges = brokenEdges.filter(
    ([source, target]) => layoutNodeIds.has(source) && layoutNodeIds.has(target),
  );

  const layoutEdgeMeta = new Map();
  layoutEdges.forEach(([source, target]) => {
    const key = `${source}:${target}`;
    const meta = linksByPair.get(key) || { source, target, type: 'consecration' };
    layoutEdgeMeta.set(key, { source, target, ...meta });
  });

  const children = new Map();
  layoutEdges.forEach(([source, target]) => {
    if (!children.has(source)) children.set(source, []);
    const meta = layoutEdgeMeta.get(`${source}:${target}`) || { source, target };
    children.get(source).push([target, meta]);
  });
  children.forEach((list, source) => {
    list.sort((a, b) => {
      const cmp = compareEventSort(a[1], b[1]);
      return cmp !== 0 ? cmp : a[0] - b[0];
    });
    children.set(source, list);
  });

  const parents = new Map();
  layoutEdges.forEach(([source, target]) => {
    if (!parents.has(target)) parents.set(target, []);
    parents.get(target).push(source);
  });

  return { children, parents, layoutEdges, layoutEdgeMeta };
}

function computeDescendantMetrics(children, nodeIds) {
  const directCount = {};
  const totalDescendants = {};
  const memo = new Map();

  function total(nid) {
    if (memo.has(nid)) return memo.get(nid);
    const childList = children.get(nid) || [];
    directCount[nid] = childList.length;
    let sum = 0;
    childList.forEach(([cid]) => { sum += 1 + total(cid); });
    memo.set(nid, sum);
    return sum;
  }

  [...nodeIds].sort((a, b) => a - b).forEach((nid) => total(nid));
  nodeIds.forEach((nid) => {
    totalDescendants[nid] = memo.get(nid) || 0;
  });
  return { directCount, totalDescendants };
}

// ---------------------------------------------------------------------------
// Layout — grid (MatrixBuilder)
// ---------------------------------------------------------------------------

function nodeSortKey(node) {
  const date = node.consecration_date || node.ordination_date || '';
  return [-0, date, (node.name || '').toLowerCase(), node.id || 0];
}

function seedRankKey(nodeId, totalDescendants, nodeById) {
  const node = nodeById.get(nodeId) || { id: nodeId };
  const desc = -(totalDescendants[nodeId] || 0);
  return [desc, ...nodeSortKey(node)];
}

function compareSeedRank(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function selectClusterSeeds(firstClergyIds, totalDescendants, nodeById) {
  return [...firstClergyIds].sort((a, b) => {
    const ak = seedRankKey(a, totalDescendants, nodeById);
    const bk = seedRankKey(b, totalDescendants, nodeById);
    return compareSeedRank(ak, bk);
  });
}

function isLayoutEligibleNode(node, consecrationParticipants) {
  if (consecrationParticipants.has(node.id)) return true;
  if (node.is_bishop) return true;
  if ((node.consecrations_count || 0) > 0) return true;
  return false;
}

function computeFirstClergyIds(layoutNodeIds, parents) {
  return [...layoutNodeIds]
    .filter((nid) => !(parents.get(nid) || []).length)
    .sort((a, b) => a - b);
}

function prepareLayoutGraph(nodes, links, showPriests) {
  const nodeById = new Map();
  nodes.forEach((n) => {
    if (n.id != null) nodeById.set(n.id, n);
  });
  const visibleIds = new Set(nodeById.keys());

  const consecrationParticipants = new Set();
  links.forEach((link) => {
    if (link.type !== 'consecration') return;
    const { source, target } = linkEndpoints(link);
    if (source != null) consecrationParticipants.add(source);
    if (target != null) consecrationParticipants.add(target);
  });

  const layoutNodeIds = showPriests
    ? new Set(visibleIds)
    : new Set(
      [...visibleIds].filter((nid) => {
        const node = nodeById.get(nid);
        return node && isLayoutEligibleNode(node, consecrationParticipants);
      }),
    );

  const primaryLinks = selectPrimarySuccessionLinks(links, nodeById);
  const { children, parents, layoutEdges } = buildLayoutForest(layoutNodeIds, primaryLinks);
  const firstClergyIds = computeFirstClergyIds(layoutNodeIds, parents);
  const { directCount, totalDescendants } = computeDescendantMetrics(children, layoutNodeIds);

  const seeds = selectClusterSeeds(firstClergyIds, totalDescendants, nodeById);
  return {
    layoutNodeIds, children, layoutEdges, firstClergyIds, directCount, totalDescendants, seeds,
  };
}

function nestTree(id, children) {
  return { id, children: (children.get(id) || []).map(([cid]) => nestTree(cid, children)) };
}

/** Succession forest as nested `{ id, children }` trees, largest lineage first (MatrixBuilder input). */
export function buildSuccessionTrees(nodes, links, { showPriests = false } = {}) {
  const { children, seeds } = prepareLayoutGraph(nodes, links, showPriests);
  return seeds.map((id) => nestTree(id, children));
}

const colX = (col) => PAD + col * (CARD_W + GAP_X);
const rowY = (row) => PAD + row * (ROW_H + GAP_Y);

function computeBounds(positions) {
  const list = Object.values(positions);
  if (!list.length) return { width: PAD * 2, height: PAD * 2, min_y: PAD, rows: 0, cols: 0 };
  const rows = Math.max(...list.map((p) => p.row)) + CARD_ROWS;
  const cols = Math.max(...list.map((p) => p.col)) + 1;
  return {
    width: colX(cols - 1) + CARD_W + PAD,
    height: rowY(rows - CARD_ROWS) + CARD_H + PAD,
    min_y: Math.min(...list.map((p) => p.y)),
    rows,
    cols,
  };
}

/**
 * Lay out visible graph data on the card grid via MatrixBuilder; x/y are the pixel
 * coordinates of each card's grid cell so bus routing lines up with the CSS grid.
 *
 * @param {object[]} nodes - Visible clergy nodes
 * @param {object[]} links - Display links (both endpoints visible)
 * @param {object} [options]
 * @param {boolean} [options.showPriests=false]
 */
export function computeLineageGridLayout(nodes, links, options = {}) {
  const { showPriests = false } = options;
  const {
    layoutNodeIds, children, layoutEdges, firstClergyIds, directCount, totalDescendants, seeds,
  } = prepareLayoutGraph(nodes, links, showPriests);

  const builder = new MatrixBuilder(seeds.map((id) => nestTree(id, children)), {
    cardRows: CARD_ROWS,
    busOffset: BUS_OFFSET_ROWS,
    lineageGap: LINEAGE_GAP,
    packAspect: PACK_ASPECT,
    cellAspect: (CARD_W + GAP_X) / (ROW_H + GAP_Y),
  });
  builder.build();
  const topRow = builder.positions.size ? builder.bounds.minRow : 0;

  const positions = {};
  builder.positions.forEach((p, id) => {
    const row = p.row - topRow;
    positions[id] = { x: colX(p.col), y: rowY(row), row, col: p.col, ...(p.side && { side: p.side }) };
  });

  const buses = builder.buses.map((bus) => ({
    source: bus.source,
    timeline_y: rowY(bus.row - topRow) + ROW_H / 2,
    timeline_start_x: colX(bus.fromCol) + CARD_W,
    targets: bus.targets.map(({ target, side }) => ({
      target,
      side,
      origin_x: positions[target].x + CARD_W / 2,
    })),
  }));

  const metrics = {};
  layoutNodeIds.forEach((nid) => {
    metrics[nid] = {
      direct_count: directCount[nid] || 0,
      total_descendants: totalDescendants[nid] || 0,
    };
  });

  return {
    positions,
    primary_edges: layoutEdges
      .map(([s, t]) => ({ source: s, target: t }))
      .sort((a, b) => (a.source - b.source) || (a.target - b.target)),
    buses,
    layout_node_ids: [...layoutNodeIds].sort((a, b) => a - b),
    first_clergy_ids: firstClergyIds,
    bounds: computeBounds(positions),
    metrics,
    grid_metrics: { ...GRID_METRICS },
  };
}

// ---------------------------------------------------------------------------
// Bus routing — stubs always draw; layout handles spacing
// ---------------------------------------------------------------------------

function buildLinksByPair(links) {
  const map = new Map();
  links.forEach((link) => {
    if (link.type !== 'ordination' && link.type !== 'consecration') return;
    const { source, target } = linkEndpoints(link);
    if (source == null || target == null) return;
    const key = `${source}:${target}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(link);
  });
  map.forEach((list) => list.sort(compareLinkEventSort));
  return map;
}

export function pathKeyForLink(source, target, link, linksByPair) {
  const relations = linksByPair.get(`${source}:${target}`) || [];
  const index = relations.indexOf(link);
  if (index >= 0) return stubPathKey(source, target, link, index);
  return `${source}->${target}`;
}

function routeBuses(buses, linksByPair, positions, metrics) {
  const paths = new Map();

  (buses || []).forEach((bus) => {
    const hubId = Number(bus.source);
    const hubPos = positions[hubId];
    if (!hubPos) return;

    const cardRightX = positionX(hubPos, metrics) + metrics.CARD_W;
    const trunkY = bus.timeline_y != null
      ? Number(bus.timeline_y)
      : positionY(hubPos, metrics) + metrics.CARD_H / 2;

    const targetEntries = (bus.targets || []).map((entry) => {
      const targetId = Number(entry.target);
      const targetPos = positions[targetId];
      if (!targetPos) return null;

      const targetLinks = linksByPair.get(`${hubId}:${targetId}`) || [];
      const cardCenterX = entry.origin_x != null
        ? Number(entry.origin_x)
        : positionX(targetPos, metrics) + metrics.CARD_W / 2;
      const edgeY = entry.side === 'above'
        ? positionY(targetPos, metrics) + metrics.CARD_H
        : positionY(targetPos, metrics);

      return { targetId, cardCenterX, edgeY, targetLinks };
    }).filter(Boolean);

    if (!targetEntries.length) return;

    const timelineStartX = Number.isFinite(Number(bus.timeline_start_x))
      ? Number(bus.timeline_start_x)
      : cardRightX;
    const maxStubX = Math.max(...targetEntries.map((entry) => {
      const n = entry.targetLinks.length || 1;
      const groupHalf = n <= 1 ? 0 : ((n - 1) * metrics.MULTI_STUB_GAP) / 2;
      return entry.cardCenterX + groupHalf;
    }));
    const timelineEndX = Number.isFinite(Number(bus.timeline_end_x))
      ? Number(bus.timeline_end_x)
      : Math.max(timelineStartX, maxStubX + 8);

    paths.set(`bus-trunk:${hubId}`, pointsToPath([
      { x: timelineStartX, y: trunkY },
      { x: timelineEndX, y: trunkY },
    ]));

    targetEntries.forEach((entry) => {
      const relations = entry.targetLinks.length
        ? entry.targetLinks
        : [{ type: 'consecration' }];
      const n = relations.length;
      relations.forEach((link, i) => {
        const attachX = entry.cardCenterX + (i - (n - 1) / 2) * metrics.MULTI_STUB_GAP;
        const path = pointsToPath([
          { x: attachX, y: trunkY },
          { x: attachX, y: entry.edgeY },
        ]);
        const key = entry.targetLinks.length
          ? stubPathKey(hubId, entry.targetId, link, i)
          : `${hubId}->${entry.targetId}`;
        paths.set(key, path);
      });
    });
  });

  return paths;
}

/**
 * Route bus trunks and vertical stubs; returns Map pathKey -> SVG d string.
 */
export function routeAllEdges(links, positions, layout, _linkEndpointsFn, metrics = {}) {
  const activeMetrics = { ...GRID_METRICS, ...layout?.grid_metrics, ...metrics };
  const linksByPair = buildLinksByPair(links);
  return routeBuses(layout.buses, linksByPair, positions, activeMetrics);
}

/** Parse trunk path to get Y and X extent (for tests). */
export function parseTrunkPath(pathD) {
  const nums = (pathD.match(/-?\d+\.?\d*/g) || []).map(Number);
  if (nums.length < 4) return null;
  return {
    y: nums[1],
    xMin: Math.min(nums[0], nums[2]),
    xMax: Math.max(nums[0], nums[2]),
  };
}

// ---------------------------------------------------------------------------
// Page render
// ---------------------------------------------------------------------------

function activeMetricsFromLayout(layout) {
  return { ...GRID_METRICS, ...layout?.grid_metrics };
}

function buildPrimaryEdgeSet(primaryEdges) {
  const set = new Set();
  (primaryEdges || []).forEach((edge) => {
    set.add(`${edge.source}->${edge.target}`);
  });
  return set;
}

function edgeStyle(link) {
  let stroke = link.type === 'ordination' ? ORDINATION_STROKE : (link.color || GREEN_COLOR);
  let strokeWidth = link.type === 'ordination' ? 1.75 : 2.25;
  let strokeDasharray = '';
  let opacity = 1;

  if (link.is_invalid) stroke = RED_COLOR;
  else if (link.is_doubtfully_valid) stroke = ORANGE_COLOR;

  if (link.type === 'co-consecration' || link.dashed) strokeDasharray = '7 5';
  if (link.is_doubtful_event) {
    strokeDasharray = strokeDasharray || '4 4';
    opacity = 0.65;
  }
  if (link.is_inherited) opacity = Math.min(opacity, 0.55);
  if (link.is_sub_conditione && link.type !== 'ordination') strokeWidth = 3;

  return { stroke, strokeWidth, strokeDasharray, opacity };
}

function validityLabel(link) {
  if (link.is_invalid) return 'invalid';
  if (link.is_doubtfully_valid) return 'doubtful';
  if (link.is_sub_conditione) return 'sub cond.';
  if (link.is_doubtful_event) return 'doubtful event';
  return '';
}

function spritePosition(mapping, id) {
  if (!mapping) return null;
  const pos = mapping[id] ?? mapping[String(id)] ?? mapping[Number(id)];
  if (Array.isArray(pos) && pos.length >= 2) return pos;
  return null;
}

function applySpritePhoto(photoEl, nodeId, spriteSheetData) {
  if (!spriteSheetData?.success || !spriteSheetData.url) return;
  const pos = spritePosition(spriteSheetData.mapping, nodeId);
  if (!pos) return;
  const sw = spriteSheetData.sprite_width;
  const sh = spriteSheetData.sprite_height;
  if (!sw || !sh) return;
  photoEl.style.setProperty('--sprite-url', `url(${JSON.stringify(spriteSheetData.url)})`);
  photoEl.style.setProperty('--sprite-x', `${-pos[0]}px`);
  photoEl.style.setProperty('--sprite-y', `${-pos[1]}px`);
  photoEl.style.setProperty('--sprite-size', `${sw}px ${sh}px`);
}

function applySpritesToCards(cardsLayer, spriteSheetData) {
  if (!cardsLayer || !spriteSheetData) return;
  cardsLayer.querySelectorAll('.lineage-grid-card').forEach((card) => {
    const photo = card.querySelector('.lineage-grid-card__photo');
    if (photo) applySpritePhoto(photo, Number(card.dataset.clergyId), spriteSheetData);
  });
}

function renderCards(stage, nodes, positions, bounds, metrics) {
  const cardsLayer = document.createElement('div');
  cardsLayer.className = 'lineage-grid-cards';
  cardsLayer.style.setProperty('--grid-cols', String(bounds.cols || 1));
  cardsLayer.style.setProperty('--grid-rows', String(bounds.rows || 1));
  const fragment = document.createDocumentFragment();

  nodes.forEach((node) => {
    const pos = positions[node.id];
    if (!pos) return;

    const card = document.createElement('article');
    card.className = 'lineage-grid-card';
    card.dataset.clergyId = String(node.id);
    card.style.gridArea = `${pos.row + 1} / ${pos.col + 1} / span ${metrics.CARD_ROWS} / span 1`;
    card.style.setProperty('--org-color', node.org_color || '#2c3e50');

    const row = document.createElement('div');
    row.className = 'lineage-grid-card__row';

    const photo = document.createElement('div');
    photo.className = 'lineage-grid-card__photo';
    photo.setAttribute('aria-hidden', 'true');

    const metaStack = document.createElement('div');
    metaStack.className = 'lineage-grid-card__meta-stack';

    const rank = document.createElement('p');
    rank.className = 'lineage-grid-card__rank';
    rank.textContent = node.rank || '';

    const org = document.createElement('p');
    org.className = 'lineage-grid-card__org';
    org.textContent = node.organization || '';

    metaStack.appendChild(rank);
    metaStack.appendChild(org);
    row.appendChild(photo);
    row.appendChild(metaStack);

    const name = document.createElement('h2');
    name.className = 'lineage-grid-card__name';
    name.textContent = node.name || '';

    card.appendChild(row);
    card.appendChild(name);
    fragment.appendChild(card);
  });

  cardsLayer.appendChild(fragment);
  stage.appendChild(cardsLayer);
  return cardsLayer;
}

function lastPathSegment(pathD) {
  const nums = (pathD.match(/-?\d+\.?\d*/g) || []).map(Number);
  if (nums.length < 4) return null;
  return {
    x1: nums[nums.length - 4],
    y1: nums[nums.length - 3],
    x2: nums[nums.length - 2],
    y2: nums[nums.length - 1],
  };
}

function appendBusTCap(edgesGroup, pathData) {
  const seg = lastPathSegment(pathData);
  if (!seg) return;
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  cap.setAttribute(
    'd',
    `M ${seg.x2 + nx * BUS_T_CAP_HALF} ${seg.y2 + ny * BUS_T_CAP_HALF} L ${seg.x2 - nx * BUS_T_CAP_HALF} ${seg.y2 - ny * BUS_T_CAP_HALF}`,
  );
  cap.setAttribute('fill', 'none');
  cap.classList.add('lineage-grid-edge', 'lineage-grid-edge--bus-trunk', 'lineage-grid-edge--bus-cap');
  edgesGroup.appendChild(cap);
}

function renderEdges(svg, links, positions, layout, primaryEdgeSet, metrics) {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  ['grid-arrow-green', 'grid-arrow-ordination', 'grid-arrow-red', 'grid-arrow-orange'].forEach((id) => {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '4');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
    path.setAttribute(
      'fill',
      id.includes('ordination') ? ORDINATION_STROKE
        : id.includes('red') ? RED_COLOR
          : id.includes('orange') ? ORANGE_COLOR
            : GREEN_COLOR,
    );
    marker.appendChild(path);
    defs.appendChild(marker);
  });
  svg.appendChild(defs);

  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edgesGroup.setAttribute('class', 'lineage-grid-edges');
  svg.appendChild(edgesGroup);

  const displayLinks = links.filter((link) => link.type !== 'co-consecration');
  const linksByPair = buildLinksByPair(displayLinks);
  const routedPaths = routeAllEdges(displayLinks, positions, layout, linkEndpoints, metrics);

  displayLinks.forEach((link) => {
    const { source, target } = linkEndpoints(link);
    const sourcePos = positions[source];
    const targetPos = positions[target];
    if (!sourcePos || !targetPos) return;

    const edgeKey = `${source}->${target}`;
    const pathKey = pathKeyForLink(source, target, link, linksByPair);
    const pathData = routedPaths.get(pathKey) || routedPaths.get(edgeKey);
    if (!pathData) return;

    const style = edgeStyle(link);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', style.stroke);
    path.setAttribute('stroke-width', String(style.strokeWidth));
    path.setAttribute('opacity', String(style.opacity));
    if (style.strokeDasharray) path.setAttribute('stroke-dasharray', style.strokeDasharray);
    if (link.is_sub_conditione && link.type !== 'ordination') {
      path.setAttribute('stroke-linecap', 'round');
    }

    let markerId = 'grid-arrow-green';
    if (link.type === 'ordination') markerId = 'grid-arrow-ordination';
    if (link.is_invalid) markerId = 'grid-arrow-red';
    else if (link.is_doubtfully_valid) markerId = 'grid-arrow-orange';
    path.setAttribute('marker-end', `url(#${markerId})`);

    path.classList.add('lineage-grid-edge');
    path.classList.add(`lineage-grid-edge--${link.type.replace(/[^a-z]+/g, '-')}`);
    if (primaryEdgeSet.has(edgeKey)) path.classList.add('lineage-grid-edge--primary');
    if (link.is_sub_conditione) path.classList.add('lineage-grid-edge--sub-conditione');
    edgesGroup.appendChild(path);

    const label = validityLabel(link);
    if (label && link.type !== 'ordination') {
      const sourceRect = inflatedCardRect(sourcePos, metrics);
      const mid = rightCenter(sourceRect);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(mid.x + 6));
      text.setAttribute('y', String(mid.y - 4));
      text.setAttribute('class', 'lineage-grid-edge-label');
      text.textContent = label;
      edgesGroup.appendChild(text);
    }
  });

  (layout.buses || []).forEach((bus) => {
    const trunkKey = `bus-trunk:${Number(bus.source)}`;
    const pathData = routedPaths.get(trunkKey);
    if (!pathData) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.classList.add('lineage-grid-edge', 'lineage-grid-edge--bus-trunk');
    edgesGroup.appendChild(path);
    appendBusTCap(edgesGroup, pathData);
  });
}

function computeStageSize(positions, layout, metrics) {
  if (layout?.bounds?.width && layout?.bounds?.height) {
    return { width: layout.bounds.width, height: layout.bounds.height };
  }
  let maxX = metrics.PAD;
  let maxY = metrics.PAD;
  Object.values(positions).forEach((pos) => {
    maxX = Math.max(maxX, positionX(pos, metrics) + metrics.CARD_W);
    maxY = Math.max(maxY, positionY(pos, metrics) + metrics.CARD_H);
  });
  return { width: maxX + metrics.PAD, height: maxY + metrics.PAD };
}

function initPanZoom(viewport, stage) {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const apply = () => {
    stage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  };

  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 0.92 : 1.08;
      const next = Math.min(2.5, Math.max(MIN_ZOOM, scale * delta));
      const rect = viewport.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      translateX = px - ((px - translateX) * next) / scale;
      translateY = py - ((py - translateY) * next) / scale;
      scale = next;
      apply();
    },
    { passive: false },
  );

  viewport.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.classList.add('is-dragging');
  });

  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    translateX += event.clientX - lastX;
    translateY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    apply();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    viewport.classList.remove('is-dragging');
  });

  apply();
}

async function loadSpriteSheetData() {
  try {
    if (typeof window.getSpriteSheetData === 'function') {
      return await window.getSpriteSheetData();
    }
    const response = await fetch('/api/sprite-sheet', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('Failed to load sprite sheet:', error);
    return null;
  }
}

function renderGrid(viewport, stage, nodes, links, showPriests, spriteSheetData) {
  stage.replaceChildren();

  const layout = computeLineageGridLayout(nodes, links, { showPriests });
  const positions = layout.positions || {};
  const activeMetrics = activeMetricsFromLayout(layout);

  const root = document.querySelector('.lineage-grid-page');
  if (root) {
    root.style.setProperty('--grid-card-w', `${activeMetrics.CARD_W}px`);
    root.style.setProperty('--grid-card-h', `${activeMetrics.CARD_H}px`);
    root.style.setProperty('--grid-row-h', `${activeMetrics.ROW_H}px`);
    root.style.setProperty('--grid-gap-x', `${activeMetrics.GAP_X}px`);
    root.style.setProperty('--grid-gap-y', `${activeMetrics.GAP_Y}px`);
    root.style.setProperty('--grid-pad', `${activeMetrics.PAD}px`);
  }

  const layoutIds = new Set(layout.layout_node_ids || Object.keys(positions).map(Number));
  const visibleNodes = nodes.filter((n) => layoutIds.has(n.id));
  const size = computeStageSize(positions, layout, activeMetrics);

  stage.style.width = `${size.width}px`;
  stage.style.height = `${size.height}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lineage-grid-svg');
  svg.setAttribute('width', String(size.width));
  svg.setAttribute('height', String(size.height));
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  stage.appendChild(svg);

  const primaryEdgeSet = buildPrimaryEdgeSet(layout.primary_edges);
  renderEdges(svg, links, positions, layout, primaryEdgeSet, activeMetrics);
  const cardsLayer = renderCards(stage, visibleNodes, positions, layout.bounds, activeMetrics);

  if (spriteSheetData) applySpritesToCards(cardsLayer, spriteSheetData);

  initPanZoom(viewport, stage);
  return { layout, cardsLayer };
}

export async function initializeLineageGrid() {
  const viewport = document.getElementById('lineage-grid-viewport');
  const stage = document.getElementById('lineage-grid-stage');
  if (!viewport || !stage) return;

  const nodes = window.nodesData || [];
  const links = window.linksData || [];

  if (!nodes.length) {
    viewport.innerHTML = '<p class="lineage-grid-empty">No clergy data available.</p>';
    return;
  }

  let showPriests = window.showPriests === true || window.showPriests === 'true';
  const spritePromise = loadSpriteSheetData();

  const state = renderGrid(viewport, stage, nodes, links, showPriests, null);
  spritePromise.then((spriteSheetData) => {
    if (spriteSheetData) applySpritesToCards(state.cardsLayer, spriteSheetData);
  });

  const priestToggle = document.getElementById('lineage-grid-show-priests');
  if (priestToggle) {
    priestToggle.addEventListener('change', () => {
      showPriests = priestToggle.checked;
      const url = new URL(window.location.href);
      if (showPriests) url.searchParams.set('show_priests', '1');
      else url.searchParams.delete('show_priests');
      window.history.replaceState(null, '', url.toString());
      window.showPriests = showPriests;

      const next = renderGrid(viewport, stage, nodes, links, showPriests, null);
      spritePromise.then((spriteSheetData) => {
        if (spriteSheetData) applySpritesToCards(next.cardsLayer, spriteSheetData);
      });
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLineageGrid);
  } else {
    initializeLineageGrid();
  }
}
