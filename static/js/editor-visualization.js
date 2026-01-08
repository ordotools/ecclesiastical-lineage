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
        
        // Clear any existing SVG, but preserve the style button and panel
        const styleButton = this.container.querySelector('#viz-style-toggle');
        const stylePanel = this.container.querySelector('#viz-style-panel');
        d3.select(this.container).selectAll('svg').remove();
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // Create SVG - ensure it doesn't cover the style button
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'viz-svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height])
            .style('background', 'transparent')
            .style('overflow', 'visible')
            .style('position', 'relative')
            .style('z-index', '1');
        
        // Create zoom behavior - matching lineage visualization
        const zoom = d3.zoom()
            .scaleExtent([0.01, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Create main group for zooming/panning
        this.g = this.svg.append('g').attr('class', 'viz-zoom-layer');
        
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

    async renderVisualization() {
        const rootStyles = getComputedStyle(document.documentElement);
        const cssLinkStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width')) || 2;
        const cssLabelDy = parseFloat(rootStyles.getPropertyValue('--viz-label-dy')) || LABEL_DY;
        this.labelDy = cssLabelDy;
        
        // Read link and arrow colors from CSS variables
        const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim() || BLACK_COLOR;
        const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
        const cssArrowOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-ordination-color').trim() || cssLinkOrdinationColor;
        const cssArrowConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-consecration-color').trim() || cssLinkConsecrationColor;
        
        // Store colors for use in link rendering
        this.cssLinkOrdinationColor = cssLinkOrdinationColor;
        this.cssLinkConsecrationColor = cssLinkConsecrationColor;
        
        // Read arrow size and style
        const cssArrowSize = parseFloat(rootStyles.getPropertyValue('--viz-arrow-size')) || 8;
        const cssArrowStyle = rootStyles.getPropertyValue('--viz-arrow-style').trim() || 'triangle';
        
        // Arrow path configurations (in viewBox units 0-10)
        const arrowStyles = {
            triangle: { path: 'M0,-5L10,0L0,5Z', refX: 10, viewBox: '0 -5 10 10' },
            chevron: { path: 'M0,-5L10,0L0,5', refX: 10, viewBox: '0 -5 10 10', stroke: true },
            barbed: { path: 'M0,-4L10,0L0,4L3,0Z', refX: 10, viewBox: '0 -4 10 8' },
            stealth: { path: 'M0,-3L10,0L0,3L2,0Z', refX: 10, viewBox: '0 -3 10 6' },
            diamond: { path: 'M0,0L5,-4L10,0L5,4Z', refX: 10, viewBox: '0 -4 10 8' }
        };
        
        const arrowConfig = arrowStyles[cssArrowStyle] || arrowStyles.triangle;
        // Set refX to 0 so arrow BASE is at line end, arrow TIP extends forward toward target node
        const arrowRefX = 0;
        
        // Store arrow config for use in markers
        this.arrowConfig = arrowConfig;
        this.cssArrowSize = cssArrowSize;
        
        // Read link gap for positioning link end before child node
        const cssLinkGap = parseFloat(rootStyles.getPropertyValue('--viz-link-gap')) || 2;
        
        // Extra gap to ensure arrow tip clears the node edge
        const cssArrowExtraGap = parseFloat(rootStyles.getPropertyValue('--viz-arrow-extra-gap')) || 4;
        
        // Store node dimensions for link coordinate calculation
        const cssNodeOuterRadius = parseFloat(rootStyles.getPropertyValue('--viz-node-outer-radius')) || OUTER_RADIUS;
        const cssNodeStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-node-stroke-width')) || 3;
        const nodeEdgeRadius = cssNodeOuterRadius + (cssNodeStrokeWidth / 2);
        
        // Calculate arrow length in pixels for link shortening (arrow size + extra gap)
        const arrowLengthPx = cssArrowSize + cssArrowExtraGap;
        
        // Store for use in tick handler
        this.nodeEdgeRadius = nodeEdgeRadius;
        this.cssLinkGap = cssLinkGap;
        this.arrowLengthPx = arrowLengthPx;

        // Add arrow markers and filters - matching lineage visualization
        const defs = this.g.append('defs');
        
        // Create arrow markers with configurable style
        const markers = defs.selectAll('marker')
            .data(['arrowhead-black', 'arrowhead-green'])
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
            .attr('fill', d => arrowConfig.stroke ? 'none' : (d === 'arrowhead-black' ? cssArrowOrdinationColor : cssArrowConsecrationColor))
            .attr('stroke', d => arrowConfig.stroke ? (d === 'arrowhead-black' ? cssArrowOrdinationColor : cssArrowConsecrationColor) : 'none')
            .attr('stroke-width', arrowConfig.stroke ? 2 : 0);

        // Load sprite sheet and create patterns
        let spriteSheetData = null;
        try {
            const spriteResponse = await fetch('/api/sprite-sheet');
            if (spriteResponse.ok) {
                const contentType = spriteResponse.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await spriteResponse.text();
                    console.warn('Sprite sheet endpoint returned non-JSON response:', contentType, text.substring(0, 200));
                    throw new Error('Invalid response type');
                }
                spriteSheetData = await spriteResponse.json();
                // Store spriteSheetData in instance for later updates
                this.spriteSheetData = spriteSheetData;
                if (spriteSheetData && spriteSheetData.success) {
                    const thumbnailSize = spriteSheetData.thumbnail_size || 48;
                    const spriteUrl = spriteSheetData.url;
                    const mapping = spriteSheetData.mapping || {};
                    
                    // Create clipPaths for each clergy member that has a position in the sprite sheet
                    // We'll use direct image elements with clipPaths instead of patterns to prevent tiling
                    this.nodesData.forEach((d) => {
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
            }
        } catch (error) {
            console.warn('Failed to load sprite sheet, falling back to individual images:', error);
            if (error.message) {
                console.warn('Error details:', error.message);
            }
        }

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

        // Base links (transparent, for force layout - center to center)
        this.linkBase = this.g.append('g')
            .attr('class', 'viz-links-base')
            .selectAll('line')
            .data(this.linksData)
            .enter().append('line')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none');

        // Overlay links (visible, edge-to-edge with arrowheads)
        this.linkOverlay = this.g.append('g')
            .attr('class', 'viz-links-overlay')
            .selectAll('line')
            .data(this.linksData)
            .enter().append('line')
            .attr('class', d => d.dashed ? 'viz-link dashed' : 'viz-link')
            .attr('stroke', d => {
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
            .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
            .attr('marker-end', d => {
                // Use link type to determine arrow marker
                if (d.type === 'ordination') {
                    return 'url(#arrowhead-black)';
                } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                    return 'url(#arrowhead-green)';
                }
                // Fallback to consecration arrow for unknown types
                return 'url(#arrowhead-green)';
            });
        
        // Keep reference to overlay links for compatibility
        this.link = this.linkOverlay;
        
        // Create nodes - matching lineage visualization exactly
        this.node = this.g.append('g')
            .attr('class', 'viz-nodes')
            .selectAll('g')
            .data(this.nodesData)
            .enter().append('g')
            .attr('class', 'viz-node')
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

        // Add white background circle for images (will be updated after sprite sheet loads)
        const bgCircle = this.node.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0);

        // Add border circle for images (will be updated after sprite sheet loads)
        const borderCircle = this.node.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0);

        // Add clergy images with sprite sheet or fallback to individual images
        if (spriteSheetData && spriteSheetData.success) {
            // Use sprite sheet with direct image elements and clipPaths
            // Show sprite for ALL clergy that have a position in the mapping (including placeholders)
            this.node.append('image')
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
            this.node.append('image')
                .attr('xlink:href', d => d.image_url || '')
                .attr('x', -IMAGE_SIZE/2)
                .attr('y', -IMAGE_SIZE/2)
                .attr('width', IMAGE_SIZE)
                .attr('height', IMAGE_SIZE)
                .attr('clip-path', `circle(${IMAGE_SIZE/2}px at ${IMAGE_SIZE/2}px ${IMAGE_SIZE/2}px)`)
                .attr('filter', 'url(#image-inset-shadow)')
                .style('pointer-events', 'none') // Make images unclickable so they don't interfere with node interactions
                .style('opacity', d => d.image_url ? 1 : 0)
                .on('error', function() {
                    d3.select(this).style('opacity', 0);
                });
        }

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
            .attr('class', 'viz-node-label')
            .attr('dy', this.labelDy)
            .text(d => d.name);

        // Add tooltips - matching lineage visualization
        this.node.append('title')
            .text(d => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`);
        
        // Update positions on simulation tick - matching lineage visualization
        this.simulation.on('tick', () => {
            // Update base links (center to center, for force layout reference)
            this.linkBase
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            // Update overlay links (edge to edge with arrowheads)
            const nodeEdgeRadius = this.nodeEdgeRadius;
            const cssLinkGap = this.cssLinkGap;
            const arrowLengthPx = this.arrowLengthPx;
            
            this.linkOverlay.each(function(d) {
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
                const x2 = d.target.x - ux * (nodeEdgeRadius + cssLinkGap + arrowLengthPx) + offset * px;
                const y2 = d.target.y - uy * (nodeEdgeRadius + cssLinkGap + arrowLengthPx) + offset * py;
                
                d3.select(this)
                    .attr('x1', x1)
                    .attr('y1', y1)
                    .attr('x2', x2)
                    .attr('y2', y2);
            });
            
            // Update nodes
            this.node
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });
        
        // Center the graph initially
        setTimeout(() => {
            this.centerGraph();
        }, 1000);
        
        // Re-highlight selected clergy after visualization loads
        if (window.currentSelectedClergyId) {
            setTimeout(() => {
                this.highlightNode(window.currentSelectedClergyId);
            }, 1500);
        }
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
        this.highlightNode(d.id);
    }
    
    // Method to highlight a node by ID
    highlightNode(nodeId) {
        if (!this.node || !this.isInitialized) return;
        
        const outerRadius = window.OUTER_RADIUS || OUTER_RADIUS || 30; // Fallback to 30 if not defined
        
        // Clear all highlights first
        this.node.selectAll('circle').each(function(d) {
            const circle = d3.select(this);
            // Reset outer circle (first circle is outer)
            const r = parseFloat(circle.attr('r'));
            if (Math.abs(r - outerRadius) < 1) { // Allow small floating point differences
                circle.attr('stroke-width', 3).attr('stroke', d => d.rank_color);
            }
        });
        
        // Highlight the selected node
        this.node.filter(d => d.id === nodeId).selectAll('circle').each(function(d) {
            const circle = d3.select(this);
            // Highlight outer circle
            const r = parseFloat(circle.attr('r'));
            if (Math.abs(r - outerRadius) < 1) { // Allow small floating point differences
                circle.attr('stroke-width', 6).attr('stroke', '#ffd700');
            }
        });
    }
    
    // Method to clear all highlights
    clearHighlights() {
        if (!this.node || !this.isInitialized) return;
        
        const outerRadius = window.OUTER_RADIUS || OUTER_RADIUS || 30; // Fallback to 30 if not defined
        
        this.node.selectAll('circle').each(function(d) {
            const circle = d3.select(this);
            const r = parseFloat(circle.attr('r'));
            if (Math.abs(r - outerRadius) < 1) { // Allow small floating point differences
                circle.attr('stroke-width', 3).attr('stroke', d => d.rank_color);
            }
        });
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

    updateSpritesheet(spriteData) {
        /** Update spritesheet without full reload */
        if (!this.svg || !spriteData || !spriteData.success) {
            console.warn('Cannot update spritesheet: invalid data or SVG not initialized');
            return;
        }
        
        console.log('Updating spritesheet:', spriteData.url);
        
        // Store updated spriteSheetData
        this.spriteSheetData = spriteData;
        
        const spriteUrl = spriteData.url;
        const mapping = spriteData.mapping || {};
        const IMAGE_SIZE = window.IMAGE_SIZE || 48;
        
        // Update all image elements that use the spritesheet
        // The images are appended to this.node, so we select from there
        const imageElements = this.node.selectAll('image');
        
        imageElements.each(function(d) {
            const position = mapping[d.id] || mapping[String(d.id)] || mapping[Number(d.id)];
            if (position && Array.isArray(position) && position.length === 2) {
                const [x, y] = position;
                const img = d3.select(this);
                
                // Update sprite sheet URL (use xlink:href for older browsers, href for newer)
                img.attr('href', spriteUrl)
                   .attr('xlink:href', spriteUrl);
                
                // Update image position in sprite sheet (centered at node)
                img.attr('x', -x - IMAGE_SIZE/2)
                   .attr('y', -y - IMAGE_SIZE/2);
                
                // Update sprite sheet dimensions
                img.attr('width', spriteData.sprite_width || 960)
                   .attr('height', spriteData.sprite_height || 960);
            }
        });
        
        console.log('Spritesheet updated successfully');
    }
    
    updateData(nodesData, linksData) {
        /** Soft refresh: update visualization data without full reload */
        if (!this.isInitialized || !this.svg || !this.simulation) {
            console.warn('Cannot update data: visualization not initialized');
            return;
        }
        
        console.log('Soft refresh: updating data with', nodesData.length, 'nodes,', linksData.length, 'links');
        
        // Store new data
        this.nodesData = nodesData;
        this.linksData = linksData;
        
        // Process parallel links
        this.processParallelLinks();
        
        // Update simulation with new data
        this.simulation.nodes(this.nodesData);
        
        // Update link force with new links
        this.simulation.force('link', d3.forceLink(this.linksData).id(d => d.id).distance(80));
        
        // Update existing links using D3 data binding
        this.link = this.link.data(this.linksData, d => `${d.source.id}-${d.target.id}-${d.type}`);
        
        // Remove old links
        this.link.exit().remove();
        
        // Read CSS variables for link colors (may have changed since initialization)
        const rootStyles = getComputedStyle(document.documentElement);
        const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim() || BLACK_COLOR;
        const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
        
        // Add new links
        const newLinks = this.link.enter().append('line')
            .attr('stroke', d => {
                // Use CSS variables based on link type instead of d.color
                if (d.type === 'ordination') {
                    return cssLinkOrdinationColor;
                } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                    return cssLinkConsecrationColor;
                }
                return cssLinkConsecrationColor;
            })
            .attr('stroke-width', parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width')) || 2)
            .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
            .attr('marker-end', d => {
                // Use link type to determine arrow marker
                if (d.type === 'ordination') {
                    return 'url(#arrowhead-black)';
                } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                    return 'url(#arrowhead-green)';
                }
                return 'url(#arrowhead-green)';
            });
        
        // Merge new links with existing
        this.link = this.link.merge(newLinks);
        
        // Update existing nodes using D3 data binding
        this.node = this.node.data(this.nodesData, d => d.id);
        
        // Remove old nodes
        this.node.exit().remove();
        
        // Add new nodes
        const newNodeGroups = this.node.enter().append('g')
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)))
            .on('click', (event, d) => this.handleNodeClick(event, d));
        
        // Add circles and labels to new nodes
        newNodeGroups.append('circle')
            .attr('r', OUTER_RADIUS)
            .attr('fill', d => d.org_color)
            .attr('stroke', d => d.rank_color)
            .attr('stroke-width', 3);
        
        newNodeGroups.append('circle')
            .attr('r', INNER_RADIUS)
            .attr('fill', d => d.rank_color)
            .attr('cx', 0)
            .attr('cy', 0);
        
        const bgCircle = newNodeGroups.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0);
        
        const borderCircle = newNodeGroups.append('circle')
            .attr('r', IMAGE_SIZE/2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0);
        
        // Add images (simplified - assumes sprite sheet is already loaded)
        if (this.spriteSheetData && this.spriteSheetData.success) {
            newNodeGroups.append('image')
                .attr('xlink:href', d => {
                    if (this.spriteSheetData.mapping) {
                        const position = this.spriteSheetData.mapping[d.id] || 
                                       this.spriteSheetData.mapping[String(d.id)] || 
                                       this.spriteSheetData.mapping[Number(d.id)];
                        if (position && Array.isArray(position) && position.length === 2) {
                            return this.spriteSheetData.url;
                        }
                    }
                    return '';
                })
                .attr('x', d => {
                    if (this.spriteSheetData.mapping) {
                        const position = this.spriteSheetData.mapping[d.id] || 
                                       this.spriteSheetData.mapping[String(d.id)] || 
                                       this.spriteSheetData.mapping[Number(d.id)];
                        if (position && Array.isArray(position) && position.length === 2) {
                            const [x] = position;
                            return -x - IMAGE_SIZE/2;
                        }
                    }
                    return 0;
                })
                .attr('y', d => {
                    if (this.spriteSheetData.mapping) {
                        const position = this.spriteSheetData.mapping[d.id] || 
                                       this.spriteSheetData.mapping[String(d.id)] || 
                                       this.spriteSheetData.mapping[Number(d.id)];
                        if (position && Array.isArray(position) && position.length === 2) {
                            const [, y] = position;
                            return -y - IMAGE_SIZE/2;
                        }
                    }
                    return 0;
                })
                .attr('width', this.spriteSheetData.sprite_width)
                .attr('height', this.spriteSheetData.sprite_height)
                .attr('clip-path', d => {
                    if (this.spriteSheetData.mapping) {
                        const position = this.spriteSheetData.mapping[d.id] || 
                                       this.spriteSheetData.mapping[String(d.id)] || 
                                       this.spriteSheetData.mapping[Number(d.id)];
                        if (position && Array.isArray(position) && position.length === 2) {
                            return `url(#clip-avatar-${d.id})`;
                        }
                    }
                    return 'none';
                })
                .attr('preserveAspectRatio', 'none')
                .style('pointer-events', 'none')
                .style('opacity', d => {
                    if (this.spriteSheetData.mapping) {
                        const position = this.spriteSheetData.mapping[d.id] || 
                                       this.spriteSheetData.mapping[String(d.id)] || 
                                       this.spriteSheetData.mapping[Number(d.id)];
                        if (position && Array.isArray(position) && position.length === 2) {
                            bgCircle.filter(node => node.id === d.id).style('opacity', 1);
                            borderCircle.filter(node => node.id === d.id).style('opacity', 1);
                            return 1;
                        }
                    }
                    return 0;
                });
        }
        
        newNodeGroups.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .style('pointer-events', 'none')
            .style('opacity', d => d.image_url ? 0 : 1)
            .text('👤');
        
        newNodeGroups.append('text')
            .attr('class', 'viz-node-label')
            .attr('dy', this.labelDy || LABEL_DY)
            .text(d => d.name);
        
        newNodeGroups.append('title')
            .text(d => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`);
        
        // Merge new nodes with existing
        this.node = this.node.merge(newNodeGroups);
        
        // Restart simulation with new data
        this.simulation.alpha(1).restart();
        
        // Re-highlight selected clergy if any
        if (window.currentSelectedClergyId) {
            setTimeout(() => {
                this.highlightNode(window.currentSelectedClergyId);
            }, 500);
        }
        
        console.log('Soft refresh completed');
    }
    
    applyStyles(styles) {
        /** Apply style preferences to visualization without full reload */
        if (!this.isInitialized || !this.svg || !this.node || !this.link) {
            console.warn('Cannot apply styles: visualization not initialized');
            return;
        }
        
        if (!styles) {
            console.warn('Cannot apply styles: no styles provided');
            return;
        }
        
        console.log('Applying styles to visualization:', styles);
        
        // Update node styles
        if (styles.node) {
            const nodeStyles = styles.node;
            
            // Update outer radius
            if (nodeStyles.outer_radius !== undefined) {
                window.OUTER_RADIUS = nodeStyles.outer_radius;
                this.node.selectAll('circle')
                    .filter(function(d, i) {
                        // First circle is outer circle
                        return i === 0;
                    })
                    .attr('r', nodeStyles.outer_radius);
            }
            
            // Update inner radius
            if (nodeStyles.inner_radius !== undefined) {
                window.INNER_RADIUS = nodeStyles.inner_radius;
                this.node.selectAll('circle')
                    .filter(function(d, i) {
                        // Second circle is inner circle
                        return i === 1;
                    })
                    .attr('r', nodeStyles.inner_radius);
            }
            
            // Update image size
            if (nodeStyles.image_size !== undefined) {
                window.IMAGE_SIZE = nodeStyles.image_size;
                const imageRadius = nodeStyles.image_size / 2;
                this.node.selectAll('circle')
                    .filter(function(d, i) {
                        // Third and fourth circles are image background and border
                        return i === 2 || i === 3;
                    })
                    .attr('r', imageRadius);
                
                // Update clip paths
                const defs = this.svg.select('defs');
                defs.selectAll('clipPath').selectAll('circle')
                    .attr('r', imageRadius);
            }
            
            // Update stroke width
            if (nodeStyles.stroke_width !== undefined) {
                this.node.selectAll('circle')
                    .filter(function(d, i) {
                        return i === 0; // Outer circle
                    })
                    .attr('stroke-width', nodeStyles.stroke_width);
            }
            
            // Note: Organization and rank colors come from metadata (ranks/organizations),
            // not from style settings, so we don't update them here
        }
        
        // Update link styles - read from CSS variables for consistency
        const rootStyles = getComputedStyle(document.documentElement);
        const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim();
        const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim();
        const cssLinkStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width'));
        const cssArrowOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-ordination-color').trim() || cssLinkOrdinationColor;
        const cssArrowConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-consecration-color').trim() || cssLinkConsecrationColor;
        
        if (styles.link) {
            const linkStyles = styles.link;
            
            // Update link colors from CSS variables
            if (cssLinkOrdinationColor || cssLinkConsecrationColor) {
                this.link.attr('stroke', d => {
                    if (d.type === 'ordination') {
                        return cssLinkOrdinationColor || linkStyles.ordination_color || BLACK_COLOR;
                    } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                        return cssLinkConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                    }
                    return cssLinkConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                });
                
                // Update arrow markers from CSS variables
                const defs = this.svg.select('defs');
                defs.selectAll('marker')
                    .selectAll('path')
                    .attr('fill', function() {
                        const markerId = d3.select(this.parentNode).attr('id');
                        if (markerId === 'arrowhead-black') {
                            return cssArrowOrdinationColor || linkStyles.ordination_color || BLACK_COLOR;
                        } else if (markerId === 'arrowhead-green') {
                            return cssArrowConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                        }
                        return GREEN_COLOR;
                    });
            }
            
            // Update link stroke width from CSS variable
            if (cssLinkStrokeWidth) {
                this.link.attr('stroke-width', cssLinkStrokeWidth);
            } else if (linkStyles.stroke_width !== undefined) {
                this.link.attr('stroke-width', linkStyles.stroke_width);
            }
        }
        
        // Update label styles
        if (styles.label) {
            const labelStyles = styles.label;
            
            // Update font size
            if (labelStyles.font_size !== undefined) {
                window.LABEL_DY = labelStyles.dy || window.LABEL_DY || 35;
                this.node.selectAll('text')
                    .filter(function(d, i, nodes) {
                        // Labels are the second text element (first is placeholder emoji)
                        const parent = d3.select(this.parentNode);
                        const texts = parent.selectAll('text');
                        return texts.nodes().indexOf(this) === 1;
                    })
                    .style('font-size', labelStyles.font_size + 'px');
            }
            
            // Update text color
            if (labelStyles.color) {
                this.node.selectAll('text')
                    .filter(function(d, i, nodes) {
                        // Labels are the second text element
                        const parent = d3.select(this.parentNode);
                        const texts = parent.selectAll('text');
                        return texts.nodes().indexOf(this) === 1;
                    })
                    .style('fill', labelStyles.color);
            }
            
            // Update vertical offset
            if (labelStyles.dy !== undefined) {
                window.LABEL_DY = labelStyles.dy;
                this.node.selectAll('text')
                    .filter(function(d, i, nodes) {
                        // Labels are the second text element
                        const parent = d3.select(this.parentNode);
                        const texts = parent.selectAll('text');
                        return texts.nodes().indexOf(this) === 1;
                    })
                    .attr('dy', labelStyles.dy);
            }
        }
        
        console.log('Styles applied successfully');
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
    
    // Guard against double initialization
    if (window.editorVisualization && window.editorVisualization.isInitialized) {
        console.log('Visualization already initialized, skipping...');
        return;
    }
    
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
