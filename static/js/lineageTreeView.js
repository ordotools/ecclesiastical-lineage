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

function buildHierarchy(nodes, consecrationLinks, nodeMap) {
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
    const children = raw.filter(c => {
      if (seen.has(c.id)) return false;
      if (lineageRoots.length > 0 && c.is_lineage_root) return false;
      seen.add(c.id);
      return true;
    });
    return {
      data: node,
      children: children.map(child => buildNode(child)).filter(Boolean)
    };
  }

  if (roots.length === 1) {
    return { single: buildNode(roots[0]) };
  }
  return { multi: roots.map(r => buildNode(r)) };
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

  computePre1968Flags(nodes, consecrationLinks);

  const rootData = buildHierarchy(nodes, validConsecLinks, nodeMap);
  if (!rootData || (rootData.multi && rootData.multi.length === 0) || (rootData.single && !rootData.single.data)) {
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">No consecration lineage to display.</p></div>';
    return;
  }

  const isMultiRoot = !!rootData.multi;
  const treeLayout = d3.tree()
    .nodeSize([TREE_NODE_DY, TREE_NODE_DX])
    .separation(() => 1);

  let allNodes = [];
  let allLinks = [];

  if (isMultiRoot) {
    const roots = rootData.multi;
    const TREE_GAP = Math.max(80, TREE_NODE_DX * 1.5);
    let xCursor = 0;
    roots.forEach((r) => {
      const h = d3.hierarchy(r, d => d.children);
      treeLayout(h);
      const yExtent = d3.extent(h.descendants(), d => d.y);
      const treeWidth = (yExtent[1] - yExtent[0]) || TREE_NODE_DX;
      const xOffset = xCursor;
      xCursor += treeWidth + TREE_GAP;
      h.each(d => { d.y += xOffset; });
      allNodes = allNodes.concat(h.descendants());
      allLinks = allLinks.concat(h.links());
    });
  } else {
    const root = d3.hierarchy(rootData.single, d => d.children);
    treeLayout(root);
    allNodes = root.descendants();
    allLinks = root.links();
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const cssLabelDy = parseFloat(rootStyles.getPropertyValue('--viz-label-dy')) || LABEL_DY;
  const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
  const cssNodeOuterRadius = parseFloat(rootStyles.getPropertyValue('--viz-node-outer-radius')) || OUTER_RADIUS;
  const cssNodeStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-node-stroke-width')) || 1;

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

  const nodeData = allNodes;

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

  const links = allLinks;

  container.append('g')
    .attr('class', 'viz-links-base')
    .selectAll('path')
    .data(links)
    .enter().append('path')
    .attr('d', linkGenerator)
    .attr('fill', 'none')
    .attr('stroke', cssLinkConsecrationColor)
    .attr('stroke-width', 3)
    .attr('marker-end', 'url(#arrowhead-tree)');

  const nodeGroups = container.append('g')
    .attr('class', 'viz-nodes')
    .selectAll('g')
    .data(nodeData)
    .enter().append('g')
    .attr('class', 'viz-node')
    .attr('transform', d => `translate(${isMultiRoot ? d.y : d.x},${isMultiRoot ? d.x : d.y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      const data = d.data.data;
      if (data) {
        data.filtered = false;
        handleNodeClick(event, data);
      }
    });

  nodeGroups.each(function(d) {
    const data = d.data.data;
    const g = d3.select(this);

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
  });

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
