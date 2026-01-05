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
          // Reset outer circle (first circle) - restore original stroke color
          const circles = nodeGroup.selectAll('circle');
          if (circles.size() > 0) {
            const outerCircle = circles.nodes()[0];
            if (outerCircle && d.rank_color) {
              d3.select(outerCircle)
                .attr('stroke-width', 1)
                .attr('stroke', d.rank_color)
                .style('filter', null);
            }
          }
        }
      });
    }
  }

  // Remove highlight from all links
  const svg2 = d3.select('#graph-container svg');
  if (!svg2.empty()) {
    const container2 = svg2.select('g');
    if (!container2.empty()) {
      container2.selectAll('line').each(function(d) {
        if (d && d.color) {
          const lineElement = d3.select(this);
          
          // Restore original marker-end if it was stored
          const originalMarker = originalMarkerEnds.get(this);
          if (originalMarker) {
            lineElement.attr('marker-end', originalMarker);
            originalMarkerEnds.delete(this);
          } else {
            // Restore marker-end based on link color
            const markerId = (d.color === BLACK_COLOR || d.color === '#0d0d0d' || d.color === '#000000')
              ? 'url(#arrowhead-black)' 
              : 'url(#arrowhead-green)';
            lineElement.attr('marker-end', markerId);
          }
          
          lineElement
            .attr('stroke-width', 3)
            .attr('stroke', d.color)
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
      // Highlight outer circle (first circle is the outer one)
      const circles = nodeGroup.selectAll('circle');
      if (circles.size() > 0) {
        const outerCircle = circles.nodes()[0];
        if (outerCircle) {
          d3.select(outerCircle)
            .attr('stroke-width', HIGHLIGHT_STROKE_WIDTH)
            .attr('stroke', HIGHLIGHT_COLOR)
            .style('filter', `drop-shadow(0 0 ${HIGHLIGHT_GLOW_RADIUS}px ${HIGHLIGHT_COLOR})`);
        }
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
  
  // Calculate refX accounting for thicker highlight stroke
  // Normal stroke width is 1, highlight stroke width is 4
  // The stroke extends outward from the circle, making the visual edge further out
  // Normal: visual edge at OUTER_RADIUS + (stroke_width/2) = OUTER_RADIUS + 0.5
  // Highlight: visual edge at OUTER_RADIUS + (stroke_width/2) = OUTER_RADIUS + 2
  // The difference is 1.5 pixels further out
  // Since refX is measured from the line end (which is at OUTER_RADIUS), and the visual edge
  // is further out with thicker stroke, we need to REDUCE refX (subtract) so the arrowhead
  // extends back toward the line end to align with the visual edge
  const normalStrokeHalf = 0.5; // half of stroke width 1
  const highlightStrokeHalf = HIGHLIGHT_STROKE_WIDTH / 2; // half of stroke width 4 = 2
  const strokeDifference = highlightStrokeHalf - normalStrokeHalf; // 1.5 pixels
  
  // Adjust refX to account for the thicker stroke
  // Subtract the stroke difference so the arrowhead aligns with the visual edge
  const adjustedRefX = (OUTER_RADIUS * 0.71) - strokeDifference;
  
  // Create yellow arrowhead marker
  const marker = defs.append('marker')
    .attr('id', 'arrowhead-yellow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', adjustedRefX)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto');
  
  marker.append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', HIGHLIGHT_COLOR);
}

/**
 * Highlight a link with yellow glow
 */
function highlightLink(sourceId, targetId, linkType) {
  if (!sourceId || !targetId) return;
  
  // Ensure yellow arrowhead marker exists
  ensureYellowArrowheadMarker();
  
  const linkKey = `${sourceId}-${targetId}-${linkType}`;
  highlightedLinks.add(linkKey);
  
  // Find and highlight the link
  const svg = d3.select('#graph-container svg');
  if (svg.empty()) return;
  
  const container = svg.select('g'); // The zoom container
  if (container.empty()) return;
  
  const links = container.selectAll('line');
  links.each(function(d) {
    if (d && d.source && d.target) {
      const linkSourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const linkTargetId = typeof d.target === 'object' ? d.target.id : d.target;
      
      if (linkSourceId === sourceId && linkTargetId === targetId && d.type === linkType) {
        const lineElement = d3.select(this);
        
        // Store original marker-end if not already stored
        const lineNode = this;
        if (!originalMarkerEnds.has(lineNode)) {
          const originalMarker = lineElement.attr('marker-end');
          originalMarkerEnds.set(lineNode, originalMarker);
        }
        
        // Highlight the link and change arrowhead to yellow
        lineElement
          .attr('stroke-width', HIGHLIGHT_STROKE_WIDTH)
          .attr('stroke', HIGHLIGHT_COLOR)
          .attr('marker-end', 'url(#arrowhead-yellow)')
          .style('filter', `drop-shadow(0 0 ${HIGHLIGHT_GLOW_RADIUS}px ${HIGHLIGHT_COLOR})`);
      }
    }
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

