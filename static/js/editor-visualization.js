/**
 * Editor Visualization Panel
 * Handles the D3.js lineage visualization in the editor interface
 * Includes resize handling for panel changes
 * Matches lineage visualization exactly for D3.js nodes, links and physics
 */

console.log('Editor visualization script loaded');

// Visualization constants - matching lineage visualization exactly
// Prevent duplicate declarations when HTMX loads content
if (typeof window.LINK_DISTANCE === 'undefined') {
    window.LINK_DISTANCE = 150; // Link distance for force layout (matches main visualization)
    window.CHARGE_STRENGTH = -400; // Charge strength (matches main visualization)
    window.COLLISION_RADIUS = 60; // Node collision radius
    window.OUTER_RADIUS = 30; // Organization ring
    window.INNER_RADIUS = 24; // Rank ring
    window.IMAGE_SIZE = 48; // Clergy image size
    window.LABEL_DY = 35; // Label position offset
}

// Use window variables to prevent const redeclaration errors
var LINK_DISTANCE = window.LINK_DISTANCE;
var CHARGE_STRENGTH = window.CHARGE_STRENGTH;
var COLLISION_RADIUS = window.COLLISION_RADIUS;
var OUTER_RADIUS = window.OUTER_RADIUS;
var INNER_RADIUS = window.INNER_RADIUS;
var IMAGE_SIZE = window.IMAGE_SIZE;
var LABEL_DY = window.LABEL_DY;

// Get color constants from CSS variables (set dynamically from constants.js)
// Fallback to reading CSS variables which are set from constants.js module
var GREEN_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-green').trim();
var BLACK_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-black').trim();

// If CSS variables aren't set yet (race condition), use hardcoded fallback
// These should match constants.js
if (!GREEN_COLOR) GREEN_COLOR = '#11451e';
if (!BLACK_COLOR) BLACK_COLOR = '#1c1c1c';

// Prevent duplicate class declarations
if (typeof window.EditorVisualization === 'undefined') {
class EditorVisualization {
    constructor() {
        this.container = null;
        this.svg = null;
        this.simulation = null;
        this.resizeObserver = null;
        this.nodesData = null;
        this.linksData = null;
        this.isInitialized = false;
        
        // Drag state variables - matching lineage visualization
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragThreshold = 100;
        this.maxClickDuration = 300;
        this.dragStartTime = 0;
    }

    // Function to check if a rank is a bishop rank - matching main visualization
    isBishopRank(rankValue) {
        if (!rankValue) return false;
        const lowerRank = rankValue.toLowerCase();
        return lowerRank.includes('bishop') || 
               lowerRank.includes('pope') || 
               lowerRank.includes('archbishop') || 
               lowerRank.includes('cardinal') ||
               lowerRank.includes('patriarch');
    }

    init(nodesData, linksData) {
        this.nodesData = nodesData;
        this.linksData = linksData;
        
        console.log('Editor visualization - Nodes:', nodesData.length, 'Links:', linksData.length);
        
        this.initializeVisualization();
    }

    initializeVisualization() {
        console.log('initializeVisualization called');
        this.container = document.getElementById('editor-graph-container');
        console.log('Container found:', !!this.container);
        console.log('D3 available:', !!d3);
        
        if (!this.container || !d3) {
            console.log('Container or D3 not available, retrying...');
            setTimeout(() => this.initializeVisualization(), 100);
            return;
        }
        
        // Clear any existing SVG
        d3.select(this.container).selectAll('*').remove();
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // Create zoom behavior - matching lineage visualization
        const zoom = d3.zoom()
            .scaleExtent([0.01, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Create main group for zooming/panning
        this.g = this.svg.append('g');
        
        // Create simulation - matching lineage visualization exactly
        this.simulation = d3.forceSimulation(this.nodesData)
            .force('link', d3.forceLink(this.linksData).id(d => d.id).distance(80)) // Use clustering distance like main visualization
            .force('charge', d3.forceManyBody().strength(-200)) // Use clustering charge strength like main visualization
            .force('center', d3.forceCenter(width / 2, height / 2).strength(0.5)) // Stronger centering force
            .force('collision', d3.forceCollide().radius(COLLISION_RADIUS))
            .force('radial', d3.forceRadial(150, width / 2, height / 2).strength(0.1)) // Radial clustering force
            .alphaDecay(0.05) // Reduced for longer simulation
            .velocityDecay(0.2); // Reduced for more movement

        // Add repulsion between bishops - matching main visualization
        const bishopNodes = this.nodesData.filter(n => n.rank && this.isBishopRank(n.rank));
        if (bishopNodes.length > 0) {
            this.simulation.force('bishop-repulsion', d3.forceManyBody().strength(-800));
        }
        
        this.renderVisualization();
        
        // Setup resize observer
        this.setupResizeObserver();
        
        this.isInitialized = true;
    }

    processParallelLinks() {
        // Process parallel links - matching lineage visualization exactly
        const linkGroups = {};
        this.linksData.forEach(link => {
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

    renderVisualization() {
        // Add arrow markers and filters - matching lineage visualization
        const defs = this.g.append('defs');
        
        defs.selectAll('marker')
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

        // Add filter for inset shadow on images
        const filter = defs.append('filter')
            .attr('id', 'image-inset-shadow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');
        
        filter.append('feGaussianBlur')
            .attr('in', 'SourceAlpha')
            .attr('stdDeviation', '3')
            .attr('result', 'blur');
        
        filter.append('feOffset')
            .attr('in', 'blur')
            .attr('dx', '4')
            .attr('dy', '4')
            .attr('result', 'offsetBlur');
        
        filter.append('feFlood')
            .attr('flood-color', 'rgba(0, 0, 0, 0.15)')
            .attr('result', 'flood');
        
        filter.append('feComposite')
            .attr('in', 'flood')
            .attr('in2', 'offsetBlur')
            .attr('operator', 'in')
            .attr('result', 'shadow');
        
        filter.append('feComposite')
            .attr('in', 'SourceGraphic')
            .attr('in2', 'shadow')
            .attr('operator', 'over');

        // Process parallel links - matching lineage visualization
        this.processParallelLinks();

        // Create links - matching lineage visualization
        this.link = this.g.append('g')
            .selectAll('line')
            .data(this.linksData)
            .enter().append('line')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
            .attr('marker-end', d => {
                if (d.color === BLACK_COLOR) {
                    return 'url(#arrowhead-black)';
                } else if (d.color === GREEN_COLOR) {
                    return 'url(#arrowhead-green)';
                } else {
                    return 'url(#arrowhead-green)';
                }
            });
        
        // Create nodes - matching lineage visualization exactly
        this.node = this.g.append('g')
            .selectAll('g')
            .data(this.nodesData)
            .enter().append('g')
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)))
            .on('click', (event, d) => this.handleNodeClick(event, d));

        // Add outer circle (organization ring) - matching lineage visualization
        this.node.append('circle')
            .attr('r', OUTER_RADIUS)
            .attr('fill', d => d.org_color)
            .attr('stroke', d => d.rank_color)
            .attr('stroke-width', 3);

        // Add inner circle (rank ring) - matching lineage visualization
        this.node.append('circle')
            .attr('r', INNER_RADIUS)
            .attr('fill', d => d.rank_color)
            .attr('cx', 0)
            .attr('cy', 0);

        // Add white background circle for images - matching lineage visualization
        this.node.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0);

        // Add border circle for images - matching lineage visualization
        this.node.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0);

        // Add clergy images with proper clipping - matching lineage visualization
        this.node.append('image')
            .attr('xlink:href', d => d.image_url || '')
            .attr('x', -IMAGE_SIZE/2)
            .attr('y', -IMAGE_SIZE/2)
            .attr('width', IMAGE_SIZE)
            .attr('height', IMAGE_SIZE)
            .attr('clip-path', `circle(${IMAGE_SIZE/2}px at ${IMAGE_SIZE/2}px ${IMAGE_SIZE/2}px)`)
            .attr('filter', 'url(#image-inset-shadow)')
            .style('opacity', d => d.image_url ? 1 : 0)
            .on('error', function() {
                d3.select(this).style('opacity', 0);
            });

        // Add fallback placeholder icon when no image is available - matching lineage visualization
        this.node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .style('pointer-events', 'none')
            .style('opacity', d => d.image_url ? 0 : 1)
            .text('👤');
        
        // Add labels - matching lineage visualization exactly
        this.node.append('text')
            .attr('dy', LABEL_DY)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', '500')
            .style('pointer-events', 'none')
            .style('fill', '#ffffff')
            .style('filter', 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))')
            .style('text-shadow', '0 0 3px rgba(0,0,0,0.9)')
            .text(d => d.name);

        // Add tooltips - matching lineage visualization
        this.node.append('title')
            .text(d => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`);
        
        // Update positions on simulation tick - matching lineage visualization
        this.simulation.on('tick', () => {
            // Update links with parallel offset support
            this.link
                .attr('x1', d => d.source.x + (d.parallelOffset || 0))
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x + (d.parallelOffset || 0))
                .attr('y2', d => d.target.y);
            
            // Update nodes
            this.node
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });
        
        // Center the graph initially
        setTimeout(() => {
            this.centerGraph();
        }, 1000);
    }

    setupResizeObserver() {
        // Use ResizeObserver to detect when the container size changes
        this.resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                this.handleResize(entry.contentRect);
            }
        });
        
        this.resizeObserver.observe(this.container);
    }

    handleResize(contentRect) {
        if (!this.isInitialized || !this.svg || !this.simulation) return;
        
        const newWidth = contentRect.width;
        const newHeight = contentRect.height;
        
        // Update SVG dimensions
        this.svg
            .attr('width', newWidth)
            .attr('height', newHeight);
        
        // Update simulation center force
        this.simulation
            .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
            .alpha(0.3)
            .restart();
    }

    centerGraph() {
        if (!this.svg || !this.g || !this.simulation) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // For force layout, restart simulation with center force
        this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
        this.simulation.alpha(1).restart();
        
        // Also center the view
        setTimeout(() => {
            this.svg.call(
                d3.zoom().transform,
                d3.zoomIdentity
            );
        }, 1000);
    }

    handleNodeClick(event, d) {
        // Select clergy when clicked
        if (typeof window.selectClergy === 'function') {
            window.selectClergy(d.id);
        }
        
        // Highlight selected node - matching lineage visualization
        this.node.select('circle').attr('stroke-width', 3).attr('stroke', d => d.rank_color);
        d3.select(event.currentTarget).select('circle').attr('stroke-width', 6).attr('stroke', '#ffd700');
    }

    // Drag functions - matching lineage visualization exactly
    dragstarted(event, d) {
        this.isDragging = false;
        this.dragStartPos = { x: event.x, y: event.y };
        this.dragStartTime = Date.now();
        this.dragThreshold = 100;
        this.maxClickDuration = 300;
        
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        const dx = event.x - this.dragStartPos.x;
        const dy = event.y - this.dragStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.dragThreshold) {
            this.isDragging = true;
        }
        
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        
        const dragDuration = Date.now() - this.dragStartTime;
        const wasQuickClick = dragDuration < this.maxClickDuration && !this.isDragging;
        
        if (wasQuickClick) {
            setTimeout(() => {
                this.handleNodeClick(event, d);
            }, 50);
        }
    }

    cleanup() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        if (this.simulation) {
            this.simulation.stop();
        }
        
        this.isInitialized = false;
    }
}

// Make class globally available
window.EditorVisualization = EditorVisualization;
}

// Global instance - use window to avoid redeclaration errors
if (typeof window.editorVisualization === 'undefined') {
    window.editorVisualization = null;
}

// Initialize function for use in templates
function initializeEditorVisualization(nodesData, linksData) {
    console.log('initializeEditorVisualization called with:', nodesData.length, 'nodes,', linksData.length, 'links');
    
    // Cleanup existing instance
    if (window.editorVisualization) {
        console.log('Cleaning up existing editor visualization instance');
        window.editorVisualization.cleanup();
    }
    
    // Create new instance
    console.log('Creating new editor visualization instance');
    window.editorVisualization = new EditorVisualization();
    window.editorVisualization.init(nodesData, linksData);
}

// Cleanup function for panel reloads
function cleanupEditorVisualization() {
    if (window.editorVisualization) {
        window.editorVisualization.cleanup();
        window.editorVisualization = null;
    }
}
