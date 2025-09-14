// Core visualization module with D3 setup and main functions
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
import { applyPriestFilter, updateTimelinePositions } from './filters.js';

// Initialize the visualization
export function initializeVisualization() {
  console.log('initializeVisualization called');
  console.log('Window data check:', {
    linksData: window.linksData,
    nodesData: window.nodesData,
    linksLength: window.linksData ? window.linksData.length : 'undefined',
    nodesLength: window.nodesData ? window.nodesData.length : 'undefined'
  });
  console.time('Visualization initialization');
  
  // The force simulation mutates links and nodes, so create a copy
  const linksRaw = window.linksData || [];
  const nodesRaw = window.nodesData || [];

  // Validate data before processing
  if (!Array.isArray(linksRaw) || !Array.isArray(nodesRaw)) {
    console.error('Invalid data received:', { linksRaw, nodesRaw });
    document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">Unable to load lineage data. Please refresh the page.</p></div>';
    return;
  }

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

  // Function to detect and offset parallel links
  function processParallelLinks(links) {
    // Group links by source-target pairs
    const linkGroups = {};
    
    links.forEach(link => {
      const key = `${link.source.id}-${link.target.id}`;
      if (!linkGroups[key]) {
        linkGroups[key] = [];
      }
      linkGroups[key].push(link);
    });
    
    // Add offset to parallel links
    Object.values(linkGroups).forEach(group => {
      if (group.length > 1) {
        // Sort by type to ensure consistent ordering
        group.sort((a, b) => {
          const typeOrder = { 'ordination': 0, 'consecration': 1, 'co-consecration': 2 };
          return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
        });
        
        // Calculate offset for each link
        const offset = 8; // Distance between parallel lines
        const totalOffset = (group.length - 1) * offset / 2;
        
        group.forEach((link, index) => {
          link.parallelOffset = (index * offset) - totalOffset;
        });
      }
    });
  }

  // Process parallel links
  processParallelLinks(validLinks);

  // Create SVG container
  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background', 'transparent') // Transparent background to show page background
    .style('overflow', 'visible'); // Allow content to extend beyond viewport

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.01, 4]) // Allow more zoom out to see the larger timeline
    .on('zoom', function(event) {
      container.attr('transform', event.transform);
      // Update timeline positions during zoom/pan
      updateTimelinePositions(event.transform);
    });
  svg.call(zoom);
  
  // Store zoom behavior globally for use in centering function
  window.currentZoom = zoom;

  // Create container group for zoom
  const container = svg.append('g');

  // Add arrow markers
  container.append('defs').selectAll('marker')
    .data(['arrowhead-black', 'arrowhead-green'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', OUTER_RADIUS * 0.95) // Position arrows slightly farther from nodes (85% of radius)
    .attr('refY', 0)
    .attr('markerWidth', 8) // Increased for larger nodes
    .attr('markerHeight', 8) // Increased for larger nodes
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', d => d === 'arrowhead-black' ? BLACK_COLOR : GREEN_COLOR);

  // Create force simulation - OPTIMIZED for faster convergence
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(validLinks).id(d => d.id).distance(LINK_DISTANCE))
    .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(COLLISION_RADIUS))
    .alphaDecay(0.1) // Faster decay for quicker convergence
    .velocityDecay(0.4); // More damping for stability

  // Add repulsion between bishops
  const bishopNodes = nodes.filter(n => n.rank && n.rank.toLowerCase() === 'bishop');
  if (bishopNodes.length > 0) {
    simulation.force('bishop-repulsion', d3.forceManyBody().strength(-800));
  }
  
  // Override force functions to exclude filtered nodes from physics
  const originalLinkForce = simulation.force('link');
  simulation.force('link', d3.forceLink(validLinks.filter(l => !l.filtered)).id(d => d.id).distance(LINK_DISTANCE));
  
  const originalChargeForce = simulation.force('charge');
  simulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : CHARGE_STRENGTH));
  
  const originalCollisionForce = simulation.force('collision');
  simulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : COLLISION_RADIUS));

  // Create links first (so they render behind nodes)
  const link = container.append('g')
    .selectAll('line')
    .data(validLinks)
    .enter().append('line')
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
    .style('opacity', d => d.filtered ? 0 : 1) // Hide filtered links
    .style('pointer-events', d => d.filtered ? 'none' : 'all') // Disable pointer events for filtered links
    .attr('marker-end', d => {
      // Ensure we have a valid color and map it to the correct marker
      if (d.color === BLACK_COLOR) {
        return 'url(#arrowhead-black)';
      } else if (d.color === GREEN_COLOR) {
        return 'url(#arrowhead-green)';
      } else {
        // Default to green if color is undefined or doesn't match
        return 'url(#arrowhead-green)';
      }
    });

  // Store references globally for filtering
  window.currentNodes = nodes;
  window.currentLinks = validLinks;
  window.currentSimulation = simulation;
  
  // Initialize filtered state for all nodes and links
  nodes.forEach(node => {
    const isPriest = node.rank && node.rank.toLowerCase() === 'priest';
    node.filtered = isPriest; // Start with priests hidden
  });
  
  validLinks.forEach(link => {
    const sourceIsPriest = link.source.rank && link.source.rank.toLowerCase() === 'priest';
    const targetIsPriest = link.target.rank && link.target.rank.toLowerCase() === 'priest';
    const isBlackLink = link.color === BLACK_COLOR;
    link.filtered = isBlackLink && (sourceIsPriest || targetIsPriest); // Hide black links to priests
  });


  // Create nodes after links (so they render on top)
  const node = container.append('g')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .style('pointer-events', d => d.filtered ? 'none' : 'all') // Disable pointer events for filtered nodes
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
    .attr('clip-path', `circle(${IMAGE_SIZE/2}px at ${IMAGE_SIZE/2}px ${IMAGE_SIZE/2}px)`) // Dynamic clipping for larger images
    .style('opacity', d => d.image_url ? 1 : 0) // Hide if no image
    .on('error', function() {
      // Hide image if it fails to load
      d3.select(this).style('opacity', 0);
    });

  // Add fallback placeholder icon when no image is available
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', '12px')
    .style('fill', '#666')
    .style('pointer-events', 'none')
    .style('opacity', d => d.image_url ? 0 : 1) // Show only when no image
    .text('👤'); // Person icon as fallback

  // Add labels
  node.append('text')
    .attr('dy', LABEL_DY)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('pointer-events', 'none')
    .style('fill', '#ffffff') // White text for dark background
    .style('filter', 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))') // Subtle drop shadow
    .style('text-shadow', '0 0 3px rgba(0,0,0,0.9)') // Additional glow effect
    .text(d => d.name);

  // Add tooltips
  node.append('title')
    .text(d => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`);

  // Update positions on simulation tick
  simulation.on('tick', () => {
    // Apply Y-axis constraints for timeline view
    if (window.isTimelineViewEnabled) {
      const timelineTop = 80; // Space below top timeline
      const timelineBottom = height - 80; // Space above bottom timeline
      
      nodes.forEach(d => {
        if (!d.filtered) {
          // Constrain Y position within timeline boundaries
          if (d.y < timelineTop) d.y = timelineTop;
          if (d.y > timelineBottom) d.y = timelineBottom;
        }
      });
    }

    link
      .attr('x1', d => d.source.x + (d.parallelOffset || 0))
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x + (d.parallelOffset || 0))
      .attr('y2', d => d.target.y)
      .style('opacity', d => d.filtered ? 0 : 1) // Update link opacity on tick
      .style('pointer-events', d => d.filtered ? 'none' : 'all'); // Disable pointer events for filtered links

    node
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('opacity', d => d.filtered ? 0 : 1) // Hide filtered nodes completely
      .style('pointer-events', d => d.filtered ? 'none' : 'all'); // Update pointer events on tick
  });

  // Stop simulation after it converges to improve performance
  simulation.on('end', () => {
    console.log('Force simulation converged');
    // Hide loading indicator when simulation is complete
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  });

  // Fallback: hide loading indicator after 10 seconds to prevent infinite loading
  setTimeout(() => {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }, 10000);

  console.timeEnd('Visualization initialization');

  // Track drag state for click detection
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragThreshold = 100; // pixels - increased for much better click detection
  let dragStartTime = 0;
  let maxClickDuration = 300; // milliseconds

  // Drag functions
  function dragstarted(event, d) {
    // Prevent dragging of filtered nodes
    if (d.filtered) return;
    
    isDragging = false;
    dragStartPos = { x: event.x, y: event.y };
    dragStartTime = Date.now();
    
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    // Prevent dragging of filtered nodes
    if (d.filtered) return;
    
    // Check if we've moved enough to consider this a drag
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
    // Prevent dragging of filtered nodes
    if (d.filtered) return;
    
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    
    // Check if this was a quick click (not a drag)
    const dragDuration = Date.now() - dragStartTime;
    const wasQuickClick = dragDuration < maxClickDuration && !isDragging;
    
    if (wasQuickClick) {
      // Use a small delay to ensure drag state is fully cleared
      setTimeout(() => {
        handleNodeClick(event, d);
      }, 50);
    }
  }

  // Control button handlers
  document.getElementById('reset-zoom').addEventListener('click', () => {
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
    );
    // Also reset timeline positions
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

  // Apply initial priest filter
  applyPriestFilter();
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
    
    // Apply the transform with smooth animation
    svg.transition()
      .duration(750)
      .call(zoom.transform, newTransform);
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
  setLargeViewDistance();
}

// Function to reset to default view distance
export function resetToDefaultViewDistance() {
  setMediumViewDistance();
}
