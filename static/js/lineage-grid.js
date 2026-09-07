/**
 * Succession grid — client-side layout, bus routing, and page render.
 *
 * Pipeline (computeLineageGridLayout):
 * 1. Layout nodes — bishops / consecration participants; all if showPriests.
 * 2. Forest — one incoming succession link per person; break cycles (newest edge).
 * 3. Side assignment — suffix rail flips before pack (5:3 scoring, opposite-rail gap).
 * 4. First clergy — no layout parent; left-edge seeds at x = PAD.
 * 5. Pack — children LTR by date, alternate above/below; leaf vs hub spacing.
 * 6. Squeeze — slide children left; stretch only as last resort when slide blocked.
 * 7. Vertical compact — pull child hubs toward parent using live subtree extents.
 * 8. Intra-cluster collide — heal card overlaps within each forest cluster.
 * 9. Inter-cluster collide — later clusters shift down until no card overlap.
 * 10. Draw — grey trunk at parent midline; vertical stubs to card edges.
 */
import gridMetrics from '../config/grid-metrics.json' with { type: 'json' };

export const GRID_METRICS = { ...gridMetrics };

const GREEN_COLOR = '#0b9f2f';
const RED_COLOR = '#e74c3c';
const ORANGE_COLOR = '#f39c12';
const ORDINATION_STROKE = '#c8d4dc';
const BUS_T_CAP_HALF = 10;
const MIN_FIT_SCALE = 0.08;

const {
  CARD_W,
  CARD_H,
  GAP_X,
  GAP_Y,
  PAD,
  DATE_SCALE,
  MULTI_STUB_GAP,
} = GRID_METRICS;

const MIN_BRANCH_GAP = CARD_W + GAP_X / 2;
GRID_METRICS.MIN_BRANCH_GAP = MIN_BRANCH_GAP;

const MIN_CHILD_GAP = CARD_W + GAP_X;
const CLUSTER_GAP = GAP_Y;
const FIRST_CHILD_X = CARD_W + GAP_X;
const ASPECT_CAP = 5 / 3;
const MIN_BUSSES_FOR_ASPECT = 4;

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
// Layout — packing
// ---------------------------------------------------------------------------

function defaultChildSide(index) {
  return index % 2 === 0 ? 'above' : 'below';
}

function sideMapKey(parentId, childId) {
  return `${parentId}:${childId}`;
}

function getChildSide(parentId, childId, index, sideMap, positions) {
  if (sideMap) {
    const key = sideMapKey(parentId, childId);
    if (sideMap.has(key)) return sideMap.get(key);
  }
  if (positions?.[childId]?.side) return positions[childId].side;
  return defaultChildSide(index);
}

function computeExtents(nodeId, children, cache, sideMap = null) {
  if (cache.has(nodeId)) return cache.get(nodeId);
  const childList = children.get(nodeId) || [];
  if (!childList.length) {
    const empty = { above: 0, below: 0 };
    cache.set(nodeId, empty);
    return empty;
  }

  let extentAbove = 0;
  let extentBelow = 0;
  childList.forEach(([childId], idx) => {
    const childExt = computeExtents(childId, children, cache, sideMap);
    const slot = CARD_H + GAP_Y + childExt.above + childExt.below;
    const side = getChildSide(nodeId, childId, idx, sideMap, null);
    if (side === 'above') extentAbove = Math.max(extentAbove, slot);
    else extentBelow = Math.max(extentBelow, slot);
  });

  const result = { above: extentAbove, below: extentBelow };
  cache.set(nodeId, result);
  return result;
}

function siblingGap(year, prevYear, isFirstChild) {
  if (isFirstChild) return GAP_X;
  if (year != null && prevYear != null) {
    return Math.max(MIN_CHILD_GAP, DATE_SCALE * (year - prevYear));
  }
  return MIN_CHILD_GAP;
}

function buildRelationCounts(links) {
  const counts = new Map();
  links.forEach((link) => {
    if (link.type === 'co-consecration') return;
    if (link.type !== 'ordination' && link.type !== 'consecration') return;
    const source = linkEndpoint(link.source);
    const target = linkEndpoint(link.target);
    if (source == null || target == null) return;
    const key = `${source}:${target}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function childEmitsBus(childId, children) {
  return (children.get(childId) || []).length > 0;
}

function relationGroupHalfWidth(nRelations) {
  if (nRelations <= 1) return 0;
  return ((nRelations - 1) * MULTI_STUB_GAP) / 2;
}

function branchMinPitch(parentId, childList, relationCounts) {
  let pitch = MIN_BRANCH_GAP;
  childList.forEach(([childId]) => {
    const nRelations = relationCounts.get(`${parentId}:${childId}`) || 1;
    if (nRelations > 1) {
      pitch = Math.max(pitch, (nRelations - 1) * MULTI_STUB_GAP + MIN_BRANCH_GAP);
    }
  });
  return pitch;
}

function linkYear(link, node) {
  const key = link.event_sort_key;
  if (key != null) return Math.floor(key / 10000);
  const date = node.consecration_date || node.ordination_date || '';
  if (date.length >= 4) {
    const year = parseInt(date.slice(0, 4), 10);
    if (!Number.isNaN(year)) return year;
  }
  return null;
}

function computeChildXPositions(
  parentId,
  childList,
  nodeById,
  children,
  widthCache,
  xCache,
  relationCounts,
  sideMap = null,
) {
  if (!childList.length) return [];

  const firstOrigin = FIRST_CHILD_X + CARD_W / 2;
  const allLeaves = childList.every(([childId]) => !childEmitsBus(childId, children));

  // Leaf-only parent: even pitch at branchMinPitch. Hub parent: sequential min gap.
  if (allLeaves) {
    const pitch = branchMinPitch(parentId, childList, relationCounts);
    const positions = [];
    const railOccupied = { above: 0, below: 0 };
    let prevYear = null;

    childList.forEach(([childId, link], idx) => {
      const node = nodeById.get(childId) || { id: childId };
      const year = linkYear(link, node);
      const side = getChildSide(parentId, childId, idx, sideMap, null);
      const childWidth = computeSubtreeWidth(
        childId, children, nodeById, widthCache, xCache, relationCounts, sideMap,
      );
      const gap = siblingGap(year, prevYear, idx === 0);
      const originX = firstOrigin + idx * pitch;
      const railMinX = railOccupied[side] === 0 ? FIRST_CHILD_X : railOccupied[side] + gap;
      const x = Math.max(originX - CARD_W / 2, railMinX);
      positions.push(x);
      railOccupied[side] = x + childWidth;
      if (year != null) prevYear = year;
    });
    return positions;
  }

  const positions = [];
  const railOccupied = { above: 0, below: 0 };
  let prevYear = null;
  let prevOriginX = null;
  let prevGroupHalf = 0;

  childList.forEach(([childId, link], idx) => {
    const node = nodeById.get(childId) || { id: childId };
    const year = linkYear(link, node);
    const side = getChildSide(parentId, childId, idx, sideMap, null);
    const childWidth = computeSubtreeWidth(
      childId, children, nodeById, widthCache, xCache, relationCounts, sideMap,
    );
    const gap = siblingGap(year, prevYear, idx === 0);
    const nRelations = relationCounts.get(`${parentId}:${childId}`) || 1;
    const groupHalf = relationGroupHalfWidth(nRelations);

    const originX = idx === 0
      ? firstOrigin
      : prevOriginX + prevGroupHalf + MIN_BRANCH_GAP + groupHalf;
    const railMinX = railOccupied[side] === 0 ? FIRST_CHILD_X : railOccupied[side] + gap;
    const x = Math.max(originX - CARD_W / 2, railMinX);

    positions.push(x);
    railOccupied[side] = x + childWidth;
    prevOriginX = x + CARD_W / 2;
    prevGroupHalf = groupHalf;
    if (year != null) prevYear = year;
  });
  return positions;
}

function computeSubtreeWidth(
  nodeId,
  children,
  nodeById,
  widthCache,
  xCache,
  relationCounts,
  sideMap = null,
) {
  if (widthCache.has(nodeId)) return widthCache.get(nodeId);

  const childList = children.get(nodeId) || [];
  if (!childList.length) {
    widthCache.set(nodeId, CARD_W);
    xCache.set(nodeId, []);
    return CARD_W;
  }

  const childXs = computeChildXPositions(
    nodeId, childList, nodeById, children, widthCache, xCache, relationCounts, sideMap,
  );
  xCache.set(nodeId, childList.map(([cid], i) => [cid, childXs[i]]));

  let maxRight = CARD_W;
  childList.forEach(([childId], i) => {
    const childWidth = computeSubtreeWidth(
      childId, children, nodeById, widthCache, xCache, relationCounts, sideMap,
    );
    maxRight = Math.max(maxRight, childXs[i] + childWidth);
  });

  widthCache.set(nodeId, maxRight);
  return maxRight;
}

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

/** First clergy sorted by largest descendant tree first. */
function selectClusterSeeds(firstClergyIds, totalDescendants, nodeById) {
  return [...firstClergyIds].sort((a, b) => {
    const ak = seedRankKey(a, totalDescendants, nodeById);
    const bk = seedRankKey(b, totalDescendants, nodeById);
    return compareSeedRank(ak, bk);
  });
}

function placeSubtreeChildren(nodeId, ctx) {
  const {
    children, nodeById, extents, widthCache, xCache,
    positions, buses, placed, clusterMembers, relationCounts, sideMap,
  } = ctx;

  const pos = positions[nodeId];
  if (!pos) return;
  const { x, y } = pos;

  const childList = children.get(nodeId) || [];
  if (!childList.length) return;

  const timelineY = y + CARD_H / 2;
  let relXs = (xCache.get(nodeId) || []).map(([, relX]) => relX);
  if (relXs.length !== childList.length) {
    relXs = computeChildXPositions(
      nodeId, childList, nodeById, children, widthCache, xCache, relationCounts, sideMap,
    );
    xCache.set(nodeId, childList.map(([cid], i) => [cid, relXs[i]]));
  }

  const busTargets = [];
  const parentTop = y;
  const parentBottom = y + CARD_H;

  childList.forEach(([childId], idx) => {
    if (placed.has(childId)) return;
    const childSideVal = getChildSide(nodeId, childId, idx, sideMap, positions);
    const childExt = extents.get(childId) || { above: 0, below: 0 };
    const childX = x + relXs[idx];

    const childY = childSideVal === 'above'
      ? parentTop - GAP_Y - childExt.below - CARD_H
      : parentBottom + GAP_Y + childExt.above;

    busTargets.push({
      target: childId,
      side: childSideVal,
      origin_x: x + relXs[idx] + CARD_W / 2,
    });
    placeSubtree(childId, childX, childY, ctx, childSideVal);
  });

  const existingBusIdx = buses.findIndex((b) => b.source === nodeId);
  if (existingBusIdx >= 0) buses.splice(existingBusIdx, 1);

  if (busTargets.length) {
    buses.push({
      source: nodeId,
      timeline_y: timelineY,
      timeline_start_x: x + CARD_W,
      timeline_end_x: x + Math.max(...childList.map(([,], i) => relXs[i] + CARD_W)),
      targets: busTargets,
    });
  }
}

function placeSubtree(nodeId, x, y, ctx, side = null) {
  const { positions, placed, clusterMembers } = ctx;

  if (placed.has(nodeId)) return;

  const pos = { x, y };
  if (side) pos.side = side;
  positions[nodeId] = pos;
  placed.add(nodeId);
  if (clusterMembers) clusterMembers.add(nodeId);

  placeSubtreeChildren(nodeId, ctx);
}

function clearSubtreeCaches(rootId, children, widthCache, xCache) {
  descendantIds(rootId, children).forEach((id) => {
    widthCache.delete(id);
    xCache.delete(id);
  });
  widthCache.delete(rootId);
  xCache.delete(rootId);
}

/** Repack descendant geometry after a sideMap change; root anchor X/Y preserved. */
function repackSubtree(rootId, ctx) {
  const {
    children, nodeById, extents, widthCache, xCache,
    positions, buses, placed, relationCounts, sideMap,
  } = ctx;

  const rootPos = positions[rootId];
  if (!rootPos) return;

  const descIds = descendantIds(rootId, children);
  const descSet = new Set(descIds);

  descIds.forEach((id) => {
    if (id === rootId) return;
    delete positions[id];
    placed.delete(id);
  });

  for (let i = buses.length - 1; i >= 0; i -= 1) {
    if (descSet.has(buses[i].source)) buses.splice(i, 1);
  }

  clearSubtreeCaches(rootId, children, widthCache, xCache);
  computeSubtreeWidth(
    rootId, children, nodeById, widthCache, xCache, relationCounts, sideMap,
  );
  placeSubtreeChildren(rootId, ctx);
}

function layoutCardRect(pos) {
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + CARD_W,
    bottom: pos.y + CARD_H,
  };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function clusterBBox(members, positions, yShift = 0) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  members.forEach((nid) => {
    const p = positions[nid];
    if (!p) return;
    const r = layoutCardRect({ x: p.x, y: p.y + yShift });
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  return { left, top, right, bottom };
}

function bboxesOverlap(a, b, margin = 0) {
  return a.left < b.right + margin
    && a.right > b.left - margin
    && a.top < b.bottom + margin
    && a.bottom > b.top - margin;
}

function shiftBBox(bbox, dx, dy) {
  return {
    left: bbox.left + dx,
    top: bbox.top + dy,
    right: bbox.right + dx,
    bottom: bbox.bottom + dy,
  };
}

function descendantIds(rootId, children) {
  const out = [];
  function walk(id) {
    out.push(id);
    (children.get(id) || []).forEach(([cid]) => walk(cid));
  }
  walk(rootId);
  return out;
}

function subtreeBBox(rootId, positions, children) {
  return clusterBBox(new Set(descendantIds(rootId, children)), positions);
}

function busDepth(sourceId, parents) {
  let depth = 0;
  let cur = sourceId;
  for (;;) {
    const pList = parents.get(cur);
    if (!pList || !pList.length) break;
    depth += 1;
    cur = pList[0];
  }
  return depth;
}

function countBusesInGroup(hubId, children, buses) {
  const ids = new Set(descendantIds(hubId, children));
  ids.add(hubId);
  return buses.filter((bus) => ids.has(bus.source)).length;
}

function groupAspectRatio(hubId, positions, children) {
  const bbox = subtreeBBox(hubId, positions, children);
  const w = bbox.right - bbox.left;
  const h = bbox.bottom - bbox.top;
  if (w <= 0 || h <= 0) return 1;
  return h / w;
}

function translateSubtree(rootId, dx, dy, positions, buses, children) {
  const ids = new Set(descendantIds(rootId, children));
  ids.forEach((nid) => {
    const pos = positions[nid];
    if (pos) {
      pos.x += dx;
      pos.y += dy;
    }
  });
  buses.forEach((bus) => {
    if (ids.has(bus.source)) {
      bus.timeline_y += dy;
      if (dx !== 0) {
        bus.timeline_start_x += dx;
        bus.timeline_end_x += dx;
      }
    }
    bus.targets.forEach((target) => {
      if (ids.has(target.target)) target.origin_x += dx;
    });
  });
}

function refreshBusGeometry(bus, positions) {
  const parentPos = positions[bus.source];
  if (!parentPos) return;
  bus.timeline_y = parentPos.y + CARD_H / 2;
  bus.timeline_start_x = parentPos.x + CARD_W;
  let maxRight = parentPos.x + CARD_W;
  bus.targets.forEach((target) => {
    const childPos = positions[target.target];
    if (childPos) {
      target.origin_x = childPos.x + CARD_W / 2;
      maxRight = Math.max(maxRight, childPos.x + CARD_W);
    }
  });
  bus.timeline_end_x = maxRight;
}

function refreshBusesForSubtree(rootId, buses, positions, children) {
  const ids = new Set(descendantIds(rootId, children));
  ids.add(rootId);
  buses.forEach((bus) => {
    if (ids.has(bus.source)) refreshBusGeometry(bus, positions);
  });
}

function computeMinLeftX(
  parentId,
  childIndex,
  childList,
  positions,
  parentX,
  nodeById,
  relationCounts,
  children,
  sideMap,
) {
  const allLeaves = childList.every(([childId]) => !childEmitsBus(childId, children));
  let originMinX = FIRST_CHILD_X;

  if (allLeaves) {
    const pitch = branchMinPitch(parentId, childList, relationCounts);
    if (childIndex === 0) {
      originMinX = FIRST_CHILD_X;
    } else {
      const [prevId] = childList[childIndex - 1];
      const prevOriginX = positions[prevId].x + CARD_W / 2 - parentX;
      originMinX = prevOriginX + pitch - CARD_W / 2;
    }
  } else if (childIndex > 0) {
    const [prevId] = childList[childIndex - 1];
    const prevPos = positions[prevId];
    const prevOriginX = prevPos.x + CARD_W / 2 - parentX;
    const nRelationsPrev = relationCounts.get(`${parentId}:${prevId}`) || 1;
    const prevGroupHalf = relationGroupHalfWidth(nRelationsPrev);
    const [targetChildId] = childList[childIndex];
    const nRelationsTarget = relationCounts.get(`${parentId}:${targetChildId}`) || 1;
    const groupHalf = relationGroupHalfWidth(nRelationsTarget);
    originMinX = prevOriginX + prevGroupHalf + MIN_BRANCH_GAP + groupHalf - CARD_W / 2;
  }

  const [targetChildId, targetLink] = childList[childIndex];
  const targetSide = getChildSide(parentId, targetChildId, childIndex, sideMap, positions);
  const targetNode = nodeById.get(targetChildId) || { id: targetChildId };
  const targetYear = linkYear(targetLink, targetNode);

  let railMinX = FIRST_CHILD_X;
  let lastSameRailCardRight = 0;
  let lastSameRailYear = null;
  for (let idx = 0; idx < childIndex; idx += 1) {
    const [childId, link] = childList[idx];
    if (getChildSide(parentId, childId, idx, sideMap, positions) !== targetSide) continue;
    const node = nodeById.get(childId) || { id: childId };
    const year = linkYear(link, node);
    lastSameRailCardRight = positions[childId].x + CARD_W - parentX;
    if (year != null) lastSameRailYear = year;
  }
  if (lastSameRailCardRight > 0) {
    const gap = siblingGap(targetYear, lastSameRailYear, false);
    railMinX = lastSameRailCardRight + gap;
  }

  return parentX + Math.max(originMinX, railMinX);
}

function subtreeOverlapsPriorSiblings(
  childId,
  dx,
  dy,
  childList,
  childIndex,
  positions,
  children,
) {
  const movingBBox = shiftBBox(subtreeBBox(childId, positions, children), -dx, dy);
  for (let j = 0; j < childIndex; j += 1) {
    const [priorId] = childList[j];
    const priorBBox = subtreeBBox(priorId, positions, children);
    if (bboxesOverlap(movingBBox, priorBBox)) return true;
  }
  return false;
}

function gridSlotDy(pixels) {
  if (pixels <= 0) return 0;
  return Math.ceil(pixels / GAP_Y) * GAP_Y;
}

function horizontalOverlap(a, b) {
  return a.left < b.right && a.right > b.left;
}

function computeMinimalGridDy(blockerId, cPlusOneId, dx, positions, children) {
  const blockerPos = positions[blockerId];
  if (!blockerPos) return null;
  const blockerSide = blockerPos.side || 'below';
  const direction = blockerSide === 'below' ? 1 : -1;
  const cPlusOneBBox = shiftBBox(subtreeBBox(cPlusOneId, positions, children), -dx, 0);

  let minPixels = 0;
  descendantIds(blockerId, children).forEach((nid) => {
    const pos = positions[nid];
    if (!pos) return;
    const rect = layoutCardRect(pos);
    if (!horizontalOverlap(rect, cPlusOneBBox)) return;
    if (!bboxesOverlap(rect, cPlusOneBBox)) return;
    if (direction > 0) {
      minPixels = Math.max(minPixels, cPlusOneBBox.bottom + GAP_Y - rect.top);
    } else {
      minPixels = Math.max(minPixels, rect.bottom + GAP_Y - cPlusOneBBox.top);
    }
  });

  if (minPixels <= 0) return 0;
  return gridSlotDy(minPixels);
}

function stretchOverlapsOutsideGroup(
  cId,
  signedDy,
  dx,
  cPlusOneId,
  childList,
  childIndex,
  positions,
  children,
  groupRootId,
) {
  const groupIds = new Set(descendantIds(groupRootId, children));
  groupIds.add(groupRootId);

  const cBBox = shiftBBox(subtreeBBox(cId, positions, children), 0, signedDy);
  const cPlusOneBBox = shiftBBox(subtreeBBox(cPlusOneId, positions, children), -dx, 0);

  for (const nid of Object.keys(positions)) {
    const id = Number(nid);
    if (groupIds.has(id)) continue;
    const r = layoutCardRect(positions[id]);
    if (bboxesOverlap(cBBox, r) || bboxesOverlap(cPlusOneBBox, r)) return true;
  }
  return false;
}

function simulateGroupAspect(
  hubId,
  positions,
  children,
  buses,
  cId,
  signedDy,
  cPlusOneId,
  dx,
) {
  const snapshot = new Map();
  descendantIds(hubId, children).concat([hubId]).forEach((nid) => {
    const p = positions[nid];
    if (p) snapshot.set(nid, { x: p.x, y: p.y });
  });

  translateSubtree(cId, 0, signedDy, positions, buses, children);
  translateSubtree(cPlusOneId, -dx, 0, positions, buses, children);
  const aspect = groupAspectRatio(hubId, positions, children);

  snapshot.forEach((pos, nid) => {
    positions[nid].x = pos.x;
    positions[nid].y = pos.y;
  });
  return aspect;
}

function stretchMoveAllowed(
  parentId,
  blockerId,
  signedDy,
  cPlusOneId,
  dx,
  childList,
  childIndex,
  positions,
  children,
  buses,
) {
  const busCount = countBusesInGroup(parentId, children, buses);
  if (busCount >= MIN_BUSSES_FOR_ASPECT) {
    const aspect = simulateGroupAspect(
      parentId,
      positions,
      children,
      buses,
      blockerId,
      signedDy,
      cPlusOneId,
      dx,
    );
    if (aspect > ASPECT_CAP) return false;
  }

  return !stretchOverlapsOutsideGroup(
    blockerId,
    signedDy,
    dx,
    cPlusOneId,
    childList,
    childIndex,
    positions,
    children,
    parentId,
  );
}

function findMinimalFit(
  parentId,
  childIndex,
  childList,
  positions,
  parentPos,
  nodeById,
  relationCounts,
  children,
  buses,
  sideMap,
  allowStretch = true,
) {
  const [cPlusOneId] = childList[childIndex];
  const minLeftX = computeMinLeftX(
    parentId,
    childIndex,
    childList,
    positions,
    parentPos.x,
    nodeById,
    relationCounts,
    children,
    sideMap,
  );
  const currentX = positions[cPlusOneId].x;
  const maxDx = currentX - minLeftX;
  if (maxDx <= 0.01) return null;

  const dxSteps = [];
  for (let dx = maxDx; dx >= GAP_X; dx -= GAP_X) dxSteps.push(dx);
  if (maxDx < GAP_X || Math.abs(maxDx - dxSteps[dxSteps.length - 1]) > 0.01) {
    dxSteps.push(maxDx);
  }

  for (const dx of dxSteps) {
    if (!subtreeOverlapsPriorSiblings(
      cPlusOneId, dx, 0, childList, childIndex, positions, children,
    )) {
      return { dx, signedDy: 0, blockerId: null };
    }

    if (!allowStretch) continue;

    for (let j = childIndex - 1; j >= 0; j -= 1) {
      const [blockerId] = childList[j];
      const dy = computeMinimalGridDy(blockerId, cPlusOneId, dx, positions, children);
      if (dy == null || dy <= 0) continue;

      const blockerSide = getChildSide(parentId, blockerId, j, sideMap, positions);
      const signedDy = blockerSide === 'below' ? dy : -dy;

      if (!stretchMoveAllowed(
        parentId,
        blockerId,
        signedDy,
        cPlusOneId,
        dx,
        childList,
        childIndex,
        positions,
        children,
        buses,
      )) continue;

      translateSubtree(blockerId, 0, signedDy, positions, buses, children);
      const ok = !subtreeOverlapsPriorSiblings(
        cPlusOneId, dx, 0, childList, childIndex, positions, children,
      );
      translateSubtree(blockerId, 0, -signedDy, positions, buses, children);
      if (!ok) continue;

      return { dx, signedDy, blockerId };
    }
  }

  return null;
}

function actualExtentAbove(nodeId, positions, children) {
  const pos = positions[nodeId];
  if (!pos) return 0;
  const bbox = subtreeBBox(nodeId, positions, children);
  return Math.max(0, pos.y - bbox.top);
}

function actualExtentBelow(nodeId, positions, children) {
  const pos = positions[nodeId];
  if (!pos) return 0;
  const bbox = subtreeBBox(nodeId, positions, children);
  return Math.max(0, bbox.bottom - (pos.y + CARD_H));
}

function subtreeOverlapsOthers(
  rootId,
  dx,
  dy,
  positions,
  children,
  skipIds,
) {
  const movingBBox = shiftBBox(subtreeBBox(rootId, positions, children), dx, dy);
  for (const nid of Object.keys(positions)) {
    const id = Number(nid);
    if (skipIds.has(id)) continue;
    const rect = layoutCardRect(positions[id]);
    if (bboxesOverlap(movingBBox, rect)) return true;
  }
  return false;
}

function compactVerticalLayout(positions, buses, children, parents, sideMap) {
  const hubIds = [...new Set(buses.map((bus) => bus.source))].sort(
    (a, b) => busDepth(b, parents) - busDepth(a, parents),
  );

  let changed = true;
  while (changed) {
    changed = false;
    hubIds.forEach((parentId) => {
      const parentPos = positions[parentId];
      if (!parentPos) return;
      const childList = children.get(parentId) || [];
      const parentTop = parentPos.y;
      const parentBottom = parentPos.y + CARD_H;

      childList.forEach(([childId], idx) => {
        const childPos = positions[childId];
        if (!childPos) return;
        const side = getChildSide(parentId, childId, idx, sideMap, positions);
        const neededAbove = actualExtentAbove(childId, positions, children);
        const neededBelow = actualExtentBelow(childId, positions, children);

        let targetY;
        if (side === 'below') {
          const slackAbove = childPos.y - parentBottom - GAP_Y;
          if (slackAbove <= neededAbove + 0.01) return;
          targetY = parentBottom + GAP_Y + neededAbove;
        } else {
          const slackBelow = parentTop - GAP_Y - CARD_H - childPos.y;
          if (slackBelow <= neededBelow + 0.01) return;
          targetY = parentTop - GAP_Y - neededBelow - CARD_H;
        }

        const deltaY = targetY - childPos.y;
        if (Math.abs(deltaY) < 0.01) return;

        const skipIds = new Set(descendantIds(childId, children));
        if (subtreeOverlapsOthers(childId, 0, deltaY, positions, children, skipIds)) return;

        translateSubtree(childId, 0, deltaY, positions, buses, children);
        refreshBusesForSubtree(childId, buses, positions, children);
        changed = true;
      });

      const parentBus = buses.find((bus) => bus.source === parentId);
      if (parentBus) refreshBusGeometry(parentBus, positions);
    });
  }
}

function applySqueezeMove(
  fit,
  cPlusOneId,
  bus,
  positions,
  buses,
  children,
) {
  if (fit.blockerId != null && fit.signedDy !== 0) {
    translateSubtree(fit.blockerId, 0, fit.signedDy, positions, buses, children);
  }
  translateSubtree(cPlusOneId, -fit.dx, 0, positions, buses, children);
  refreshBusGeometry(bus, positions);
  if (fit.blockerId != null) {
    refreshBusesForSubtree(fit.blockerId, buses, positions, children);
  }
  refreshBusesForSubtree(cPlusOneId, buses, positions, children);
}

function allCardsOverlap(positions) {
  const entries = Object.entries(positions);
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (rectsOverlap(layoutCardRect(entries[i][1]), layoutCardRect(entries[j][1]))) return true;
    }
  }
  return false;
}

function measureGroupLayout(parentId, positions, children, buses) {
  const busCount = countBusesInGroup(parentId, children, buses);
  const aspect = groupAspectRatio(parentId, positions, children);
  const aspectLegal = busCount < MIN_BUSSES_FOR_ASPECT || aspect <= ASPECT_CAP + 0.001;
  const bbox = subtreeBBox(parentId, positions, children);
  return {
    legal: aspectLegal && !allCardsOverlap(positions),
    aspectDelta: Math.abs(aspect - ASPECT_CAP),
    width: bbox.right - bbox.left,
  };
}

function layoutScoreBetter(a, b) {
  if (a.aspectDelta !== b.aspectDelta) return a.aspectDelta < b.aspectDelta;
  if (Math.abs(a.width - b.width) > 0.01) return a.width < b.width;
  return false;
}

function suffixHasHub(childList, fromIndex, children) {
  for (let idx = fromIndex; idx < childList.length; idx += 1) {
    if (childEmitsBus(childList[idx][0], children)) return true;
  }
  return false;
}

function invertedSuffixSideMap(parentId, fromIndex, childList, sideMap, positions) {
  const temp = new Map(sideMap);
  for (let idx = fromIndex; idx < childList.length; idx += 1) {
    const [childId] = childList[idx];
    const key = sideMapKey(parentId, childId);
    const current = temp.get(key)
      || getChildSide(parentId, childId, idx, temp, positions);
    temp.set(key, current === 'above' ? 'below' : 'above');
  }
  return temp;
}

function suffixFitsOppositeRailVertically(
  parentId,
  fromIndex,
  childList,
  positions,
  parentPos,
  children,
  sideMap,
) {
  const parentTop = parentPos.y;
  const parentBottom = parentPos.y + CARD_H;

  for (let idx = fromIndex; idx < childList.length; idx += 1) {
    const [childId] = childList[idx];
    const side = getChildSide(parentId, childId, idx, sideMap, positions);
    const neededAbove = actualExtentAbove(childId, positions, children);
    const neededBelow = actualExtentBelow(childId, positions, children);

    let targetY;
    if (side === 'below') {
      targetY = parentBottom + GAP_Y + neededAbove;
    } else {
      targetY = parentTop - GAP_Y - neededBelow - CARD_H;
    }

    const dy = targetY - positions[childId].y;
    if (subtreeOverlapsPriorSiblings(childId, 0, dy, childList, idx, positions, children)) {
      return false;
    }
  }
  return true;
}

function oppositeRailHasGap(
  parentId,
  fromIndex,
  childList,
  positions,
  parentPos,
  nodeById,
  relationCounts,
  children,
  sideMap,
) {
  const tempSideMap = invertedSuffixSideMap(
    parentId, fromIndex, childList, sideMap, positions,
  );

  const currentMinLeft = computeMinLeftX(
    parentId,
    fromIndex,
    childList,
    positions,
    parentPos.x,
    nodeById,
    relationCounts,
    children,
    sideMap,
  );
  const flippedMinLeft = computeMinLeftX(
    parentId,
    fromIndex,
    childList,
    positions,
    parentPos.x,
    nodeById,
    relationCounts,
    children,
    tempSideMap,
  );

  if (currentMinLeft - flippedMinLeft >= GAP_X - 0.01) return true;

  return suffixFitsOppositeRailVertically(
    parentId, fromIndex, childList, positions, parentPos, children, tempSideMap,
  );
}

function createLayoutSnapshot(positions, buses, sideMap) {
  const posSnap = new Map();
  Object.entries(positions).forEach(([nid, p]) => {
    posSnap.set(Number(nid), { x: p.x, y: p.y, side: p.side });
  });

  const busSnap = buses.map((bus) => ({
    source: bus.source,
    timeline_y: bus.timeline_y,
    timeline_start_x: bus.timeline_start_x,
    timeline_end_x: bus.timeline_end_x,
    targets: bus.targets.map((t) => ({
      target: t.target,
      side: t.side,
      origin_x: t.origin_x,
    })),
  }));

  return {
    posSnap,
    busSnap,
    sideSnap: new Map(sideMap),
  };
}

function restoreLayoutSnapshot(snapshot, positions, buses, sideMap) {
  const { posSnap, busSnap, sideSnap } = snapshot;

  posSnap.forEach((p, nid) => {
    positions[nid].x = p.x;
    positions[nid].y = p.y;
    if (p.side) positions[nid].side = p.side;
    else delete positions[nid].side;
  });

  sideMap.clear();
  sideSnap.forEach((value, key) => sideMap.set(key, value));

  busSnap.forEach((snap) => {
    const bus = buses.find((b) => b.source === snap.source);
    if (!bus) return;
    bus.timeline_y = snap.timeline_y;
    bus.timeline_start_x = snap.timeline_start_x;
    bus.timeline_end_x = snap.timeline_end_x;
    snap.targets.forEach((st) => {
      const target = bus.targets.find((t) => t.target === st.target);
      if (target) {
        target.side = st.side;
        target.origin_x = st.origin_x;
      }
    });
  });
}

function createGroupSnapshot(parentId, positions, children, buses, sideMap, childList) {
  return createLayoutSnapshot(positions, buses, sideMap);
}

function restoreGroupSnapshot(snapshot, positions, buses, sideMap) {
  restoreLayoutSnapshot(snapshot, positions, buses, sideMap);
}

function invertSuffixSides(parentId, fromIndex, childList, sideMap, positions) {
  for (let idx = fromIndex; idx < childList.length; idx += 1) {
    const [childId] = childList[idx];
    const key = sideMapKey(parentId, childId);
    const current = sideMap.get(key)
      || getChildSide(parentId, childId, idx, sideMap, positions);
    sideMap.set(key, current === 'above' ? 'below' : 'above');
  }
}

function relayoutDirectChildrenOfBus(parentId, positions, buses, children, sideMap) {
  const parentPos = positions[parentId];
  if (!parentPos) return;
  const childList = children.get(parentId) || [];
  const parentTop = parentPos.y;
  const parentBottom = parentPos.y + CARD_H;

  childList.forEach(([childId], idx) => {
    const childPos = positions[childId];
    if (!childPos) return;
    const side = getChildSide(parentId, childId, idx, sideMap, positions);
    const neededAbove = actualExtentAbove(childId, positions, children);
    const neededBelow = actualExtentBelow(childId, positions, children);

    let targetY;
    if (side === 'below') {
      targetY = parentBottom + GAP_Y + neededAbove;
    } else {
      targetY = parentTop - GAP_Y - neededBelow - CARD_H;
    }

    const dy = targetY - childPos.y;
    if (Math.abs(dy) > 0.01) {
      translateSubtree(childId, 0, dy, positions, buses, children);
    }
    positions[childId].side = side;
    updateBusTargetSide(parentId, childId, side, buses);
  });

  const parentBus = buses.find((b) => b.source === parentId);
  if (parentBus) refreshBusGeometry(parentBus, positions);
}

function relayoutNestedBusesUnder(rootId, positions, buses, children, sideMap) {
  descendantIds(rootId, children).forEach((nid) => {
    if ((children.get(nid) || []).length > 0) {
      relayoutDirectChildrenOfBus(nid, positions, buses, children, sideMap);
    }
  });
}

function relayoutSuffixBreakBuses(positions, buses, children, sideMap) {
  const parentsWithBreak = new Set();
  sideMap.forEach((_side, key) => {
    const colon = key.indexOf(':');
    if (colon > 0) parentsWithBreak.add(Number(key.slice(0, colon)));
  });

  parentsWithBreak.forEach((parentId) => {
    relayoutDirectChildrenOfBus(parentId, positions, buses, children, sideMap);
    const childList = children.get(parentId) || [];
    childList.forEach(([childId]) => {
      if (sideMap.has(sideMapKey(parentId, childId))) {
        relayoutNestedBusesUnder(childId, positions, buses, children, sideMap);
      }
    });
  });
}

function childTargetY(parentPos, side, childId, positions, children) {
  const neededAbove = actualExtentAbove(childId, positions, children);
  const neededBelow = actualExtentBelow(childId, positions, children);
  const parentTop = parentPos.y;
  const parentBottom = parentPos.y + CARD_H;
  if (side === 'below') return parentBottom + GAP_Y + neededAbove;
  return parentTop - GAP_Y - neededBelow - CARD_H;
}

function reattachChildToSide(childId, side, parentPos, positions, buses, children) {
  const targetY = childTargetY(parentPos, side, childId, positions, children);
  const dy = targetY - positions[childId].y;
  if (Math.abs(dy) > 0.01) {
    translateSubtree(childId, 0, dy, positions, buses, children);
  }
  positions[childId].side = side;
}

function updateBusTargetSide(parentId, childId, side, buses) {
  const bus = buses.find((b) => b.source === parentId);
  if (!bus) return;
  const target = bus.targets.find((t) => t.target === childId);
  if (target) target.side = side;
}

function applySuffixFlip(
  parentId,
  fromIndex,
  childList,
  parentPos,
  positions,
  buses,
  children,
  sideMap,
) {
  invertSuffixSides(parentId, fromIndex, childList, sideMap, positions);
  for (let idx = fromIndex; idx < childList.length; idx += 1) {
    const [childId] = childList[idx];
    const side = getChildSide(parentId, childId, idx, sideMap, positions);
    positions[childId].side = side;
    updateBusTargetSide(parentId, childId, side, buses);
  }
  relayoutDirectChildrenOfBus(parentId, positions, buses, children, sideMap);
  for (let idx = fromIndex; idx < childList.length; idx += 1) {
    relayoutNestedBusesUnder(childList[idx][0], positions, buses, children, sideMap);
  }
}

function busHasSuffixBreak(parentId, childList, sideMap) {
  return childList.some(([childId]) => sideMap.has(sideMapKey(parentId, childId)));
}

function suffixFlipMinLeftGain(
  parentId,
  fromIndex,
  childList,
  positions,
  parentPos,
  nodeById,
  relationCounts,
  children,
  sideMap,
) {
  const tempSideMap = invertedSuffixSideMap(
    parentId, fromIndex, childList, sideMap, positions,
  );
  const currentMinLeft = computeMinLeftX(
    parentId, fromIndex, childList, positions, parentPos.x,
    nodeById, relationCounts, children, sideMap,
  );
  const flippedMinLeft = computeMinLeftX(
    parentId, fromIndex, childList, positions, parentPos.x,
    nodeById, relationCounts, children, tempSideMap,
  );
  return currentMinLeft - flippedMinLeft;
}

function sideAssignmentPass(
  layoutNodeIds,
  children,
  parents,
  nodeById,
  relationCounts,
  sideMap,
  seeds,
) {
  const extentCache = new Map();
  layoutNodeIds.forEach((nid) => computeExtents(nid, children, extentCache));

  const widthCache = new Map();
  const xCache = new Map();
  layoutNodeIds.forEach((nid) => {
    computeSubtreeWidth(nid, children, nodeById, widthCache, xCache, relationCounts);
  });

  const positions = {};
  const buses = [];
  const placed = new Set();
  let clusterY = PAD;

  const placeCtx = {
    children,
    nodeById,
    extents: extentCache,
    widthCache,
    xCache,
    positions,
    buses,
    placed,
    clusterMembers: null,
    relationCounts,
    sideMap,
  };

  seeds.forEach((seed) => {
    if (placed.has(seed)) return;
    const ext = extentCache.get(seed) || { above: 0, below: 0 };
    const seedY = clusterY + ext.above;
    placeCtx.clusterMembers = new Set();
    placeSubtree(seed, PAD, seedY, placeCtx);
    clusterY = seedY + CARD_H + ext.below + CLUSTER_GAP;
  });

  const repackCtx = {
    children,
    nodeById,
    extents: extentCache,
    widthCache,
    xCache,
    positions,
    buses,
    placed,
    clusterMembers: new Set(),
    relationCounts,
    sideMap,
  };

  const hubIds = [...layoutNodeIds]
    .filter((id) => (children.get(id) || []).length >= 2)
    .sort((a, b) => busDepth(a, parents) - busDepth(b, parents));

  hubIds.forEach((parentId) => {
    const childList = children.get(parentId) || [];
    const parentPos = positions[parentId];
    if (!parentPos) return;

    let flippedThisBus = false;

    const scoreSuffixFlip = (fromIndex, applyFlip) => {
      if (applyFlip) {
        applySuffixFlip(
          parentId, fromIndex, childList, parentPos, positions, buses, children, sideMap,
        );
      }

      squeezeSlideLayout(
        positions, buses, children, parents, nodeById, relationCounts, sideMap,
      );
      stretchLastResortLayout(
        positions, buses, children, parents, nodeById, relationCounts, sideMap,
      );
      compactVerticalLayout(positions, buses, children, parents, sideMap);
      return measureGroupLayout(parentId, positions, children, buses);
    };

    for (let i = 1; i < childList.length; i += 1) {
      if (flippedThisBus || busHasSuffixBreak(parentId, childList, sideMap)) break;

      const canFlip = suffixHasHub(childList, i, children)
        && oppositeRailHasGap(
          parentId, i, childList, positions, parentPos,
          nodeById, relationCounts, children, sideMap,
        );

      if (!canFlip) continue;

      const packedSnapshot = createLayoutSnapshot(positions, buses, sideMap);
      const baselineScore = scoreSuffixFlip(i, false);
      restoreLayoutSnapshot(packedSnapshot, positions, buses, sideMap);
      clearSubtreeCaches(parentId, children, widthCache, xCache);
      computeSubtreeWidth(
        parentId, children, nodeById, widthCache, xCache, relationCounts, sideMap,
      );
      repackSubtree(parentId, repackCtx);

      const minLeftGain = suffixFlipMinLeftGain(
        parentId, i, childList, positions, parentPos,
        nodeById, relationCounts, children, sideMap,
      );
      const tempSideMap = invertedSuffixSideMap(
        parentId, i, childList, sideMap, positions,
      );
      const verticalGapFill = suffixFitsOppositeRailVertically(
        parentId, i, childList, positions, parentPos, children, tempSideMap,
      );
      const flipScore = scoreSuffixFlip(i, true);
      const singleHubSuffix = i === childList.length - 1 && suffixHasHub(childList, i, children);
      const commit = flipScore.legal && (
        layoutScoreBetter(flipScore, baselineScore)
        || minLeftGain >= GAP_X - 0.01
        || (verticalGapFill && singleHubSuffix && flipScore.width <= baselineScore.width + 0.01)
      );

      restoreLayoutSnapshot(packedSnapshot, positions, buses, sideMap);
      clearSubtreeCaches(parentId, children, widthCache, xCache);
      computeSubtreeWidth(
        parentId, children, nodeById, widthCache, xCache, relationCounts, sideMap,
      );
      repackSubtree(parentId, repackCtx);

      if (commit) {
        invertSuffixSides(parentId, i, childList, sideMap, positions);
        flippedThisBus = true;
      }
    }
  });
}

function simulateBusChildMove(
  parentId,
  childIndex,
  childList,
  bus,
  positions,
  buses,
  children,
  parents,
  nodeById,
  relationCounts,
  sideMap,
) {
  const snapshot = createGroupSnapshot(
    parentId, positions, children, buses, sideMap, childList,
  );
  const parentPos = positions[parentId];
  const [cPlusOneId] = childList[childIndex];
  const allowStretch = !busHasSuffixBreak(parentId, childList, sideMap);

  const fit = findMinimalFit(
    parentId,
    childIndex,
    childList,
    positions,
    parentPos,
    nodeById,
    relationCounts,
    children,
    buses,
    sideMap,
    allowStretch,
  );
  if (fit) {
    applySqueezeMove(fit, cPlusOneId, bus, positions, buses, children);
    if (busHasSuffixBreak(parentId, childList, sideMap)) {
      relayoutDirectChildrenOfBus(parentId, positions, buses, children, sideMap);
      relayoutNestedBusesUnder(cPlusOneId, positions, buses, children, sideMap);
    }
  }

  compactVerticalLayout(positions, buses, children, parents, sideMap);

  const score = measureGroupLayout(parentId, positions, children, buses);
  const result = { score, fit, changed: fit != null };
  restoreGroupSnapshot(snapshot, positions, buses, sideMap);
  return result;
}

function applySqueezeMoveIfLegal(
  fit,
  cPlusOneId,
  bus,
  positions,
  buses,
  children,
  parents,
  sideMap,
) {
  const snapshot = createLayoutSnapshot(positions, buses, sideMap);
  applySqueezeMove(fit, cPlusOneId, bus, positions, buses, children);
  compactVerticalLayout(positions, buses, children, parents, sideMap);
  const legal = !allCardsOverlap(positions);
  if (!legal) {
    restoreLayoutSnapshot(snapshot, positions, buses, sideMap);
    return false;
  }
  return true;
}

function optimizeBusChildSlide(
  parentId,
  childIndex,
  childList,
  bus,
  positions,
  buses,
  children,
  parents,
  nodeById,
  relationCounts,
  sideMap,
) {
  const [cPlusOneId] = childList[childIndex];
  const parentPos = positions[parentId];

  const fit = findMinimalFit(
    parentId,
    childIndex,
    childList,
    positions,
    parentPos,
    nodeById,
    relationCounts,
    children,
    buses,
    sideMap,
    false,
  );
  if (!fit) return null;

  const applied = applySqueezeMoveIfLegal(
    fit, cPlusOneId, bus, positions, buses, children, parents, sideMap,
  );
  return applied ? { fit } : null;
}

function optimizeBusChildStretch(
  parentId,
  childIndex,
  childList,
  bus,
  positions,
  buses,
  children,
  parents,
  nodeById,
  relationCounts,
  sideMap,
) {
  if (busHasSuffixBreak(parentId, childList, sideMap)) return null;

  const [cPlusOneId] = childList[childIndex];
  const parentPos = positions[parentId];

  const slideFit = findMinimalFit(
    parentId,
    childIndex,
    childList,
    positions,
    parentPos,
    nodeById,
    relationCounts,
    children,
    buses,
    sideMap,
    false,
  );
  if (slideFit) return null;

  const fit = findMinimalFit(
    parentId,
    childIndex,
    childList,
    positions,
    parentPos,
    nodeById,
    relationCounts,
    children,
    buses,
    sideMap,
    true,
  );
  if (!fit || !fit.signedDy) return null;

  const applied = applySqueezeMoveIfLegal(
    fit, cPlusOneId, bus, positions, buses, children, parents, sideMap,
  );
  return applied ? { fit } : null;
}

function runSqueezePass(positions, buses, children, parents, nodeById, relationCounts, sideMap, optimizeFn) {
  const sortedBuses = [...buses].sort(
    (a, b) => busDepth(b.source, parents) - busDepth(a.source, parents),
  );

  let changed = true;
  while (changed) {
    changed = false;
    sortedBuses.forEach((bus) => {
      const parentId = bus.source;
      const childList = children.get(parentId) || [];
      if (childList.length < 2) return;

      const parentPos = positions[parentId];
      if (!parentPos) return;

      for (let i = 1; i < childList.length; i += 1) {
        const [cPlusOneId] = childList[i];
        if (!positions[cPlusOneId]) continue;

        const result = optimizeFn(
          parentId,
          i,
          childList,
          bus,
          positions,
          buses,
          children,
          parents,
          nodeById,
          relationCounts,
          sideMap,
        );
        if (result) changed = true;
      }
    });
  }
}

/** Post-pack pass: slide bus children left into gaps (no stretch). */
function squeezeSlideLayout(
  positions,
  buses,
  children,
  parents,
  nodeById,
  relationCounts,
  sideMap,
) {
  runSqueezePass(
    positions, buses, children, parents, nodeById, relationCounts, sideMap, optimizeBusChildSlide,
  );
}

/** Stretch prior child vertically only when slide is blocked and legal. */
function stretchLastResortLayout(
  positions,
  buses,
  children,
  parents,
  nodeById,
  relationCounts,
  sideMap,
) {
  runSqueezePass(
    positions, buses, children, parents, nodeById, relationCounts, sideMap, optimizeBusChildStretch,
  );
  relayoutSuffixBreakBuses(positions, buses, children, sideMap);
}

function resolveIntraClusterOverlaps(positions, buses, children, clusterNodeMap) {
  const margin = 4;
  const maxIter = 500;

  clusterNodeMap.forEach((members) => {
    let iter = 0;
    let changed = true;

    while (changed && iter < maxIter) {
      changed = false;
      iter += 1;

      const ids = [...members].filter((id) => positions[id]);
      ids.sort((a, b) => {
        const pa = positions[a];
        const pb = positions[b];
        if (Math.abs(pa.y - pb.y) > 1) return pa.y - pb.y;
        return pa.x - pb.x;
      });

      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const idA = ids[i];
          const idB = ids[j];
          const ra = layoutCardRect(positions[idA]);
          const rb = layoutCardRect(positions[idB]);
          if (!rectsOverlap(ra, rb)) continue;

          const posA = positions[idA];
          const posB = positions[idB];
          const moveId = posA.x > posB.x
            || (Math.abs(posA.x - posB.x) < 1 && idA > idB)
            ? idA
            : idB;
          const otherId = moveId === idA ? idB : idA;
          const rMove = layoutCardRect(positions[moveId]);
          const rOther = layoutCardRect(positions[otherId]);

          const sameY = Math.abs(positions[moveId].y - positions[otherId].y) < 1;
          const sameRail = sameY
            && Math.abs(positions[moveId].x - positions[otherId].x) < CARD_W + GAP_X;

          if (sameRail) {
            const dx = rOther.right + margin - rMove.left;
            if (dx > 0) {
              translateSubtree(moveId, dx, 0, positions, buses, children);
              refreshBusesForSubtree(moveId, buses, positions, children);
              changed = true;
            }
          } else {
            const overlapY = rOther.bottom + margin - rMove.top;
            if (overlapY > 0) {
              const dy = Math.ceil(overlapY / GAP_Y) * GAP_Y;
              translateSubtree(moveId, 0, dy, positions, buses, children);
              refreshBusesForSubtree(moveId, buses, positions, children);
              changed = true;
            }
          }
          break;
        }
        if (changed) break;
      }
    }
  });
}

function resolveCardCollisions(positions, buses, clusterNodeMap) {
  const seedOrder = [...clusterNodeMap.keys()];
  const margin = 4;
  const placedBBoxes = [];

  if (seedOrder.length > 0) {
    const firstMembers = clusterNodeMap.get(seedOrder[0]);
    if (firstMembers) placedBBoxes.push(clusterBBox(firstMembers, positions));
  }

  for (let si = 1; si < seedOrder.length; si += 1) {
    const members = clusterNodeMap.get(seedOrder[si]);
    if (!members) continue;

    let shift = 0;
    let changed = true;

    while (changed) {
      changed = false;
      const mBBox = clusterBBox(members, positions, shift);

      for (let ei = 0; ei < si; ei += 1) {
        const eBBox = placedBBoxes[ei];
        if (!bboxesOverlap(mBBox, eBBox, margin)) continue;

        const needed = eBBox.bottom + margin - mBBox.top;
        if (needed > shift) {
          shift = needed;
          changed = true;
        }

        const earlierMembers = clusterNodeMap.get(seedOrder[ei]);
        for (const mid of members) {
          const mPos = positions[mid];
          if (!mPos) continue;
          const mRect = layoutCardRect({ x: mPos.x, y: mPos.y + shift });
          for (const eid of earlierMembers) {
            const ePos = positions[eid];
            if (!ePos) continue;
            if (rectsOverlap(mRect, layoutCardRect(ePos))) {
              const memberNeeded = layoutCardRect(ePos).bottom + margin - mRect.top;
              if (memberNeeded > shift) {
                shift = memberNeeded;
                changed = true;
              }
            }
          }
        }
      }
    }

    if (shift > 0) {
      members.forEach((nid) => {
        if (positions[nid]) positions[nid].y += shift;
      });
      buses.forEach((bus) => {
        if (members.has(bus.source)) bus.timeline_y += shift;
      });
    }

    placedBBoxes.push(clusterBBox(members, positions));
  }
}

function computeBounds(positions) {
  if (!Object.keys(positions).length) {
    return { width: PAD * 2, height: PAD * 2, min_y: PAD };
  }
  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);
  return {
    width: Math.max(...xs) + CARD_W + PAD,
    height: Math.max(...ys) + CARD_H + PAD,
    min_y: Math.min(...ys),
  };
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

/**
 * Compute pixel layout from visible graph data.
 *
 * @param {object[]} nodes - Visible clergy nodes
 * @param {object[]} links - Display links (both endpoints visible)
 * @param {object} [options]
 * @param {boolean} [options.showPriests=false]
 */
export function computeLineageGridLayout(nodes, links, options = {}) {
  const { showPriests = false, stretchSqueeze = true } = options;

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
  const relationCounts = buildRelationCounts(links);
  const { children, parents, layoutEdges } = buildLayoutForest(layoutNodeIds, primaryLinks);
  const firstClergyIds = computeFirstClergyIds(layoutNodeIds, parents);
  const { directCount, totalDescendants } = computeDescendantMetrics(children, layoutNodeIds);

  const seeds = selectClusterSeeds(firstClergyIds, totalDescendants, nodeById);

  const sideMap = new Map();
  sideAssignmentPass(
    layoutNodeIds,
    children,
    parents,
    nodeById,
    relationCounts,
    sideMap,
    seeds,
  );

  const extentCache = new Map();
  layoutNodeIds.forEach((nid) => computeExtents(nid, children, extentCache, sideMap));

  const widthCache = new Map();
  const xCache = new Map();
  layoutNodeIds.forEach((nid) => {
    computeSubtreeWidth(nid, children, nodeById, widthCache, xCache, relationCounts, sideMap);
  });

  const positions = {};
  const buses = [];
  const placed = new Set();
  const clusterNodeMap = new Map();
  let clusterY = PAD;

  const placeCtx = {
    children,
    nodeById,
    extents: extentCache,
    widthCache,
    xCache,
    positions,
    buses,
    placed,
    clusterMembers: null,
    relationCounts,
    sideMap,
  };

  seeds.forEach((seed) => {
    if (placed.has(seed)) return;
    const ext = extentCache.get(seed) || { above: 0, below: 0 };
    const seedY = clusterY + ext.above;
    const clusterMembers = new Set();
    clusterNodeMap.set(seed, clusterMembers);
    placeCtx.clusterMembers = clusterMembers;

    placeSubtree(seed, PAD, seedY, placeCtx);
    clusterY = seedY + CARD_H + ext.below + CLUSTER_GAP;
  });

  if (stretchSqueeze) {
    squeezeSlideLayout(
      positions,
      buses,
      children,
      parents,
      nodeById,
      relationCounts,
      sideMap,
    );
    stretchLastResortLayout(
      positions,
      buses,
      children,
      parents,
      nodeById,
      relationCounts,
      sideMap,
    );
    compactVerticalLayout(
      positions,
      buses,
      children,
      parents,
      sideMap,
    );
  }

  resolveIntraClusterOverlaps(positions, buses, children, clusterNodeMap);
  resolveCardCollisions(positions, buses, clusterNodeMap);

  if (stretchSqueeze) {
    compactVerticalLayout(
      positions,
      buses,
      children,
      parents,
      sideMap,
    );
  }

  if (Object.keys(positions).length) {
    const minY = Math.min(...Object.values(positions).map((p) => p.y));
    const yShift = minY < PAD ? PAD - minY : 0;
    if (yShift) {
      Object.values(positions).forEach((p) => { p.y += yShift; });
      buses.forEach((bus) => { bus.timeline_y += yShift; });
    }
  }

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

/** Test hooks for layout unit tests (suffix flip, gap heuristic). */
export const __lineageGridTestHooks = {
  defaultChildSide,
  getChildSide,
  invertSuffixSides,
  oppositeRailHasGap,
  applySuffixFlip,
  measureGroupLayout,
  simulateBusChildMove,
  suffixHasHub,
  allCardsOverlap,
  busHasSuffixBreak,
  relayoutDirectChildrenOfBus,
  relayoutNestedBusesUnder,
  relayoutSuffixBreakBuses,
  sideAssignmentPass,
  repackSubtree,
  squeezeSlideLayout,
  stretchLastResortLayout,
  resolveIntraClusterOverlaps,
};

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

function renderCards(stage, nodes, positions, metrics) {
  const cardsLayer = document.createElement('div');
  cardsLayer.className = 'lineage-grid-cards';
  const fragment = document.createDocumentFragment();

  nodes.forEach((node) => {
    const pos = positions[node.id];
    if (!pos) return;

    const card = document.createElement('article');
    card.className = 'lineage-grid-card';
    card.dataset.clergyId = String(node.id);
    card.style.left = `${positionX(pos, metrics)}px`;
    card.style.top = `${positionY(pos, metrics)}px`;
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

function initPanZoom(viewport, stage, fitSize) {
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
      const next = Math.min(2.5, Math.max(MIN_FIT_SCALE, scale * delta));
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

  const fitToView = () => {
    const rect = viewport.getBoundingClientRect();
    const targetW = fitSize?.width ?? stage.offsetWidth;
    const targetH = fitSize?.height ?? stage.offsetHeight;
    const sx = rect.width / targetW;
    const sy = rect.height / targetH;
    scale = Math.min(1, Math.max(MIN_FIT_SCALE, sx, sy)) * 0.95;
    translateX = (rect.width - targetW * scale) / 2;
    translateY = (rect.height - targetH * scale) / 2;
    apply();
  };

  const fitBtn = document.getElementById('lineage-grid-fit');
  if (fitBtn) {
    fitBtn.addEventListener('click', fitToView);
    requestAnimationFrame(fitToView);
  } else {
    apply();
  }

  return { fitToView };
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
  const cardsLayer = renderCards(stage, visibleNodes, positions, activeMetrics);

  if (spriteSheetData) applySpritesToCards(cardsLayer, spriteSheetData);

  const panZoom = initPanZoom(viewport, stage, size);
  return { layout, panZoom, cardsLayer };
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
