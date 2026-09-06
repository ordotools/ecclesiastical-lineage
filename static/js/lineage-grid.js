/**
 * Grid lineage page: HTML cards on a fixed grid with SVG overlay edges.
 */
import {
  GREEN_COLOR,
  RED_COLOR,
  ORANGE_COLOR,
} from './constants.js';
import {
  GRID_METRICS,
  positionX,
  positionY,
  inflatedCardRect,
  rightCenter,
  routeAllEdges,
  pathKeyForLink,
} from './lineage-grid-router.js?v=9';
import { computeLineageGridLayout } from './lineage-grid-layout.js?v=9';

/** Visible on dark grid background (BLACK_COLOR #0d0d0d is invisible). */
const ORDINATION_STROKE = '#c8d4dc';
const BUS_T_CAP_HALF = 10;
const MIN_FIT_SCALE = 0.08;

function activeMetricsFromLayout(layout) {
  return { ...GRID_METRICS, ...layout?.grid_metrics };
}

function linkEndpoints(link) {
  const source = typeof link.source === 'object' ? link.source?.id : link.source;
  const target = typeof link.target === 'object' ? link.target?.id : link.target;
  return { source, target };
}

function buildPrimaryEdgeSet(primaryEdges) {
  const set = new Set();
  (primaryEdges || []).forEach((edge) => {
    set.add(`${edge.source}->${edge.target}`);
  });
  return set;
}

function edgeStyle(link) {
  let stroke = link.type === 'ordination'
    ? ORDINATION_STROKE
    : (link.color || GREEN_COLOR);
  let strokeWidth = link.type === 'ordination' ? 1.75 : 2.25;
  let strokeDasharray = '';
  let opacity = 1;

  if (link.is_invalid) {
    stroke = RED_COLOR;
  } else if (link.is_doubtfully_valid) {
    stroke = ORANGE_COLOR;
  }

  if (link.type === 'co-consecration' || link.dashed) {
    strokeDasharray = '7 5';
  }
  if (link.is_doubtful_event) {
    strokeDasharray = strokeDasharray || '4 4';
    opacity = 0.65;
  }
  if (link.is_inherited) {
    opacity = Math.min(opacity, 0.55);
  }
  if (link.is_sub_conditione && link.type !== 'ordination') {
    strokeWidth = 3;
  }

  return { stroke, strokeWidth, strokeDasharray, opacity };
}

function cardRect(position, metrics) {
  return inflatedCardRect(position, metrics);
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

function renderCards(stage, nodes, positions, metrics, spriteSheetData) {
  const cardsLayer = document.createElement('div');
  cardsLayer.className = 'lineage-grid-cards';
  stage.appendChild(cardsLayer);

  nodes.forEach((node) => {
    const pos = positions[node.id];
    if (!pos) return;

    const card = document.createElement('article');
    card.className = 'lineage-grid-card';
    card.dataset.clergyId = String(node.id);
    card.style.left = `${positionX(pos, metrics)}px`;
    card.style.top = `${positionY(pos, metrics)}px`;
    card.style.setProperty('--org-color', node.org_color || '#2c3e50');

    card.innerHTML = `
      <div class="lineage-grid-card__row">
        <div class="lineage-grid-card__photo" aria-hidden="true"></div>
        <div class="lineage-grid-card__meta-stack">
          <p class="lineage-grid-card__rank">${node.rank || ''}</p>
          <p class="lineage-grid-card__org">${node.organization || ''}</p>
        </div>
      </div>
      <h2 class="lineage-grid-card__name">${node.name || ''}</h2>
    `;
    applySpritePhoto(card.querySelector('.lineage-grid-card__photo'), node.id, spriteSheetData);

    cardsLayer.appendChild(card);
  });
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
  const routedPaths = routeAllEdges(displayLinks, positions, layout, linkEndpoints, metrics);

  displayLinks.forEach((link) => {
    const { source, target } = linkEndpoints(link);
    const sourcePos = positions[source];
    const targetPos = positions[target];
    if (!sourcePos || !targetPos) return;

    const edgeKey = `${source}->${target}`;
    const isPrimary = primaryEdgeSet.has(edgeKey);
    const style = edgeStyle(link);
    const pathKey = pathKeyForLink(source, target, link, displayLinks, linkEndpoints);
    const pathData = routedPaths.get(pathKey) || routedPaths.get(edgeKey);
    if (!pathData) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', style.stroke);
    path.setAttribute('stroke-width', String(style.strokeWidth));
    path.setAttribute('opacity', String(style.opacity));
    if (style.strokeDasharray) {
      path.setAttribute('stroke-dasharray', style.strokeDasharray);
    }
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
    if (isPrimary) path.classList.add('lineage-grid-edge--primary');
    if (link.is_sub_conditione) path.classList.add('lineage-grid-edge--sub-conditione');

    edgesGroup.appendChild(path);

    const label = validityLabel(link);
    if (label && link.type !== 'ordination') {
      const sourceRect = cardRect(sourcePos, metrics);
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
    const trunkKey = `bus-trunk:${bus.source}`;
    let pathData = routedPaths.get(trunkKey);
    if (!pathData) {
      const hubPos = positions[bus.source];
      if (!hubPos || bus.timeline_y == null) return;
      const hubRect = inflatedCardRect(hubPos, metrics);
      const start = rightCenter(hubRect);
      const timelineY = Number(bus.timeline_y);
      const timelineEndX = bus.timeline_end_x != null
        ? Number(bus.timeline_end_x)
        : start.x + 100;
      const exitX = start.x + 8;
      pathData = `M ${start.x} ${start.y} L ${exitX} ${start.y} L ${exitX} ${timelineY} L ${timelineEndX} ${timelineY}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.classList.add('lineage-grid-edge');
    path.classList.add('lineage-grid-edge--bus-trunk');
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
  return {
    width: maxX + metrics.PAD,
    height: maxY + metrics.PAD,
  };
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

export async function initializeLineageGrid() {
  const viewport = document.getElementById('lineage-grid-viewport');
  const stage = document.getElementById('lineage-grid-stage');
  if (!viewport || !stage) return;

  const nodes = window.nodesData || [];
  const links = window.linksData || [];
  const showPriests = window.showPriests === true || window.showPriests === 'true';
  const layout = computeLineageGridLayout(nodes, links, { showPriests });
  const positions = layout.positions || {};
  const activeMetrics = activeMetricsFromLayout(layout);
  const spriteSheetData = await loadSpriteSheetData();

  const root = document.querySelector('.lineage-grid-page');
  if (root) {
    root.style.setProperty('--grid-card-w', `${activeMetrics.CARD_W}px`);
    root.style.setProperty('--grid-card-h', `${activeMetrics.CARD_H}px`);
  }

  if (!nodes.length) {
    viewport.innerHTML = '<p class="lineage-grid-empty">No clergy data available.</p>';
    return;
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
  renderCards(stage, visibleNodes, positions, activeMetrics, spriteSheetData);
  initPanZoom(viewport, stage, size);

  const priestToggle = document.getElementById('lineage-grid-show-priests');
  if (priestToggle) {
    priestToggle.addEventListener('change', () => {
      const url = new URL(window.location.href);
      if (priestToggle.checked) {
        url.searchParams.set('show_priests', '1');
      } else {
        url.searchParams.delete('show_priests');
      }
      window.location.href = url.toString();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLineageGrid);
} else {
  initializeLineageGrid();
}
