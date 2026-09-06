/**
 * Gutter lane router for grid lineage edges.
 * Keeps paths off cards and prevents coincident same-direction segments.
 */

import gridMetrics from '../config/grid-metrics.json' with { type: 'json' };

export const GRID_METRICS = { ...gridMetrics };

export function positionX(position, metrics = GRID_METRICS) {
  if (position.x != null) return Number(position.x);
  return metrics.PAD + (position.col ?? 0) * (metrics.CARD_W + metrics.GAP_X);
}

export function positionY(position, metrics = GRID_METRICS) {
  if (position.y != null) return Number(position.y);
  return metrics.PAD + (position.row ?? 0) * (metrics.CARD_H + metrics.GAP_Y);
}

function cellX(col, metrics = GRID_METRICS) {
  return metrics.PAD + col * (metrics.CARD_W + metrics.GAP_X);
}

function cellY(row, metrics = GRID_METRICS) {
  return metrics.PAD + row * (metrics.CARD_H + metrics.GAP_Y);
}

function inflatedCardRect(position, metrics = GRID_METRICS) {
  const inset = metrics.CARD_INSET;
  return {
    x: positionX(position, metrics) - inset,
    y: positionY(position, metrics) - inset,
    w: metrics.CARD_W + inset * 2,
    h: metrics.CARD_H + inset * 2,
  };
}

function bottomCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
}

function topCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y };
}

function rightCenter(rect) {
  return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
}

function leftCenter(rect) {
  return { x: rect.x, y: rect.y + rect.h / 2 };
}

function realCardEdgeY(position, side, metrics = GRID_METRICS) {
  const y = positionY(position, metrics);
  if (side === 'above') return y + metrics.CARD_H;
  return y;
}

function realCardCenterX(position, metrics = GRID_METRICS) {
  return positionX(position, metrics) + metrics.CARD_W / 2;
}

function compareLinkEventSort(a, b) {
  const ka = a.event_sort_key;
  const kb = b.event_sort_key;
  const aNull = ka == null;
  const bNull = kb == null;
  if (aNull !== bNull) return aNull ? 1 : -1;
  if (ka !== kb) return ka - kb;
  const typeOrder = { ordination: 0, consecration: 1 };
  const ta = typeOrder[a.type] ?? 2;
  const tb = typeOrder[b.type] ?? 2;
  return ta - tb;
}

function stubPathKey(sourceId, targetId, link, index) {
  return `${sourceId}->${targetId}:${link.type}:${index}`;
}

function segmentKey(x1, y1, x2, y2) {
  if (y1 === y2) {
    return `H:${y1}:${Math.min(x1, x2)}:${Math.max(x1, x2)}`;
  }
  return `V:${x1}:${Math.min(y1, y2)}:${Math.max(y1, y2)}`;
}

function pointsToPath(points) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  rest.forEach((p) => {
    d += ` L ${p.x} ${p.y}`;
  });
  return d;
}

function simplifyPath(points) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = out[out.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    const collinearH = prev.y === curr.y && curr.y === next.y;
    const collinearV = prev.x === curr.x && curr.x === next.x;
    if (!collinearH && !collinearV) out.push(curr);
  }
  out.push(points[points.length - 1]);
  return out;
}

function rectIntersectsSegment(rect, x1, y1, x2, y2) {
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

class LaneRouter {
  constructor(positions, cardRects, metrics = GRID_METRICS) {
    this.positions = positions;
    this.cardRects = cardRects;
    this.metrics = metrics;
    this.occupied = new Set();
    this.hLaneCount = new Map();
    this.vLaneCount = new Map();
  }

  occupySegment(x1, y1, x2, y2) {
    this.occupied.add(segmentKey(x1, y1, x2, y2));
  }

  isSegmentFree(x1, y1, x2, y2, excludeIds = null) {
    const key = segmentKey(x1, y1, x2, y2);
    if (this.occupied.has(key)) return false;
    for (const [id, rect] of this.cardRects.entries()) {
      if (excludeIds && excludeIds.has(id)) continue;
      if (rectIntersectsSegment(rect, x1, y1, x2, y2)) return false;
    }
    return true;
  }

  reservePath(points, excludeIds = null) {
    const simplified = simplifyPath(points);
    for (let i = 0; i < simplified.length - 1; i += 1) {
      const a = simplified[i];
      const b = simplified[i + 1];
      if (!this.isSegmentFree(a.x, a.y, b.x, b.y, excludeIds)) {
        return null;
      }
    }
    for (let i = 0; i < simplified.length - 1; i += 1) {
      const a = simplified[i];
      const b = simplified[i + 1];
      this.occupySegment(a.x, a.y, b.x, b.y);
    }
    return pointsToPath(simplified);
  }

  gutterHorizY(row) {
    const { CARD_H, GAP_Y, PAD } = this.metrics;
    if (row < 0) {
      return PAD - GAP_Y / 2;
    }
    return cellY(row, this.metrics) + CARD_H + GAP_Y / 2;
  }

  gutterVertX(col) {
    const { CARD_W, GAP_X, PAD } = this.metrics;
    if (col < 0) {
      return PAD - GAP_X / 2;
    }
    return cellX(col, this.metrics) + CARD_W + GAP_X / 2;
  }

  nextHorizLane(y, x1, x2, excludeIds = null) {
    const base = Math.round(y);
    let lane = this.hLaneCount.get(base) || 0;
    while (lane < 24) {
      const offset = Math.floor((lane + 1) / 2) * this.metrics.LANE_PITCH;
      const tryY = y + offset * (lane % 2 === 0 ? 1 : -1);
      if (this.isSegmentFree(x1, tryY, x2, tryY, excludeIds)) {
        this.hLaneCount.set(base, lane + 1);
        return tryY;
      }
      lane += 1;
    }
    return y;
  }

  nextVertLane(x, y1, y2, excludeIds = null) {
    const base = Math.round(x);
    let lane = this.vLaneCount.get(base) || 0;
    while (lane < 24) {
      const offset = Math.floor((lane + 1) / 2) * this.metrics.LANE_PITCH;
      const tryX = x + offset * (lane % 2 === 0 ? 1 : -1);
      if (this.isSegmentFree(tryX, y1, tryX, y2, excludeIds)) {
        this.vLaneCount.set(base, lane + 1);
        return tryX;
      }
      lane += 1;
    }
    return x;
  }

  routeBus(bus, links = [], linkEndpointsFn = null) {
    const hubPos = this.positions[bus.source];
    if (!hubPos) return {};
    const hubRect = this.cardRects.get(bus.source);
    if (!hubRect) return {};

    const hubExclude = new Set([bus.source]);
    const start = rightCenter(hubRect);
    const trunkBaseY = bus.timeline_y != null
      ? Number(bus.timeline_y)
      : start.y;

    const targetEntries = (bus.targets || []).map((entry) => {
      const targetPos = this.positions[entry.target];
      if (!targetPos) return null;

      let targetLinks = [];
      if (linkEndpointsFn && links.length) {
        targetLinks = links.filter((link) => {
          if (link.type !== 'ordination' && link.type !== 'consecration') return false;
          const { source, target } = linkEndpointsFn(link);
          return source === bus.source && target === entry.target;
        }).sort(compareLinkEventSort);
      }

      const cardCenterX = entry.origin_x != null
        ? Number(entry.origin_x)
        : realCardCenterX(targetPos, this.metrics);
      const edgeY = realCardEdgeY(targetPos, entry.side, this.metrics);
      return {
        targetId: entry.target,
        side: entry.side,
        cardCenterX,
        edgeY,
        targetLinks,
      };
    }).filter(Boolean);

    if (!targetEntries.length) return {};

    const maxStubX = Math.max(...targetEntries.map((entry) => {
      const n = entry.targetLinks.length || 1;
      const groupHalf = n <= 1 ? 0 : ((n - 1) * this.metrics.MULTI_STUB_GAP) / 2;
      return entry.cardCenterX + groupHalf;
    }));
    const timelineStartX = bus.timeline_start_x != null
      ? Number(bus.timeline_start_x)
      : start.x + 8;
    const timelineEndX = bus.timeline_end_x != null
      ? Number(bus.timeline_end_x)
      : maxStubX + 8;
    const trunkYFinal = this.nextHorizLane(trunkBaseY, timelineStartX, timelineEndX, hubExclude);
    const exitX = start.x + 8;

    this.occupySegment(start.x, start.y, exitX, start.y);
    this.occupySegment(exitX, start.y, exitX, trunkYFinal);
    this.occupySegment(timelineStartX, trunkYFinal, timelineEndX, trunkYFinal);

    const trunkPath = pointsToPath(simplifyPath([
      start,
      { x: exitX, y: start.y },
      { x: exitX, y: trunkYFinal },
      { x: timelineEndX, y: trunkYFinal },
    ]));

    const childPaths = {
      [`bus-trunk:${bus.source}`]: trunkPath,
    };

    targetEntries.forEach((entry) => {
      const relations = entry.targetLinks.length
        ? entry.targetLinks
        : [{ type: 'consecration' }];
      const n = relations.length;
      const { MULTI_STUB_GAP } = this.metrics;

      relations.forEach((link, i) => {
        const attachX = entry.cardCenterX + (i - (n - 1) / 2) * MULTI_STUB_GAP;
        const points = [
          { x: attachX, y: trunkYFinal },
          { x: attachX, y: entry.edgeY },
        ];
        const simplified = simplifyPath(points);
        for (let seg = 0; seg < simplified.length - 1; seg += 1) {
          const a = simplified[seg];
          const b = simplified[seg + 1];
          this.occupySegment(a.x, a.y, b.x, b.y);
        }
        const path = pointsToPath(simplified);
        const key = entry.targetLinks.length
          ? stubPathKey(bus.source, entry.targetId, link, i)
          : `${bus.source}->${entry.targetId}`;
        childPaths[key] = path;
      });
    });

    return childPaths;
  }

  routeVertical(sourceRect, targetRect, sourceId, targetId, downward) {
    const exclude = new Set([sourceId, targetId]);
    const start = downward ? bottomCenter(sourceRect) : topCenter(sourceRect);
    const end = downward ? topCenter(targetRect) : bottomCenter(targetRect);

    const sourceY = positionY(this.positions[sourceId] || {}, this.metrics);
    const targetY = positionY(this.positions[targetId] || {}, this.metrics);
    const sourceRow = this.positions[sourceId]?.row ?? this.rowAtY(sourceY);
    const targetRow = this.positions[targetId]?.row ?? this.rowAtY(targetY);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const gutterRow = Math.min(sourceRow, targetRow) + attempt;
      const gutterY = this.gutterHorizY(gutterRow);
      const midY = this.nextHorizLane(gutterY, Math.min(start.x, end.x), Math.max(start.x, end.x), exclude);
      const vx1 = this.nextVertLane(start.x, Math.min(start.y, midY), Math.max(start.y, midY), exclude);
      const vx2 = this.nextVertLane(end.x, Math.min(midY, end.y), Math.max(midY, end.y), exclude);
      const path = this.reservePath([
        start,
        { x: vx1, y: start.y },
        { x: vx1, y: midY },
        { x: vx2, y: midY },
        { x: vx2, y: end.y },
        end,
      ], exclude);
      if (path) return path;
    }
    return null;
  }

  routeSide(sourceRect, targetRect, sourceId, targetId) {
    const exclude = new Set([sourceId, targetId]);
    const start = rightCenter(sourceRect);
    const end = leftCenter(targetRect);
    const sourceCol = this.positions[sourceId]?.col ?? this.colAtX(start.x);
    const targetCol = this.positions[targetId]?.col ?? this.colAtX(end.x);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const gutterCol = Math.min(sourceCol, targetCol) + attempt;
      const gutterX = this.gutterVertX(gutterCol);
      const midX = this.nextVertLane(gutterX, Math.min(start.y, end.y), Math.max(start.y, end.y), exclude);
      const hy1 = this.nextHorizLane(start.y, start.x, midX, exclude);
      const hy2 = this.nextHorizLane(end.y, midX, end.x, exclude);
      const path = this.reservePath([
        start,
        { x: midX, y: hy1 },
        { x: midX, y: hy2 },
        { x: end.x, y: hy2 },
        end,
      ], exclude);
      if (path) return path;
    }
    return null;
  }

  rowAtY(y) {
    const { PAD, CARD_H, GAP_Y } = this.metrics;
    return Math.floor((y - PAD) / (CARD_H + GAP_Y));
  }

  colAtX(x) {
    const { PAD, CARD_W, GAP_X } = this.metrics;
    return Math.floor((x - PAD) / (CARD_W + GAP_X));
  }

  routeEdge(link, sourceId, targetId, isPrimary, isBusChild) {
    const sourceRect = this.cardRects.get(sourceId);
    const targetRect = this.cardRects.get(targetId);
    if (!sourceRect || !targetRect) return null;

    if (isBusChild) {
      return null;
    }

    if (link.type === 'ordination' || link.type === 'consecration' || link.type === 'co-consecration') {
      return null;
    }

    return null;
  }
}

function linkRoutePriority(link) {
  if (link.type === 'consecration') return 0;
  if (link.type === 'co-consecration') return 2;
  if (link.type === 'ordination') return 3;
  return 1;
}

function buildBusChildSet(buses) {
  const set = new Set();
  (buses || []).forEach((bus) => {
    (bus.targets || []).forEach((entry) => {
      set.add(`${bus.source}->${entry.target}`);
    });
  });
  return set;
}

function relationLinksForPair(links, source, target, linkEndpointsFn) {
  return links.filter((link) => {
    if (link.type !== 'ordination' && link.type !== 'consecration') return false;
    const endpoints = linkEndpointsFn(link);
    return endpoints.source === source && endpoints.target === target;
  }).sort(compareLinkEventSort);
}

function pathKeyForLink(source, target, link, links, linkEndpointsFn) {
  const relations = relationLinksForPair(links, source, target, linkEndpointsFn);
  const index = relations.indexOf(link);
  if (index >= 0) return stubPathKey(source, target, link, index);
  return `${source}->${target}`;
}

/**
 * Route all edges and hub buses; returns Map edgeKey -> SVG path d string.
 */
export function routeAllEdges(links, positions, layout, linkEndpointsFn, metrics = {}) {
  const activeMetrics = { ...GRID_METRICS, ...layout?.grid_metrics, ...metrics };
  const cardRects = new Map();
  Object.entries(positions).forEach(([id, pos]) => {
    cardRects.set(Number(id), inflatedCardRect(pos, activeMetrics));
  });

  const router = new LaneRouter(positions, cardRects, activeMetrics);
  const paths = new Map();
  const primaryEdgeSet = new Set(
    (layout.primary_edges || []).map((e) => `${e.source}->${e.target}`),
  );
  const busChildSet = buildBusChildSet(layout.buses);
  const sortedLinks = [...links].sort((a, b) => linkRoutePriority(a) - linkRoutePriority(b));

  (layout.buses || []).forEach((bus) => {
    const busPaths = router.routeBus(bus, sortedLinks, linkEndpointsFn);
    Object.entries(busPaths).forEach(([key, path]) => {
      paths.set(key, path);
    });
  });

  sortedLinks.forEach((link) => {
    const { source, target } = linkEndpointsFn(link);
    const typedKey = pathKeyForLink(source, target, link, sortedLinks, linkEndpointsFn);
    const legacyKey = `${source}->${target}`;
    if (paths.has(typedKey) || paths.has(legacyKey)) return;

    const sourcePos = positions[source];
    const targetPos = positions[target];
    if (!sourcePos || !targetPos) return;

    const isPrimary = (link.type === 'consecration' || link.type === 'ordination')
      && primaryEdgeSet.has(legacyKey);
    const isBusChild = busChildSet.has(legacyKey);
    const path = router.routeEdge(link, source, target, isPrimary, isBusChild);
    if (path) paths.set(typedKey, path);
  });

  return paths;
}

export {
  cellX,
  cellY,
  inflatedCardRect,
  bottomCenter,
  topCenter,
  rightCenter,
  leftCenter,
  segmentKey,
  rectIntersectsSegment,
  LaneRouter,
  realCardEdgeY,
  realCardCenterX,
  stubPathKey,
  compareLinkEventSort,
  pathKeyForLink,
  relationLinksForPair,
};
