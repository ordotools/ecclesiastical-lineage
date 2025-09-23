/**
 * Editor Visualization Panel
 * Handles the D3.js lineage visualization in the editor interface
 * Includes resize handling for panel changes
 */

console.log('Editor visualization script loaded');

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
        
        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Create main group for zooming/panning
        this.g = this.svg.append('g');
        
        // Create simulation
        this.simulation = d3.forceSimulation(this.nodesData)
            .force('link', d3.forceLink(this.linksData).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));
        
        this.renderVisualization();
        
        // Setup resize observer
        this.setupResizeObserver();
        
        this.isInitialized = true;
    }

    renderVisualization() {
        // Create links
        this.link = this.g.append('g')
            .selectAll('line')
            .data(this.linksData)
            .enter().append('line')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 2)
            .attr('opacity', 0.7);
        
        // Create nodes
        this.node = this.g.append('g')
            .selectAll('circle')
            .data(this.nodesData)
            .enter().append('circle')
            .attr('r', d => d.rank === 'Pope' ? 20 : 15)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)))
            .on('click', (event, d) => this.handleNodeClick(event, d));
        
        // Add node labels
        this.label = this.g.append('g')
            .selectAll('text')
            .data(this.nodesData)
            .enter().append('text')
            .text(d => d.name)
            .attr('font-size', '12px')
            .attr('font-family', 'Inter, sans-serif')
            .attr('fill', 'rgba(255, 255, 255, 0.9)')
            .attr('text-anchor', 'middle')
            .attr('dy', 35)
            .style('pointer-events', 'none')
            .style('text-shadow', '1px 1px 2px rgba(0, 0, 0, 0.7)');
        
        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            this.link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            this.node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            this.label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
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
        if (!this.svg || !this.g) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        const bounds = this.g.node().getBBox();
        const fullWidth = width;
        const fullHeight = height;
        const midX = bounds.x + bounds.width / 2;
        const midY = bounds.y + bounds.height / 2;
        
        if (bounds.width === 0 || bounds.height === 0) return;
        
        const scale = 0.8 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight);
        const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
        
        this.svg.transition()
            .duration(750)
            .call(d3.zoom().transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }

    handleNodeClick(event, d) {
        // Select clergy when clicked
        if (typeof window.selectClergy === 'function') {
            window.selectClergy(d.id);
        }
        
        // Highlight selected node
        this.node.attr('stroke-width', 2).attr('stroke', '#fff');
        d3.select(event.currentTarget).attr('stroke-width', 4).attr('stroke', '#ffd700');
    }

    // Drag functions
    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
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

// Global instance
let editorVisualization = null;

// Initialize function for use in templates
function initializeEditorVisualization(nodesData, linksData) {
    console.log('initializeEditorVisualization called with:', nodesData.length, 'nodes,', linksData.length, 'links');
    
    // Cleanup existing instance
    if (editorVisualization) {
        console.log('Cleaning up existing editor visualization instance');
        editorVisualization.cleanup();
    }
    
    // Create new instance
    console.log('Creating new editor visualization instance');
    editorVisualization = new EditorVisualization();
    editorVisualization.init(nodesData, linksData);
}

// Cleanup function for panel reloads
function cleanupEditorVisualization() {
    if (editorVisualization) {
        editorVisualization.cleanup();
        editorVisualization = null;
    }
}
