// Highlight Lineage Module
// Handles highlighting the consecration chain when highlight mode is enabled

import { OUTER_RADIUS, BLACK_COLOR, GREEN_COLOR } from './constants.js';

// Global state for highlight mode
let isHighlightModeEnabled = false;
let highlightedNodes = new Set();
let highlightedLinks = new Set();

// Yellow glow color for highlighting
const HIGHLIGHT_COLOR = '#ffd700'; // Gold/yellow
const HIGHLIGHT_GLOW_RADIUS = 15;
const HIGHLIGHT_STROKE_WIDTH = 4;

// Store original marker-end values for links
const originalMarkerEnds = new Map();

/** Normalize link data for both force-directed (d.source.id) and tree (d.source.data.id) formats. */
function getLinkIdsAndType(d) {
  if (!d || !d.source || !d.target) return null;
  const sourceId = d.source?.data?.id ?? d.source?.id;
  const targetId = d.target?.data?.id ?? d.target?.id;
  const linkType = d.target?.data?.parentLinkType ?? d.type ?? 'consecration';
  return { sourceId, targetId, linkType };
}

/**
 * Enable or disable highlight mode
 */
export function setHighlightMode(enabled) {
  isHighlightModeEnabled = enabled;
  if (!enabled) {
    clearHighlight();
  }
}

/**
 * Check if highlight mode is enabled
 */
export function isHighlightMode() {
  return isHighlightModeEnabled;
}

/**
 * Clear all highlights
 */
export function clearHighlight() {
  // Remove highlight from all nodes
  const svg = d3.select('#graph-container svg');
  if (!svg.empty()) {
    const container = svg.select('g'); // The zoom container
    if (!container.empty()) {
      const nodeGroups = container.selectAll('g');
      nodeGroups.each(function(d) {
        if (d && d.id) {
          const nodeGroup = d3.select(this);
          // Reset outer shape - restore original stroke color
          const useSquare = d.is_pre_1968_consecration || d.is_lineage_root;
          const outerSelector = useSquare ? '.viz-node-outer-rect' : '.viz-node-outer-circle';
          const outerShape = nodeGroup.select(outerSelector);
          if (!outerShape.empty() && d.rank_color) {
            outerShape
              .attr('stroke-width', 1)
              .attr('stroke', d.rank_color)
              .style('filter', null);
          }
        }
      });
    }
  }

  // Remove highlight from all links (both line and path, e.g. tree)
  const svg2 = d3.select('#graph-container svg');
  if (!svg2.empty()) {
    const container2 = svg2.select('g');
    if (!container2.empty()) {
      container2.selectAll('.viz-link').each(function(d) {
        if (d) {
          const linkElement = d3.select(this);
          const norm = getLinkIdsAndType(d);
          const linkType = norm ? norm.linkType : (d.type ?? 'consecration');
          const isPath = this.tagName && this.tagName.toLowerCase() === 'path';

          if (isPath) {
            // Tree links: no arrowheads; remove marker-end if we added it
            const originalMarker = originalMarkerEnds.get(this);
            if (originalMarker) {
              linkElement.attr('marker-end', originalMarker);
              originalMarkerEnds.delete(this);
            } else {
              linkElement.attr('marker-end', null);
            }
          } else {
            // Force-directed (line): restore marker-end
            const originalMarker = originalMarkerEnds.get(this);
            if (originalMarker) {
              linkElement.attr('marker-end', originalMarker);
              originalMarkerEnds.delete(this);
            } else {
              const markerId = (linkType === 'ordination')
                ? 'url(#arrowhead-black)'
                : 'url(#arrowhead-green)';
              linkElement.attr('marker-end', markerId);
            }
          }

          const rootStyles = getComputedStyle(document.documentElement);
          const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim() || BLACK_COLOR;
          const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
          const restoreColor = (linkType === 'ordination') ? cssLinkOrdinationColor : cssLinkConsecrationColor;

          linkElement
            .attr('stroke-width', parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width')) || 3)
            .attr('stroke', restoreColor)
            .style('filter', null);
        }
      });
    }
  }

  highlightedNodes.clear();
  highlightedLinks.clear();
  originalMarkerEnds.clear();
}

/**
 * Highlight a node with yellow glow
 */
function highlightNode(nodeId) {
  if (!nodeId) return;
  
  highlightedNodes.add(nodeId);
  
  // Find the node group and highlight its circles
  // Nodes are in g elements within the container
  const svg = d3.select('#graph-container svg');
  if (svg.empty()) return;
  
  const container = svg.select('g'); // The zoom container
  if (container.empty()) return;
  
  const nodeGroups = container.selectAll('g');
  nodeGroups.each(function(d) {
    if (d && d.id === nodeId) {
      const nodeGroup = d3.select(this);
      // Highlight outer shape
      const useSquare = d.is_pre_1968_consecration || d.is_lineage_root;
      const outerSelector = useSquare ? '.viz-node-outer-rect' : '.viz-node-outer-circle';
      const outerShape = nodeGroup.select(outerSelector);
      if (!outerShape.empty()) {
        outerShape
          .attr('stroke-width', HIGHLIGHT_STROKE_WIDTH)
          .attr('stroke', HIGHLIGHT_COLOR)
          .style('filter', `drop-shadow(0 0 ${HIGHLIGHT_GLOW_RADIUS}px ${HIGHLIGHT_COLOR})`);
      }
    }
  });
}

/**
 * Ensure yellow arrowhead marker exists in SVG defs
 * Adjust refX to account for thicker highlight stroke
 */
function ensureYellowArrowheadMarker() {
  const svg = d3.select('#graph-container svg');
  if (svg.empty()) return;
  
  const container = svg.select('g'); // The zoom container
  if (container.empty()) return;
  
  const defs = container.select('defs');
  if (defs.empty()) return;
  
  // Check if yellow arrowhead already exists
  const yellowMarker = defs.select('#arrowhead-yellow');
  if (!yellowMarker.empty()) return;
  
  // Read arrow configuration from CSS variables
  const rootStyles = getComputedStyle(document.documentElement);
  const cssArrowSize = parseFloat(rootStyles.getPropertyValue('--viz-arrow-size')) || 8;
  const cssArrowStyle = rootStyles.getPropertyValue('--viz-arrow-style').trim() || 'triangle';
  
  // Arrow path configurations (matching core.js and editor-visualization.js)
  const arrowStyles = {
    triangle: { path: 'M0,-5L10,0L0,5Z', viewBox: '0 -5 10 10' },
    chevron: { path: 'M0,-5L10,0L0,5', viewBox: '0 -5 10 10', stroke: true },
    barbed: { path: 'M0,-4L10,0L0,4L3,0Z', viewBox: '0 -4 10 8' },
    stealth: { path: 'M0,-3L10,0L0,3L2,0Z', viewBox: '0 -3 10 6' },
    diamond: { path: 'M0,0L5,-4L10,0L5,4Z', viewBox: '0 -4 10 8' }
  };
  
  const arrowConfig = arrowStyles[cssArrowStyle] || arrowStyles.triangle;
  // Set refX to 0 so arrow BASE is at line end, arrow TIP extends forward
  const adjustedRefX = 0;
  
  // Create yellow arrowhead marker
  const marker = defs.append('marker')
    .attr('id', 'arrowhead-yellow')
    .attr('viewBox', arrowConfig.viewBox)
    .attr('refX', adjustedRefX)
    .attr('refY', 0)
    .attr('markerWidth', cssArrowSize)
    .attr('markerHeight', cssArrowSize)
    .attr('orient', 'auto');
  
  marker.append('path')
    .attr('d', arrowConfig.path)
    .attr('fill', arrowConfig.stroke ? 'none' : HIGHLIGHT_COLOR)
    .attr('stroke', arrowConfig.stroke ? HIGHLIGHT_COLOR : 'none')
    .attr('stroke-width', arrowConfig.stroke ? 2 : 0);
}

/**
 * Highlight a link with yellow glow
 */
function highlightLink(sourceId, targetId, linkType) {
  if (!sourceId || !targetId) return;

  const linkKey = `${sourceId}-${targetId}-${linkType}`;
  highlightedLinks.add(linkKey);

  const svg = d3.select('#graph-container svg');
  if (svg.empty()) return;

  const container = svg.select('g'); // The zoom container
  if (container.empty()) return;

  const links = container.selectAll('.viz-link');
  links.each(function(d) {
    const norm = getLinkIdsAndType(d);
    if (!norm || norm.sourceId !== sourceId || norm.targetId !== targetId || norm.linkType !== linkType) return;

    const linkElement = d3.select(this);
    const isPath = this.tagName && this.tagName.toLowerCase() === 'path';

    if (!isPath) {
      ensureYellowArrowheadMarker();
      const linkNode = this;
      if (!originalMarkerEnds.has(linkNode)) {
        originalMarkerEnds.set(linkNode, linkElement.attr('marker-end'));
      }
      linkElement.attr('marker-end', 'url(#arrowhead-yellow)');
    }

    linkElement
      .attr('stroke-width', HIGHLIGHT_STROKE_WIDTH)
      .attr('stroke', HIGHLIGHT_COLOR)
      .style('filter', `drop-shadow(0 0 ${HIGHLIGHT_GLOW_RADIUS}px ${HIGHLIGHT_COLOR})`);
  });
}

/**
 * Find the consecrator of a bishop (via consecration link)
 */
function findConsecrator(bishopId) {
  if (!window.currentLinks) return null;
  
  // Find consecration link where target is this bishop
  const consecrationLink = window.currentLinks.find(link => {
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return targetId === bishopId && link.type === 'consecration';
  });
  
  if (consecrationLink) {
    const sourceId = typeof consecrationLink.source === 'object' ? consecrationLink.source.id : consecrationLink.source;
    return sourceId;
  }
  
  return null;
}

/**
 * Find the ordaining bishop of a priest (via ordination link)
 */
function findOrdainingBishop(priestId) {
  if (!window.currentLinks) return null;
  
  // Find ordination link where target is this priest
  const ordinationLink = window.currentLinks.find(link => {
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return targetId === priestId && link.type === 'ordination';
  });
  
  if (ordinationLink) {
    const sourceId = typeof ordinationLink.source === 'object' ? ordinationLink.source.id : ordinationLink.source;
    return sourceId;
  }
  
  return null;
}

/**
 * Traverse the consecration chain upward from a node
 * Returns array of node IDs in the chain
 */
function traverseConsecrationChain(startNodeId) {
  const chain = [];
  const visited = new Set();
  let currentNodeId = startNodeId;
  
  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    chain.push(currentNodeId);
    
    // Find consecrator
    const consecratorId = findConsecrator(currentNodeId);
    if (consecratorId) {
      currentNodeId = consecratorId;
    } else {
      // Reached the top of the chain
      break;
    }
  }
  
  return chain;
}

/**
 * Highlight the consecration lineage chain for a clicked node
 */
export function highlightLineageChain(node) {
  if (!node || !node.id) return;
  
  // Clear previous highlights
  clearHighlight();
  
  // Get the node ID
  const startNodeId = node.id;
  
  // Determine if this is a bishop or priest
  const isBishop = node.rank && (
    node.rank.toLowerCase().includes('bishop') ||
    node.rank.toLowerCase().includes('pope') ||
    node.rank.toLowerCase().includes('archbishop') ||
    node.rank.toLowerCase().includes('cardinal') ||
    node.rank.toLowerCase().includes('patriarch')
  );
  
  let chain = [];
  
  if (isBishop) {
    // For bishops: start with the bishop, then traverse consecration chain upward
    chain = traverseConsecrationChain(startNodeId);
  } else {
    // For priests: start with the priest, find ordaining bishop, then traverse consecration chain
    chain.push(startNodeId);
    
    // Find ordaining bishop
    const ordainingBishopId = findOrdainingBishop(startNodeId);
    if (ordainingBishopId) {
      // Highlight ordination link
      highlightLink(ordainingBishopId, startNodeId, 'ordination');
      
      // Traverse consecration chain from ordaining bishop
      const bishopChain = traverseConsecrationChain(ordainingBishopId);
      chain.push(...bishopChain);
    }
  }
  
  // Highlight all nodes in the chain
  chain.forEach(nodeId => {
    highlightNode(nodeId);
  });
  
  // Highlight all consecration links in the chain
  // The chain goes from bottom to top, so each node (except the first) has a consecration link from the previous node
  for (let i = 1; i < chain.length; i++) {
    const currentNodeId = chain[i];
    const previousNodeId = chain[i - 1];
    // Highlight consecration link: source is the consecrator (current), target is the consecrated (previous)
    highlightLink(currentNodeId, previousNodeId, 'consecration');
  }
  
  // Also highlight the ordination link if we started with a priest
  if (!isBishop) {
    const ordainingBishopId = findOrdainingBishop(startNodeId);
    if (ordainingBishopId) {
      // Ordination link: source is ordaining bishop, target is the priest
      highlightLink(ordainingBishopId, startNodeId, 'ordination');
    }
  }
}

