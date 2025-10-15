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
  width, 
  height,
  ZOOM_LEVEL_LARGE,
  ZOOM_LEVEL_MEDIUM,
  ZOOM_LEVEL_SMALL
} from './constants.js';
import { handleNodeClick } from './modals.js';
import { applyPriestFilter, updateTimelinePositions, applyBackboneOnlyFilter } from './filters.js';
import { renderStatusBadges } from './statusBadges.js';

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
        
        const offset = 8;
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

  // Create SVG container
  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background', 'transparent')
    .style('overflow', 'visible');

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.01, 4])
    .on('zoom', function(event) {
      container.attr('transform', event.transform);
      updateTimelinePositions(event.transform);
    });
  svg.call(zoom);
  
  window.currentZoom = zoom;

  // Create container group for zoom
  const container = svg.append('g');

  // Add arrow markers
  container.append('defs').selectAll('marker')
    .data(['arrowhead-black', 'arrowhead-green'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', OUTER_RADIUS * 0.95)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', d => d === 'arrowhead-black' ? BLACK_COLOR : GREEN_COLOR);

  // Create force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(validLinks).id(d => d.id).distance(80)) // Reduced from LINK_DISTANCE for clustering
    .force('charge', d3.forceManyBody().strength(-200)) // Reduced repulsion for clustering
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.5)) // Stronger centering force
    .force('collision', d3.forceCollide().radius(COLLISION_RADIUS))
    .force('radial', d3.forceRadial(150, width / 2, height / 2).strength(0.1)) // Radial clustering force
    .alphaDecay(0.05) // Reduced for longer simulation
    .velocityDecay(0.2); // Reduced for more movement

  // Add repulsion between bishops
  const bishopNodes = nodes.filter(n => n.rank && isBishopRank(n.rank));
  if (bishopNodes.length > 0) {
    simulation.force('bishop-repulsion', d3.forceManyBody().strength(-800));
  }
  
  // Override force functions to exclude filtered nodes from physics
  simulation.force('link', d3.forceLink(validLinks.filter(l => !l.filtered)).id(d => d.id).distance(80)); // Use clustering distance
  simulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : -200)); // Use clustering charge strength
  simulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : COLLISION_RADIUS));

  // Store simulation globally for compatibility
  window.currentSimulation = simulation;

  // Render links with straight lines
  const link = container.append('g')
    .selectAll('line')
    .data(validLinks)
    .enter().append('line')
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
    .style('opacity', d => d.filtered ? 0 : 1)
    .style('pointer-events', d => d.filtered ? 'none' : 'all')
    .attr('marker-end', d => {
      if (d.color === BLACK_COLOR) {
        return 'url(#arrowhead-black)';
      } else if (d.color === GREEN_COLOR) {
        return 'url(#arrowhead-green)';
      } else {
        return 'url(#arrowhead-green)';
      }
    });


  // Create nodes after links (so they render on top)
  const node = container.append('g')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .style('pointer-events', d => d.filtered ? 'none' : 'all')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  // Add node circles
  node.append('circle')
    .attr('r', OUTER_RADIUS)
    .attr('fill', d => d.org_color)
    .attr('stroke', d => d.rank_color)
    .attr('stroke-width', 3);

  // Add rank indicator
  node.append('circle')
    .attr('r', INNER_RADIUS)
    .attr('fill', d => d.rank_color)
    .attr('cx', 0)
    .attr('cy', 0);

  // Add clergy images with proper clipping
  node.append('image')
    .attr('xlink:href', d => d.image_url || '')
    .attr('x', -IMAGE_SIZE/2)
    .attr('y', -IMAGE_SIZE/2)
    .attr('width', IMAGE_SIZE)
    .attr('height', IMAGE_SIZE)
    .attr('clip-path', `circle(${IMAGE_SIZE/2}px at ${IMAGE_SIZE/2}px ${IMAGE_SIZE/2}px)`)
    .style('opacity', d => d.image_url ? 1 : 0)
    .on('error', function() {
      d3.select(this).style('opacity', 0);
    });

  // Add fallback placeholder icon when no image is available
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', '12px')
    .style('fill', '#666')
    .style('pointer-events', 'none')
    .style('opacity', d => d.image_url ? 0 : 1)
    .text('👤');

  // Add labels
  node.append('text')
    .attr('dy', LABEL_DY)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('pointer-events', 'none')
    .style('fill', '#ffffff')
    .style('filter', 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))')
    .style('text-shadow', '0 0 3px rgba(0,0,0,0.9)')
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

    // Update links
    link
      .attr('x1', d => d.source.x + (d.parallelOffset || 0))
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x + (d.parallelOffset || 0))
      .attr('y2', d => d.target.y)
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
    console.log('Force simulation converged');
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

  // Drag functions
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragThreshold = 100;
  let dragStartTime = 0;
  let maxClickDuration = 300;

  function dragstarted(event, d) {
    if (d.filtered) return;
    
    isDragging = false;
    dragStartPos = { x: event.x, y: event.y };
    dragStartTime = Date.now();
    
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    if (d.filtered) return;
    
    const dx = event.x - dragStartPos.x;
    const dy = event.y - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > dragThreshold) {
      isDragging = true;
    }
    
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (d.filtered) return;
    
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    
    const dragDuration = Date.now() - dragStartTime;
    const wasQuickClick = dragDuration < maxClickDuration && !isDragging;
    
    if (wasQuickClick) {
      setTimeout(() => {
        handleNodeClick(event, d);
      }, 50);
    }
  }

  // Control button handlers
  document.getElementById('reset-zoom').addEventListener('click', () => {
    svg.call(zoom.transform, d3.zoomIdentity);
    updateTimelinePositions(d3.zoomIdentity);
  });

  document.getElementById('center-graph').addEventListener('click', () => {
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(1).restart();
  });

  // Handle window resize
  window.addEventListener('resize', function() {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight - 76;
    svg.attr('width', newWidth).attr('height', newHeight);
    
    simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
    simulation.alpha(1).restart();
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
    const viewportHeight = window.innerHeight - 76; // Account for navbar height
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
