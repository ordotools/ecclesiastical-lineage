// D3 tree visualization for ecclesiastical lineage (consecration-only)
import {
  OUTER_RADIUS,
  INNER_RADIUS,
  IMAGE_SIZE,
  LABEL_DY,
  GREEN_COLOR,
  TREE_NODE_DX,
  TREE_NODE_DY,
  TREE_GAP,
  SUMMARY_NODE_WIDTH,
  SUMMARY_NODE_HEIGHT,
  width,
  height
} from '../constants.js';
import { handleNodeClick } from '../modals.js';
import { renderStatusBadges } from '../statusBadges.js';
import {
  toStableId,
  getNodeId,
  useSquareNode,
  getLinkStatus,
  getStatusIcon,
  getStatusIconColor,
  parseYearFromDate,
  yearToDecade
} from './lineageTreeUtils.js';
import {
  computePre1968Flags,
  buildHierarchy,
  applyDefaultSummaries,
  buildLinkToValidityMap,
  decadeSteps
} from './lineageTreeHierarchy.js';
import {
  TREE_ANIMATION,
  getTreeEaseFn,
  computeStaggerOpts,
  createStaggerFns,
  makePathTween,
  makeExpandLinkTween,
  makeCollapseLinkTween
} from './lineageTreeAnimation.js';

const treeEaseFn = getTreeEaseFn();

function getDisplayChildren(expandedParentIds, summaryExpandedIds) {
  return (d) => {
    const nodeId = getNodeId(d);
    const sid = toStableId(nodeId);
    const isSummary = !!((d?.data ?? d)?.isSummary || d?.isSummary);
    if (isSummary) {
      return summaryExpandedIds.has(sid) ? ((d?.data ?? d)?.leafNodes ?? null) : null;
    }
    if (sid && !expandedParentIds.has(sid)) return null;
    return d?.children ?? null;
  };
}

function createDisplayHierarchy(rootData, expandedParentIds, summaryExpandedIds) {
  const childrenAccessor = getDisplayChildren(expandedParentIds, summaryExpandedIds);
  if (rootData.single) {
    return { single: d3.hierarchy(rootData.single, childrenAccessor) };
  }
  return {
    multi: rootData.multi.map(r => d3.hierarchy(r, childrenAccessor))
  };
}

function createCoordAccessor(isMultiRoot) {
  const depthKey = isMultiRoot ? 'y' : 'x';
  return {
    depthKey,
    getNodePos(d) {
      return isMultiRoot ? [d.y, d.x] : [d.x, d.y];
    },
    getParentPos(d) {
      const p = d.parent;
      if (!p) return isMultiRoot ? [d.y, d.x] : [d.x, d.y];
      return isMultiRoot ? [p.y, p.x] : [p.x, p.y];
    },
    getTargetCoords(tgt) {
      return { tx: isMultiRoot ? tgt.y : tgt.x, ty: isMultiRoot ? tgt.x : tgt.y };
    }
  };
}

function assignPositionIds(allNodes, isMultiRoot) {
  const byDepth = [...allNodes].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  byDepth.forEach(d => {
    const parent = d.parent;
    if (!parent) {
      d._positionId = String(d._treeIndex ?? 0);
    } else {
      const siblings = parent.children ?? [];
      const idx = siblings.indexOf(d);
      d._positionId = parent._positionId + '.' + (idx >= 0 ? idx : siblings.length);
    }
  });
}

function applyTimelinePositions(allNodes, allLinks, linkDateByEdge, coord) {
  const depthKey = coord.depthKey;
  const nodeToDepth = new Map();
  const nodeToDecade = new Map();

  allNodes.forEach(d => {
    const nid = getNodeId(d);
    if (d.depth === 0) {
      nodeToDepth.set(d, 0);
      const rootData = d.data?.data ?? d.data;
      const rootDecade = d.data?.isSummary ? d.data.decade : yearToDecade(parseYearFromDate(rootData?.consecration_date));
      nodeToDecade.set(d, rootDecade);
      return;
    }
    const parent = d.parent;
    const pid = getNodeId(parent);
    const childDecade = d.data?.isSummary
      ? d.data.decade
      : yearToDecade(parseYearFromDate(pid != null && nid != null ? linkDateByEdge.get(`${pid}-${nid}`) : null));
    const parentDecade = nodeToDecade.get(parent);
    const parentDepth = nodeToDepth.get(parent) ?? 0;

    let childDepth;
    if (childDecade == null || parentDecade == null || childDecade === parentDecade) {
      childDepth = parentDepth + 1;
    } else {
      const steps = Math.max(1, decadeSteps(childDecade - parentDecade));
      childDepth = parentDepth + steps;
    }
    nodeToDepth.set(d, childDepth);
    nodeToDecade.set(d, childDecade);
  });

  allNodes.forEach(d => {
    const depthVal = (nodeToDepth.get(d) ?? 0) * TREE_NODE_DX;
    d[depthKey] = depthVal;
  });
}

/** Initializes the lineage tree D3 visualization. */
export async function initializeTreeView() {
  console.time('Tree view initialization');

  const linksRaw = window.linksData || [];
  const nodesRaw = window.nodesData || [];

  if (!Array.isArray(linksRaw) || !Array.isArray(nodesRaw)) {
    console.error('Invalid data:', { linksRaw, nodesRaw });
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">Unable to load lineage data.</p></div>';
    return;
  }

  if (nodesRaw.length === 0) {
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">No clergy data available.</p></div>';
    return;
  }

  const selectedOrg = window.selectedOrganization;
  let nodes = nodesRaw
    .map(n => ({ ...n }))
    .filter(n => selectedOrg == null || n.organization === selectedOrg);

  const consecrationLinks = linksRaw
    .map(l => ({ ...l }))
    .filter(l => l.type === 'consecration');

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  consecrationLinks.forEach(link => {
    if (typeof link.source === 'number') link.source = nodeMap.get(link.source);
    if (typeof link.target === 'number') link.target = nodeMap.get(link.target);
  });

  const validConsecLinks = consecrationLinks.filter(l =>
    l.source && l.target &&
    nodeMap.has(l.source.id) && nodeMap.has(l.target.id)
  );

  const linkToValidityMap = buildLinkToValidityMap(validConsecLinks);

  const linkDateByEdge = new Map();
  linkToValidityMap.forEach((link, key) => {
    if (link?.date != null) linkDateByEdge.set(key, link.date);
  });

  computePre1968Flags(nodes, consecrationLinks);

  const rootHierarchy = buildHierarchy(nodes, validConsecLinks, nodeMap, linkDateByEdge);
  if (!rootHierarchy || (rootHierarchy.multi && rootHierarchy.multi.length === 0) || (rootHierarchy.single && !rootHierarchy.single.data)) {
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">No consecration lineage to display.</p></div>';
    return;
  }

  function collectExpandableNodeIds(hierarchyWithSummaries) {
    const ids = new Set();
    function visit(node, isRoot) {
      const nid = getNodeId(node);
      const hasChildren = (node.children ?? []).length > 0;
      const isSummary = !!node.data?.isSummary;
      if ((hasChildren || isSummary) && nid != null) ids.add(toStableId(nid));
      (node.children ?? []).forEach(c => visit(c, false));
    }
    if (hierarchyWithSummaries.single) visit(hierarchyWithSummaries.single, true);
    if (hierarchyWithSummaries.multi) hierarchyWithSummaries.multi.forEach(r => visit(r, true));
    return ids;
  }

  const hierarchyWithSummaries = applyDefaultSummaries(rootHierarchy, linkDateByEdge);
  const allExpandableIds = collectExpandableNodeIds(hierarchyWithSummaries);

  const expandedParentIds = new Set();
  const summaryExpandedIds = new Set();

  function loadTreeState() {
    try {
      const key = `lineageTreeState_${selectedOrg ?? 'all'}`;
      const raw = localStorage.getItem(key);
      if (!raw) {
        allExpandableIds.forEach(id => expandedParentIds.add(id));
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.expandedParentIds) && parsed.expandedParentIds.length > 0) {
        parsed.expandedParentIds.forEach(id => {
          const sid = toStableId(id);
          if (sid) expandedParentIds.add(sid);
        });
      } else if (Array.isArray(parsed?.collapsedNodeIds) && parsed.collapsedNodeIds.length > 0) {
        allExpandableIds.forEach(id => expandedParentIds.add(id));
        parsed.collapsedNodeIds.forEach(id => {
          const sid = toStableId(id);
          if (sid) expandedParentIds.delete(sid);
        });
      } else {
        allExpandableIds.forEach(id => expandedParentIds.add(id));
      }
      (parsed?.summaryExpandedIds ?? []).forEach(id => {
        const sid = toStableId(id);
        if (sid) summaryExpandedIds.add(sid);
      });
    } catch {
      /* localStorage access may fail (private mode, quota); ignore */
    }
  }

  function saveTreeState() {
    try {
      const key = `lineageTreeState_${selectedOrg ?? 'all'}`;
      const payload = { expandedParentIds: [...expandedParentIds], summaryExpandedIds: [...summaryExpandedIds] };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      /* localStorage access may fail (private mode, quota); ignore */
    }
  }

  loadTreeState();
  const isMultiRoot = !!rootHierarchy.multi;
  const coord = createCoordAccessor(isMultiRoot);
  const treeLayout = d3.tree()
    .nodeSize([TREE_NODE_DY, TREE_NODE_DX])
    .separation((a, b) => {
      if (a.parent !== b.parent) return 2;
      const aSize = a.descendants?.().length ?? 1;
      const bSize = b.descendants?.().length ?? 1;
      return 1 + Math.min(aSize, bSize) * 0.15;
    });

  function runLayout() {
    const hierarchyForDisplay = applyDefaultSummaries(rootHierarchy, linkDateByEdge);
    const displayData = createDisplayHierarchy(hierarchyForDisplay, expandedParentIds, summaryExpandedIds);
    let allNodes = [];
    let allLinks = [];

    if (isMultiRoot) {
      displayData.multi.forEach((h, i) => {
        treeLayout(h);
        h.each(d => { d._treeIndex = i; });
        allNodes = allNodes.concat(h.descendants());
        allLinks = allLinks.concat(h.links());
      });
    } else {
      treeLayout(displayData.single);
      allNodes = displayData.single.descendants();
      allLinks = displayData.single.links();
    }

    applyTimelinePositions(allNodes, allLinks, linkDateByEdge, coord);

    allNodes.sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));

    if (isMultiRoot) {
      const depthKey = coord.depthKey;
      const treeWidths = displayData.multi.map((_, i) => {
        const nodesInTree = allNodes.filter(d => d._treeIndex === i);
        const maxY = Math.max(0, ...nodesInTree.map(d => d[depthKey]));
        return maxY || TREE_NODE_DX;
      });
      const xOffsets = [0];
      for (let i = 1; i < displayData.multi.length; i++) {
        xOffsets.push(xOffsets[i - 1] + treeWidths[i - 1] + TREE_GAP);
      }
      allNodes.forEach(d => {
        const idx = d._treeIndex;
        if (idx != null) d[depthKey] += xOffsets[idx];
      });
    }
    assignPositionIds(allNodes, isMultiRoot);
    return { allNodes, allLinks };
  }

  let { allNodes, allLinks } = runLayout();

  function getCssVizVars() {
    const rootStyles = getComputedStyle(document.documentElement);
    return {
      labelDy: parseFloat(rootStyles.getPropertyValue('--viz-label-dy')) || LABEL_DY,
      linkColor: rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR,
      nodeOuterRadius: parseFloat(rootStyles.getPropertyValue('--viz-node-outer-radius')) || OUTER_RADIUS,
      strokeWidth: parseFloat(rootStyles.getPropertyValue('--viz-node-stroke-width')) || 1,
      surfaceColor: rootStyles.getPropertyValue('--viz-surface').trim() || '#1a1a1a'
    };
  }
  const vizVars = getCssVizVars();

  let spriteSheetData = null;
  try {
    if (typeof window.getSpriteSheetData === 'function') {
      spriteSheetData = await window.getSpriteSheetData();
    } else {
      const resp = await fetch('/api/sprite-sheet');
      if (resp.ok) {
        const ct = resp.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          spriteSheetData = await resp.json();
        }
      }
    }
  } catch (e) {
    console.warn('Sprite sheet load failed:', e);
  }

  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('class', 'viz-svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background', 'transparent')
    .style('overflow', 'visible');

  const container = svg.append('g').attr('class', 'viz-zoom-layer');

  const zoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => container.attr('transform', event.transform));
  svg.call(zoom);

  window.currentZoom = zoom;

  const xExt = d3.extent(allNodes, d => coord.getNodePos(d)[0]);
  const yExt = d3.extent(allNodes, d => coord.getNodePos(d)[1]);
  const midX = (xExt[0] + xExt[1]) / 2;
  const midY = (yExt[0] + yExt[1]) / 2;
  const scale = 0.8;
  const initialTransform = isMultiRoot
    ? d3.zoomIdentity.translate(width / 2 - midY * scale, height / 2 - midX * scale).scale(scale)
    : d3.zoomIdentity.translate(width / 2 - midX * scale, 40 - midY * scale).scale(scale);
  svg.call(zoom.transform, initialTransform);
  const defs = container.append('defs');

  const arrowMarker = { path: 'M0,-5L10,0L0,5Z', viewBox: '0 -5 10 10' };
  defs.selectAll('marker')
    .data(['arrowhead-tree'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', arrowMarker.viewBox)
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', arrowMarker.path)
    .attr('fill', vizVars.linkColor);

  allNodes.forEach(d => {
    const data = d.data.data;
    if (data) {
      const clipId = `clip-avatar-tree-${data.id}`;
      const clipPath = defs.append('clipPath').attr('id', clipId);
      if (useSquareNode(data)) {
        clipPath.append('rect')
          .attr('width', IMAGE_SIZE)
          .attr('height', IMAGE_SIZE)
          .attr('x', -IMAGE_SIZE / 2)
          .attr('y', -IMAGE_SIZE / 2);
      } else {
        clipPath.append('circle')
          .attr('r', IMAGE_SIZE / 2)
          .attr('cx', 0)
          .attr('cy', 0);
      }
    }
  });

  const linkGenerator = isMultiRoot
    ? d3.linkHorizontal().x(d => d.y).y(d => d.x)
    : d3.linkVertical().x(d => d.x).y(d => d.y);

  const linkKey = (l) => `${getNodeId(l.source)}-${getNodeId(l.target)}`;
  const iconOffset = vizVars.nodeOuterRadius + (vizVars.strokeWidth / 2) + 30;

  function hasCollapsibleContent(d) {
    return (d.data?.children?.length > 0) || !!d.data?.isSummary;
  }

  function getCollapseOrder(node, getDisplayChildrenFn) {
    const order = [];
    function visit(n) {
      const children = getDisplayChildrenFn(n);
      if (children && children.length > 0) {
        children.forEach(visit);
      }
      if (hasCollapsibleContent(n) && !isCollapsed(n)) {
        order.push(n);
      }
    }
    visit(node);
    return order;
  }

  function visitDescendants(node, getDisplayChildrenFn, collector) {
    function visit(n) {
      collector.add(n);
      const children = getDisplayChildrenFn(n);
      if (children && children.length > 0) children.forEach(c => visit(c));
    }
    const children = getDisplayChildrenFn(node);
    if (children && children.length > 0) children.forEach(c => visit(c));
  }

  function collectDescendantPositionIds(node, getDisplayChildrenFn) {
    const ids = new Set();
    visitDescendants(node, getDisplayChildrenFn, { add(n) { if (n._positionId) ids.add(n._positionId); } });
    return ids;
  }

  function collectDescendantNodes(node, getDisplayChildrenFn) {
    const result = [];
    visitDescendants(node, getDisplayChildrenFn, { add(n) { result.push(n); } });
    return result;
  }

  function isCollapsed(d) {
    const sid = toStableId(getNodeId(d));
    if (d.data?.isSummary) return !summaryExpandedIds.has(sid);
    return !expandedParentIds.has(sid);
  }

  function getChevronTransform(d) {
    return isCollapsed(d) ? 'rotate(-90) translate(-2.5,3)' : 'translate(-3,-2.5)';
  }

  function createContextMenuItem(label, onClick) {
    const item = document.createElement('div');
    item.className = 'viz-context-menu-item';
    item.textContent = label;
    item.setAttribute('role', 'menuitem');
    item.addEventListener('click', async () => {
      hideContextMenu();
      await onClick();
    });
    return item;
  }

  const CHEVRON_OFFSET = vizVars.nodeOuterRadius + 12;
  const chevronPath = 'M 0 0 L 6 0 L 3 5 Z'; // triangle pointing down; rotate -90 for right

  function findPointAtDistanceFromTarget(pathEl, targetX, targetY, targetDist, epsilon = 0.5) {
    const total = pathEl.getTotalLength();
    if (total < 2 * targetDist) {
      const mid = pathEl.getPointAtLength(total / 2);
      return mid;
    }
    let lo = 0;
    let hi = total;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const p = pathEl.getPointAtLength(mid);
      const d = Math.hypot(p.x - targetX, p.y - targetY);
      if (Math.abs(d - targetDist) < epsilon) return p;
      if (d > targetDist) lo = mid;
      else hi = mid;
    }
    return pathEl.getPointAtLength((lo + hi) / 2);
  }

  function getIconPositionOnCurve(treeLink, linkGen, targetX, targetY, offset) {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', linkGen(treeLink));
    const p = findPointAtDistanceFromTarget(pathEl, targetX, targetY, offset);
    return { x: p.x, y: p.y };
  }

  const linksBase = container.append('g').attr('class', 'viz-links-base');
  const linkStatusIconsGroup = container.append('g').attr('class', 'viz-link-status-icons');
  const nodesGroup = container.append('g').attr('class', 'viz-nodes');

  const contextMenuEl = document.createElement('div');
  contextMenuEl.className = 'viz-context-menu';
  contextMenuEl.setAttribute('role', 'menu');
  document.getElementById('graph-container').appendChild(contextMenuEl);

  function hideContextMenu() {
    contextMenuEl.classList.remove('visible');
    contextMenuEl.innerHTML = '';
    document.removeEventListener('click', hideContextMenuOnOutsideClick);
    document.removeEventListener('contextmenu', hideContextMenuOnOutsideClick);
  }

  function hideContextMenuOnOutsideClick(e) {
    if (contextMenuEl.contains(e.target)) return;
    hideContextMenu();
  }

  async function performStagedCollapse(d) {
    const getDisplayChildrenFn = getDisplayChildren(expandedParentIds, summaryExpandedIds);
    const toCollapse = getCollapseOrder(d, getDisplayChildrenFn);
    const affectedNodeIds = new Set();
    for (const n of toCollapse) {
      collectDescendantPositionIds(n, getDisplayChildrenFn).forEach(id => affectedNodeIds.add(id));
    }
    if (toCollapse.length === 0) {
      affectedNodeIds.clear();
      collectDescendantPositionIds(d, getDisplayChildrenFn).forEach(id => affectedNodeIds.add(id));
    }
    const rootDepth = d.depth ?? 0;
    const descendantNodes = collectDescendantNodes(d, getDisplayChildrenFn);
    const staggerOpts = computeStaggerOpts(descendantNodes, rootDepth);
    const clickedId = toStableId(getNodeId(d));
    if (d.data?.isSummary) {
      summaryExpandedIds.delete(clickedId);
    } else {
      expandedParentIds.delete(clickedId);
    }
    saveTreeState();
    if (affectedNodeIds.size === 0) {
      await updateTree({ collapsePhase: false });
      return;
    }
    await updateTree({ collapsePhase: true, affectedNodeIds, staggerOpts });
    await updateTree({ collapsePhase: false, affectedNodeIds });
  }

  async function performStagedExpand(d) {
    const nodeId = toStableId(getNodeId(d));
    if (d.data?.isSummary) {
      summaryExpandedIds.add(nodeId);
    } else {
      expandedParentIds.add(nodeId);
    }
    saveTreeState();
    const { allNodes } = runLayout();
    const expandedInNewLayout = allNodes.find(n => toStableId(getNodeId(n)) === nodeId);
    const affectedNodeIds = new Set();
    let staggerOpts = null;
    if (expandedInNewLayout) {
      const rootDepth = expandedInNewLayout.depth ?? 0;
      const descendants = expandedInNewLayout.descendants().slice(1);
      descendants.forEach(n => {
        if (n._positionId) affectedNodeIds.add(n._positionId);
      });
      staggerOpts = computeStaggerOpts(descendants, rootDepth);
    }
    if (affectedNodeIds.size === 0) {
      await updateTree({ expandPhase: false });
      return;
    }
    await updateTree({ expandPhase: 'reflow', affectedNodeIds, staggerOpts });
    await updateTree({ expandPhase: true, affectedNodeIds, staggerOpts });
    await updateTree({ expandPhase: false, affectedNodeIds });
  }

  function showContextMenu(event, d) {
    if (!hasCollapsibleContent(d)) return;
    event.preventDefault();
    event.stopPropagation();
    const nodeId = getNodeId(d);
    const collapsed = isCollapsed(d);
    const isSummary = !!d.data?.isSummary;
    contextMenuEl.innerHTML = '';
    const expandLabel = isSummary ? 'Expand' : 'Expand subtree';
    const collapseLabel = isSummary ? 'Collapse' : 'Collapse subtree';
    if (collapsed) {
      contextMenuEl.appendChild(createContextMenuItem(expandLabel, () => performStagedExpand(d)));
    } else {
      contextMenuEl.appendChild(createContextMenuItem(collapseLabel, () => performStagedCollapse(d)));
    }
    contextMenuEl.style.left = `${event.clientX}px`;
    contextMenuEl.style.top = `${event.clientY}px`;
    contextMenuEl.classList.add('visible');
    document.addEventListener('click', hideContextMenuOnOutsideClick);
    document.addEventListener('contextmenu', hideContextMenuOnOutsideClick);
  }

  function renderSummaryNodeContent(g, d) {
    const { count, decade } = d.data;
    const label = `${count} consecration${count !== 1 ? 's' : ''} (${decade}s)`;
    g.selectAll('*').remove();
    g.append('rect')
      .attr('class', 'viz-node-summary viz-node-summary-rect')
      .attr('width', SUMMARY_NODE_WIDTH)
      .attr('height', SUMMARY_NODE_HEIGHT)
      .attr('x', -SUMMARY_NODE_WIDTH / 2)
      .attr('y', -SUMMARY_NODE_HEIGHT / 2)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', 'rgba(80,90,100,0.4)')
      .attr('stroke', 'rgba(200,200,220,0.7)')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,4');
    g.append('text')
      .attr('class', 'viz-node-label viz-node-summary-label')
      .attr('dy', vizVars.labelDy)
      .attr('y', 2)
      .text(label);
    g.append('title').text(`Click or use chevron to expand and show ${count} individual consecration${count !== 1 ? 's' : ''}`);
  }

  function hideImageOnError() {
    d3.select(this).style('opacity', 0);
  }

  function renderNodeImage(g, data, squareNode, spriteSheet) {
    if (spriteSheet?.success && spriteSheet.mapping) {
      const pos = spriteSheet.mapping[data.id] ?? spriteSheet.mapping[String(data.id)];
      if (pos && Array.isArray(pos) && pos.length === 2) {
        g.append('image')
          .attr('xlink:href', spriteSheet.url)
          .attr('x', -pos[0] - IMAGE_SIZE / 2)
          .attr('y', -pos[1] - IMAGE_SIZE / 2)
          .attr('width', spriteSheet.sprite_width || spriteSheet.sprite_height || 48)
          .attr('height', spriteSheet.sprite_height || spriteSheet.sprite_width || 48)
          .attr('clip-path', `url(#clip-avatar-tree-${data.id})`)
          .attr('preserveAspectRatio', 'none')
          .style('pointer-events', 'none');
        return;
      }
    }
    g.append('image')
      .attr('xlink:href', data.image_url || '')
      .attr('x', -IMAGE_SIZE / 2)
      .attr('y', -IMAGE_SIZE / 2)
      .attr('width', IMAGE_SIZE)
      .attr('height', IMAGE_SIZE)
      .attr('clip-path', squareNode ? 'none' : `circle(${IMAGE_SIZE / 2}px at ${IMAGE_SIZE / 2}px ${IMAGE_SIZE / 2}px)`)
      .style('pointer-events', 'none')
      .style('opacity', data.image_url ? 1 : 0)
      .on('error', hideImageOnError);
  }

  function renderNodeContent(g, d) {
    if (d.data?.isSummary) {
      renderSummaryNodeContent(g, d);
      return;
    }
    const data = d.data.data;
    if (!data) return;
    const squareNode = useSquareNode(data);
    g.selectAll('*').remove();
    g.append('circle')
      .attr('class', 'viz-node-outer viz-node-outer-circle')
      .attr('r', vizVars.nodeOuterRadius)
      .attr('fill', data.org_color)
      .attr('stroke', data.rank_color)
      .attr('stroke-width', vizVars.strokeWidth)
      .style('display', squareNode ? 'none' : null);
    g.append('rect')
      .attr('class', 'viz-node-outer viz-node-outer-rect')
      .attr('width', vizVars.nodeOuterRadius * 2)
      .attr('height', vizVars.nodeOuterRadius * 2)
      .attr('x', -vizVars.nodeOuterRadius)
      .attr('y', -vizVars.nodeOuterRadius)
      .attr('fill', data.org_color)
      .attr('stroke', data.rank_color)
      .attr('stroke-width', vizVars.strokeWidth)
      .style('display', squareNode ? null : 'none');
    g.append('circle')
      .attr('class', 'viz-node-inner viz-node-inner-circle')
      .attr('r', INNER_RADIUS)
      .attr('fill', data.rank_color)
      .style('display', squareNode ? 'none' : null);
    g.append('rect')
      .attr('class', 'viz-node-inner viz-node-inner-rect')
      .attr('width', INNER_RADIUS * 2)
      .attr('height', INNER_RADIUS * 2)
      .attr('x', -INNER_RADIUS)
      .attr('y', -INNER_RADIUS)
      .attr('fill', data.rank_color)
      .style('display', squareNode ? null : 'none');
    g.append('circle')
      .attr('class', 'viz-node-image-bg viz-node-image-bg-circle')
      .attr('r', IMAGE_SIZE / 2)
      .attr('fill', 'rgba(255,255,255,1)')
      .style('opacity', data.image_url ? 1 : 0)
      .style('display', squareNode ? 'none' : null);
    g.append('rect')
      .attr('class', 'viz-node-image-bg viz-node-image-bg-rect')
      .attr('width', IMAGE_SIZE)
      .attr('height', IMAGE_SIZE)
      .attr('x', -IMAGE_SIZE / 2)
      .attr('y', -IMAGE_SIZE / 2)
      .attr('fill', 'rgba(255,255,255,1)')
      .style('opacity', data.image_url ? 1 : 0)
      .style('display', squareNode ? null : 'none');
    renderNodeImage(g, data, squareNode, spriteSheetData);
    g.append('text')
      .attr('class', 'viz-node-label')
      .attr('dy', vizVars.labelDy)
      .text(data.name);
    g.append('title')
      .text(`${data.name}\nRank: ${data.rank}\nOrganization: ${data.organization}`);
    if (data.statuses && data.statuses.length > 0) {
      renderStatusBadges(g, data.statuses, OUTER_RADIUS);
    }
  }

  async function updateTree(opts = {}) {
    const collapsePhase = opts.collapsePhase === true;
    const expandReflow = opts.expandPhase === 'reflow';
    const expandPhase = opts.expandPhase === true;
    const affectedNodeIds = opts.affectedNodeIds;
    const staggerOpts = opts.staggerOpts;

    const { allNodes: nodes, allLinks: links } = runLayout();
    const t = d3.transition().duration(TREE_ANIMATION.expandDuration).ease(treeEaseFn);
    const tCollapse = d3.transition().duration(TREE_ANIMATION.collapseDuration).ease(treeEaseFn);
    const tReflow = d3.transition().duration(TREE_ANIMATION.expandDuration).ease(d3.easeLinear);
    const { linkDelay, linkDuration, nodeDelay, nodeDuration } = createStaggerFns(staggerOpts, affectedNodeIds, expandPhase);
    const transitionPromises = [];

    linksBase.selectAll('path')
      .data(links, linkKey)
      .join(
        (enter) => {
          const paths = enter.append('path')
            .attr('fill', 'none')
            .attr('stroke', vizVars.linkColor)
            .attr('stroke-width', 3)
            .attr('stroke-opacity', 0);
          const startPos = (pos) => isMultiRoot ? { y: pos[0], x: pos[1] } : { x: pos[0], y: pos[1] };
          const expandAffected = (expandPhase || expandReflow) && affectedNodeIds?.size > 0
            ? paths.filter(d => affectedNodeIds.has(d.target._positionId))
            : null;
          const expandOther = expandAffected?.size() ? paths.filter(d => !affectedNodeIds.has(d.target._positionId)) : paths;
          if (expandReflow && expandAffected?.size()) {
            expandAffected.attr('d', d => linkGenerator({ source: d.source, target: startPos(coord.getParentPos(d.target)) }));
          } else if (expandPhase && expandAffected?.size()) {
            const linkTrans = expandAffected
              .transition().ease(treeEaseFn).delay(linkDelay).duration(linkDuration)
              .attrTween('d', d => makeExpandLinkTween(d, coord.getNodePos.bind(coord), coord.getParentPos.bind(coord), linkGenerator, TREE_ANIMATION.collapseArcStrength, affectedNodeIds, isMultiRoot))
              .attr('stroke-opacity', 1);
            transitionPromises.push(linkTrans.end().catch(() => { /* interrupted */ }));
          }
          if (expandOther.size()) {
            expandOther.attr('d', linkGenerator);
            if (!expandReflow) {
              const expandOtherTrans = expandOther.transition(t).attr('stroke-opacity', 1);
              transitionPromises.push(expandOtherTrans.end().catch(() => { /* interrupted */ }));
            } else {
              expandOther.attr('stroke-opacity', 1);
            }
          }
          return paths;
        },
        (update) => {
          if (collapsePhase) return update;
          if (expandPhase && affectedNodeIds?.size > 0) {
            const affectedUpdate = update.filter(d => affectedNodeIds.has(d.target._positionId));
            const linkTrans = affectedUpdate
              .transition().ease(treeEaseFn).delay(linkDelay).duration(linkDuration)
              .attrTween('d', d => makeExpandLinkTween(d, coord.getNodePos.bind(coord), coord.getParentPos.bind(coord), linkGenerator, TREE_ANIMATION.collapseArcStrength, affectedNodeIds, isMultiRoot))
              .attr('stroke-opacity', 1);
            transitionPromises.push(linkTrans.end().catch(() => { /* interrupted */ }));
            return update;
          }
          const reflowTrans = update.attr('stroke-opacity', 1).transition(tReflow).attr('d', linkGenerator);
          if (expandReflow && update.size()) transitionPromises.push(reflowTrans.end().catch(() => { /* interrupted */ }));
          return update;
        },
        (exit) => {
          const exitTrans = exit.transition()
            .ease(treeEaseFn)
            .delay(staggerOpts && collapsePhase ? linkDelay : 0)
            .duration(staggerOpts && collapsePhase ? linkDuration : TREE_ANIMATION.collapseDuration);
          if (collapsePhase && affectedNodeIds?.size > 0) {
            exitTrans.attrTween('d', d => makeCollapseLinkTween(d, coord.getNodePos.bind(coord), coord.getParentPos.bind(coord), linkGenerator, TREE_ANIMATION.collapseArcStrength, affectedNodeIds, isMultiRoot));
          }
          const removed = exitTrans.attr('stroke-opacity', 0).remove();
          if (exit.size()) transitionPromises.push(removed.end().catch(() => { /* interrupted */ }));
          return removed;
        }
      );

    const isLinkAffected = (link) => affectedNodeIds && (affectedNodeIds.has(link.source._positionId) || affectedNodeIds.has(link.target._positionId));

    const linksWithStatus = links.map(l => {
      const sid = getNodeId(l.source);
      const tid = getNodeId(l.target);
      const consecLink = sid != null && tid != null ? linkToValidityMap.get(`${sid}-${tid}`) : null;
      return { treeLink: l, consecLink };
    }).filter(item => item.consecLink && getLinkStatus(item.consecLink) !== 'valid');

    const statusKey = (d) => linkKey(d.treeLink);
    linkStatusIconsGroup.selectAll('g')
      .data(linksWithStatus, statusKey)
      .join(
        (enter) => {
          const g = enter.append('g')
            .attr('class', d => `viz-link-status-icon-group status-${getLinkStatus(d.consecLink)}`)
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .attr('transform', d => {
              const { tx, ty } = coord.getTargetCoords(d.treeLink.target);
              const pos = getIconPositionOnCurve(d.treeLink, linkGenerator, tx, ty, iconOffset);
              return `translate(${pos.x},${pos.y})`;
            });
          g.append('circle')
            .attr('r', 10)
            .attr('fill', vizVars.surfaceColor)
            .attr('opacity', 0.85);
          g.append('text')
            .attr('class', d => `viz-link-status-icon status-${getLinkStatus(d.consecLink)}`)
            .text(d => getStatusIcon(getLinkStatus(d.consecLink)))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', d => getStatusIconColor(getLinkStatus(d.consecLink)))
            .attr('stroke', vizVars.surfaceColor)
            .attr('stroke-width', '1px')
            .attr('paint-order', 'stroke');
          g.transition(t).style('opacity', d => ((collapsePhase || expandPhase || expandReflow) && isLinkAffected(d.treeLink)) ? 0 : 1);
          return g;
        },
        (update) => {
          if (collapsePhase || expandPhase || expandReflow) {
            if (expandReflow) {
              const statusTrans = update
                .style('opacity', d => isLinkAffected(d.treeLink) ? 0 : 1)
                .transition(tReflow)
                .attr('transform', d => {
                  const { tx, ty } = coord.getTargetCoords(d.treeLink.target);
                  const pos = getIconPositionOnCurve(d.treeLink, linkGenerator, tx, ty, iconOffset);
                  return `translate(${pos.x},${pos.y})`;
                })
                .style('opacity', d => isLinkAffected(d.treeLink) ? 0 : 1);
              if (update.size()) transitionPromises.push(statusTrans.end().catch(() => { /* interrupted */ }));
              return update;
            }
            return update.style('opacity', d => isLinkAffected(d.treeLink) ? 0 : 1);
          }
          return update.transition(tReflow).attr('transform', d => {
            const { tx, ty } = coord.getTargetCoords(d.treeLink.target);
            const pos = getIconPositionOnCurve(d.treeLink, linkGenerator, tx, ty, iconOffset);
            return `translate(${pos.x},${pos.y})`;
          }).style('opacity', 1);
        },
        (exit) => exit.transition(collapsePhase || expandPhase ? tCollapse : t).style('opacity', 0).remove()
      );

    const nodeKey = (d) => d._positionId ?? getNodeId(d) ?? (d.id != null ? `h-${d.id}` : null);
    nodesGroup.selectAll('g.viz-node')
      .data(nodes, nodeKey)
      .join(
        (enter) => {
          const g = enter.append('g')
            .attr('class', d => d.data?.isSummary ? 'viz-node viz-node-summary' : 'viz-node')
            .attr('transform', d => {
              const [x, y] = coord.getParentPos(d);
              return `translate(${x},${y})`;
            })
            .style('cursor', 'pointer')
            .on('click', async (event, d) => {
              event.stopPropagation();
                if (d.data?.isSummary) {
                const nodeId = toStableId(getNodeId(d));
                if (summaryExpandedIds.has(nodeId)) {
                  await performStagedCollapse(d);
                } else {
                  await performStagedExpand(d);
                }
                return;
              }
              const data = d.data.data;
              if (data) {
                data.filtered = false;
                handleNodeClick(event, data);
              }
            })
            .on('contextmenu', (event, d) => showContextMenu(event, d));
          g.each(function(d) { renderNodeContent(d3.select(this), d); });
          g.filter(hasCollapsibleContent).append('g')
            .attr('class', 'viz-collapse-btn')
            .attr('transform', `translate(${CHEVRON_OFFSET},-${CHEVRON_OFFSET})`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .on('click', async (event, d) => {
              event.stopPropagation();
              event.preventDefault();
              if (isCollapsed(d)) {
                await performStagedExpand(d);
              } else {
                await performStagedCollapse(d);
              }
            })
            .call(collapseBtn => {
              collapseBtn.append('rect')
                .attr('width', 24).attr('height', 24).attr('x', -12).attr('y', -12)
                .attr('fill', 'transparent');
              collapseBtn.append('path')
                .attr('d', chevronPath)
                .attr('fill', 'rgba(255,255,255,0.9)')
                .attr('stroke', vizVars.surfaceColor)
                .attr('stroke-width', 1)
                .attr('transform', getChevronTransform);
            });
          const enterAffected = g.filter(d => (expandPhase || expandReflow) && affectedNodeIds?.has(d._positionId));
          const enterOther = g.filter(d => !((expandPhase || expandReflow) && affectedNodeIds?.has(d._positionId)));
          if (expandReflow) {
            enterAffected
              .attr('transform', d => {
                const [x, y] = coord.getParentPos(d);
                return `translate(${x},${y})`;
              })
              .style('opacity', 0);
          } else if (enterAffected.size()) {
            const enterAffectedTrans = enterAffected.transition()
              .ease(treeEaseFn)
              .delay(nodeDelay)
              .duration(nodeDuration)
              .attrTween('transform', d => makePathTween(d, coord.getNodePos.bind(coord), coord.getParentPos.bind(coord), TREE_ANIMATION.collapseArcStrength, false));
            transitionPromises.push(enterAffectedTrans.end().catch(() => { /* interrupted */ }));
          }
          if (enterOther.size()) {
            if (expandReflow) {
              enterOther.attr('transform', d => `translate(${coord.getNodePos(d)[0]},${coord.getNodePos(d)[1]})`);
            } else {
              const enterOtherTrans = enterOther.transition(t).attr('transform', d => {
                const [x, y] = coord.getNodePos(d);
                return `translate(${x},${y})`;
              });
              transitionPromises.push(enterOtherTrans.end().catch(() => { /* interrupted */ }));
            }
          }
          return g;
        },
        (update) => {
          update.on('contextmenu', (event, d) => showContextMenu(event, d));
          if (collapsePhase) {
            update.select('.viz-collapse-btn path')
              .attr('transform', getChevronTransform);
          } else if (expandPhase && affectedNodeIds?.size > 0) {
            const affectedUpdate = update.filter(d => affectedNodeIds.has(d._positionId));
            const nodeTrans = affectedUpdate.transition()
              .ease(treeEaseFn)
              .delay(nodeDelay)
              .duration(nodeDuration)
              .on('start', function() { d3.select(this).style('opacity', 1); })
              .attrTween('transform', d => makePathTween(d, coord.getNodePos.bind(coord), coord.getParentPos.bind(coord), TREE_ANIMATION.collapseArcStrength, false));
            transitionPromises.push(nodeTrans.end().catch(() => { /* interrupted */ }));
            update.select('.viz-collapse-btn path').attr('transform', getChevronTransform);
          } else if (expandReflow) {
            const reflowTrans = update.transition(tReflow).attr('transform', d => `translate(${coord.getNodePos(d)[0]},${coord.getNodePos(d)[1]})`);
            if (update.size()) transitionPromises.push(reflowTrans.end().catch(() => { /* interrupted */ }));
            update.select('.viz-collapse-btn path').attr('transform', getChevronTransform);
          } else {
            update.transition(tReflow).attr('transform', d => {
              const [x, y] = coord.getNodePos(d);
              return `translate(${x},${y})`;
            });
            update.select('.viz-collapse-btn path')
              .attr('transform', getChevronTransform);
          }
          update.select('.viz-collapse-btn').on('click', async (event, d) => {
            event.stopPropagation();
            event.preventDefault();
            if (isCollapsed(d)) {
              await performStagedExpand(d);
            } else {
              await performStagedCollapse(d);
            }
          });
        },
        (exit) => {
          const exitAffected = affectedNodeIds
            ? exit.filter(d => affectedNodeIds.has(d._positionId))
            : exit;
          const exitOther = affectedNodeIds
            ? exit.filter(d => !affectedNodeIds.has(d._positionId))
            : null;
          const exitTrans = exitAffected.transition()
            .ease(treeEaseFn)
            .delay(nodeDelay)
            .duration(nodeDuration)
            .attrTween('transform', d => makePathTween(d, coord.getNodePos.bind(coord), coord.getParentPos.bind(coord), TREE_ANIMATION.collapseArcStrength, true))
            .remove();
          const exitOtherTrans = exitOther
            ? exitOther.transition(tCollapse).style('opacity', 0).remove()
            : null;
          const allExit = exitAffected.size() + (exitOther ? exitOther.size() : 0);
          if (allExit > 0) {
            transitionPromises.push(exitTrans.end().catch(() => { /* interrupted */ }));
            if (exitOtherTrans) transitionPromises.push(exitOtherTrans.end().catch(() => { /* interrupted */ }));
          }
          return exitTrans;
        }
      );
    await Promise.all(transitionPromises);
  }

  updateTree();

  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';

  const resetZoomHandler = () => svg.call(zoom.transform, initialTransform);
  for (const id of ['reset-zoom', 'center-graph']) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', resetZoomHandler);
  }

  console.timeEnd('Tree view initialization');
}
