/**
 * Grid lineage page: HTML cards on a fixed grid with SVG overlay edges.
 */
import {
  GREEN_COLOR,
  BLACK_COLOR,
  RED_COLOR,
  ORANGE_COLOR,
} from './constants.js';

const CARD_W = 168;
const CARD_H = 108;
const GAP_X = 52;
const GAP_Y = 64;
const PAD = 48;

function cellX(col) {
  return PAD + col * (CARD_W + GAP_X);
}

function cellY(row) {
  return PAD + row * (CARD_H + GAP_Y);
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
  let stroke = link.color || (link.type === 'ordination' ? BLACK_COLOR : GREEN_COLOR);
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

function cardRect(position) {
  return {
    x: cellX(position.col),
    y: cellY(position.row),
    w: CARD_W,
    h: CARD_H,
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

function orthogonalDownPath(sourceRect, targetRect) {
  const start = bottomCenter(sourceRect);
  const end = topCenter(targetRect);
  const midY = start.y + Math.max(24, (end.y - start.y) / 2);
  return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
}

function orthogonalSidePath(sourceRect, targetRect) {
  const start = rightCenter(sourceRect);
  const end = leftCenter(targetRect);
  const midX = start.x + Math.max(20, (end.x - start.x) / 2);
  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
}

function routePath(link, sourceRect, targetRect, isPrimary) {
  if (link.type === 'ordination' || link.type === 'co-consecration') {
    return orthogonalSidePath(sourceRect, targetRect);
  }
  return orthogonalDownPath(sourceRect, targetRect);
}

function validityLabel(link) {
  if (link.is_invalid) return 'invalid';
  if (link.is_doubtfully_valid) return 'doubtful';
  if (link.is_sub_conditione) return 'sub cond.';
  if (link.is_doubtful_event) return 'doubtful event';
  return '';
}

function renderCards(stage, nodes, positions) {
  const cardsLayer = document.createElement('div');
  cardsLayer.className = 'lineage-grid-cards';
  stage.appendChild(cardsLayer);

  nodes.forEach((node) => {
    const pos = positions[node.id];
    if (!pos) return;

    const card = document.createElement('article');
    card.className = 'lineage-grid-card';
    card.dataset.clergyId = String(node.id);
    card.style.left = `${cellX(pos.col)}px`;
    card.style.top = `${cellY(pos.row)}px`;
    card.style.setProperty('--org-color', node.org_color || '#2c3e50');

    const tag = (node.tags || []).find((t) => t.is_system)?.label || '';
    const validityClass = tag ? `lineage-grid-card--${tag.replace(/\s+/g, '-')}` : '';

    card.innerHTML = `
      <div class="lineage-grid-card__photo-wrap">
        <img class="lineage-grid-card__photo" src="${node.image_url || ''}" alt="" loading="lazy">
      </div>
      <div class="lineage-grid-card__body">
        <h2 class="lineage-grid-card__name">${node.name || ''}</h2>
        <p class="lineage-grid-card__meta">${node.rank || ''}${node.organization ? ` · ${node.organization}` : ''}</p>
        ${node.consecration_date ? `<p class="lineage-grid-card__date">${node.consecration_date}</p>` : ''}
        ${tag ? `<span class="lineage-grid-card__tag ${validityClass}">${tag}</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `/?clergy_id=${encodeURIComponent(node.id)}`;
    });

    cardsLayer.appendChild(card);
  });
}

function renderEdges(svg, links, positions, primaryEdgeSet) {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  ['grid-arrow-green', 'grid-arrow-black', 'grid-arrow-red', 'grid-arrow-orange'].forEach((id) => {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '4');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
    path.setAttribute('fill', id.includes('black') ? BLACK_COLOR : id.includes('red') ? RED_COLOR : id.includes('orange') ? ORANGE_COLOR : GREEN_COLOR);
    marker.appendChild(path);
    defs.appendChild(marker);
  });
  svg.appendChild(defs);

  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edgesGroup.setAttribute('class', 'lineage-grid-edges');
  svg.appendChild(edgesGroup);

  links.forEach((link) => {
    const { source, target } = linkEndpoints(link);
    const sourcePos = positions[source];
    const targetPos = positions[target];
    if (!sourcePos || !targetPos) return;

    const sourceRect = cardRect(sourcePos);
    const targetRect = cardRect(targetPos);
    const edgeKey = `${source}->${target}`;
    const isPrimary = link.type === 'consecration' && primaryEdgeSet.has(edgeKey);
    const style = edgeStyle(link);
    const pathData = routePath(link, sourceRect, targetRect, isPrimary);

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
    if (link.type === 'ordination') markerId = 'grid-arrow-black';
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
      const mid = rightCenter(sourceRect);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(mid.x + 6));
      text.setAttribute('y', String(mid.y - 4));
      text.setAttribute('class', 'lineage-grid-edge-label');
      text.textContent = label;
      edgesGroup.appendChild(text);
    }
  });
}

function computeStageSize(positions) {
  let maxCol = 0;
  let maxRow = 0;
  Object.values(positions).forEach((pos) => {
    maxCol = Math.max(maxCol, pos.col);
    maxRow = Math.max(maxRow, pos.row);
  });
  return {
    width: cellX(maxCol) + CARD_W + PAD,
    height: cellY(maxRow) + CARD_H + PAD,
  };
}

function initPanZoom(viewport, stage) {
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
      const next = Math.min(2.5, Math.max(0.2, scale * delta));
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

  const fitBtn = document.getElementById('lineage-grid-fit');
  if (fitBtn) {
    fitBtn.addEventListener('click', () => {
      const rect = viewport.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const sx = rect.width / stageRect.width;
      const sy = rect.height / stageRect.height;
      scale = Math.min(1, sx, sy) * 0.95;
      translateX = (rect.width - stageRect.width * scale) / 2;
      translateY = (rect.height - stageRect.height * scale) / 2;
      apply();
    });
    requestAnimationFrame(() => fitBtn.click());
  } else {
    apply();
  }
}

export function initializeLineageGrid() {
  const viewport = document.getElementById('lineage-grid-viewport');
  const stage = document.getElementById('lineage-grid-stage');
  if (!viewport || !stage) return;

  const nodes = window.nodesData || [];
  const links = window.linksData || [];
  const layout = window.layoutData || { positions: {}, primary_edges: [] };
  const positions = layout.positions || {};

  if (!nodes.length) {
    viewport.innerHTML = '<p class="lineage-grid-empty">No clergy data available.</p>';
    return;
  }

  const layoutIds = new Set(layout.layout_node_ids || Object.keys(positions).map(Number));
  const visibleNodes = nodes.filter((n) => layoutIds.has(n.id));

  const size = computeStageSize(positions);
  stage.style.width = `${size.width}px`;
  stage.style.height = `${size.height}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lineage-grid-svg');
  svg.setAttribute('width', String(size.width));
  svg.setAttribute('height', String(size.height));
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  stage.appendChild(svg);

  const primaryEdgeSet = buildPrimaryEdgeSet(layout.primary_edges);
  renderEdges(svg, links, positions, primaryEdgeSet);
  renderCards(stage, visibleNodes, positions);
  initPanZoom(viewport, stage);

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

document.addEventListener('DOMContentLoaded', initializeLineageGrid);
