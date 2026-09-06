/**
 * Deterministic timeline packing for succession lineage grid.
 * Runs client-side from visible graph data (nodes, links).
 */
import gridMetrics from '../config/grid-metrics.json' with { type: 'json' };

export const GRID_METRICS = { ...gridMetrics };

const {
  CARD_W,
  CARD_H,
  GAP_X,
  GAP_Y,
  PAD,
  DATE_SCALE,
  MIN_BRANCH_GAP,
  MULTI_STUB_GAP,
} = GRID_METRICS;

const MIN_CHILD_GAP = CARD_W + GAP_X;
const CLUSTER_GAP = GAP_Y;
const FIRST_CHILD_X = CARD_W + GAP_X;

/** Higher rank = more valid (Table A inverted for selection). */
const VALIDITY_RANK = {
  valid: 5,
  sub_conditione: 4,
  doubtful_event: 3,
  doubtfully_valid: 2,
  invalid: 1,
};

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

function linkEndpoint(value) {
  if (value != null && typeof value === 'object') return value.id ?? null;
  return value ?? null;
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

function nodeSortKey(node) {
  const date = node.consecration_date || node.ordination_date || '';
  return [-0, date, (node.name || '').toLowerCase(), node.id || 0];
}

function compareNodeSort(a, b) {
  const ka = nodeSortKey(a);
  const kb = nodeSortKey(b);
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
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

function findCycleEdge(edges) {
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

  function dfs(node) {
    visiting.add(node);
    const children = (graph.get(node) || []).slice().sort((a, b) => a - b);
    for (const child of children) {
      if (visiting.has(child)) return [node, child];
      if (!visited.has(child)) {
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

function edgesEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

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

  while (findCycleEdge(remaining)) {
    const candidates = remaining.filter(
      (edge) => !findCycleEdge(remaining.filter((e) => !edgesEqual(e, edge))),
    );
    let toRemove;
    if (candidates.length) {
      toRemove = candidates.reduce((best, edge) => {
        const bk = removalKey(best);
        const ek = removalKey(edge);
        for (let i = 0; i < ek.length; i += 1) {
          if (ek[i] > bk[i]) return edge;
          if (ek[i] < bk[i]) return best;
        }
        return best;
      });
    } else {
      toRemove = findCycleEdge(remaining);
    }
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
      if (cmp !== 0) return cmp;
      return a[0] - b[0];
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

  nodeIds.forEach((nid) => {
    directCount[nid] = (children.get(nid) || []).length;
  });

  [...nodeIds].sort((a, b) => a - b).forEach((nid) => {
    const seen = new Set();
    const stack = (children.get(nid) || []).map(([cid]) => cid);
    while (stack.length) {
      const childId = stack.pop();
      if (seen.has(childId)) continue;
      seen.add(childId);
      (children.get(childId) || []).forEach(([cid]) => stack.push(cid));
    }
    totalDescendants[nid] = seen.size;
  });

  return { directCount, totalDescendants };
}

function childSide(index) {
  return index % 2 === 0 ? 'above' : 'below';
}

function computeExtents(nodeId, children, cache) {
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
    const childExt = computeExtents(childId, children, cache);
    const side = childSide(idx);
    const slot = CARD_H + GAP_Y + childExt.above + childExt.below;
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

function computeChildXPositions(
  parentId,
  childList,
  nodeById,
  children,
  widthCache,
  xCache,
  relationCounts,
) {
  if (!childList.length) return [];

  const firstOrigin = FIRST_CHILD_X + CARD_W / 2;
  const allLeaves = childList.every(([childId]) => !childEmitsBus(childId, children));

  if (allLeaves) {
    const pitch = branchMinPitch(parentId, childList, relationCounts);
    const positions = [];
    const railOccupied = { above: 0, below: 0 };
    let prevYear = null;

    childList.forEach(([childId, link], idx) => {
      const node = nodeById.get(childId) || { id: childId };
      const year = linkYear(link, node);
      const side = childSide(idx);
      const childWidth = computeSubtreeWidth(
        childId,
        children,
        nodeById,
        widthCache,
        xCache,
        relationCounts,
      );
      const gap = siblingGap(year, prevYear, idx === 0);
      const originX = firstOrigin + idx * pitch;
      const railMinX = railOccupied[side] === 0
        ? FIRST_CHILD_X
        : railOccupied[side] + gap;

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
    const side = childSide(idx);
    const childWidth = computeSubtreeWidth(
      childId,
      children,
      nodeById,
      widthCache,
      xCache,
      relationCounts,
    );
    const gap = siblingGap(year, prevYear, idx === 0);
    const nRelations = relationCounts.get(`${parentId}:${childId}`) || 1;
    const groupHalf = relationGroupHalfWidth(nRelations);

    let originX;
    if (idx === 0) {
      originX = firstOrigin;
    } else {
      originX = prevOriginX + prevGroupHalf + MIN_BRANCH_GAP + groupHalf;
    }

    const railMinX = railOccupied[side] === 0
      ? FIRST_CHILD_X
      : railOccupied[side] + gap;

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
) {
  if (widthCache.has(nodeId)) return widthCache.get(nodeId);

  const childList = children.get(nodeId) || [];
  if (!childList.length) {
    widthCache.set(nodeId, CARD_W);
    xCache.set(nodeId, []);
    return CARD_W;
  }

  const childXs = computeChildXPositions(
    nodeId,
    childList,
    nodeById,
    children,
    widthCache,
    xCache,
    relationCounts,
  );
  xCache.set(nodeId, childList.map(([cid], i) => [cid, childXs[i]]));

  let maxRight = CARD_W;
  childList.forEach(([childId], i) => {
    const childWidth = computeSubtreeWidth(
      childId,
      children,
      nodeById,
      widthCache,
      xCache,
      relationCounts,
    );
    maxRight = Math.max(maxRight, childXs[i] + childWidth);
  });

  widthCache.set(nodeId, maxRight);
  return maxRight;
}

function seedRankKey(nodeId, totalDescendants, nodeById) {
  const node = nodeById.get(nodeId) || { id: nodeId };
  const desc = -(totalDescendants[nodeId] || 0);
  const ns = nodeSortKey(node);
  return [desc, ...ns];
}

function compareSeedRank(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function selectClusterSeeds(layoutNodeIds, children, parents, totalDescendants, nodeById) {
  const placed = new Set();
  const seeds = [];

  while (placed.size < layoutNodeIds.size) {
    let candidates = [...layoutNodeIds].filter(
      (nid) => !placed.has(nid)
        && (parents.get(nid) || []).every(
          (p) => !layoutNodeIds.has(p) || placed.has(p),
        ),
    );
    if (!candidates.length) {
      candidates = [...layoutNodeIds].filter((nid) => !placed.has(nid));
    }

    const seed = candidates.reduce((best, nid) => {
      const bk = seedRankKey(best, totalDescendants, nodeById);
      const nk = seedRankKey(nid, totalDescendants, nodeById);
      return compareSeedRank(nk, bk) < 0 ? nid : best;
    });

    seeds.push(seed);

    const stack = [seed];
    while (stack.length) {
      const nodeId = stack.pop();
      if (placed.has(nodeId) || !layoutNodeIds.has(nodeId)) continue;
      placed.add(nodeId);
      (children.get(nodeId) || []).forEach(([cid]) => stack.push(cid));
    }
  }

  return seeds;
}

function placeSubtree(
  nodeId,
  x,
  y,
  children,
  nodeById,
  extents,
  widthCache,
  xCache,
  positions,
  buses,
  placed,
  clusterMembers,
  relationCounts,
  side = null,
) {
  if (placed.has(nodeId)) return;

  const pos = { x, y };
  if (side) pos.side = side;
  positions[nodeId] = pos;
  placed.add(nodeId);
  clusterMembers.add(nodeId);

  const childList = children.get(nodeId) || [];
  if (!childList.length) return;

  const timelineY = y + CARD_H / 2;
  let relXs = (xCache.get(nodeId) || []).map(([, relX]) => relX);
  if (relXs.length !== childList.length) {
    relXs = computeChildXPositions(
      nodeId,
      childList,
      nodeById,
      children,
      widthCache,
      xCache,
      relationCounts,
    );
    xCache.set(nodeId, childList.map(([cid], i) => [cid, relXs[i]]));
  }

  const busTargets = [];
  const parentTop = y;
  const parentBottom = y + CARD_H;

  childList.forEach(([childId, _link], idx) => {
    if (placed.has(childId)) return;
    const childSideVal = childSide(idx);
    const childExt = extents.get(childId) || { above: 0, below: 0 };
    const childX = x + relXs[idx];

    let childY;
    if (childSideVal === 'above') {
      childY = parentTop - GAP_Y - childExt.below - CARD_H;
    } else {
      childY = parentBottom + GAP_Y + childExt.above;
    }

    busTargets.push({
      target: childId,
      side: childSideVal,
      origin_x: x + relXs[idx] + CARD_W / 2,
    });
    placeSubtree(
      childId,
      childX,
      childY,
      children,
      nodeById,
      extents,
      widthCache,
      xCache,
      positions,
      buses,
      placed,
      clusterMembers,
      relationCounts,
      childSideVal,
    );
  });

  if (busTargets.length) {
    const timelineStartX = x + CARD_W;
    const timelineEndX = x + Math.max(
      ...childList.map(([,], i) => relXs[i] + CARD_W),
    );
    buses.push({
      source: nodeId,
      timeline_y: timelineY,
      timeline_start_x: timelineStartX,
      timeline_end_x: timelineEndX,
      targets: busTargets,
    });
  }
}

function cardRect(pos) {
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

function resolveCardCollisions(positions, buses, clusterNodeMap) {
  const seedOrder = [...clusterNodeMap.keys()];
  const margin = 4;

  for (let si = 1; si < seedOrder.length; si += 1) {
    const seed = seedOrder[si];
    const members = clusterNodeMap.get(seed);
    if (!members) continue;

    let shift = 0;
    let changed = true;

    while (changed) {
      changed = false;
      for (const earlierSeed of seedOrder.slice(0, si)) {
        const earlierMembers = clusterNodeMap.get(earlierSeed);
        if (!earlierMembers) continue;

        for (const mid of members) {
          const mPos = positions[mid];
          if (!mPos) continue;
          const mRect = cardRect({ x: mPos.x, y: mPos.y + shift });

          for (const eid of earlierMembers) {
            const ePos = positions[eid];
            if (!ePos) continue;
            const eRect = cardRect(ePos);
            if (rectsOverlap(mRect, eRect)) {
              const needed = eRect.bottom + margin - mRect.top;
              if (needed > shift) {
                shift = needed;
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
        if (members.has(bus.source)) {
          bus.timeline_y += shift;
        }
      });
    }
  }
}

function computeBounds(positions) {
  if (!Object.keys(positions).length) {
    return { width: PAD * 2, height: PAD * 2, min_y: PAD };
  }

  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);
  const maxX = Math.max(...xs) + CARD_W;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + CARD_H;

  return {
    width: maxX + PAD,
    height: maxY + PAD,
    min_y: minY,
  };
}

function isLayoutEligibleNode(node, consecrationParticipants, showPriests) {
  if (showPriests) return true;
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
  const { showPriests = false } = options;

  const nodeById = new Map();
  nodes.forEach((n) => {
    if (n.id != null) nodeById.set(n.id, n);
  });
  const visibleIds = new Set(nodeById.keys());

  const consecrationParticipants = new Set();
  links.forEach((link) => {
    if (link.type !== 'consecration') return;
    const source = linkEndpoint(link.source);
    const target = linkEndpoint(link.target);
    if (source != null) consecrationParticipants.add(source);
    if (target != null) consecrationParticipants.add(target);
  });

  const layoutNodeIds = showPriests
    ? new Set(visibleIds)
    : new Set(
      [...visibleIds].filter((nid) => {
        const node = nodeById.get(nid);
        return node && isLayoutEligibleNode(node, consecrationParticipants, false);
      }),
    );

  const primaryLinks = selectPrimarySuccessionLinks(links, nodeById);
  const relationCounts = buildRelationCounts(links);

  const { children, parents, layoutEdges } = buildLayoutForest(
    layoutNodeIds,
    primaryLinks,
  );

  const firstClergyIds = computeFirstClergyIds(layoutNodeIds, parents);

  const { directCount, totalDescendants } = computeDescendantMetrics(children, layoutNodeIds);

  const extentCache = new Map();
  layoutNodeIds.forEach((nid) => computeExtents(nid, children, extentCache));

  const widthCache = new Map();
  const xCache = new Map();
  layoutNodeIds.forEach((nid) => {
    computeSubtreeWidth(nid, children, nodeById, widthCache, xCache, relationCounts);
  });

  const seeds = selectClusterSeeds(
    layoutNodeIds,
    children,
    parents,
    totalDescendants,
    nodeById,
  );

  const positions = {};
  const buses = [];
  const placed = new Set();
  const clusterNodeMap = new Map();
  let clusterY = PAD;

  seeds.forEach((seed) => {
    if (placed.has(seed)) return;
    const ext = extentCache.get(seed) || { above: 0, below: 0 };
    const seedY = clusterY + ext.above;
    const clusterMembers = new Set();
    clusterNodeMap.set(seed, clusterMembers);

    placeSubtree(
      seed,
      PAD,
      seedY,
      children,
      nodeById,
      extentCache,
      widthCache,
      xCache,
      positions,
      buses,
      placed,
      clusterMembers,
      relationCounts,
    );

    clusterY = seedY + CARD_H + ext.below + CLUSTER_GAP;
  });

  resolveCardCollisions(positions, buses, clusterNodeMap);

  if (Object.keys(positions).length) {
    const minY = Math.min(...Object.values(positions).map((p) => p.y));
    const yShift = minY < PAD ? PAD - minY : 0;
    if (yShift) {
      Object.values(positions).forEach((p) => { p.y += yShift; });
      buses.forEach((bus) => { bus.timeline_y += yShift; });
    }
  }

  const bounds = computeBounds(positions);

  const primaryEdges = layoutEdges
    .map(([s, t]) => ({ source: s, target: t }))
    .sort((a, b) => (a.source - b.source) || (a.target - b.target));

  const metrics = {};
  layoutNodeIds.forEach((nid) => {
    metrics[nid] = {
      direct_count: directCount[nid] || 0,
      total_descendants: totalDescendants[nid] || 0,
    };
  });

  return {
    positions,
    primary_edges: primaryEdges,
    buses,
    layout_node_ids: [...layoutNodeIds].sort((a, b) => a - b),
    first_clergy_ids: firstClergyIds,
    bounds,
    metrics,
    grid_metrics: { ...GRID_METRICS },
  };
}
