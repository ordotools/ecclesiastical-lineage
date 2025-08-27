// Visualization constants - UPDATED for standardized image sizes (25% smaller for better quality)
const LINK_DISTANCE = 150; // Reduced from 200 for smaller nodes
const CHARGE_STRENGTH = -400;
const COLLISION_RADIUS = 60; // Reduced from 80 for smaller nodes
const OUTER_RADIUS = 30; // Organization ring - reduced from 40 to surround 48×48 images
const INNER_RADIUS = 24; // Rank ring - reduced from 32 to be visible around images
const IMAGE_SIZE = 48; // Reduced from 64 to 48×48 for better image quality
const LABEL_DY =  35; // Reduced from 50 for smaller nodes
const ARROWHEAD_LENGTH = 16; // Reduced from 18 for smaller nodes

// Show/hide floating menu button and hide fixed legend/controls on mobile
function handleMobileMenuDisplay() {
  const isMobile = window.innerWidth <= 768;
  document.getElementById('mobile-menu-btn').style.display = isMobile ? 'block' : 'none';
  document.querySelector('.legend-visualization').style.display = isMobile ? 'none' : '';
  document.querySelector('.visualization-controls').style.display = isMobile ? 'none' : '';
}
window.addEventListener('resize', handleMobileMenuDisplay);
document.addEventListener('DOMContentLoaded', handleMobileMenuDisplay);

// Mobile menu open/close logic
const menuBtn = document.getElementById('mobile-menu-btn');
const menuModal = document.getElementById('mobile-menu-modal');
const closeBtn = document.getElementById('close-mobile-menu');
if (menuBtn && menuModal && closeBtn) {
  menuBtn.addEventListener('click', () => {
    menuModal.style.display = 'block';
  });
  closeBtn.addEventListener('click', () => {
    menuModal.style.display = 'none';
  });
  menuModal.addEventListener('click', (e) => {
    if (e.target === menuModal) menuModal.style.display = 'none';
  });
}

// Wire up mobile controls to main controls
const resetZoomMobile = document.getElementById('reset-zoom-mobile');
const centerGraphMobile = document.getElementById('center-graph-mobile');
if (resetZoomMobile) {
  resetZoomMobile.addEventListener('click', function() {
    document.getElementById('reset-zoom').click();
    menuModal.style.display = 'none';
  });
}
if (centerGraphMobile) {
  centerGraphMobile.addEventListener('click', function() {
    document.getElementById('center-graph').click();
    menuModal.style.display = 'none';
  });
}

// Specify the dimensions of the chart
const width = window.innerWidth;
const height = window.innerHeight - 76;

// Define color constants for consistency
const GREEN_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-green').trim() || '#27ae60';
const BLACK_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-black').trim() || '#000000';

// Initialize the visualization
function initializeVisualization() {
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
        .style('background', 'transparent'); // Transparent background to show page background

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', function(event) {
            container.attr('transform', event.transform);
        });
    svg.call(zoom);

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

    // Create links first (so they render behind nodes)
    const link = container.append('g')
        .selectAll('line')
        .data(validLinks)
        .enter().append('line')
        .attr('stroke', d => d.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
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

    // Create nodes after links (so they render on top)
    const node = container.append('g')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
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
        link
            .attr('x1', d => d.source.x + (d.parallelOffset || 0))
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x + (d.parallelOffset || 0))
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
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

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Control button handlers
    document.getElementById('reset-zoom').addEventListener('click', () => {
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
        );
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

    // Initialize mobile display
    handleMobileMenuDisplay();

} // Close initializeVisualization function

// Start the visualization
initializeVisualization();
