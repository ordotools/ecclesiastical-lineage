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

/**
 * Placement rule: most valid order wins; among equally valid ones the earliest (undated last).
 * A later, less valid order never displaces an earlier, more valid one.
 */
export function comparePrimarySuccession(a, b) {
  return linkValidityRank(b) - linkValidityRank(a) || compareEventSort(a, b);
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

/** Experimental view: leaf siblings of one organization collapse into a group card at this size. */
export const GROUP_MIN = 5;

/**
 * Replace runs of GROUP_MIN+ leaf children sharing an organization with one group entry
 * (id `group:<parent>:<org>`), placed where the first member was. Groups in `expanded` stay open.
 */
function groupLeafSiblings(children, nodeById, expanded) {
  const groups = {};
  const grouped = new Map();
  children.forEach((list, parentId) => {
    const leavesByOrg = new Map();
    list.forEach(([cid]) => {
      if ((children.get(cid) || []).length || String(cid).startsWith('ghost:')) return;
      const org = nodeById.get(cid)?.organization || '';
      if (!leavesByOrg.has(org)) leavesByOrg.set(org, []);
      leavesByOrg.get(org).push(cid);
    });
    const out = [];
    list.forEach((entry) => {
      const org = nodeById.get(entry[0])?.organization || '';
      const members = leavesByOrg.get(org);
      const gid = `group:${parentId}:${org}`;
      if (!members?.includes(entry[0]) || members.length < GROUP_MIN || expanded.has(gid)) {
        out.push(entry);
        return;
      }
      if (groups[gid]) return;
      const first = nodeById.get(members[0]) || {};
      groups[gid] = { parent: parentId, members, organization: org, org_color: first.org_color };
      out.push([gid, entry[1]]);
    });
    grouped.set(parentId, out);
  });
  return { children: grouped, groups };
}

/**
 * Ghost cards: every consecration / co-consecration (and, with `ordinations`, ordination) that is not
 * a target's primary line becomes a leaf `ghost:<source>:<target>` (`…:o` for ordinations) in the
 * giver's bus, in date order, pointing to the real card. Pairs already joined by the primary line get
 * no ghost (the real stub shows every relation). MatrixBuilder places ghosts like any child.
 */
function addGhostChildren(children, links, layoutEdges, layoutNodeIds, ordinations = false) {
  const primary = new Set(layoutEdges.map(([s, t]) => `${s}:${t}`));
  const ghosts = {};
  links.forEach((link) => {
    if (link.type !== 'consecration' && link.type !== 'co-consecration' && !(ordinations && link.type === 'ordination')) return;
    const { source, target } = linkEndpoints(link);
    if (!layoutNodeIds.has(source) || !layoutNodeIds.has(target) || primary.has(`${source}:${target}`)) return;
    const gid = `ghost:${source}:${target}${link.type === 'ordination' ? ':o' : ''}`;
    if (ghosts[gid] && link.type === 'ordination' && compareEventSort(ghosts[gid].link, link) <= 0) return; // earliest ordination
    if (ghosts[gid] && ghosts[gid].link.type === 'consecration') return; // consecrator outranks co-consecrator
    ghosts[gid] = { source, target, link };
  });
  if (!Object.keys(ghosts).length) return { children, ghosts };

  const out = new Map(children);
  Object.entries(ghosts).forEach(([gid, { source, link }]) => {
    out.set(source, [...(out.get(source) || []), [gid, link]]);
  });
  new Set(Object.values(ghosts).map((g) => g.source)).forEach((source) => {
    // Stable sort: date first; equal dates keep real children ahead of ghosts.
    out.set(source, out.get(source).sort((a, b) => compareEventSort(a[1], b[1])));
  });
  return { children: out, ghosts };
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
 * @param {boolean} [options.groupSiblings=false] - Collapse large same-organization leaf runs
 * @param {Set<string>} [options.expandedGroups] - Group ids to keep expanded
 */
export function computeLineageGridLayout(nodes, links, options = {}) {
  const {
    showPriests = false, groupSiblings = false, expandedGroups = new Set(), ghostCards = false,
    ordinationGhosts = false,
  } = options;
  const {
    layoutNodeIds, children, layoutEdges, firstClergyIds, directCount, totalDescendants, seeds,
  } = prepareLayoutGraph(nodes, links, showPriests);

  let treeChildren = children;
  let groups = {};
  let ghosts = {};
  // Before grouping: a consecrator with ghosts is no longer a leaf, so it never folds into a group.
  if (ghostCards) ({ children: treeChildren, ghosts } = addGhostChildren(treeChildren, links, layoutEdges, layoutNodeIds, ordinationGhosts));
  if (groupSiblings) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    ({ children: treeChildren, groups } = groupLeafSiblings(treeChildren, nodeById, expandedGroups));
  }

  const builder = new MatrixBuilder(seeds.map((id) => nestTree(id, treeChildren)), {
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
    groups,
    ghosts,
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
      const targetId = entry.target; // numeric clergy id, or a `group:` id in the experimental view
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

// ---------------------------------------------------------------------------
// Experimental view (toolbar toggle): year-first cards, validity seals and line glyphs,
// other-consecrator chips, grouped mass consecrations, legend.
// ---------------------------------------------------------------------------

const VALIDITY_ORDER = ['bad', 'doubt', 'info', 'ok'];
const VALIDITY_GLYPH = { bad: '×', doubt: '?', info: 's', ok: '✓' };
const VALIDITY_COLOR = { bad: RED_COLOR, doubt: ORANGE_COLOR, info: '#4d6a8a', ok: GREEN_COLOR };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function linkValidityKind(link) {
  if (!link) return null;
  if (link.is_invalid) return 'bad';
  if (link.is_doubtfully_valid || link.is_doubtful_event) return 'doubt';
  if (link.is_sub_conditione) return 'info';
  return null;
}

function linkValidityText(link) {
  return [
    link.is_invalid && 'Invalid',
    link.is_doubtfully_valid && 'Doubtfully valid',
    link.is_doubtful_event && 'Doubtful event',
    link.is_sub_conditione && 'Sub conditione',
  ].filter(Boolean).join(', ');
}

/** Color carries the validity, dash pattern repeats it so it survives color blindness. */
function experimentalEdgeStyle(link) {
  const opacity = link.is_inherited ? 0.55 : 1;
  if (link.type === 'ordination') {
    return {
      stroke: ORDINATION_STROKE, strokeWidth: 1.25, strokeDasharray: link.is_invalid ? '2 3' : '', opacity,
      marker: 'grid-arrow-ordination',
    };
  }
  if (link.is_invalid) return { stroke: RED_COLOR, strokeWidth: 2.5, strokeDasharray: '', opacity, marker: 'grid-arrow-red' };
  if (link.is_doubtfully_valid || link.is_doubtful_event) {
    return {
      stroke: ORANGE_COLOR, strokeWidth: 2.5, strokeDasharray: link.is_doubtfully_valid ? '6 3' : '1.5 3', opacity,
      marker: 'grid-arrow-orange',
    };
  }
  return { stroke: GREEN_COLOR, strokeWidth: 2.5, strokeDasharray: '', opacity, marker: 'grid-arrow-green' };
}

function nodeValidityMarks(node, primaryLink) {
  const marks = [];
  (node.tags || []).forEach(({ label = '' }) => {
    if (/invalid/i.test(label)) marks.push({ label, kind: 'bad' });
    else if (/doubt/i.test(label)) marks.push({ label, kind: 'doubt' });
    else if (/valid/i.test(label)) marks.push({ label, kind: 'ok' });
  });
  const kind = linkValidityKind(primaryLink);
  if (kind) marks.push({ label: linkValidityText(primaryLink), kind });
  return marks;
}

const worstKind = (marks) => VALIDITY_ORDER.find((k) => marks.some((m) => m.kind === k)) || null;

function buildExperimentalContext(nodes, links) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const primaryByTarget = new Map(
    selectPrimarySuccessionLinks(links, nodeById).map((l) => [linkEndpoint(l.target), l]),
  );
  const consecratorsByTarget = new Map();
  links.forEach((link) => {
    if (link.type !== 'consecration' && link.type !== 'co-consecration') return;
    const { source, target } = linkEndpoints(link);
    if (!consecratorsByTarget.has(target)) consecratorsByTarget.set(target, new Set());
    consecratorsByTarget.get(target).add(source);
  });
  return { nodeById, primaryByTarget, consecratorsByTarget };
}

function otherConsecrators(id, ctx) {
  const primarySource = linkEndpoint(ctx.primaryByTarget.get(id)?.source);
  return [...(ctx.consecratorsByTarget.get(id) || [])].filter((s) => s !== primarySource);
}

function eventYear(node) {
  return (node.consecration_date || node.ordination_date || '').slice(0, 4);
}

function initials(name) {
  const words = (name || '').split(/[\s,]+/).filter((w) => w && !w.includes('.') && /^\p{Lu}/u.test(w));
  if (!words.length) return '';
  return words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0];
}

/** Pale org colors vanish as a stripe on the cream card; those get an outline. */
function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const v = parseInt(m[1], 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255 > 0.72;
}

function appendSeal(card, marks) {
  const kind = worstKind(marks);
  if (!kind) return;
  const seal = el('span', `lineage-grid-card__seal lineage-grid-card__seal--${kind}`, VALIDITY_GLYPH[kind]);
  seal.title = marks.map((m) => m.label).join(', ');
  card.appendChild(seal);
}

function renderExperimentalCard(card, node, ctx) {
  card.classList.add('lineage-grid-card--exp');
  if (isLightColor(node.org_color)) card.classList.add('is-light-org');

  const body = el('div', 'lineage-grid-card__body');
  const row = el('div', 'lineage-grid-card__row');
  const photo = el('div', 'lineage-grid-card__photo lineage-grid-card__photo--mono', initials(node.name));
  photo.setAttribute('aria-hidden', 'true');
  const metaStack = el('div', 'lineage-grid-card__meta-stack');
  metaStack.append(el('p', 'lineage-grid-card__rank', node.rank || ''), el('p', 'lineage-grid-card__org', node.organization || ''));
  row.append(photo, metaStack);
  body.append(row, el('h2', 'lineage-grid-card__name', node.name || ''));

  const others = otherConsecrators(node.id, ctx);
  if (others.length) {
    const chip = el('span', 'lineage-grid-card__chip', `+${others.length} other consecrator${others.length > 1 ? 's' : ''}`);
    chip.title = `Also consecrated by ${others.map((id) => ctx.nodeById.get(id)?.name || id).join(', ')}`;
    const chips = el('div', 'lineage-grid-card__chips');
    chips.appendChild(chip);
    body.appendChild(chips);
  }

  // Year of the order the card is placed at, so the year always matches the card's spot on its bus.
  const placedYear = String(ctx.primaryByTarget.get(node.id)?.event_sort_key ?? '').slice(0, 4);
  card.append(el('span', 'lineage-grid-card__year', placedYear || eventYear(node)), body);
  appendSeal(card, nodeValidityMarks(node, ctx.primaryByTarget.get(node.id)));
}

function renderGroupCard(gid, group, pos, metrics, ctx) {
  const members = group.members.map((id) => ctx.nodeById.get(id)).filter(Boolean);
  const years = [...new Set(members.map(eventYear).filter(Boolean))].sort();
  const doubtful = members.filter((m) => linkValidityKind(ctx.primaryByTarget.get(m.id))).length;
  const noun = members.every(isBishopNode) ? 'bishops' : 'clergy';

  const card = el('article', 'lineage-grid-card lineage-grid-card--exp lineage-grid-card--group');
  card.dataset.groupId = gid;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Expand ${members.length} ${group.organization} ${noun}`);
  card.style.gridArea = `${pos.row + 1} / ${pos.col + 1} / span ${metrics.CARD_ROWS} / span 1`;
  card.style.setProperty('--org-color', group.org_color || '#2c3e50');
  if (isLightColor(group.org_color)) card.classList.add('is-light-org');

  const body = el('div', 'lineage-grid-card__body');
  body.append(
    el('p', 'lineage-grid-card__rank', 'Click to expand'),
    el('h2', 'lineage-grid-card__name', `${members.length} ${group.organization || 'unaffiliated'} ${noun}`),
  );
  if (doubtful) {
    const chips = el('div', 'lineage-grid-card__chips');
    chips.appendChild(el('span', 'lineage-grid-card__chip lineage-grid-card__chip--doubt', `${doubtful} questionable`));
    body.appendChild(chips);
  }
  const yearText = years.length > 1 ? `${years[0]}–${years[years.length - 1].slice(2)}` : (years[0] || '');
  card.append(el('span', 'lineage-grid-card__year', yearText), body);
  return card;
}

function appendValidityGlyph(edgesGroup, pathData, kind, title) {
  const seg = lastPathSegment(pathData);
  if (!seg || !kind) return;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', `lineage-grid-glyph lineage-grid-glyph--${kind}`);
  const cx = seg.x2 + 11;
  const cy = (seg.y1 + seg.y2) / 2;
  const t = document.createElementNS(ns, 'title');
  t.textContent = title;
  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', String(cx));
  circle.setAttribute('cy', String(cy));
  circle.setAttribute('r', '7');
  circle.setAttribute('stroke', VALIDITY_COLOR[kind]);
  const text = document.createElementNS(ns, 'text');
  text.setAttribute('x', String(cx));
  text.setAttribute('y', String(cy + 3.5));
  text.setAttribute('fill', VALIDITY_COLOR[kind]);
  text.textContent = VALIDITY_GLYPH[kind];
  g.append(t, circle, text);
  edgesGroup.appendChild(g);
}

const LEGEND_LINES = [
  [GREEN_COLOR, '', 2.5, 'Consecration'],
  [ORANGE_COLOR, '6 3', 2.5, 'Doubtfully valid'],
  [ORANGE_COLOR, '1.5 3', 2.5, 'Doubtful event'],
  [RED_COLOR, '', 2.5, 'Invalid'],
  [ORDINATION_STROKE, '', 1.25, 'Ordination'],
];
const LEGEND_MARKS = [['ok', 'Tagged valid'], ['doubt', 'Doubtful'], ['bad', 'Invalid'], ['info', 'Sub conditione']];

function renderLegend(legend, visibleNodes, groups) {
  const orgs = new Map();
  const count = (org, color) => {
    if (!org) return;
    const entry = orgs.get(org) || { color, n: 0 };
    entry.n += 1;
    orgs.set(org, entry);
  };
  visibleNodes.forEach((n) => count(n.organization, n.org_color));
  Object.values(groups).forEach((g) => count(g.organization, g.org_color));

  const body = el('div', 'lineage-grid-legend__body');
  const lines = el('div', 'lineage-grid-legend__section');
  lines.appendChild(el('h3', null, 'Lines'));
  LEGEND_LINES.forEach(([stroke, dash, w, label]) => {
    const item = el('span', 'lineage-grid-legend__item');
    item.innerHTML = `<svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/></svg>`;
    item.append(label);
    lines.appendChild(item);
  });
  const marks = el('div', 'lineage-grid-legend__section');
  marks.appendChild(el('h3', null, 'Validity marks'));
  LEGEND_MARKS.forEach(([kind, label]) => {
    const item = el('span', 'lineage-grid-legend__item');
    item.append(el('span', `lineage-grid-card__seal lineage-grid-card__seal--${kind}`, VALIDITY_GLYPH[kind]), label);
    marks.appendChild(item);
  });
  const orgSection = el('div', 'lineage-grid-legend__section');
  orgSection.appendChild(el('h3', null, 'Organizations'));
  [...orgs.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([org, { color }]) => {
    const item = el('span', 'lineage-grid-legend__item');
    const swatch = el('span', 'lineage-grid-legend__swatch');
    swatch.style.background = color || '#2c3e50';
    item.append(swatch, org);
    orgSection.appendChild(item);
  });
  body.append(lines, marks, orgSection);
  legend.replaceChildren(el('summary', null, 'Legend'), body);
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
  // Sprite cell (0,0) is the shared placeholder silhouette; monogram cards keep their initials.
  if (photoEl.classList.contains('lineage-grid-card__photo--mono') && pos[0] === 0 && pos[1] === 0) return;
  photoEl.classList.add('has-photo');
  const sw = spriteSheetData.sprite_width;
  const sh = spriteSheetData.sprite_height;
  if (!sw || !sh) return;
  // In cell units, so CSS scales the sheet to whatever size the photo circle is.
  const cell = spriteSheetData.thumbnail_size || 48;
  photoEl.style.setProperty('--sprite-url', `url(${JSON.stringify(spriteSheetData.url)})`);
  photoEl.style.setProperty('--sprite-col', String(pos[0] / cell));
  photoEl.style.setProperty('--sprite-row', String(pos[1] / cell));
  photoEl.style.setProperty('--sprite-cols', String(sw / cell));
  photoEl.style.setProperty('--sprite-rows', String(sh / cell));
}

function applySpritesToCards(cardsLayer, spriteSheetData) {
  if (!cardsLayer || !spriteSheetData) return;
  cardsLayer.querySelectorAll('.lineage-grid-card').forEach((card) => {
    const photo = card.querySelector('.lineage-grid-card__photo');
    if (photo) applySpritePhoto(photo, Number(card.dataset.clergyId), spriteSheetData);
  });
}

/** Dashed reference card in a consecrator's bus; clicking it pans to the real card (data-focus-target). */
function renderGhostCard(gid, ghost, pos, metrics, nodeById) {
  const target = nodeById.get(ghost.target) || {};
  const verb = { 'co-consecration': 'Co-consecrated', ordination: 'Ordained' }[ghost.link.type] || 'Consecrated';
  const year = String(ghost.link.event_sort_key ?? '').slice(0, 4);
  const card = el('article', 'lineage-grid-card lineage-grid-card--ghost');
  card.dataset.ghostId = gid;
  card.dataset.focusTarget = String(ghost.target);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${verb} ${target.name || ''}${year ? ` in ${year}` : ''}; go to card`);
  card.style.gridArea = `${pos.row + 1} / ${pos.col + 1} / span ${metrics.CARD_ROWS} / span 1`;
  card.style.setProperty('--org-color', target.org_color || '#2c3e50');
  card.append(
    el('p', 'lineage-grid-card__rank', `${verb}${year ? ` ${year}` : ''}`),
    el('h2', 'lineage-grid-card__name', `→ ${target.name || ''}`),
  );
  return card;
}

function renderCards(stage, nodes, positions, bounds, metrics, ctx = null, groups = {}, ghosts = {}) {
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

    if (ctx) {
      renderExperimentalCard(card, node, ctx);
      fragment.appendChild(card);
      return;
    }

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

  if (ctx) {
    Object.entries(groups).forEach(([gid, group]) => {
      if (positions[gid]) fragment.appendChild(renderGroupCard(gid, group, positions[gid], metrics, ctx));
    });
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  Object.entries(ghosts).forEach(([gid, ghost]) => {
    if (positions[gid]) fragment.appendChild(renderGhostCard(gid, ghost, positions[gid], metrics, nodeById));
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

function renderEdges(svg, links, positions, layout, primaryEdgeSet, metrics, ctx = null) {
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

    const style = ctx ? experimentalEdgeStyle(link) : edgeStyle(link);
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
    path.setAttribute('marker-end', `url(#${style.marker || markerId})`);

    path.classList.add('lineage-grid-edge');
    path.classList.add(`lineage-grid-edge--${link.type.replace(/[^a-z]+/g, '-')}`);
    if (primaryEdgeSet.has(edgeKey)) path.classList.add('lineage-grid-edge--primary');
    if (link.is_sub_conditione) path.classList.add('lineage-grid-edge--sub-conditione');
    edgesGroup.appendChild(path);

    if (ctx) {
      if (link.type !== 'ordination') appendValidityGlyph(edgesGroup, pathData, linkValidityKind(link), linkValidityText(link));
      return;
    }

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

  if (ctx) {
    // Group cards have no link of their own: style the stub by the least valid member.
    Object.entries(layout.groups || {}).forEach(([gid, group]) => {
      const pathData = routedPaths.get(`${group.parent}->${gid}`);
      if (!pathData) return;
      const worst = group.members
        .map((id) => ctx.primaryByTarget.get(id))
        .filter(Boolean)
        .sort((a, b) => linkValidityRank(a) - linkValidityRank(b))[0] || { type: 'consecration' };
      const style = experimentalEdgeStyle(worst);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', style.stroke);
      path.setAttribute('stroke-width', String(style.strokeWidth));
      if (style.strokeDasharray) path.setAttribute('stroke-dasharray', style.strokeDasharray);
      path.setAttribute('marker-end', `url(#${style.marker})`);
      path.classList.add('lineage-grid-edge');
      edgesGroup.appendChild(path);
      appendValidityGlyph(edgesGroup, pathData, linkValidityKind(worst), `Least valid in group: ${linkValidityText(worst)}`);
    });
  }

  // Ghost stubs carry the real link's style, always dashed (they point elsewhere).
  Object.entries(layout.ghosts || {}).forEach(([gid, { source, link }]) => {
    const pathData = routedPaths.get(`${source}->${gid}`);
    if (!pathData) return;
    const style = ctx ? experimentalEdgeStyle(link) : edgeStyle(link);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', style.stroke);
    path.setAttribute('stroke-width', String(style.strokeWidth));
    path.setAttribute('stroke-dasharray', style.strokeDasharray || '4 4');
    path.setAttribute('marker-end', `url(#${style.marker || 'grid-arrow-green'})`);
    path.classList.add('lineage-grid-edge', 'lineage-grid-edge--ghost');
    edgesGroup.appendChild(path);
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
  });
}

// ---------------------------------------------------------------------------
// Focus overlay: click a card to enlarge it and show every order it received
// as mini-cards pointing into it (node.orders from the server).
// ---------------------------------------------------------------------------

export const FOCUS = { SCALE: 1.6, MINI_W: 190, MINI_H: 46, CO_H: 28, CO_INDENT: 18, GAP: 8, COL_GAP: 64 };

/** Pure geometry: enlarged card rect, mini-card rects (left column), arrows into the card's left edge. */
export function focusLayout(orders, cardRect, f = FOCUS) {
  const w = cardRect.w * f.SCALE;
  const h = cardRect.h * f.SCALE;
  const big = { x: cardRect.x + cardRect.w / 2 - w / 2, y: cardRect.y + cardRect.h / 2 - h / 2, w, h };

  const sorted = [...(orders || [])].sort(
    (a, b) => (a.sort_key ?? Infinity) - (b.sort_key ?? Infinity) || (a.kind === 'ordination' ? -1 : 1),
  );
  const entries = [];
  sorted.forEach((order) => {
    entries.push({ order, bishop: order.bishop, isCo: false, link: { ...order, type: order.kind, event_sort_key: order.sort_key } });
    (order.co || []).forEach((co) => {
      entries.push({ order, bishop: co, isCo: true, link: { ...order, type: 'co-consecration' } });
    });
  });

  const heights = entries.map((e) => (e.isCo ? f.CO_H : f.MINI_H));
  const total = heights.reduce((s, v) => s + v, 0) + f.GAP * Math.max(0, entries.length - 1);
  const colX = big.x - f.COL_GAP - f.MINI_W;
  let y = big.y + big.h / 2 - total / 2;

  const items = entries.map((entry, i) => {
    const indent = entry.isCo ? f.CO_INDENT : 0;
    const rect = { x: colX + indent, y, w: f.MINI_W - indent, h: heights[i] };
    y += heights[i] + f.GAP;
    const x1 = rect.x + rect.w;
    const y1 = rect.y + rect.h / 2;
    const ty = big.y + (big.h * (i + 1)) / (entries.length + 1);
    return { ...entry, rect, arrow: `M${x1},${y1} L${big.x},${ty}` };
  });
  return { big, items };
}

function orderLabel(entry) {
  const base = entry.isCo ? 'Co-consecrator' : entry.order.kind === 'ordination' ? 'Ordained' : 'Consecrated';
  return entry.order.is_sub_conditione ? `${base} · s.c.` : base;
}

/**
 * The focus mini-card the card is placed on (layout parent's order of the incoming type, best by the
 * placement rule) and a one-line reason, so "why is this card here?" is answered in the overlay.
 */
function placedItem(items, node, placedSource) {
  const candidates = items
    .filter((i) => !i.isCo && i.order.kind === incomingSuccessionType(node) && i.bishop?.id != null)
    .sort((a, b) => comparePrimarySuccession(a.link, b.link));
  const placed = candidates.find((i) => i.bishop.id === placedSource);
  if (!placed) return {};
  const tied = candidates.filter((i) => i !== placed && linkValidityRank(i.link) === linkValidityRank(placed.link));
  const reason = candidates.length === 1 ? 'its only recorded order of this kind'
    : tied.length ? `the earliest of ${tied.length + 1} equally valid orders`
      : `the most valid of ${candidates.length} orders`;
  return { placed, reason: `Card placed on this order: ${reason}.` };
}

function renderFocus(stage, nodeId, nodeById, positions, metrics, placedSource = null) {
  const node = nodeById.get(nodeId);
  const pos = positions[nodeId];
  const card = stage.querySelector(`.lineage-grid-card[data-clergy-id="${nodeId}"]`);
  if (!node || !pos || !card) return null;

  const cardRect = { x: positionX(pos, metrics), y: positionY(pos, metrics), w: metrics.CARD_W, h: metrics.CARD_H };
  const { big, items } = focusLayout(node.orders, cardRect);
  const { placed, reason } = placedItem(items, node, placedSource);

  const layer = el('div', 'lineage-grid-focus');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lineage-grid-focus__svg');
  layer.appendChild(svg);

  items.forEach((item) => {
    const style = experimentalEdgeStyle(item.link);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', item.arrow);
    path.setAttribute('stroke', style.stroke);
    path.setAttribute('stroke-width', String(style.strokeWidth));
    path.setAttribute('opacity', String(style.opacity));
    path.setAttribute('fill', 'none');
    if (style.strokeDasharray) path.setAttribute('stroke-dasharray', style.strokeDasharray);
    path.setAttribute('marker-end', `url(#${style.marker})`); // markers live in the main grid SVG
    svg.appendChild(path);

    const bishopId = item.bishop?.id;
    const reachable = bishopId != null && positions[bishopId];
    const mini = el(reachable ? 'button' : 'div', `lineage-grid-focus__mini${item.isCo ? ' is-co' : ''}${item === placed ? ' is-placed' : ''}`);
    if (reachable) {
      mini.type = 'button';
      mini.dataset.focusTarget = String(bishopId);
    }
    Object.assign(mini.style, {
      left: `${item.rect.x}px`, top: `${item.rect.y}px`, width: `${item.rect.w}px`, height: `${item.rect.h}px`,
      '--org-color': nodeById.get(bishopId)?.org_color || '#7b90a4',
    });
    const o = item.order;
    mini.title = [
      `${orderLabel(item)} ${o.date}`,
      linkValidityText(o),
      o.details_unknown && 'Details unknown',
      o.is_inherited && 'Inherited',
      o.is_other && 'Other',
      !reachable && (bishopId != null ? 'Not shown on chart' : null),
      item === placed && reason,
    ].filter(Boolean).join(' — ');
    mini.append(
      el('span', 'lineage-grid-focus__label', `${orderLabel(item)}${item.isCo ? '' : ` · ${(o.date || '').slice(0, 4) || '?'}`}`),
      el('span', 'lineage-grid-focus__name', item.bishop?.name || 'Unknown bishop'),
    );
    const kind = linkValidityKind(o);
    if (kind) appendSeal(mini, [{ label: linkValidityText(o), kind }]);
    if (item === placed) mini.appendChild(el('span', 'lineage-grid-focus__placed', 'Placed here'));
    layer.appendChild(mini);
  });

  const bigCard = card.cloneNode(true);
  bigCard.classList.add('lineage-grid-focus__card');
  bigCard.style.gridArea = '';
  Object.assign(bigCard.style, {
    left: `${cardRect.x}px`, top: `${cardRect.y}px`, width: `${cardRect.w}px`, height: `${cardRect.h}px`,
    transform: `scale(${FOCUS.SCALE})`,
  });
  if (!items.length) bigCard.title = 'No orders recorded';
  layer.appendChild(bigCard);

  card.parentElement.classList.add('is-focus-dim');
  stage.appendChild(layer);
  return { center: { x: big.x + big.w / 2, y: big.y + big.h / 2 } };
}

function closeFocus(stage) {
  stage.querySelector('.lineage-grid-focus')?.remove();
  stage.querySelector('.lineage-grid-cards')?.classList.remove('is-focus-dim');
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

/** Pointer events, so mouse and touch share one path: one pointer pans, two pinch-zoom. */
function initPanZoom(viewport, stage) {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  const pointers = new Map(); // pointerId -> { x, y } in viewport coords
  let gesture = null; // view + pointer midpoint/spread when the current pan or pinch began

  const clampZoom = (s) => Math.min(2.5, Math.max(MIN_ZOOM, s));
  const apply = () => {
    stage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  };
  const local = (event) => {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const startGesture = () => {
    const [a, b = a] = pointers.values();
    gesture = {
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y),
      scale, translateX, translateY,
    };
  };

  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      stage.classList.remove('is-animating');
      const delta = event.deltaY > 0 ? 0.92 : 1.08;
      const next = clampZoom(scale * delta);
      const { x: px, y: py } = local(event);
      translateX = px - ((px - translateX) * next) / scale;
      translateY = py - ((py - translateY) * next) / scale;
      scale = next;
      apply();
    },
    { passive: false },
  );

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || pointers.size >= 2) return;
    stage.classList.remove('is-animating');
    pointers.set(event.pointerId, local(event));
    startGesture();
    viewport.classList.add('is-dragging');
  });

  window.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, local(event));
    const [a, b = a] = pointers.values();
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const next = pointers.size > 1 && gesture.dist
      ? clampZoom((gesture.scale * Math.hypot(a.x - b.x, a.y - b.y)) / gesture.dist)
      : gesture.scale;
    // Keep the stage point that was under the starting midpoint under the current midpoint.
    translateX = mx - ((gesture.mx - gesture.translateX) * next) / gesture.scale;
    translateY = my - ((gesture.my - gesture.translateY) * next) / gesture.scale;
    scale = next;
    apply();
  });

  const endPointer = (event) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size) startGesture(); // pinch -> pan with the remaining finger, no jump
    else viewport.classList.remove('is-dragging');
  };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  apply();
  return {
    /** Scale and center the whole stage inside the viewport (never enlarged past 1:1). */
    fit() {
      const w = stage.offsetWidth, h = stage.offsetHeight;
      if (!w || !h) return;
      scale = Math.min(1, Math.max(MIN_ZOOM, Math.min(viewport.clientWidth / w, viewport.clientHeight / h)));
      translateX = (viewport.clientWidth - w * scale) / 2;
      translateY = (viewport.clientHeight - h * scale) / 2;
      apply();
    },
    /** Glide so stage point (x, y) sits in the middle of the viewport, zooming in to at least minScale. */
    centerOn(x, y, minScale = 0) {
      stage.classList.add('is-animating');
      scale = Math.max(scale, minScale);
      translateX = viewport.clientWidth / 2 - x * scale;
      translateY = viewport.clientHeight / 2 - y * scale;
      apply();
    },
  };
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

function renderGrid(stage, nodes, links, { showPriests, experimental, expandedGroups, legend }) {
  stage.replaceChildren();

  const layout = computeLineageGridLayout(nodes, links, {
    showPriests, expandedGroups, ghostCards: true, ordinationGhosts: true,
  });
  const ctx = experimental ? buildExperimentalContext(nodes, links) : null;
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
    root.classList.toggle('is-experimental', !!experimental);
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
  renderEdges(svg, links, positions, layout, primaryEdgeSet, activeMetrics, ctx);
  const cardsLayer = renderCards(stage, visibleNodes, positions, layout.bounds, activeMetrics, ctx, layout.groups, layout.ghosts);

  if (legend) {
    legend.hidden = !experimental;
    if (experimental) renderLegend(legend, visibleNodes, layout.groups);
  }
  return { layout, cardsLayer };
}

export async function initializeLineageGrid() {
  const viewport = document.getElementById('lineage-grid-viewport');
  const stage = document.getElementById('lineage-grid-stage');
  if (!viewport || !stage) return;

  let nodes = window.nodesData || [];
  let links = window.linksData || [];

  if (!nodes.length) {
    viewport.innerHTML = '<p class="lineage-grid-empty">No clergy data available.</p>';
    return;
  }

  let showPriests = window.showPriests === true || window.showPriests === 'true';
  const experimentalToggle = document.getElementById('lineage-grid-experimental');
  let experimental = !!experimentalToggle?.checked;
  const expandedGroups = new Set();
  const legend = document.getElementById('lineage-grid-legend');
  const spritePromise = loadSpriteSheetData();

  // Once per page: pan/zoom listeners live on viewport/window, so re-renders keep the view.
  const panZoom = initPanZoom(viewport, stage);
  let nodeById = new Map(nodes.map((n) => [n.id, n]));
  let gridState = null;

  const draw = () => {
    const state = renderGrid(stage, nodes, links, { showPriests, experimental, expandedGroups, legend });
    gridState = state; // re-render wipes the stage, so any focus overlay is already gone
    spritePromise.then((spriteSheetData) => {
      if (spriteSheetData) applySpritesToCards(state.cardsLayer, spriteSheetData);
    });
  };
  draw();
  panZoom.fit(); // first load shows the whole lineage

  // Both toggles default on, so only the opt-out goes in the URL.
  const setQueryFlag = (name, on) => {
    const url = new URL(window.location.href);
    if (on) url.searchParams.delete(name);
    else url.searchParams.set(name, '0');
    window.history.replaceState(null, '', url.toString());
  };

  const priestToggle = document.getElementById('lineage-grid-show-priests');
  if (priestToggle) {
    priestToggle.addEventListener('change', () => {
      showPriests = priestToggle.checked;
      setQueryFlag('show_priests', showPriests);
      window.showPriests = showPriests;
      draw();
    });
  }

  if (experimentalToggle) {
    experimentalToggle.addEventListener('change', () => {
      experimental = experimentalToggle.checked;
      expandedGroups.clear();
      setQueryFlag('experimental', experimental);
      draw();
    });
  }

  // Expand a group card on click (not at the end of a pan drag) or Enter/Space.
  let downX = 0;
  let downY = 0;
  viewport.addEventListener('pointerdown', (event) => { downX = event.clientX; downY = event.clientY; });
  const expandGroup = (card) => {
    expandedGroups.add(card.dataset.groupId);
    draw();
  };
  const openFocus = (id, { pan = false, minScale = 0 } = {}) => {
    closeFocus(stage);
    const placedSource = gridState.layout.primary_edges?.find((e) => e.target === id)?.source ?? null;
    const focus = renderFocus(stage, id, nodeById, gridState.layout.positions || {}, activeMetricsFromLayout(gridState.layout), placedSource);
    if (focus && pan) panZoom.centerOn(focus.center.x, focus.center.y, minScale);
  };
  initSearch(() => gridState.cardsLayer, () => nodeById, (id) => openFocus(id, { pan: true, minScale: 0.6 }));
  viewport.addEventListener('click', (event) => {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) >= 5) return; // end of a pan drag
    const group = event.target.closest('[data-group-id]');
    if (group) return expandGroup(group);
    const mini = event.target.closest('[data-focus-target]');
    if (mini) return openFocus(Number(mini.dataset.focusTarget), { pan: true });
    const card = event.target.closest('.lineage-grid-cards [data-clergy-id]');
    if (card) {
      const id = Number(card.dataset.clergyId);
      openFocus(id);
      return admin?.open(id, nodeById.get(id)?.name);
    }
    if (!event.target.closest('.lineage-grid-focus__card')) closeFocus(stage);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (stage.querySelector('.lineage-grid-focus')) closeFocus(stage);
    else admin?.close();
  });

  // After a save in the embedded editor: refetch the data and redraw in place (pan/zoom kept).
  const reload = async (focusId) => {
    const response = await fetch('/lineage-grid.json', { credentials: 'same-origin' });
    if (!response.ok) return;
    ({ nodes, links } = await response.json());
    nodeById = new Map(nodes.map((n) => [n.id, n]));
    draw();
    if (nodeById.has(focusId)) openFocus(focusId);
  };
  const admin = window.canEdit ? initAdminPanel(reload) : null;
  stage.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-group-id]');
    const ghost = event.target.closest('[data-ghost-id]');
    if (!card && !ghost) return;
    event.preventDefault();
    if (card) expandGroup(card);
    else openFocus(Number(ghost.dataset.focusTarget), { pan: true });
  });
}

/**
 * Cmd/Ctrl+F or Cmd/Ctrl+K clergy search: editor v2's fuzzy search over the clergy on the chart,
 * results shown as clones of the grid's own cards. Arrow keys: down enters the results grid, then
 * arrows move by card; up from the top row returns to the text field (left/right edit text there).
 */
function initSearch(getCardsLayer, getNodeById, onSelect) {
  const overlay = document.getElementById('lineage-grid-search');
  const input = document.getElementById('lineage-grid-search-input');
  const list = document.getElementById('lineage-grid-search-results');
  const status = document.getElementById('lineage-grid-search-status');
  if (!overlay || !input || !list) return;
  let index = null; // rebuilt when a redraw replaces the cards layer
  let results = [];
  let active = -1;

  const ensureIndex = async () => {
    const layer = getCardsLayer();
    if (index?.layer === layer) return index;
    const { createClergyFuseIndex, searchClergy } = await import('/static/js/fuzzySearchV2.js');
    const byId = getNodeById();
    const shown = [...layer.querySelectorAll('.lineage-grid-card[data-clergy-id]')]
      .map((card) => byId.get(Number(card.dataset.clergyId)))
      .filter(Boolean);
    index = { layer, fuse: createClergyFuseIndex(shown).fuse, searchClergy };
    return index;
  };

  const setActive = (i) => {
    active = i;
    [...list.children].forEach((card, j) => {
      card.classList.toggle('is-active', j === i);
      card.setAttribute('aria-selected', String(j === i));
    });
    const card = list.children[i];
    if (card) {
      input.setAttribute('aria-activedescendant', card.id);
      card.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const render = async () => {
    const query = input.value;
    const { layer, fuse, searchClergy } = await ensureIndex();
    if (query !== input.value) return; // a newer keystroke already rendered
    results = searchClergy(fuse, query, 30);
    list.replaceChildren(...results.map((item) => {
      const card = layer.querySelector(`.lineage-grid-card[data-clergy-id="${item.id}"]`).cloneNode(true);
      card.style.gridArea = '';
      card.id = `lineage-grid-search-${item.id}`;
      card.setAttribute('role', 'option');
      return card;
    }));
    status.textContent = results.length ? ''
      : query.trim() ? `No clergy on the chart match “${query.trim()}”.` : 'Type a name, rank or organization.';
    setActive(-1);
  };

  const open = () => {
    overlay.hidden = false;
    input.focus();
    input.select();
    render();
  };
  const close = () => {
    overlay.hidden = true;
    input.blur();
  };
  const choose = (i) => {
    const item = results[i];
    if (!item) return;
    close();
    onSelect(item.id);
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // don't also close the focus overlay / editor panel
      return close();
    }
    const n = results.length;
    if (!n) return;
    const cols = getComputedStyle(list).gridTemplateColumns.split(' ').length;
    const move = {
      ArrowDown: active < 0 ? 0 : Math.min(n - 1, active + cols),
      ArrowUp: active - cols < 0 ? -1 : active - cols,
      ArrowRight: Math.min(n - 1, active + 1),
      ArrowLeft: Math.max(0, active - 1),
    }[event.key];
    if (move !== undefined && (active >= 0 || event.key === 'ArrowDown')) {
      event.preventDefault();
      setActive(move);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(Math.max(active, 0));
    }
  });
  // Mouse and keys share one highlight.
  list.addEventListener('pointermove', (event) => {
    const card = event.target.closest('[role="option"]');
    const i = [...list.children].indexOf(card);
    if (card && i !== active) setActive(i);
  });
  list.addEventListener('click', (event) => {
    const card = event.target.closest('[role="option"]');
    if (card) choose([...list.children].indexOf(card));
  });
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) close();
  });
  document.getElementById('lineage-grid-search-open')?.addEventListener('click', open);
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && (event.key === 'f' || event.key === 'k')) {
      event.preventDefault();
      open();
    }
  });
}

/** Right-half editor panel: an iframe on /editor/embed, so the form is editor v2's own. */
function initAdminPanel(onSaved) {
  const page = document.querySelector('.lineage-grid-page');
  const panel = document.getElementById('lineage-grid-admin-panel');
  const frame = document.getElementById('lineage-grid-admin-frame');
  const title = document.getElementById('lineage-grid-admin-title');
  const fullEditor = document.getElementById('lineage-grid-full-editor');
  if (!panel || !frame) return null;

  const open = (id, name) => {
    const query = id != null ? `?clergy_id=${id}` : '';
    title.textContent = id != null ? `Edit: ${name || `#${id}`}` : 'Add clergy';
    if (fullEditor) fullEditor.href = `/editor/${query}`;
    frame.src = `/editor/embed${query}`;
    panel.hidden = false;
    page?.classList.add('has-admin-panel');
  };
  const close = () => {
    panel.hidden = true;
    frame.removeAttribute('src');
    page?.classList.remove('has-admin-panel');
  };

  // editor v2's app.js dispatches this on body after every successful save.
  frame.addEventListener('load', () => {
    frame.contentDocument?.body?.addEventListener('editor:validityChanged', (event) => {
      onSaved(Number(event.detail?.clergyId));
    });
  });
  document.getElementById('lineage-grid-admin-close')?.addEventListener('click', close);
  document.getElementById('lineage-grid-add-clergy')?.addEventListener('click', () => open(null));
  return { open, close };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLineageGrid);
  } else {
    initializeLineageGrid();
  }
}
