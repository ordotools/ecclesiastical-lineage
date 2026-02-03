// Core visualization module with D3 force layout
import { 
  LINK_DISTANCE, 
  CHARGE_STRENGTH, 
  COLLISION_RADIUS, 
  OUTER_RADIUS, 
  INNER_RADIUS, 
  IMAGE_SIZE, 
  LABEL_DY, 
  GREEN_COLOR, 
  BLACK_COLOR,
  RED_COLOR,
  ORANGE_COLOR,
  width, 
  height,
  ZOOM_LEVEL_LARGE,
  ZOOM_LEVEL_MEDIUM,
  ZOOM_LEVEL_SMALL
} from './constants.js';
import { handleNodeClick } from './modals.js';
import { applyPriestFilter, updateTimelinePositions, applyBackboneOnlyFilter } from './filters.js';
import { renderStatusBadges } from './statusBadges.js';

// ============================================================================
// VISUALIZATION CONFIGURATION
// ============================================================================
// All tunable parameters for the force-directed graph visualization
// Adjust these values to modify the behavior and appearance of the graph

// --- Force Simulation Parameters ---
const SIMULATION_CONFIG = {
  // Link force: controls the ideal distance between connected nodes
  linkDistance: 150,                    // Ideal distance between linked nodes (pixels)
  
  // Charge force: controls node repulsion/attraction
  chargeStrength: -300,               // Negative = repulsion, positive = attraction
  
  // Center force: pulls nodes toward the center of the viewport
  centerStrength: 0.5,                 // Strength of centering force (0-1)
  
  // Collision force: prevents nodes from overlapping
  collisionRadius: COLLISION_RADIUS,   // Minimum distance between node centers
  
  // Radial force: creates circular clustering effect
  radialRadius: 150,                   // Radius of radial clustering (pixels)
  radialStrength: 0.1,                 // Strength of radial force (0-1)
  
  // Bishop repulsion: extra repulsion between bishop-rank nodes
  bishopRepulsionStrength: -800,      // Stronger repulsion for bishops
  
  // Simulation decay: controls how quickly the simulation settles
  alphaDecay: 0.10,                    // Rate at which simulation cools down (0-1, lower = longer)
  velocityDecay: 0.2,                  // Friction/damping for node movement (0-1, lower = more movement)
  
  // Alpha target: controls simulation restart behavior
  alphaTargetOnDrag: 0.3,              // Target alpha when dragging starts
  alphaTargetOnRestart: 1.0            // Target alpha when manually restarting
};

// --- Drag and Click Detection Parameters ---
const DRAG_CONFIG = {
  // Click detection: movement threshold based on node size
  dragThreshold: OUTER_RADIUS,        // Half node diameter - movement less than this = click
  maxClickDuration: 300,               // Maximum time (ms) for a click vs drag
  
  // Ease-off animation: how simulation slows down after drag ends
  easeOffDuration: 250                 // Time (ms) to gradually stop simulation after drag
};

// --- Link Visual Parameters ---
const LINK_CONFIG = {
  strokeWidth: 3,                      // Width of link lines (pixels)
  parallelOffset: 8                    // Spacing between parallel links (pixels)
};

// --- Node Visual Parameters ---
// (Most node visual parameters are imported from constants.js:
//  OUTER_RADIUS, INNER_RADIUS, IMAGE_SIZE, LABEL_DY)

// ============================================================================

// Function to check if a rank is a bishop rank
// This will be updated to use the server-side bishop flag in the future
function isBishopRank(rankValue) {
  if (!rankValue) return false;
  const lowerRank = rankValue.toLowerCase();
  return lowerRank.includes('bishop') || 
         lowerRank.includes('pope') || 
         lowerRank.includes('archbishop') || 
         lowerRank.includes('cardinal') ||
         lowerRank.includes('patriarch');
}

// Initialize the visualization
export async function initializeVisualization() {
  console.log('initializeVisualization called');
  console.log('Window data check:', {
    linksData: window.linksData,
    nodesData: window.nodesData,
    linksLength: window.linksData ? window.linksData.length : 'undefined',
    nodesLength: window.nodesData ? window.nodesData.length : 'undefined'
  });
  console.time('Visualization initialization');
  
  // The layout algorithm mutates links and nodes, so create a copy
  const linksRaw = window.linksData || [];
  const nodesRaw = window.nodesData || [];

  // Validate data before processing
  if (!Array.isArray(linksRaw) || !Array.isArray(nodesRaw)) {
    console.error('Invalid data received:', { linksRaw, nodesRaw });
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">Unable to load lineage data. Please refresh the page.</p></div>';
    return;
  }
  
  // Additional data validation
  if (nodesRaw.length === 0) {
    console.warn('No nodes data available');
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">No clergy data available.</p></div>';
    return;
  }
  
  console.log('Data validation passed:', {
    nodesCount: nodesRaw.length,
    linksCount: linksRaw.length,
    sampleNode: nodesRaw[0],
    sampleLink: linksRaw[0]
  });
  
  // Debug: Log link types
  const linkTypes = {};
  linksRaw.forEach(link => {
    linkTypes[link.type] = (linkTypes[link.type] || 0) + 1;
  });
  console.log('Link types found:', linkTypes);

  const nodes = nodesRaw.map(d => ({...d}));
  const links = linksRaw.map(d => ({...d}));

  // Convert link source/target IDs to node references - OPTIMIZED
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  links.forEach(link => {
    if (typeof link.source === 'number') {
      link.source = nodeMap.get(link.source);
    }
    if (typeof link.target === 'number') {
      link.target = nodeMap.get(link.target);
    }
  });

  // Filter out any links with missing source or target
  const validLinks = links.filter(link => {
    if (!link.source || !link.target) {
      console.warn('Invalid link found:', link);
      return false;
    }
    return true;
  });
  
  console.log(`Valid links after filtering: ${validLinks.length} out of ${links.length}`);

  // Process parallel links (keep for force layout compatibility)
  function processParallelLinks(links) {
    const linkGroups = {};
    links.forEach(link => {
      const key = `${link.source.id}-${link.target.id}`;
      if (!linkGroups[key]) {
        linkGroups[key] = [];
      }
      linkGroups[key].push(link);
    });
    
    Object.values(linkGroups).forEach(group => {
      if (group.length > 1) {
        group.sort((a, b) => {
          const typeOrder = { 'ordination': 0, 'consecration': 1, 'co-consecration': 2 };
          return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
        });
        
        const offset = LINK_CONFIG.parallelOffset;
        const totalOffset = (group.length - 1) * offset / 2;
        group.forEach((link, index) => {
          link.parallelOffset = (index * offset) - totalOffset;
        });
      }
    });
  }

  // Store references globally for filtering
  window.currentNodes = nodes;
  window.currentLinks = validLinks;
  
  // Initialize filtered state for all nodes and links (will be overridden by filter system)
  nodes.forEach(node => {
    node.filtered = false; // Start with all nodes visible, filters will be applied later
  });
  
  validLinks.forEach(link => {
    link.filtered = false; // Start with all links visible, filters will be applied later
  });

  // Process parallel links for better visual separation
  processParallelLinks(validLinks);

  // Read CSS-driven style values so both templates render identically
  const rootStyles = getComputedStyle(document.documentElement);
  const cssLinkStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width')) || LINK_CONFIG.strokeWidth;
  const cssLabelDy = parseFloat(rootStyles.getPropertyValue('--viz-label-dy')) || LABEL_DY;
  const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim() || BLACK_COLOR;
  const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
  const cssLinkInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-link-invalid-ordination-color').trim() || ORANGE_COLOR;
  const cssLinkInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-link-invalid-consecration-color').trim() || RED_COLOR;
  const cssArrowOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-ordination-color').trim() || cssLinkOrdinationColor;
  const cssArrowConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-consecration-color').trim() || cssLinkConsecrationColor;
  const cssArrowInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-invalid-ordination-color').trim() || cssLinkInvalidOrdinationColor;
  const cssArrowInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-invalid-consecration-color').trim() || cssLinkInvalidConsecrationColor;
  
  // Read arrow size and style
  const cssArrowSize = parseFloat(rootStyles.getPropertyValue('--viz-arrow-size')) || 8;
  const cssArrowStyle = rootStyles.getPropertyValue('--viz-arrow-style').trim() || 'triangle';
  
  // Arrow path configurations (in viewBox units 0-10)
  // Each style has: path, refX (where tip is), viewBox
  const arrowStyles = {
    triangle: { path: 'M0,-5L10,0L0,5Z', refX: 10, viewBox: '0 -5 10 10' },
    chevron: { path: 'M0,-5L10,0L0,5', refX: 10, viewBox: '0 -5 10 10', stroke: true },
    barbed: { path: 'M0,-4L10,0L0,4L3,0Z', refX: 10, viewBox: '0 -4 10 8' },
    stealth: { path: 'M0,-3L10,0L0,3L2,0Z', refX: 10, viewBox: '0 -3 10 6' },
    diamond: { path: 'M0,0L5,-4L10,0L5,4Z', refX: 10, viewBox: '0 -4 10 8' }
  };
  
  const arrowConfig = arrowStyles[cssArrowStyle] || arrowStyles.triangle;
  // Set refX to 0 so arrow BASE is at line end, arrow TIP extends forward toward target node
  // This hides the line end beneath the arrow body
  const arrowRefX = 0;
  
  // Read link gap for positioning link end before child node
  const cssLinkGap = parseFloat(rootStyles.getPropertyValue('--viz-link-gap')) || 2;
  
  // Extra gap to ensure arrow tip clears the node edge
  const cssArrowExtraGap = parseFloat(rootStyles.getPropertyValue('--viz-arrow-extra-gap')) || 4;
  
  // Calculate how much to shorten the link so line end is hidden beneath arrow
  // Arrow size in pixels, plus extra gap so arrow tip clears node edge
  const arrowLengthPx = cssArrowSize + cssArrowExtraGap;
  
  // Store node dimensions for link coordinate calculation
  const cssNodeOuterRadius = parseFloat(rootStyles.getPropertyValue('--viz-node-outer-radius')) || OUTER_RADIUS;
  const cssNodeStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-node-stroke-width')) || 1;
  const nodeEdgeRadius = cssNodeOuterRadius + (cssNodeStrokeWidth / 2);

  // Create SVG container
  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('class', 'viz-svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background', 'transparent')
    .style('overflow', 'visible');

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 2])
    .on('zoom', function(event) {
      container.attr('transform', event.transform);
      updateTimelinePositions(event.transform);
    });
  svg.call(zoom);
  
  window.currentZoom = zoom;

  // Create container group for zoom
  const container = svg.append('g').attr('class', 'viz-zoom-layer');

  // Add arrow markers and filters
  const defs = container.append('defs');
  
  // Create arrow markers with configurable style
  const markers = defs.selectAll('marker')
    .data(['arrowhead-black', 'arrowhead-green', 'arrowhead-red', 'arrowhead-orange'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', arrowConfig.viewBox)
    .attr('refX', arrowRefX)
    .attr('refY', 0)
    .attr('markerWidth', cssArrowSize)
    .attr('markerHeight', cssArrowSize)
    .attr('orient', 'auto');
  
  markers.append('path')
    .attr('d', arrowConfig.path)
    .attr('fill', d => {
      if (arrowConfig.stroke) return 'none';
      if (d === 'arrowhead-black') return cssArrowOrdinationColor;
      if (d === 'arrowhead-green') return cssArrowConsecrationColor;
      if (d === 'arrowhead-red') return cssArrowInvalidConsecrationColor;
      if (d === 'arrowhead-orange') return cssArrowInvalidOrdinationColor;
      return cssArrowConsecrationColor;
    })
    .attr('stroke', d => {
      if (!arrowConfig.stroke) return 'none';
      if (d === 'arrowhead-black') return cssArrowOrdinationColor;
      if (d === 'arrowhead-green') return cssArrowConsecrationColor;
      if (d === 'arrowhead-red') return cssArrowInvalidConsecrationColor;
      if (d === 'arrowhead-orange') return cssArrowInvalidOrdinationColor;
      return cssArrowConsecrationColor;
    })
    .attr('stroke-width', arrowConfig.stroke ? 2 : 0);

  // Load sprite sheet and create patterns (before creating nodes) - using cache
  let spriteSheetData = null;
  try {
    // Use cached sprite sheet data if available
    if (typeof window.getSpriteSheetData === 'function') {
      spriteSheetData = await window.getSpriteSheetData();
    } else {
      // Fallback to direct fetch if cache utility not available
      const spriteResponse = await fetch('/api/sprite-sheet');
      if (spriteResponse.ok) {
        const contentType = spriteResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await spriteResponse.text();
          console.warn('Sprite sheet endpoint returned non-JSON response:', contentType, text.substring(0, 200));
          throw new Error('Invalid response type');
        }
        spriteSheetData = await spriteResponse.json();
      }
    }
    
    if (spriteSheetData && spriteSheetData.success) {
      const thumbnailSize = spriteSheetData.thumbnail_size || 48;
      const spriteUrl = spriteSheetData.url;
      const mapping = spriteSheetData.mapping || {};
      
      // Create clipPaths for each clergy member that has a position in the sprite sheet
      // We'll use direct image elements with clipPaths instead of patterns to prevent tiling
      nodes.forEach((d) => {
        // Try both string and number keys since JSON might convert keys
        const position = mapping[d.id] || mapping[String(d.id)] || mapping[Number(d.id)];
        
        if (position && Array.isArray(position) && position.length === 2) {
          // Create a circular clipPath for the node image (works for both real images and placeholders)
          const clipId = `clip-avatar-${d.id}`;
          const clipPath = defs.append('clipPath')
            .attr('id', clipId);
          clipPath.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('cx', 0)
            .attr('cy', 0);
        }
      });
    }
  } catch (error) {
    console.warn('Failed to load sprite sheet, falling back to individual images:', error);
    if (error.message) {
      console.warn('Error details:', error.message);
    }
  }

  // Add filter for inset shadow on images
  // const filter = defs.append('filter')
  //   .attr('id', 'image-inset-shadow')
  //   .attr('x', '-50%')
  //   .attr('y', '-50%')
  //   .attr('width', '200%')
  //   .attr('height', '200%');
  
  // filter.append('feGaussianBlur')
  //   .attr('in', 'SourceAlpha')
  //   .attr('stdDeviation', '3')
  //   .attr('result', 'blur');
  
  // filter.append('feOffset')
  //   .attr('in', 'blur')
  //   .attr('dx', '4')
  //   .attr('dy', '4')
  //   .attr('result', 'offsetBlur');
  
  // filter.append('feFlood')
  //   .attr('flood-color', 'rgba(0, 0, 0, 0.15)')
  //   .attr('result', 'flood');
  
  // filter.append('feComposite')
  //   .attr('in', 'flood')
  //   .attr('in2', 'offsetBlur')
  //   .attr('operator', 'in')
  //   .attr('result', 'shadow');
  
  // filter.append('feComposite')
  //   .attr('in', 'SourceGraphic')
  //   .attr('in2', 'shadow')
  //   .attr('operator', 'over');

  // Create force simulation with configured parameters
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(validLinks).id(d => d.id).distance(SIMULATION_CONFIG.linkDistance))
    .force('charge', d3.forceManyBody().strength(SIMULATION_CONFIG.chargeStrength))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(SIMULATION_CONFIG.centerStrength))
    .force('collision', d3.forceCollide().radius(SIMULATION_CONFIG.collisionRadius))
    .force('radial', d3.forceRadial(SIMULATION_CONFIG.radialRadius, width / 2, height / 2).strength(SIMULATION_CONFIG.radialStrength))
    .alphaDecay(SIMULATION_CONFIG.alphaDecay)
    .velocityDecay(SIMULATION_CONFIG.velocityDecay);

  // Add repulsion between bishops
  const bishopNodes = nodes.filter(n => n.rank && isBishopRank(n.rank));
  if (bishopNodes.length > 0) {
    simulation.force('bishop-repulsion', d3.forceManyBody().strength(SIMULATION_CONFIG.bishopRepulsionStrength));
  }
  
  // Override force functions to exclude filtered nodes from physics
  simulation.force('link', d3.forceLink(validLinks.filter(l => !l.filtered)).id(d => d.id).distance(SIMULATION_CONFIG.linkDistance));
  simulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : SIMULATION_CONFIG.chargeStrength));
  simulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : SIMULATION_CONFIG.collisionRadius));

  // Store simulation globally for compatibility
  window.currentSimulation = simulation;

  // Base links (transparent, for force layout - center to center)
  const linkBase = container.append('g')
    .attr('class', 'viz-links-base')
    .selectAll('line')
    .data(validLinks)
    .enter().append('line')
    .attr('stroke', 'transparent')
    .attr('stroke-width', 1)
    .style('pointer-events', 'none');

  // Overlay links (visible, edge-to-edge with arrowheads)
  const linkOverlay = container.append('g')
    .attr('class', 'viz-links-overlay')
    .selectAll('line')
    .data(validLinks)
    .enter().append('line')
    .attr('class', d => {
      let classes = 'viz-link';
      if (d.dashed || d.is_doubtful) classes += ' dashed';
      return classes;
    })
    .attr('stroke', d => {
      // Invalid links override normal color - orange for ordinations, red for consecrations
      if (d.is_invalid) {
        if (d.type === 'ordination') {
          return cssLinkInvalidOrdinationColor;
        } else {
          return cssLinkInvalidConsecrationColor;
        }
      }
      // Use CSS variables based on link type instead of d.color
      if (d.type === 'ordination') {
        return cssLinkOrdinationColor;
      } else if (d.type === 'consecration' || d.type === 'co-consecration') {
        return cssLinkConsecrationColor;
      }
      // Fallback to consecration color for unknown types
      return cssLinkConsecrationColor;
    })
    .attr('stroke-width', cssLinkStrokeWidth)
    .attr('stroke-dasharray', d => {
      // Make doubtful links dotted (or if already dashed from co-consecration)
      if (d.is_doubtful || d.dashed) {
        return '5,5';
      }
      return 'none';
    })
    .style('opacity', d => d.filtered ? 0 : 1)
    .style('pointer-events', d => d.filtered ? 'none' : 'all')
    .attr('marker-end', d => {
      // Invalid links use colored arrow markers - orange for ordinations, red for consecrations
      if (d.is_invalid) {
        if (d.type === 'ordination') {
          return 'url(#arrowhead-orange)';
        } else {
          return 'url(#arrowhead-red)';
        }
      }
      // Use CSS variables to determine arrow marker
      if (d.type === 'ordination') {
        return 'url(#arrowhead-black)';
      } else if (d.type === 'consecration' || d.type === 'co-consecration') {
        return 'url(#arrowhead-green)';
      }
      // Fallback to consecration arrow for unknown types
      return 'url(#arrowhead-green)';
    });
  
  // Keep reference to overlay links for filtering/highlighting
  const link = linkOverlay;


  // Create nodes after links (so they render on top)
  const node = container.append('g')
    .attr('class', 'viz-nodes')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .attr('class', 'viz-node')
    .style('pointer-events', d => d.filtered ? 'none' : 'all')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  // Add node circles
  node.append('circle')
    .attr('r', cssNodeOuterRadius)
    .attr('fill', d => d.org_color)
    .attr('stroke', d => d.rank_color)
    .attr('stroke-width', cssNodeStrokeWidth);

  // Add rank indicator
  node.append('circle')
    .attr('r', INNER_RADIUS)
    .attr('fill', d => d.rank_color)
    .attr('cx', 0)
    .attr('cy', 0);

  // Add white background circle for images (will be updated after sprite sheet loads)
  const bgCircle = node.append('circle')
    .attr('r', IMAGE_SIZE/2)
    .attr('fill', 'rgba(255, 255, 255, 1)')
    .attr('cx', 0)
    .attr('cy', 0)
    .style('opacity', d => d.image_url ? 1 : 0);

  // Add border circle for images (will be updated after sprite sheet loads)
  const borderCircle = node.append('circle')
    .attr('r', IMAGE_SIZE/2)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0, 0, 0, 1)')
    .attr('stroke-width', '0.5px') // Reduced from 1px to 0.5px for smaller nodes
    .attr('cx', 0)
    .attr('cy', 0)
    .style('opacity', d => d.image_url ? 1 : 0);

  // Add clergy images with sprite sheet or fallback to individual images
  if (spriteSheetData && spriteSheetData.success) {
    // Use sprite sheet with direct image elements and clipPaths
    // Show sprite for ALL clergy that have a position in the mapping (including placeholders)
    node.append('image')
      .attr('xlink:href', d => {
        if (spriteSheetData.mapping) {
          const position = spriteSheetData.mapping[d.id] || spriteSheetData.mapping[String(d.id)] || spriteSheetData.mapping[Number(d.id)];
          if (position && Array.isArray(position) && position.length === 2) {
            return spriteSheetData.url;
          }
        }
        return '';
      })
      .attr('x', d => {
        if (spriteSheetData.mapping) {
          const position = spriteSheetData.mapping[d.id] || spriteSheetData.mapping[String(d.id)] || spriteSheetData.mapping[Number(d.id)];
          if (position && Array.isArray(position) && position.length === 2) {
            const [x] = position;
            // Position image so the sprite thumbnail is centered at node (0,0)
            return -x - IMAGE_SIZE/2;
          }
        }
        return 0;
      })
      .attr('y', d => {
        if (spriteSheetData.mapping) {
          const position = spriteSheetData.mapping[d.id] || spriteSheetData.mapping[String(d.id)] || spriteSheetData.mapping[Number(d.id)];
          if (position && Array.isArray(position) && position.length === 2) {
            const [, y] = position;
            // Position image so the sprite thumbnail is centered at node (0,0)
            return -y - IMAGE_SIZE/2;
          }
        }
        return 0;
      })
      .attr('width', spriteSheetData.sprite_width)
      .attr('height', spriteSheetData.sprite_height)
      .attr('clip-path', d => {
        if (spriteSheetData.mapping) {
          const position = spriteSheetData.mapping[d.id] || spriteSheetData.mapping[String(d.id)] || spriteSheetData.mapping[Number(d.id)];
          if (position && Array.isArray(position) && position.length === 2) {
            return `url(#clip-avatar-${d.id})`;
          }
        }
        return 'none';
      })
      .attr('preserveAspectRatio', 'none')
      .style('pointer-events', 'none') // Make sprite images unclickable so they don't interfere with node interactions
      .style('opacity', d => {
        if (spriteSheetData.mapping) {
          const position = spriteSheetData.mapping[d.id] || spriteSheetData.mapping[String(d.id)] || spriteSheetData.mapping[Number(d.id)];
          if (position && Array.isArray(position) && position.length === 2) {
            // Update background and border circles to show for nodes with sprite positions (including placeholders)
            bgCircle.filter(node => node.id === d.id).style('opacity', 1);
            borderCircle.filter(node => node.id === d.id).style('opacity', 1);
            return 1;
          }
        }
        return 0;
      });
  } else {
    // Fallback to individual images
    node.append('image')
      .attr('xlink:href', d => d.image_url || '')
      .attr('x', -IMAGE_SIZE/2)
      .attr('y', -IMAGE_SIZE/2)
      .attr('width', IMAGE_SIZE)
      .attr('height', IMAGE_SIZE)
      .attr('clip-path', `circle(${IMAGE_SIZE/2}px at ${IMAGE_SIZE/2}px ${IMAGE_SIZE/2}px)`)
      .style('pointer-events', 'none') // Make images unclickable so they don't interfere with node interactions
      .style('opacity', d => d.image_url ? 1 : 0)
      .on('error', function() {
        d3.select(this).style('opacity', 0);
      });
  }

  // Add fallback placeholder icon when no image is available
  // node.append('text')
  //   .attr('text-anchor', 'middle')
  //   .attr('dominant-baseline', 'middle')
  //   .style('font-size', '12px')
  //   .style('fill', '#666')
  //   .style('pointer-events', 'none')
  //   .style('opacity', d => d.image_url ? 0 : 1)
  //   .text('👤');

  // Add labels
  node.append('text')
    .attr('class', 'viz-node-label')
    .attr('dy', cssLabelDy)
    .text(d => d.name);

  // Add tooltips
  node.append('title')
    .text(d => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`);

  // Render status badges around nodes
  node.each(function(d) {
    if (d.statuses && d.statuses.length > 0) {
      renderStatusBadges(d3.select(this), d.statuses, OUTER_RADIUS);
    }
  });

  // Update positions on simulation tick
  simulation.on('tick', () => {
    // Apply Y-axis constraints for timeline view
    if (window.isTimelineViewEnabled) {
      const timelineTop = 80;
      const timelineBottom = height - 80;
      
      nodes.forEach(d => {
        if (!d.filtered) {
          if (d.y < timelineTop) d.y = timelineTop;
          if (d.y > timelineBottom) d.y = timelineBottom;
        }
      });
    }

    // Update base links (center to center, for force layout reference)
    linkBase
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    // Update overlay links (edge to edge with arrowheads)
    linkOverlay.each(function(d) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist === 0) {
        // Nodes at same position, hide link
        d3.select(this)
          .attr('x1', d.source.x)
          .attr('y1', d.source.y)
          .attr('x2', d.source.x)
          .attr('y2', d.source.y);
        return;
      }
      
      // Unit vector along link direction
      const ux = dx / dist;
      const uy = dy / dist;
      
      // Perpendicular vector for parallel offset (rotate 90 degrees)
      const px = -uy;
      const py = ux;
      
      const offset = d.parallelOffset || 0;
      
      // Start at source node edge + perpendicular offset
      const x1 = d.source.x + ux * nodeEdgeRadius + offset * px;
      const y1 = d.source.y + uy * nodeEdgeRadius + offset * py;
      
      // End before target node edge (with gap + arrow length to hide line beneath arrow)
      // The arrow marker is at line end, so shorten line by arrow length so line end is under arrow body
      const x2 = d.target.x - ux * (nodeEdgeRadius + cssLinkGap + arrowLengthPx) + offset * px;
      const y2 = d.target.y - uy * (nodeEdgeRadius + cssLinkGap + arrowLengthPx) + offset * py;
      
      d3.select(this)
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2);
    });
    
    // Update overlay link visibility
    linkOverlay
      .style('opacity', d => d.filtered ? 0 : 1)
      .style('pointer-events', d => d.filtered ? 'none' : 'all');

    // Update nodes
    node
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('opacity', d => d.filtered ? 0 : 1)
      .style('pointer-events', d => d.filtered ? 'none' : 'all');
  });

  // Stop simulation after it converges
  simulation.on('end', () => {
    // console.log('Force simulation converged');
    hideLoadingIndicator();
  });

  function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }

  // Fallback: hide loading indicator after 10 seconds to prevent infinite loading
  setTimeout(() => {
    hideLoadingIndicator();
  }, 10000);

  console.timeEnd('Visualization initialization');

  // Drag functions - use configuration values
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartTime = 0;
  let easeOffTimeout = null;

  function dragstarted(event, d) {
    if (d.filtered) return;
    
    // Clear any pending ease-off timeout
    if (easeOffTimeout) {
      clearTimeout(easeOffTimeout);
      easeOffTimeout = null;
    }
    
    isDragging = false;
    dragStartPos = { x: event.x, y: event.y };
    dragStartTime = Date.now();
    
    // Start simulation when drag starts to allow smooth node movement
    // We'll stop it immediately if it turns out to be just a click
    if (!event.active) {
      simulation.alphaTarget(SIMULATION_CONFIG.alphaTargetOnDrag).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    if (d.filtered) return;
    
    const dx = event.x - dragStartPos.x;
    const dy = event.y - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Track if actual dragging occurred (movement exceeds threshold)
    if (distance > DRAG_CONFIG.dragThreshold) {
      isDragging = true;
    }
    
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (d.filtered) return;
    
    // Calculate final distance moved
    const dx = event.x - dragStartPos.x;
    const dy = event.y - dragStartPos.y;
    const finalDistance = Math.sqrt(dx * dx + dy * dy);
    
    const dragDuration = Date.now() - dragStartTime;
    // A click is: short duration AND movement less than the drag threshold
    const wasQuickClick = dragDuration < DRAG_CONFIG.maxClickDuration && finalDistance <= DRAG_CONFIG.dragThreshold;
    
    // Release the node position lock
    d.fx = null;
    d.fy = null;
    
    // Handle based on whether it was a click or drag
    if (!event.active) {
      if (wasQuickClick) {
        // For quick clicks, stop the simulation immediately
        // (it was started in dragstarted but we need to stop it now)
        simulation.alphaTarget(0);
        
        // Handle the click without affecting simulation further
        setTimeout(() => {
          handleNodeClick(event, d);
        }, 50);
      } else {
        // For actual drags, ease off the simulation gradually
        // Gradually reduce alphaTarget to 0 over configured duration
        const startAlpha = simulation.alphaTarget();
        const startTime = Date.now();
        const duration = DRAG_CONFIG.easeOffDuration;
        
        function easeOff() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out: start fast, slow down at the end
          const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
          const currentAlpha = startAlpha * (1 - eased);
          
          simulation.alphaTarget(currentAlpha);
          
          if (progress < 1) {
            easeOffTimeout = setTimeout(easeOff, 16); // ~60fps
          } else {
            // Fully stopped
            simulation.alphaTarget(0);
            easeOffTimeout = null;
          }
        }
        
        // Start easing off
        easeOff();
      }
    }
  }

  // Control button handlers (only if buttons exist)
  const resetZoomBtn = document.getElementById('reset-zoom');
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener('click', () => {
      svg.call(zoom.transform, d3.zoomIdentity);
      updateTimelinePositions(d3.zoomIdentity);
    });
  }

  const centerGraphBtn = document.getElementById('center-graph');
  if (centerGraphBtn) {
    centerGraphBtn.addEventListener('click', () => {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.alpha(SIMULATION_CONFIG.alphaTargetOnRestart).restart();
    });
  }

  // Handle window resize - only restart simulation on actual window size changes
  let lastWindowWidth = window.innerWidth;
  let lastWindowHeight = window.innerHeight;
  window.addEventListener('resize', function() {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight - 76;
    
    // Only restart simulation if actual window dimensions changed
    // (not just layout changes from panel expansion)
    if (newWidth !== lastWindowWidth || newHeight !== (lastWindowHeight - 76)) {
      lastWindowWidth = newWidth;
      lastWindowHeight = newHeight;
      
      svg.attr('width', newWidth).attr('height', newHeight);
      
      simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
      simulation.alpha(1).restart();
    }
  });

  // Apply initial filters
  applyBackboneOnlyFilter();
  applyPriestFilter();

  console.log('Visualization initialized with force layout');
}

// View zoom management functions
export function setViewZoom(zoomLevel) {
  const svg = d3.select('#graph-container svg');
  const zoom = window.currentZoom;
  
  if (!svg.empty() && zoom) {
    // Get current transform to preserve translation
    const currentTransform = d3.zoomTransform(svg.node());
    
    // Create new transform with the specified zoom level
    const newTransform = d3.zoomIdentity
      .translate(currentTransform.x, currentTransform.y)
      .scale(zoomLevel);
    
    // Apply the transform
    svg.call(zoom.transform, newTransform);
  }
}

export function setLargeViewDistance() {
  setViewZoom(ZOOM_LEVEL_LARGE);
}

export function setMediumViewDistance() {
  setViewZoom(ZOOM_LEVEL_MEDIUM);
}

export function setSmallViewDistance() {
  setViewZoom(ZOOM_LEVEL_SMALL);
}

// Function to set view distance when clergy info panel is shown
export function setClergyInfoViewDistance() {
  const svg = d3.select('#graph-container svg');
  const zoom = window.currentZoom;
  
  if (!svg.empty() && zoom) {
    // Get current transform to preserve visual position
    const currentTransform = d3.zoomTransform(svg.node());
    
    // Calculate the center point of the current view
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight; // - 76; // Account for navbar height
    const viewCenterX = viewportWidth / 2;
    const viewCenterY = viewportHeight / 2;
    
    // Calculate what point in graph coordinates is currently at the center of the view
    const currentScale = currentTransform.k;
    const graphCenterX = (viewCenterX - currentTransform.x) / currentScale;
    const graphCenterY = (viewCenterY - currentTransform.y) / currentScale;
    
    // Calculate the new translation to keep the same graph point at the center with the new scale
    const newScale = ZOOM_LEVEL_LARGE;
    const newTranslateX = viewCenterX - (graphCenterX * newScale);
    const newTranslateY = viewCenterY - (graphCenterY * newScale);
    
    // Create new transform that preserves the visual position
    const newTransform = d3.zoomIdentity
      .translate(newTranslateX, newTranslateY)
      .scale(newScale);
    
    // Apply the transform smoothly
    svg.transition()
      .duration(300)
      .call(zoom.transform, newTransform);
  }
}

// Function to reset to default view distance
export function resetToDefaultViewDistance() {
  // Don't change zoom level when dismissing panel - just keep current zoom
  // This prevents the graph from jumping/zooming when the panel is closed
}
