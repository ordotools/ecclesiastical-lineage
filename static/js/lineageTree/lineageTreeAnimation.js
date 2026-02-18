/**
 * Animation logic: Bezier path tweens, stagger helpers for lineage tree.
 * @module lineageTreeAnimation
 */

export const TREE_ANIMATION = {
  growthDuration: 80,
  expandDuration: 80,
  collapseDuration: 80,
  collapseArcStrength: 0.25,
};

/** Point on cubic Bezier curve at t ∈ [0,1]. */
export function pointOnCubicBezier(t, P0, P1, P2, P3) {
  const s = 1 - t;
  const x = s * s * s * P0[0] + 3 * s * s * t * P1[0] + 3 * s * t * t * P2[0] + t * t * t * P3[0];
  const y = s * s * s * P0[1] + 3 * s * s * t * P1[1] + 3 * s * t * t * P2[1] + t * t * t * P3[1];
  return [x, y];
}

/** Control points P1, P2 for Bezier from P0 to P3 with given arc strength. */
export function computeBezierControlPoints(P0, P3, arcStrength) {
  const dx = P3[0] - P0[0];
  const dy = P3[1] - P0[1];
  const dist = Math.hypot(dx, dy) || 1;
  const k = arcStrength * dist;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const P1 = [P0[0] + k * perpX, P0[1] + k * perpY];
  const P2 = [P3[0] - k * perpX, P3[1] - k * perpY];
  return { P1, P2 };
}

const treeEaseFn = d3.easeCubicInOut;

/** Stagger timing options for expand/collapse based on depth delta. */
export function computeStaggerOpts(descendantNodes, rootDepth) {
  const maxDepthDelta = descendantNodes.length ? Math.max(...descendantNodes.map(n => (n.depth ?? 0) - rootDepth)) : 0;
  const numGenerations = Math.max(1, maxDepthDelta);
  const timePerGeneration = TREE_ANIMATION.growthDuration / numGenerations;
  return { rootDepth, numGenerations, timePerGeneration };
}

/** linkDelay, linkDuration, nodeDelay, nodeDuration fns from stagger opts. */
export function createStaggerFns(staggerOpts, affectedNodeIds, expandPhase) {
  if (!staggerOpts || !affectedNodeIds) {
    const fallbackDuration = () => (expandPhase ? TREE_ANIMATION.expandDuration : TREE_ANIMATION.collapseDuration);
    return {
      linkDelay: () => 0,
      linkDuration: fallbackDuration,
      nodeDelay: () => 0,
      nodeDuration: fallbackDuration
    };
  }
  const { rootDepth, timePerGeneration, numGenerations } = staggerOpts;
  const linkDelay = (d) => {
    if (!affectedNodeIds.has(d.target._positionId)) return 0;
    const depthDelta = (d.target.depth ?? 0) - rootDepth;
    return expandPhase ? (depthDelta - 1) * timePerGeneration : (numGenerations - depthDelta) * timePerGeneration;
  };
  const linkDuration = (d) => (affectedNodeIds.has(d.target._positionId)) ? timePerGeneration : (expandPhase ? TREE_ANIMATION.expandDuration : TREE_ANIMATION.collapseDuration);
  const nodeDelay = (d) => {
    if (!affectedNodeIds.has(d._positionId)) return 0;
    const depthDelta = (d.depth ?? 0) - rootDepth;
    return expandPhase ? (depthDelta - 1) * timePerGeneration : (numGenerations - depthDelta) * timePerGeneration;
  };
  const nodeDuration = (d) => (affectedNodeIds.has(d._positionId)) ? timePerGeneration : (expandPhase ? TREE_ANIMATION.expandDuration : TREE_ANIMATION.collapseDuration);
  return { linkDelay, linkDuration, nodeDelay, nodeDuration };
}

/** Attr tween for node transform (expand/collapse). */
export function makePathTween(d, getNodePos, getParentPos, arcStrength, collapse) {
  const P0 = collapse ? getNodePos(d) : getParentPos(d);
  const P3 = collapse ? getParentPos(d) : getNodePos(d);
  const { P1, P2 } = computeBezierControlPoints(P0, P3, arcStrength);
  return (t) => {
    const eased = treeEaseFn(t);
    const [x, y] = pointOnCubicBezier(eased, P0, P1, P2, P3);
    return `translate(${x},${y})`;
  };
}

export function makeExpandLinkTween(link, getNodePosFn, getParentPosFn, linkGen, arcStrength, affectedPositionIds, multiRoot) {
  const target = link.target;
  if (!affectedPositionIds?.has(target._positionId)) {
    return () => linkGen(link);
  }
  const P0_tgt = getParentPosFn(target);
  const P3_tgt = getNodePosFn(target);
  const { P1: P1_tgt, P2: P2_tgt } = computeBezierControlPoints(P0_tgt, P3_tgt, arcStrength);
  const srcPos = getNodePosFn(link.source);
  const srcPt = multiRoot ? { y: srcPos[0], x: srcPos[1] } : { x: srcPos[0], y: srcPos[1] };
  return (t) => {
    const eased = treeEaseFn(t);
    const [c0_tgt, c1_tgt] = pointOnCubicBezier(eased, P0_tgt, P1_tgt, P2_tgt, P3_tgt);
    const syntheticTarget = multiRoot ? { y: c0_tgt, x: c1_tgt } : { x: c0_tgt, y: c1_tgt };
    return linkGen({ source: srcPt, target: syntheticTarget });
  };
}

export function makeCollapseLinkTween(link, getNodePosFn, getParentPosFn, linkGen, arcStrength, affectedPositionIds, multiRoot) {
  const target = link.target;
  if (!affectedPositionIds?.has(target._positionId)) {
    return () => linkGen(link);
  }
  const P0_tgt = getNodePosFn(target);
  const P3_tgt = getParentPosFn(target);
  const { P1: P1_tgt, P2: P2_tgt } = computeBezierControlPoints(P0_tgt, P3_tgt, arcStrength);

  const sourceAffected = link.source?._positionId != null && affectedPositionIds?.has(link.source._positionId);
  let P0_src, P1_src, P2_src, P3_src;
  if (sourceAffected) {
    P0_src = getNodePosFn(link.source);
    P3_src = getNodePosFn(link.source);
    const cp = computeBezierControlPoints(P0_src, P3_src, arcStrength);
    P1_src = cp.P1;
    P2_src = cp.P2;
  }

  return (t) => {
    const eased = treeEaseFn(t);
    const [c0_tgt, c1_tgt] = pointOnCubicBezier(eased, P0_tgt, P1_tgt, P2_tgt, P3_tgt);
    const syntheticTarget = multiRoot ? { y: c0_tgt, x: c1_tgt } : { x: c0_tgt, y: c1_tgt };
    const syntheticSource = sourceAffected
      ? pointOnCubicBezier(eased, P0_src, P1_src, P2_src, P3_src)
      : getNodePosFn(link.source);
    const src = sourceAffected
      ? (multiRoot ? { y: syntheticSource[0], x: syntheticSource[1] } : { x: syntheticSource[0], y: syntheticSource[1] })
      : link.source;
    return linkGen({ source: src, target: syntheticTarget });
  };
}

/** Returns the easing function for tree transitions. */
export function getTreeEaseFn() {
  return treeEaseFn;
}
