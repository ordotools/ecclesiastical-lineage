// D3 tree visualization for ecclesiastical lineage (consecration-only)
import {
  OUTER_RADIUS,
  INNER_RADIUS,
  IMAGE_SIZE,
  LABEL_DY,
  GREEN_COLOR,
  TREE_NODE_DX,
  TREE_NODE_DY,
  width,
  height
} from './constants.js';
import { handleNodeClick } from './modals.js';
import { renderStatusBadges } from './statusBadges.js';

const PRE_1968_CONSECRATION_YEAR = 1968;

function isBishopRank(rankValue) {
  if (!rankValue) return false;
  const lowerRank = rankValue.toLowerCase();
  return lowerRank.includes('bishop') ||
    lowerRank.includes('pope') ||
    lowerRank.includes('archbishop') ||
    lowerRank.includes('cardinal') ||
    lowerRank.includes('patriarch');
}

function parseYearFromDate(dateValue) {
  if (!dateValue) return null;
  const year = parseInt(String(dateValue).slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function yearToDecade(year) {
  if (year == null || !Number.isFinite(year)) return null;
  const mod = year % 10;
  return mod < 5 ? Math.floor(year / 10) * 10 : Math.ceil(year / 10) * 10;
}

function useSquareNode(d) {
  return d.is_pre_1968_consecration || !!d.is_lineage_root;
}

function computePre1968Flags(nodes, consecrationLinks) {
  const pre1968ConsecrationTargets = new Set();
  const pre1968SponsorBishops = new Set();

  consecrationLinks.forEach(link => {
    const year = parseYearFromDate(link.date);
    if (year === null || year >= PRE_1968_CONSECRATION_YEAR) return;

    const targetId = typeof link.target === 'object' && link.target ? link.target.id : link.target;
    const sourceId = typeof link.source === 'object' && link.source ? link.source.id : link.source;
    if (targetId != null) pre1968ConsecrationTargets.add(targetId);
    if (sourceId != null) pre1968SponsorBishops.add(sourceId);
  });

  const shouldMarkPre1968Consecrator = (node, consecratorIds) => {
    if (!node || !consecratorIds || !consecratorIds.has(node.id)) return false;
    if (node.consecration_date) return false;
    if (node.rank && !isBishopRank(node.rank)) return false;
    return true;
  };

  nodes.forEach(node => {
    const consecrationYear = parseYearFromDate(node.consecration_date);
    node.is_pre_1968_consecration = consecrationYear !== null
      ? consecrationYear < PRE_1968_CONSECRATION_YEAR
      : pre1968ConsecrationTargets.has(node.id) || shouldMarkPre1968Consecrator(node, pre1968SponsorBishops);
  });
}

function getLinkStatus(d) {
  if (d.is_invalid) return 'invalid';
  if (d.is_doubtfully_valid || d.is_doubtful) return 'doubtfully_valid';
  if (d.is_doubtful_event) return 'doubtful_event';
  if (d.is_sub_conditione) return 'sub_conditione';
  return 'valid';
}

function getStatusIcon(status) {
  switch (status) {
    case 'invalid': return '✕';
    case 'doubtfully_valid': return '?';
    case 'doubtful_event': return '~';
    case 'sub_conditione': return 'SC';
    default: return null;
  }
}

function getStatusIconColor(status) {
  switch (status) {
    case 'invalid': return '#e74c3c';
    case 'doubtfully_valid': return '#f39c12';
    case 'doubtful_event': return '#e67e22';
    case 'sub_conditione': return '#3498db';
    default: return '#ffffff';
  }
}

const STATUS_PRIORITY = { invalid: 4, doubtfully_valid: 3, doubtful_event: 2, sub_conditione: 1, valid: 0 };

const TREE_TRANSITION_DURATION = 350;

function buildLinkToValidityMap(validConsecLinks) {
  const map = new Map();
  validConsecLinks.forEach(link => {
    const sid = typeof link.source === 'object' ? link.source?.id : link.source;
    const tid = typeof link.target === 'object' ? link.target?.id : link.target;
    if (sid == null || tid == null) return;
    const key = `${sid}-${tid}`;
    const status = getLinkStatus(link);
    const prev = map.get(key);
    if (!prev || STATUS_PRIORITY[status] > STATUS_PRIORITY[getLinkStatus(prev)]) {
      map.set(key, link);
    }
  });
  return map;
}

function decadeSteps(decadeDiff) {
  return Math.ceil(decadeDiff / 10);
}

function buildHierarchy(nodes, consecrationLinks, nodeMap, linkDateByEdge) {
  const targetsBySource = new Map();
  const hasIncoming = new Set();

  consecrationLinks.forEach(link => {
    const sid = typeof link.source === 'object' ? link.source?.id : link.source;
    const tid = typeof link.target === 'object' ? link.target?.id : link.target;
    const sourceNode = nodeMap.get(sid);
    const targetNode = nodeMap.get(tid);
    if (!sourceNode || !targetNode) return;

    hasIncoming.add(tid);
    if (!targetsBySource.has(sid)) targetsBySource.set(sid, []);
    targetsBySource.get(sid).push(targetNode);
  });

  const lineageRoots = nodes.filter(n => n.is_lineage_root);
  const roots = lineageRoots.length > 0
    ? lineageRoots
    : nodes.filter(n => !hasIncoming.has(n.id));

  if (roots.length === 0) return null;

  function buildNode(node) {
    const raw = targetsBySource.get(node.id) || [];
    const seen = new Set();
    const filtered = raw.filter(c => {
      if (seen.has(c.id)) return false;
      if (lineageRoots.length > 0 && c.is_lineage_root) return false;
      seen.add(c.id);
      return true;
    });
    const children = filtered
      .sort((a, b) => {
        const yA = parseYearFromDate(linkDateByEdge?.get(`${node.id}-${a.id}`));
        const yB = parseYearFromDate(linkDateByEdge?.get(`${node.id}-${b.id}`));
        return (yA ?? 9999) - (yB ?? 9999);
      })
      .map(child => buildNode(child))
      .filter(Boolean);
    return {
      data: node,
      children
    };
  }

  if (roots.length === 1) {
    return { single: buildNode(roots[0]) };
  }
  return { multi: roots.map(r => buildNode(r)) };
}

function applyDefaultSummaries(hierarchy, linkDateByEdge) {
  function processNode(node, parentId) {
    if (!node || !node.children?.length) return node;
    const children = node.children;
    if (children.length <= 5) {
      return {
        data: node.data,
        children: children.map(c => processNode(c, node.data?.id))
      };
    }
    const leaves = children.filter(c => !c.children?.length);
    const parents = children.filter(c => c.children?.length > 0);
    if (leaves.length === 0) {
      return {
        data: node.data,
        children: children.map(c => processNode(c, node.data?.id))
      };
    }
    const oldestLeaf = leaves[0];
    const pid = node.data?.id ?? parentId;
    const linkDate = pid != null && oldestLeaf?.data?.id != null
      ? linkDateByEdge?.get(`${pid}-${oldestLeaf.data.id}`)
      : null;
    const leafDate = linkDate || oldestLeaf?.data?.consecration_date;
    const decade = yearToDecade(parseYearFromDate(leafDate));
    const summaryId = `summary-${node.data?.id}`;
    const summaryNode = {
      data: {
        isSummary: true,
        id: summaryId,
        leafIds: leaves.map(l => l.data?.id).filter(Boolean),
        leafNodes: leaves,
        decade: decade ?? 0,
        count: leaves.length
      },
      children: []
    };
    const newChildren = [summaryNode, ...parents].sort((a, b) => {
      const aDecade = a.data?.isSummary ? a.data.decade : yearToDecade(parseYearFromDate(
        pid != null && a.data?.id ? linkDateByEdge?.get(`${pid}-${a.data.id}`) : a.data?.consecration_date
      ));
      const bDecade = b.data?.isSummary ? b.data.decade : yearToDecade(parseYearFromDate(
        pid != null && b.data?.id ? linkDateByEdge?.get(`${pid}-${b.data.id}`) : b.data?.consecration_date
      ));
      return (aDecade ?? 9999) - (bDecade ?? 9999);
    });
    return {
      data: node.data,
      children: newChildren.map(c => c.data?.isSummary ? c : processNode(c, node.data?.id))
    };
  }

  if (!hierarchy) return hierarchy;
  if (hierarchy.single) {
    return { single: processNode(hierarchy.single, null) };
  }
  if (hierarchy.multi) {
    return { multi: hierarchy.multi.map(r => processNode(r, null)) };
  }
  return hierarchy;
}

function getDisplayChildren(collapsedNodeIds, summaryExpandedIds) {
  return (d) => {
    const nodeId = (d.data?.data ?? d.data)?.id ?? d.data?.id;
    if (nodeId && collapsedNodeIds.has(nodeId)) return null;
    if (d.data?.isSummary && summaryExpandedIds.has(nodeId)) {
      return d.data.leafNodes ?? null;
    }
    return d.children;
  };
}

function createDisplayHierarchy(rootData, collapsedNodeIds, summaryExpandedIds) {
  const childrenAccessor = getDisplayChildren(collapsedNodeIds, summaryExpandedIds);
  if (rootData.single) {
    return { single: d3.hierarchy(rootData.single, childrenAccessor) };
  }
  return {
    multi: rootData.multi.map(r => d3.hierarchy(r, childrenAccessor))
  };
}

function getNodeIdFromHierarchy(d) {
  return (d.data?.data ?? d.data)?.id;
}

function applyTimelinePositions(allNodes, allLinks, linkDateByEdge, isMultiRoot) {
  const depthKey = isMultiRoot ? 'y' : 'x';
  const nodeToDepth = new Map();
  const nodeToDecade = new Map();

  allNodes.forEach(d => {
    const nid = getNodeIdFromHierarchy(d);
    if (d.depth === 0) {
      nodeToDepth.set(d, 0);
      const rootData = d.data?.data ?? d.data;
      const rootDecade = d.data?.isSummary ? d.data.decade : yearToDecade(parseYearFromDate(rootData?.consecration_date));
      nodeToDecade.set(d, rootDecade);
      return;
    }
    const parent = d.parent;
    const pid = getNodeIdFromHierarchy(parent);
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

  const collapsedNodeIds = new Set();
  const summaryExpandedIds = new Set();
  const isMultiRoot = !!rootHierarchy.multi;
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
    const displayData = createDisplayHierarchy(hierarchyForDisplay, collapsedNodeIds, summaryExpandedIds);
    let allNodes = [];
    let allLinks = [];

    if (isMultiRoot) {
      const TREE_GAP = Math.max(80, TREE_NODE_DX * 1.5);
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

    applyTimelinePositions(allNodes, allLinks, linkDateByEdge, isMultiRoot);

    if (isMultiRoot) {
      const TREE_GAP = Math.max(80, TREE_NODE_DX * 1.5);
      const depthKey = 'y';
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
    return { allNodes, allLinks };
  }

  let { allNodes, allLinks } = runLayout();

  const rootStyles = getComputedStyle(document.documentElement);
  const cssLabelDy = parseFloat(rootStyles.getPropertyValue('--viz-label-dy')) || LABEL_DY;
  const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
  const cssNodeOuterRadius = parseFloat(rootStyles.getPropertyValue('--viz-node-outer-radius')) || OUTER_RADIUS;
  const cssNodeStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-node-stroke-width')) || 1;
  const cssSurfaceColor = rootStyles.getPropertyValue('--viz-surface').trim() || '#1a1a1a';

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

  const xExt = d3.extent(allNodes, d => isMultiRoot ? d.y : d.x);
  const yExt = d3.extent(allNodes, d => isMultiRoot ? d.x : d.y);
  const midX = (xExt[0] + xExt[1]) / 2;
  const midY = (yExt[0] + yExt[1]) / 2;
  const scale = 0.8;
  const initialTransform = isMultiRoot
    ? d3.zoomIdentity.translate(width / 2 - midY * scale, height / 2 - midX * scale).scale(scale)
    : d3.zoomIdentity.translate(width / 2 - midX * scale, 40 - midY * scale).scale(scale);
  svg.call(zoom.transform, initialTransform);
  const defs = container.append('defs');

  const arrowStyles = {
    triangle: { path: 'M0,-5L10,0L0,5Z', viewBox: '0 -5 10 10', stroke: false }
  };
  const ac = arrowStyles.triangle;

  defs.selectAll('marker')
    .data(['arrowhead-tree'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', ac.viewBox)
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', ac.path)
    .attr('fill', cssLinkConsecrationColor);

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

  const getNodeId = (d) => (d.data?.data ?? d.data)?.id ?? d.data?.id;
  const linkKey = (l) => `${getNodeId(l.source)}-${getNodeId(l.target)}`;
  const iconOffset = cssNodeOuterRadius + (cssNodeStrokeWidth / 2) + 30;

  function hasCollapsibleContent(d) {
    return (d.data?.children?.length > 0) || !!d.data?.isSummary;
  }

  function isCollapsed(d) {
    const nodeId = getNodeId(d);
    if (d.data?.isSummary) return !summaryExpandedIds.has(nodeId);
    return collapsedNodeIds.has(nodeId);
  }

  const CHEVRON_OFFSET = cssNodeOuterRadius + 12;
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
      const item = document.createElement('div');
      item.className = 'viz-context-menu-item';
      item.textContent = expandLabel;
      item.setAttribute('role', 'menuitem');
      item.addEventListener('click', () => {
        if (isSummary) summaryExpandedIds.add(nodeId);
        else collapsedNodeIds.delete(nodeId);
        hideContextMenu();
        updateTree();
      });
      contextMenuEl.appendChild(item);
    } else {
      const item = document.createElement('div');
      item.className = 'viz-context-menu-item';
      item.textContent = collapseLabel;
      item.setAttribute('role', 'menuitem');
      item.addEventListener('click', () => {
        if (isSummary) summaryExpandedIds.delete(nodeId);
        else collapsedNodeIds.add(nodeId);
        hideContextMenu();
        updateTree();
      });
      contextMenuEl.appendChild(item);
    }
    contextMenuEl.style.left = `${event.clientX}px`;
    contextMenuEl.style.top = `${event.clientY}px`;
    contextMenuEl.classList.add('visible');
    document.addEventListener('click', hideContextMenuOnOutsideClick);
    document.addEventListener('contextmenu', hideContextMenuOnOutsideClick);
  }

  const SUMMARY_NODE_WIDTH = 80;
  const SUMMARY_NODE_HEIGHT = 32;

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
      .attr('dy', cssLabelDy)
      .attr('y', 2)
      .text(label);
    g.append('title').text(`Click or use chevron to expand and show ${count} individual consecration${count !== 1 ? 's' : ''}`);
  }

  function renderNodeContent(g, d) {
    if (d.data?.isSummary) {
      renderSummaryNodeContent(g, d);
      return;
    }
    const data = d.data.data;
    if (!data) return;
    g.selectAll('*').remove();
    g.append('circle')
      .attr('class', 'viz-node-outer viz-node-outer-circle')
      .attr('r', cssNodeOuterRadius)
      .attr('fill', data.org_color)
      .attr('stroke', data.rank_color)
      .attr('stroke-width', cssNodeStrokeWidth)
      .style('display', useSquareNode(data) ? 'none' : null);
    g.append('rect')
      .attr('class', 'viz-node-outer viz-node-outer-rect')
      .attr('width', cssNodeOuterRadius * 2)
      .attr('height', cssNodeOuterRadius * 2)
      .attr('x', -cssNodeOuterRadius)
      .attr('y', -cssNodeOuterRadius)
      .attr('fill', data.org_color)
      .attr('stroke', data.rank_color)
      .attr('stroke-width', cssNodeStrokeWidth)
      .style('display', useSquareNode(data) ? null : 'none');
    g.append('circle')
      .attr('class', 'viz-node-inner viz-node-inner-circle')
      .attr('r', INNER_RADIUS)
      .attr('fill', data.rank_color)
      .style('display', useSquareNode(data) ? 'none' : null);
    g.append('rect')
      .attr('class', 'viz-node-inner viz-node-inner-rect')
      .attr('width', INNER_RADIUS * 2)
      .attr('height', INNER_RADIUS * 2)
      .attr('x', -INNER_RADIUS)
      .attr('y', -INNER_RADIUS)
      .attr('fill', data.rank_color)
      .style('display', useSquareNode(data) ? null : 'none');
    g.append('circle')
      .attr('class', 'viz-node-image-bg viz-node-image-bg-circle')
      .attr('r', IMAGE_SIZE / 2)
      .attr('fill', 'rgba(255,255,255,1)')
      .style('opacity', data.image_url ? 1 : 0)
      .style('display', useSquareNode(data) ? 'none' : null);
    g.append('rect')
      .attr('class', 'viz-node-image-bg viz-node-image-bg-rect')
      .attr('width', IMAGE_SIZE)
      .attr('height', IMAGE_SIZE)
      .attr('x', -IMAGE_SIZE / 2)
      .attr('y', -IMAGE_SIZE / 2)
      .attr('fill', 'rgba(255,255,255,1)')
      .style('opacity', data.image_url ? 1 : 0)
      .style('display', useSquareNode(data) ? null : 'none');
    if (spriteSheetData?.success && spriteSheetData.mapping) {
      const pos = spriteSheetData.mapping[data.id] ?? spriteSheetData.mapping[String(data.id)];
      if (pos && Array.isArray(pos) && pos.length === 2) {
        g.append('image')
          .attr('xlink:href', spriteSheetData.url)
          .attr('x', -pos[0] - IMAGE_SIZE / 2)
          .attr('y', -pos[1] - IMAGE_SIZE / 2)
          .attr('width', spriteSheetData.sprite_width || spriteSheetData.sprite_height || 48)
          .attr('height', spriteSheetData.sprite_height || spriteSheetData.sprite_width || 48)
          .attr('clip-path', `url(#clip-avatar-tree-${data.id})`)
          .attr('preserveAspectRatio', 'none')
          .style('pointer-events', 'none');
      } else {
        g.append('image')
          .attr('xlink:href', data.image_url || '')
          .attr('x', -IMAGE_SIZE / 2)
          .attr('y', -IMAGE_SIZE / 2)
          .attr('width', IMAGE_SIZE)
          .attr('height', IMAGE_SIZE)
          .attr('clip-path', useSquareNode(data) ? 'none' : `circle(${IMAGE_SIZE / 2}px at ${IMAGE_SIZE / 2}px ${IMAGE_SIZE / 2}px)`)
          .style('pointer-events', 'none')
          .style('opacity', data.image_url ? 1 : 0)
          .on('error', function() { d3.select(this).style('opacity', 0); });
      }
    } else {
      g.append('image')
        .attr('xlink:href', data.image_url || '')
        .attr('x', -IMAGE_SIZE / 2)
        .attr('y', -IMAGE_SIZE / 2)
        .attr('width', IMAGE_SIZE)
        .attr('height', IMAGE_SIZE)
        .attr('clip-path', useSquareNode(data) ? 'none' : `circle(${IMAGE_SIZE / 2}px at ${IMAGE_SIZE / 2}px ${IMAGE_SIZE / 2}px)`)
        .style('pointer-events', 'none')
        .style('opacity', data.image_url ? 1 : 0)
        .on('error', function() { d3.select(this).style('opacity', 0); });
    }
    g.append('text')
      .attr('class', 'viz-node-label')
      .attr('dy', cssLabelDy)
      .text(data.name);
    g.append('title')
      .text(`${data.name}\nRank: ${data.rank}\nOrganization: ${data.organization}`);
    if (data.statuses && data.statuses.length > 0) {
      renderStatusBadges(g, data.statuses, OUTER_RADIUS);
    }
  }

  function getNodePos(d) {
    return isMultiRoot ? [d.y, d.x] : [d.x, d.y];
  }

  function getParentPos(d) {
    const p = d.parent;
    if (!p) return getNodePos(d);
    return isMultiRoot ? [p.y, p.x] : [p.x, p.y];
  }

  function updateTree() {
    const { allNodes: nodes, allLinks: links } = runLayout();
    const t = d3.transition().duration(TREE_TRANSITION_DURATION).ease(d3.easeCubicOut);

    linksBase.selectAll('path')
      .data(links, linkKey)
      .join(
        (enter) => enter.append('path')
          .attr('d', linkGenerator)
          .attr('fill', 'none')
          .attr('stroke', cssLinkConsecrationColor)
          .attr('stroke-width', 3)
          .attr('marker-end', 'url(#arrowhead-tree)')
          .attr('stroke-opacity', 0)
          .transition(t)
          .attr('stroke-opacity', 1),
        (update) => update.transition(t).attr('d', linkGenerator),
        (exit) => exit.transition(t).attr('stroke-opacity', 0).remove()
      );

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
              const tgt = d.treeLink.target;
              const tx = isMultiRoot ? tgt.y : tgt.x;
              const ty = isMultiRoot ? tgt.x : tgt.y;
              const pos = getIconPositionOnCurve(d.treeLink, linkGenerator, tx, ty, iconOffset);
              return `translate(${pos.x},${pos.y})`;
            });
          g.append('circle')
            .attr('r', 10)
            .attr('fill', cssSurfaceColor)
            .attr('opacity', 0.85);
          g.append('text')
            .attr('class', d => `viz-link-status-icon status-${getLinkStatus(d.consecLink)}`)
            .text(d => getStatusIcon(getLinkStatus(d.consecLink)))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', d => getStatusIconColor(getLinkStatus(d.consecLink)))
            .attr('stroke', cssSurfaceColor)
            .attr('stroke-width', '1px')
            .attr('paint-order', 'stroke');
          g.transition(t).style('opacity', 1);
          return g;
        },
        (update) => update.transition(t).attr('transform', d => {
          const tgt = d.treeLink.target;
          const tx = isMultiRoot ? tgt.y : tgt.x;
          const ty = isMultiRoot ? tgt.x : tgt.y;
          const pos = getIconPositionOnCurve(d.treeLink, linkGenerator, tx, ty, iconOffset);
          return `translate(${pos.x},${pos.y})`;
        }),
        (exit) => exit.transition(t).style('opacity', 0).remove()
      );

    const nodeKey = (d) => getNodeId(d) ?? (d.id != null ? `h-${d.id}` : null);
    nodesGroup.selectAll('g.viz-node')
      .data(nodes, nodeKey)
      .join(
        (enter) => {
          const g = enter.append('g')
            .attr('class', d => d.data?.isSummary ? 'viz-node viz-node-summary' : 'viz-node')
            .attr('transform', d => {
              const [x, y] = getParentPos(d);
              return `translate(${x},${y})`;
            })
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
              event.stopPropagation();
              if (d.data?.isSummary) {
                const nodeId = getNodeId(d);
                summaryExpandedIds.has(nodeId) ? summaryExpandedIds.delete(nodeId) : summaryExpandedIds.add(nodeId);
                updateTree();
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
            .on('click', (event, d) => {
              event.stopPropagation();
              const nodeId = getNodeId(d);
              if (d.data?.isSummary) {
                summaryExpandedIds.has(nodeId) ? summaryExpandedIds.delete(nodeId) : summaryExpandedIds.add(nodeId);
              } else {
                collapsedNodeIds.has(nodeId) ? collapsedNodeIds.delete(nodeId) : collapsedNodeIds.add(nodeId);
              }
              updateTree();
            })
            .append('path')
            .attr('d', chevronPath)
            .attr('fill', 'rgba(255,255,255,0.9)')
            .attr('stroke', cssSurfaceColor)
            .attr('stroke-width', 1)
            .attr('transform', d => isCollapsed(d) ? 'rotate(-90) translate(-2.5,3)' : 'translate(-3,-2.5)');
          g.transition(t).attr('transform', d => {
            const [x, y] = getNodePos(d);
            return `translate(${x},${y})`;
          });
          return g;
        },
        (update) => {
          update.transition(t).attr('transform', d => {
            const [x, y] = getNodePos(d);
            return `translate(${x},${y})`;
          });
          update.select('.viz-collapse-btn path')
            .attr('transform', d => isCollapsed(d) ? 'rotate(-90) translate(-2.5,3)' : 'translate(-3,-2.5)');
        },
        (exit) => exit.transition(t).attr('transform', d => {
          const [x, y] = getParentPos(d);
          return `translate(${x},${y})`;
        }).remove()
      );
  }

  updateTree();

  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';

  const resetZoomBtn = document.getElementById('reset-zoom');
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener('click', () => {
      svg.call(zoom.transform, initialTransform);
    });
  }

  const centerGraphBtn = document.getElementById('center-graph');
  if (centerGraphBtn) {
    centerGraphBtn.addEventListener('click', () => {
      svg.call(zoom.transform, initialTransform);
    });
  }

  console.timeEnd('Tree view initialization');
}
