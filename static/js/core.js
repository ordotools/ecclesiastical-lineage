// Core visualization module with D3 setup and elkjs layered layout
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

// Layout mode: 'layered' (elkjs) or 'force' (original)
let layoutMode = 'layered';
let elk = null;

// Function to compute layered layout using elkjs
async function computeLayeredLayout(nodes, links) {
  console.log('Computing layered layout with elkjs...');
  
  // Initialize ELK if not already done
  if (!elk && typeof ELK !== 'undefined') {
    elk = new ELK();
  }
  
  if (!elk) {
    console.warn('ELK not available, falling back to force layout');
    layoutMode = 'force';
    return null;
  }
  
  // Prepare data for elkjs
  const elkNodes = nodes.map(node => {
    // Calculate layer based on event date (consecration for bishops, ordination for priests)
    let layerDate = null;
    if (node.rank && node.rank.toLowerCase() === 'bishop' && node.consecration_date && node.consecration_date !== 'Not specified') {
      layerDate = new Date(node.consecration_date);
    } else if (node.ordination_date && node.ordination_date !== 'Not specified') {
      layerDate = new Date(node.ordination_date);
    }
    
    // Assign layer ID based on year (group by decade for better spacing)
    let layerId = 'unknown';
    if (layerDate && !isNaN(layerDate.getTime())) {
      const year = layerDate.getFullYear();
      layerId = `layer_${Math.floor(year / 10) * 10}`; // Group by decade
    }
    
    return {
      id: node.id.toString(),
      width: OUTER_RADIUS * 2 + 20, // Node width including padding
      height: OUTER_RADIUS * 2 + 20, // Node height including padding
      properties: {
        'elk.layered.layering.layerId': layerId,
        originalNode: node
      }
    };
  });
  
  const elkEdges = links.map((link, index) => ({
    id: `edge_${index}`,
    sources: [link.source.id.toString()],
    targets: [link.target.id.toString()],
    properties: {
      originalLink: link
    }
  }));
  
  const elkGraph = {
    id: 'root',
    properties: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.unnecessaryBendpoints': 'true'
    },
    children: elkNodes,
    edges: elkEdges
  };
  
  try {
    const layoutedGraph = await elk.layout(elkGraph);
    console.log('ELK layout computation complete');
    
    // Apply computed positions back to nodes
    layoutedGraph.children.forEach(elkNode => {
      const originalNode = elkNode.properties.originalNode;
      originalNode.x = elkNode.x + elkNode.width / 2; // Center the node
      originalNode.y = elkNode.y + elkNode.height / 2;
    });
    
    // Store edge routing information
    layoutedGraph.edges.forEach(elkEdge => {
      const originalLink = elkEdge.properties.originalLink;
      if (elkEdge.sections && elkEdge.sections.length > 0) {
        originalLink.routing = elkEdge.sections[0];
      }
    });
    
    return layoutedGraph;
  } catch (error) {
    console.error('ELK layout failed:', error);
    layoutMode = 'force';
    return null;
  }
}

// Function to render links with orthogonal routing
function renderOrthogonalLinks(container, links) {
  const linkGroup = container.append('g').attr('class', 'links');
  
  links.forEach((link, index) => {
    const linkElement = linkGroup.append('g').attr('class', `link link-${index}`);
    
    if (link.routing && link.routing.bendPoints) {
      // Create path with bend points
      const points = [
        { x: link.routing.startPoint.x, y: link.routing.startPoint.y },
        ...link.routing.bendPoints,
        { x: link.routing.endPoint.x, y: link.routing.endPoint.y }
      ];
      
      const pathData = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      
      linkElement.append('path')
        .attr('d', pathData)
        .attr('stroke', link.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', link.dashed ? '5,5' : 'none')
        .attr('fill', 'none')
        .attr('marker-end', `url(#arrowhead-${link.color === BLACK_COLOR ? 'black' : 'green'})`)
        .style('opacity', link.filtered ? 0 : 1)
        .style('pointer-events', link.filtered ? 'none' : 'all');
    } else {
      // Fall back to straight line
      linkElement.append('line')
        .attr('x1', link.source.x)
        .attr('y1', link.source.y)
        .attr('x2', link.target.x)
        .attr('y2', link.target.y)
        .attr('stroke', link.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', link.dashed ? '5,5' : 'none')
        .attr('marker-end', `url(#arrowhead-${link.color === BLACK_COLOR ? 'black' : 'green'})`)
        .style('opacity', link.filtered ? 0 : 1)
        .style('pointer-events', link.filtered ? 'none' : 'all');
    }
  });
  
  return linkGroup;
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

  // Try layered layout first, fall back to force layout
  let layoutResult = null;
  if (layoutMode === 'layered') {
    try {
      layoutResult = await computeLayeredLayout(nodes, validLinks);
    } catch (error) {
      console.error('Layered layout failed, falling back to force layout:', error);
      layoutMode = 'force';
    }
  }

  // Process parallel links only for force layout
  if (layoutMode === 'force') {
    processParallelLinks(validLinks);
  }

  // Create SVG container
  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background', 'transparent')
    .style('overflow', 'visible');

  // Calculate appropriate viewBox for layered layout
  if (layoutMode === 'layered' && layoutResult) {
    // Get bounds of the layered layout
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x - OUTER_RADIUS);
      maxX = Math.max(maxX, node.x + OUTER_RADIUS);
      minY = Math.min(minY, node.y - OUTER_RADIUS);
      maxY = Math.max(maxY, node.y + OUTER_RADIUS);
    });
    
    const padding = 100;
    const layoutWidth = maxX - minX + 2 * padding;
    const layoutHeight = maxY - minY + 2 * padding;
    const layoutCenterX = (minX + maxX) / 2;
    const layoutCenterY = (minY + maxY) / 2;
    
    // Update SVG to fit the layout
    svg.attr('viewBox', [minX - padding, minY - padding, layoutWidth, layoutHeight]);
    
    console.log('Layered layout bounds:', { minX, maxX, minY, maxY, layoutWidth, layoutHeight });
  }

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

  // Create force simulation only for force layout mode
  let simulation = null;
  if (layoutMode === 'force') {
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks).id(d => d.id).distance(80)) // Reduced from LINK_DISTANCE for clustering
      .force('charge', d3.forceManyBody().strength(-200)) // Reduced repulsion for clustering
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.5)) // Stronger centering force
      .force('collision', d3.forceCollide().radius(COLLISION_RADIUS))
      .force('radial', d3.forceRadial(150, width / 2, height / 2).strength(0.1)) // Radial clustering force
      .alphaDecay(0.05) // Reduced for longer simulation
      .velocityDecay(0.2); // Reduced for more movement

    // Add repulsion between bishops
    const bishopNodes = nodes.filter(n => n.rank && n.rank.toLowerCase() === 'bishop');
    if (bishopNodes.length > 0) {
      simulation.force('bishop-repulsion', d3.forceManyBody().strength(-800));
    }
    
    // Override force functions to exclude filtered nodes from physics
    simulation.force('link', d3.forceLink(validLinks.filter(l => !l.filtered)).id(d => d.id).distance(80)); // Use clustering distance
    simulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : -200)); // Use clustering charge strength
    simulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : COLLISION_RADIUS));
  }

  // Store simulation globally for compatibility
  window.currentSimulation = simulation;

  // Render links based on layout mode
  let link;
  if (layoutMode === 'layered') {
    // Use orthogonal routing for layered layout
    link = renderOrthogonalLinks(container, validLinks);
  } else {
    // Use straight lines for force layout
    link = container.append('g')
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
  }


  // Create nodes after links (so they render on top)
  const node = container.append('g')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .style('pointer-events', d => d.filtered ? 'none' : 'all')
    .call(layoutMode === 'force' ? d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended) : () => {});

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

  // Position nodes immediately for layered layout
  if (layoutMode === 'layered') {
    node.attr('transform', d => `translate(${d.x},${d.y})`)
      .style('opacity', d => d.filtered ? 0 : 1)
      .style('pointer-events', d => d.filtered ? 'none' : 'all');
      
    // Add click handlers for layered layout (no drag)
    node.on('click', function(event, d) {
      if (!d.filtered) {
        handleNodeClick(event, d);
      }
    });
  }

  // Update positions on simulation tick (force layout only)
  if (simulation) {
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

      // Update links (force layout uses straight lines)
      if (layoutMode === 'force' && link.attr) {
        link
          .attr('x1', d => d.source.x + (d.parallelOffset || 0))
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x + (d.parallelOffset || 0))
          .attr('y2', d => d.target.y)
          .style('opacity', d => d.filtered ? 0 : 1)
          .style('pointer-events', d => d.filtered ? 'none' : 'all');
      }

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
  } else {
    // For layered layout, hide loading indicator immediately
    console.log('Layered layout complete');
    hideLoadingIndicator();
  }

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

  // Drag functions (only for force layout)
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragThreshold = 100;
  let dragStartTime = 0;
  let maxClickDuration = 300;

  function dragstarted(event, d) {
    if (d.filtered || layoutMode !== 'force') return;
    
    isDragging = false;
    dragStartPos = { x: event.x, y: event.y };
    dragStartTime = Date.now();
    
    if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    if (d.filtered || layoutMode !== 'force') return;
    
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
    if (d.filtered || layoutMode !== 'force') return;
    
    if (!event.active && simulation) simulation.alphaTarget(0);
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
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
    );
    updateTimelinePositions(d3.zoomIdentity);
  });

  document.getElementById('center-graph').addEventListener('click', () => {
    if (layoutMode === 'force' && simulation) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.alpha(1).restart();
    } else if (layoutMode === 'layered') {
      // For layered layout, center the view on the graph bounds
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(node => {
        if (!node.filtered) {
          minX = Math.min(minX, node.x - OUTER_RADIUS);
          maxX = Math.max(maxX, node.x + OUTER_RADIUS);
          minY = Math.min(minY, node.y - OUTER_RADIUS);
          maxY = Math.max(maxY, node.y + OUTER_RADIUS);
        }
      });
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      
      const scale = Math.min(width / graphWidth, height / graphHeight) * 0.8;
      const translateX = width / 2 - centerX * scale;
      const translateY = height / 2 - centerY * scale;
      
      const transform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale);
      
      svg.transition().duration(750).call(zoom.transform, transform);
    }
  });

  // Handle window resize
  window.addEventListener('resize', function() {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight - 76;
    svg.attr('width', newWidth).attr('height', newHeight);
    
    if (layoutMode === 'force' && simulation) {
      simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
      simulation.alpha(1).restart();
    }
  });

  // Apply initial filters
  applyBackboneOnlyFilter();
  applyPriestFilter();

  // Add layout mode toggle for testing
  console.log(`Visualization initialized in ${layoutMode} mode`);
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
