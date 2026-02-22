/**
 * Tree layout visualization module.
 * Builds forest from nodesData + linksData, D3 tree layout, renders nodes/links, zoom, fit.
 */
import { width, height } from '../../js/constants.js';
import { createNodeGroup } from '../shared/nodes/nodes.js';

/**
 * Build forest from nodesData and linksData.
 * Uses ordination and consecration links only (skips co-consecration).
 * Each node has at most one parent; edges are source → target (parent → child).
 *
 * @param {Array} nodesData - Array of clergy nodes (id, name, is_lineage_root, ...)
 * @param {Array} linksData - Array of links (source, target, type: 'ordination'|'consecration'|'co-consecration')
 * @returns {{ roots: Array, nodeMap: Map }} roots = array of root nodes with nested children; nodeMap by id
 */
export function buildForest(nodesData, linksData) {
  const nodes = Array.isArray(nodesData) ? nodesData : [];
  const links = Array.isArray(linksData) ? linksData : [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Parent map: target id -> source id; link type map for styling
  const parentMap = new Map();
  const linkTypeMap = new Map();
  for (const link of links) {
    if (link.type === 'ordination' || link.type === 'consecration') {
      const sourceId = typeof link.source === 'object' ? link.source?.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target?.id : link.target;
      if (sourceId != null && targetId != null) {
        parentMap.set(targetId, sourceId);
        linkTypeMap.set(targetId, link.type);
      }
    }
  }

  // Roots: is_lineage_root, or fallback to nodes with no incoming link
  let roots = nodes.filter((n) => Boolean(n.is_lineage_root));
  if (roots.length === 0) {
    roots = nodes.filter((n) => !parentMap.has(n.id));
  }

  // Leftmost-descendant key for same-layer ordering (min id in subtree); compare as string for consistency.
  const leftmostKey = (n) => (n._leftmostDescendantId != null ? String(n._leftmostDescendantId) : String(n.id ?? ''));

  // Attach children to each node; store parentLinkType for link styling.
  // Order children by leftmost descendant (same-layer) to minimize link crossings before layout.
  const attachChildren = (node) => {
    if (!node) return node;
    const childList = nodes
      .filter((n) => parentMap.get(n.id) === node.id)
      .map((n) => {
        const child = { ...n, children: [], parentLinkType: linkTypeMap.get(n.id) || 'consecration' };
        return attachChildren(child);
      });
    node.children = childList.sort((a, b) => leftmostKey(a).localeCompare(leftmostKey(b)));
    node._leftmostDescendantId = node.children.length === 0 ? node.id : node.children[0]._leftmostDescendantId;
    return node;
  };

  roots = roots.map((n) => attachChildren({ ...n, children: [] }));

  return { roots, nodeMap };
}

const NODE_SIZE_X = 100;
const NODE_SIZE_Y = 120;
const PRE_1968_YEAR = 1968;
const YEAR_SCALE = 8;
const PADDING_Y = 40;

const tree = d3.tree()
  .nodeSize([NODE_SIZE_X, NODE_SIZE_Y])
  .separation((a, b) => (a.parent === b.parent ? 1 : 2));

/**
 * Orientation of point C relative to segment A→B: positive = left, negative = right, 0 = collinear.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {{ x: number, y: number }} c
 */
function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * True if segment (a,b) properly intersects segment (c,d) (interior point, not at endpoints).
 */
function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

/**
 * Optional post-pass: detect link crossings (segment intersection).
 * @param {Array<{ source: { x: number, y: number }, target: { x: number, y: number } }>} links
 * @returns {Array<[number, number]>} Pairs of link indices [i, j] with i < j that cross
 */
export function detectLinkCrossings(links) {
  const crossings = [];
  for (let i = 0; i < links.length; i++) {
    const la = links[i];
    const a = { x: la.source.x, y: la.source.y };
    const b = { x: la.target.x, y: la.target.y };
    for (let j = i + 1; j < links.length; j++) {
      const lb = links[j];
      const c = { x: lb.source.x, y: lb.source.y };
      const d = { x: lb.target.x, y: lb.target.y };
      if (segmentsIntersect(a, b, c, d)) crossings.push([i, j]);
    }
  }
  return crossings;
}

function parseYear(dateValue) {
  if (!dateValue) return null;
  const y = parseInt(String(dateValue).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/**
 * Initialize tree visualization in #graph-container.
 * Uses window.nodesData/window.linksData if nodesData/linksData not provided.
 * Respects node.filtered when using window.currentNodes/currentLinks.
 *
 * @param {Array} [nodesData] - Optional; defaults to window.currentNodes or window.nodesData
 * @param {Array} [linksData] - Optional; defaults to window.currentLinks or window.linksData
 */
export async function initializeTreeVisualization(nodesData, linksData) {
  const nodesRaw = nodesData ?? window.currentNodes ?? window.nodesData ?? [];
  const linksRaw = linksData ?? window.currentLinks ?? window.linksData ?? [];

  if (!Array.isArray(nodesRaw) || !Array.isArray(linksRaw)) {
    const container = document.getElementById('graph-container');
    if (container) {
      container.innerHTML = '<div class="text-center p-4"><p class="text-muted">Unable to load lineage data.</p></div>';
    }
    return;
  }

  const nodes = nodesRaw.filter((n) => n.filtered !== true);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const links = linksRaw.filter((l) => {
    const sid = typeof l.source === 'object' ? l.source?.id : l.source;
    const tid = typeof l.target === 'object' ? l.target?.id : l.target;
    return nodeIds.has(sid) && nodeIds.has(tid) && (l.filtered !== true);
  });

  if (nodes.length === 0) {
    const container = document.getElementById('graph-container');
    if (container) {
      container.innerHTML = '<div class="text-center p-4"><p class="text-muted">No clergy data available.</p></div>';
    }
    return;
  }

  const { roots, nodeMap } = buildForest(nodes, links);
  if (roots.length === 0) {
    const container = document.getElementById('graph-container');
    if (container) {
      container.innerHTML = '<div class="text-center p-4"><p class="text-muted">No lineage roots; mark roots in the editor to see the tree.</p></div>';
    }
    return;
  }

  // Resolve link source/target to node objects if needed
  links.forEach((link) => {
    if (typeof link.source === 'number') link.source = nodeMap.get(link.source);
    if (typeof link.target === 'number') link.target = nodeMap.get(link.target);
  });

  // Precompute is_pre_1968_consecration for useSquareNode
  const pre1968Targets = new Set();
  links.forEach((l) => {
    const y = parseYear(l.date);
    if (y != null && y < PRE_1968_YEAR && (l.type === 'consecration' || l.type === 'co-consecration')) {
      pre1968Targets.add(typeof l.target === 'object' ? l.target?.id : l.target);
    }
  });
  nodes.forEach((n) => {
    if (n.is_pre_1968_consecration === undefined) {
      const cy = parseYear(n.consecration_date);
      n.is_pre_1968_consecration = cy != null ? cy < PRE_1968_YEAR : pre1968Targets.has(n.id);
    }
  });

  const useSquareNode = (d) => !!(d?.is_pre_1968_consecration || d?.is_lineage_root);

  const rootStyles = getComputedStyle(document.documentElement);
  const cssLinkOrdination = rootStyles.getPropertyValue('--viz-link-ordination-color').trim() || '#1c1c1c';
  const cssLinkConsecration = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || '#0b9f2f';

  const containerEl = document.getElementById('graph-container');
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const svg = d3.select(containerEl)
    .append('svg')
    .attr('class', 'viz-svg viz-svg-tree')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background', 'transparent')
    .style('overflow', 'visible');

  const zoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => container.attr('transform', event.transform));

  svg.call(zoom);
  window.currentZoom = zoom;

  const container = svg.append('g').attr('class', 'viz-zoom-layer viz-tree-zoom-layer');

  const virtualRoot = { id: '__root__', children: roots };
  const root = d3.hierarchy(virtualRoot, (d) => d.children || []);
  root.sort((a, b) => {
    const keyA = a.data._leftmostDescendantId ?? a.data.id;
    const keyB = b.data._leftmostDescendantId ?? b.data.id;
    return String(keyA).localeCompare(String(keyB));
  });
  tree(root);

  // Timeline-based y override: overwrite node.y with year-based positions
  const realNodes = root.descendants().filter((n) => n.data.id !== '__root__');
  const getLayoutYear = (node) => {
    const d = node.data;
    const cy = parseYear(d?.consecration_date);
    if (cy != null) return cy;
    const oy = parseYear(d?.ordination_date);
    if (oy != null) return oy;
    return null;
  };
  const years = realNodes.map(getLayoutYear).filter((y) => y != null);
  const minYear = years.length > 0 ? Math.min(...years) : null;
  const maxYear = years.length > 0 ? Math.max(...years) : null;
  const useTimeline = minYear != null && maxYear != null;

  realNodes.forEach((node) => {
    const layoutYear = getLayoutYear(node);
    if (useTimeline && layoutYear != null) {
      node.y = (layoutYear - minYear) * YEAR_SCALE + PADDING_Y;
    } else {
      // Nodes without dates: fallback to depth * NODE_SIZE_Y
      node.y = node.depth * NODE_SIZE_Y;
    }
  });

  const linkGen = d3.linkVertical()
    .x((d) => d.x)
    .y((d) => d.y);

  const treeLinks = root.links().filter((l) => l.source.data.id !== '__root__');
  const linkCrossings = detectLinkCrossings(treeLinks);
  if (linkCrossings.length > 0) {
    window.__treeLinkCrossings = linkCrossings;
  } else {
    delete window.__treeLinkCrossings;
  }
  const linksGroup = container.append('g').attr('class', 'viz-links-tree');
  linksGroup.selectAll('path')
    .data(treeLinks)
    .join('path')
    .attr('class', 'viz-link viz-link-tree')
    .attr('d', linkGen)
    .attr('stroke', (d) => (d.target.data?.parentLinkType === 'ordination' ? cssLinkOrdination : cssLinkConsecration))
    .attr('fill', 'none')
    .attr('stroke-width', 2);

  const descendants = root.descendants().filter((d) => d.data.id !== '__root__');
  const nodeData = descendants.map((d) => ({ ...d.data, _treeX: d.x, _treeY: d.y }));
  const nodesGroup = container.append('g').attr('class', 'viz-nodes viz-nodes-tree');
  const nodeEnter = nodesGroup.selectAll('g.viz-node')
    .data(nodeData)
    .join('g')
    .attr('class', 'viz-node viz-node-tree')
    .attr('transform', (d) => `translate(${d._treeX},${d._treeY})`)
    .style('pointer-events', 'all')
    .on('mouseover', function(event, d) {
      import('../../js/highlightLineage.js').then(({ highlightLineageChain }) => highlightLineageChain(d));
    })
    .on('mouseout', function() {
      import('../../js/highlightLineage.js').then(({ clearHighlight }) => clearHighlight());
    });

  createNodeGroup(nodeEnter, {
    useSquareNode,
    spriteSheetData: null,
    getLabelText: (d) => d.name ?? '',
    getTitleText: (d) => `${d.name ?? ''}\nRank: ${d.rank ?? ''}\nOrganization: ${d.organization ?? ''}`,
    showPlaceholderIcon: false
  });

  nodeEnter.on('click', async (event, d) => {
    if (!d?.id) return;
    const { handleNodeClick } = await import('../../js/modals.js');
    handleNodeClick(event, d);
  });

  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';

  const xs = descendants.map((d) => d.x);
  const ys = descendants.map((d) => d.y);
  const pad = 60;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = Math.min(width / w, height / h, 1.5);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = width / 2 - cx * scale;
  const ty = height / 2 - cy * scale;

  svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}
