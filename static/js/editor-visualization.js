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
var RED_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-red')?.trim();
var ORANGE_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-orange')?.trim();

// If CSS variables aren't set yet (race condition), use hardcoded fallback
// These should match constants.js
if (!GREEN_COLOR) GREEN_COLOR = '#11451e';
if (!BLACK_COLOR) BLACK_COLOR = '#1c1c1c';
if (!RED_COLOR) RED_COLOR = '#e74c3c';
if (!ORANGE_COLOR) ORANGE_COLOR = '#f39c12';

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

    parseYearFromDate(dateValue) {
        if (!dateValue) return null;
        const year = parseInt(String(dateValue).slice(0, 4), 10);
        return Number.isFinite(year) ? year : null;
    }

    shouldMarkPre1968Consecrator(node, consecratorIds) {
        if (!node || !consecratorIds || !consecratorIds.has(node.id)) return false;
        if (node.consecration_date) return false;
        if (node.rank && !this.isBishopRank(node.rank)) return false;
        return true;
    }

    updatePre1968Flags() {
        const PRE_1968_CONSECRATION_YEAR = 1968;
        const pre1968ConsecrationTargets = new Set();
        const pre1968SponsorBishops = new Set();
        if (Array.isArray(this.linksData)) {
            this.linksData.forEach(link => {
                const year = this.parseYearFromDate(link.date);
                if (year === null || year >= PRE_1968_CONSECRATION_YEAR) return;
                if (link && (link.type === 'consecration' || link.type === 'co-consecration')) {
                    const targetId = typeof link.target === 'object' && link.target ? link.target.id : link.target;
                    if (targetId !== undefined && targetId !== null) {
                        pre1968ConsecrationTargets.add(targetId);
                    }
                    const sourceId = typeof link.source === 'object' && link.source ? link.source.id : link.source;
                    if (sourceId !== undefined && sourceId !== null) {
                        pre1968SponsorBishops.add(sourceId);
                    }
                    return;
                }

                if (link && link.type === 'ordination') {
                    const sourceId = typeof link.source === 'object' && link.source ? link.source.id : link.source;
                    if (sourceId !== undefined && sourceId !== null) {
                        pre1968SponsorBishops.add(sourceId);
                    }
                }
            });
        }

        if (Array.isArray(this.nodesData)) {
            this.nodesData.forEach(node => {
                const consecrationYear = this.parseYearFromDate(node.consecration_date);
                node.is_pre_1968_consecration = consecrationYear !== null
                    ? consecrationYear < PRE_1968_CONSECRATION_YEAR
                    : pre1968ConsecrationTargets.has(node.id) ||
                      this.shouldMarkPre1968Consecrator(node, pre1968SponsorBishops);
            });
        }
    }

    init(nodesData, linksData) {
        this.nodesData = nodesData;
        this.linksData = linksData;
        this.updatePre1968Flags();
        
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
        // Use same physics parameters as main visualization (SIMULATION_CONFIG)
        const LINK_DISTANCE = 150;
        const CHARGE_STRENGTH = -300;
        const CENTER_STRENGTH = 0.5;
        const COLLISION_RADIUS_VALUE = COLLISION_RADIUS;
        const RADIAL_RADIUS = 150;
        const RADIAL_STRENGTH = 0.1;
        const ALPHA_DECAY = 0.10;
        const VELOCITY_DECAY = 0.2;
        
        this.simulation = d3.forceSimulation(this.nodesData)
            .force('link', d3.forceLink(this.linksData).id(d => d.id).distance(LINK_DISTANCE))
            .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
            .force('center', d3.forceCenter(width / 2, height / 2).strength(CENTER_STRENGTH))
            .force('collision', d3.forceCollide().radius(COLLISION_RADIUS_VALUE))
            .force('radial', d3.forceRadial(RADIAL_RADIUS, width / 2, height / 2).strength(RADIAL_STRENGTH))
            .alphaDecay(ALPHA_DECAY)
            .velocityDecay(VELOCITY_DECAY);

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
        const cssLinkInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-link-invalid-ordination-color').trim() || ORANGE_COLOR;
        const cssLinkInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-link-invalid-consecration-color').trim() || RED_COLOR;
        const cssArrowOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-ordination-color').trim() || cssLinkOrdinationColor;
        const cssArrowConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-consecration-color').trim() || cssLinkConsecrationColor;
        const cssArrowInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-invalid-ordination-color').trim() || cssLinkInvalidOrdinationColor;
        const cssArrowInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-invalid-consecration-color').trim() || cssLinkInvalidConsecrationColor;
        const cssSurfaceColor = rootStyles.getPropertyValue('--viz-surface').trim() || '#1a1a1a';
        
        // Store colors for use in link rendering
        this.cssLinkOrdinationColor = cssLinkOrdinationColor;
        this.cssLinkConsecrationColor = cssLinkConsecrationColor;
        this.cssLinkInvalidOrdinationColor = cssLinkInvalidOrdinationColor;
        this.cssLinkInvalidConsecrationColor = cssLinkInvalidConsecrationColor;
        this.cssSurfaceColor = cssSurfaceColor;
        
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

        // Load sprite sheet and create patterns (using cache)
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
            // Store spriteSheetData in instance for later updates
            if (spriteSheetData) {
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
                            // Create a clipPath for the node image (square for pre-1968 consecrations)
                            const clipId = `clip-avatar-${d.id}`;
                            const clipPath = defs.append('clipPath')
                                .attr('id', clipId);
                            if (d.is_pre_1968_consecration) {
                                clipPath.append('rect')
                                    .attr('width', IMAGE_SIZE)
                                    .attr('height', IMAGE_SIZE)
                                    .attr('x', -IMAGE_SIZE / 2)
                                    .attr('y', -IMAGE_SIZE / 2);
                            } else {
                                clipPath.append('circle')
                                    .attr('r', IMAGE_SIZE / 2)
                                    .attr('cx', 0)
                                    .attr('cy', 0);
                            }
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

        // Helper function to determine link status from flags
        this.getLinkStatus = function(d) {
            // Priority order: invalid > doubtfully_valid > doubtful_event > sub_conditione > valid
            // Handle backward compatibility with old is_doubtful field
            if (d.is_invalid) return 'invalid';
            if (d.is_doubtfully_valid || d.is_doubtful) return 'doubtfully_valid';
            if (d.is_doubtful_event) return 'doubtful_event';
            if (d.is_sub_conditione) return 'sub_conditione';
            return 'valid';
        };

        // Helper function to get status icon symbol
        this.getStatusIcon = function(status) {
            switch (status) {
                case 'invalid': return '✕';
                case 'doubtfully_valid': return '?';
                case 'doubtful_event': return '~';
                case 'sub_conditione': return 'SC';
                default: return null; // No icon for valid
            }
        };

        // Helper function to get status icon color based on color theory
        this.getStatusIconColor = function(status) {
            switch (status) {
                case 'invalid': return '#e74c3c'; // Red - danger, invalid
                case 'doubtfully_valid': return '#f39c12'; // Orange - caution, warning
                case 'doubtful_event': return '#e67e22'; // Dark orange - uncertainty, questionable
                case 'sub_conditione': return '#3498db'; // Blue - conditional, provisional
                default: return '#ffffff'; // White fallback
            }
        };

        // Overlay links (visible, edge-to-edge with arrowheads)
        this.linkOverlay = this.g.append('g')
            .attr('class', 'viz-links-overlay')
            .selectAll('line')
            .data(this.linksData)
            .enter().append('line')
            .attr('class', d => {
                let classes = 'viz-link';
                if (d.dashed || d.is_doubtfully_valid || d.is_doubtful) classes += ' dashed';
                return classes;
            })
            .attr('stroke', d => {
                // Always use normal link colors (green/grey) regardless of status
                // Status is indicated by icon color, not link color
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
                // Use is_doubtfully_valid for new data, is_doubtful for backward compatibility
                if (d.is_doubtfully_valid || d.is_doubtful || d.dashed) {
                    return '5,5';
                }
                return 'none';
            })
            .attr('marker-end', d => {
                // Always use normal arrow markers (black/green) regardless of status
                // Status is indicated by icon color, not arrow color
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

        // Create status icon layer (rendered after links, before nodes)
        this.linkStatusIcons = this.g.append('g')
            .attr('class', 'viz-link-status-icons')
            .selectAll('g')
            .data(this.linksData.filter(d => this.getLinkStatus(d) !== 'valid'))
            .enter().append('g')
            .attr('class', d => `viz-link-status-icon-group status-${this.getLinkStatus(d)}`)
            .style('pointer-events', 'none')
            .style('opacity', d => d.filtered ? 0 : 1);

        // Add background circle for halo effect
        this.linkStatusIcons.append('circle')
            .attr('r', 10)
            .attr('fill', this.cssSurfaceColor) // Background color from CSS variable
            .attr('opacity', 0.85);

        // Add text icon
        this.linkStatusIcons.append('text')
            .attr('class', d => `viz-link-status-icon status-${this.getLinkStatus(d)}`)
            .text(d => this.getStatusIcon(this.getLinkStatus(d)))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', d => this.getStatusIconColor(this.getLinkStatus(d)))
            .attr('stroke', this.cssSurfaceColor)
            .attr('stroke-width', '1px')
            .attr('paint-order', 'stroke');
        
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
            .on('click', (event, d) => {
                // Prevent drag from interfering with click
                event.stopPropagation();
                this.handleNodeClick(event, d);
            });

        // Add node shapes (circle or square based on consecration year)
        this.node.append('circle')
            .attr('class', 'viz-node-outer viz-node-outer-circle')
            .attr('r', OUTER_RADIUS)
            .attr('fill', d => d.org_color)
            .attr('stroke', d => d.rank_color)
            .attr('stroke-width', 3)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);

        this.node.append('rect')
            .attr('class', 'viz-node-outer viz-node-outer-rect')
            .attr('width', OUTER_RADIUS * 2)
            .attr('height', OUTER_RADIUS * 2)
            .attr('x', -OUTER_RADIUS)
            .attr('y', -OUTER_RADIUS)
            .attr('fill', d => d.org_color)
            .attr('stroke', d => d.rank_color)
            .attr('stroke-width', 3)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');

        // Add rank indicator
        this.node.append('circle')
            .attr('class', 'viz-node-inner viz-node-inner-circle')
            .attr('r', INNER_RADIUS)
            .attr('fill', d => d.rank_color)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);

        this.node.append('rect')
            .attr('class', 'viz-node-inner viz-node-inner-rect')
            .attr('width', INNER_RADIUS * 2)
            .attr('height', INNER_RADIUS * 2)
            .attr('x', -INNER_RADIUS)
            .attr('y', -INNER_RADIUS)
            .attr('fill', d => d.rank_color)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');

        // Add white background shape for images (will be updated after sprite sheet loads)
        this.node.append('circle')
            .attr('class', 'viz-node-image-bg viz-node-image-bg-circle')
            .attr('r', IMAGE_SIZE / 2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);

        this.node.append('rect')
            .attr('class', 'viz-node-image-bg viz-node-image-bg-rect')
            .attr('width', IMAGE_SIZE)
            .attr('height', IMAGE_SIZE)
            .attr('x', -IMAGE_SIZE / 2)
            .attr('y', -IMAGE_SIZE / 2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');

        // Add border shape for images (will be updated after sprite sheet loads)
        this.node.append('circle')
            .attr('class', 'viz-node-image-border viz-node-image-border-circle')
            .attr('r', IMAGE_SIZE / 2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);

        this.node.append('rect')
            .attr('class', 'viz-node-image-border viz-node-image-border-rect')
            .attr('width', IMAGE_SIZE)
            .attr('height', IMAGE_SIZE)
            .attr('x', -IMAGE_SIZE / 2)
            .attr('y', -IMAGE_SIZE / 2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');

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
                            this.node.filter(node => node.id === d.id)
                                .selectAll('.viz-node-image-bg')
                                .style('opacity', 1);
                            this.node.filter(node => node.id === d.id)
                                .selectAll('.viz-node-image-border')
                                .style('opacity', 1);
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
                .attr('clip-path', d => d.is_pre_1968_consecration
                    ? 'none'
                    : `circle(${IMAGE_SIZE / 2}px at ${IMAGE_SIZE / 2}px ${IMAGE_SIZE / 2}px)`)
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

            // Update status icons at link midpoints
            if (this.linkStatusIcons) {
                this.linkStatusIcons.each(function(d) {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist === 0) {
                        // Nodes at same position, hide icon
                        d3.select(this)
                            .attr('transform', `translate(${d.source.x},${d.source.y})`)
                            .style('opacity', 0);
                        return;
                    }
                    
                    // Unit vector along link direction
                    const ux = dx / dist;
                    const uy = dy / dist;
                    
                    // Perpendicular vector for parallel offset (rotate 90 degrees)
                    const px = -uy;
                    const py = ux;
                    
                    const offset = d.parallelOffset || 0;
                    
                    // Calculate midpoint along the visible link (between edge-to-edge points)
                    const x1 = d.source.x + ux * nodeEdgeRadius + offset * px;
                    const y1 = d.source.y + uy * nodeEdgeRadius + offset * py;
                    const x2 = d.target.x - ux * (nodeEdgeRadius + cssLinkGap + arrowLengthPx) + offset * px;
                    const y2 = d.target.y - uy * (nodeEdgeRadius + cssLinkGap + arrowLengthPx) + offset * py;
                    
                    // Midpoint (centered on link, no offset)
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    
                    d3.select(this)
                        .attr('transform', `translate(${midX},${midY})`)
                        .style('opacity', d.filtered ? 0 : 1);
                });
            }
            
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
        
        // Apply any saved styles after visualization is initialized
        if (window.vizStyleController && typeof window.vizStyleController.getStyles === 'function') {
            setTimeout(() => {
                const styles = window.vizStyleController.getStyles();
                if (styles && this.isInitialized) {
                    this.applyStyles(styles);
                }
            }, 500);
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
        
        // Update simulation center and radial forces to match new container size
        const RADIAL_RADIUS = 150;
        const RADIAL_STRENGTH = 0.1;
        this.simulation
            .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
            .force('radial', d3.forceRadial(RADIAL_RADIUS, newWidth / 2, newHeight / 2).strength(RADIAL_STRENGTH))
            .alpha(0.3)
            .restart();
    }

    centerGraph() {
        if (!this.svg || !this.g || !this.simulation) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // For force layout, restart simulation with center and radial forces
        const RADIAL_RADIUS = 150;
        const RADIAL_STRENGTH = 0.1;
        this.simulation
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('radial', d3.forceRadial(RADIAL_RADIUS, width / 2, height / 2).strength(RADIAL_STRENGTH));
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
        // Prevent event propagation if event exists and has stopPropagation
        // D3 events don't have stopPropagation, so check if it's a native event
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        
        // Select clergy when clicked
        if (typeof window.selectClergy === 'function') {
            console.log('Visualization node clicked, selecting clergy:', d.id);
            window.selectClergy(d.id);
        } else {
            console.warn('window.selectClergy not available, falling back to direct HTMX');
            // Fallback: load form content directly
            if (d && d.id) {
                const rightPanelContent = document.querySelector('.right-panel .panel-content');
                if (rightPanelContent) {
                    htmx.ajax('GET', `/editor/clergy-form-content/${d.id}`, {
                        target: rightPanelContent,
                        swap: 'innerHTML'
                    }).then(() => {
                        // Update selected clergy ID
                        window.currentSelectedClergyId = d.id;
                        // Clear form state after load
                        if (typeof window.clearGlobalFormState === 'function') {
                            window.clearGlobalFormState();
                        }
                        // Highlight in visualization
                        this.highlightNode(d.id);
                    }).catch(error => {
                        console.error('Error loading form:', error);
                    });
                }
            }
        }
        
        // Highlight selected node - matching lineage visualization
        this.highlightNode(d.id);
    }
    
    // Method to highlight a node by ID
    highlightNode(nodeId) {
        if (!this.node || !this.isInitialized) return;
        
        // Clear all highlights first
        this.node.each(function(d) {
            const outerShape = d3.select(this).select(d.is_pre_1968_consecration
                ? '.viz-node-outer-rect'
                : '.viz-node-outer-circle');
            if (!outerShape.empty()) {
                outerShape.attr('stroke-width', 3).attr('stroke', d.rank_color);
            }
        });
        
        // Highlight the selected node
        this.node.filter(d => d.id === nodeId).each(function(d) {
            const outerShape = d3.select(this).select(d.is_pre_1968_consecration
                ? '.viz-node-outer-rect'
                : '.viz-node-outer-circle');
            if (!outerShape.empty()) {
                outerShape.attr('stroke-width', 6).attr('stroke', '#ffd700');
            }
        });
    }
    
    // Method to clear all highlights
    clearHighlights() {
        if (!this.node || !this.isInitialized) return;
        
        this.node.each(function(d) {
            const outerShape = d3.select(this).select(d.is_pre_1968_consecration
                ? '.viz-node-outer-rect'
                : '.viz-node-outer-circle');
            if (!outerShape.empty()) {
                outerShape.attr('stroke-width', 3).attr('stroke', d.rank_color);
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
        
        // Invalidate cache since we have new sprite data
        if (typeof window.invalidateSpriteSheetCache === 'function') {
            window.invalidateSpriteSheetCache();
        }
        
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
        
        // Process parallel links on the raw links data before resolving nodes
        // Create a copy to avoid mutating the original
        const processedLinksData = linksData.map(link => ({ ...link }));
        
        // Process parallel links
        const linkGroups = {};
        processedLinksData.forEach(link => {
            let sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            let targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const key = `${sourceId}-${targetId}`;
            if (!linkGroups[key]) {
                linkGroups[key] = [];
            }
            linkGroups[key].push(link);
        });
        
        Object.values(linkGroups).forEach(group => {
            if (group.length > 1) {
                const offset = 8;
                const totalOffset = (group.length - 1) * offset / 2;
                group.forEach((link, index) => {
                    link.parallelOffset = (index * offset) - totalOffset;
                });
            }
        });
        
        // Clear any fixed positions from nodes to allow them to reposition
        this.nodesData.forEach(node => {
            if (node.fx !== undefined) delete node.fx;
            if (node.fy !== undefined) delete node.fy;
        });
        
        // Use same physics parameters as main visualization
        const LINK_DISTANCE = 150;
        const CHARGE_STRENGTH = -300;
        const CENTER_STRENGTH = 0.5;
        const COLLISION_RADIUS_VALUE = COLLISION_RADIUS;
        const RADIAL_RADIUS = 150;
        const RADIAL_STRENGTH = 0.1;
        
        // Update simulation with new nodes FIRST
        // This ensures simulation has the latest node objects
        this.simulation.nodes(this.nodesData);
        
        // Get the actual node objects from the simulation (these are the objects that will have x/y updated)
        const simulationNodes = this.simulation.nodes();
        
        if (!Array.isArray(simulationNodes)) {
            console.error('simulation.nodes() did not return an array:', simulationNodes);
            return;
        }
        
        // Create a map of node IDs to the actual simulation node objects
        const nodeMap = new Map(simulationNodes.map(d => [d.id, d]));
        
        // CRITICAL: Create a completely fresh links array with new objects that reference simulation nodes
        // This ensures links always reference the simulation's node objects, not copies or stale references
        this.linksData = processedLinksData.map(link => {
            // Extract source/target IDs
            let sourceId = typeof link.source === 'object' && link.source.id ? link.source.id : link.source;
            let targetId = typeof link.target === 'object' && link.target.id ? link.target.id : link.target;
            
            // Get simulation node objects
            const sourceNode = nodeMap.get(sourceId);
            const targetNode = nodeMap.get(targetId);
            
            if (!sourceNode) {
                console.warn('Could not resolve source node for link:', sourceId);
            }
            if (!targetNode) {
                console.warn('Could not resolve target node for link:', targetId);
            }
            
            // Create a new link object with all properties, but source/target reference simulation nodes
            return {
                ...link,
                source: sourceNode || link.source,
                target: targetNode || link.target
            };
        });

        this.updatePre1968Flags();
        
        // Update link force with the fresh links array - this ensures the force uses correct node references
        this.simulation
            .force('link', d3.forceLink(this.linksData).id(d => d.id).distance(LINK_DISTANCE))
            .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
            .force('collision', d3.forceCollide().radius(COLLISION_RADIUS_VALUE))
            .force('radial', d3.forceRadial(RADIAL_RADIUS, this.container.clientWidth / 2, this.container.clientHeight / 2).strength(RADIAL_STRENGTH));
        
        // Update bishop repulsion if needed
        const bishopNodes = this.nodesData.filter(n => n.rank && this.isBishopRank(n.rank));
        if (bishopNodes.length > 0) {
            this.simulation.force('bishop-repulsion', d3.forceManyBody().strength(-800));
        } else {
            this.simulation.force('bishop-repulsion', null);
        }
        
        // Update base links (transparent, for force layout)
        // Key function uses node IDs to match links
        const linkKey = d => `${typeof d.source === 'object' ? d.source.id : d.source}-${typeof d.target === 'object' ? d.target.id : d.target}-${d.type || ''}`;
        
        // Bind fresh links array to base links
        this.linkBase = this.linkBase.data(this.linksData, linkKey);
        this.linkBase.exit().remove();
        const newLinkBase = this.linkBase.enter().append('line')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none');
        this.linkBase = this.linkBase.merge(newLinkBase);
        
        // Update overlay links (visible, edge-to-edge with arrowheads)
        const rootStyles = getComputedStyle(document.documentElement);
        const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim() || BLACK_COLOR;
        const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim() || GREEN_COLOR;
        const cssLinkInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-link-invalid-ordination-color').trim() || ORANGE_COLOR;
        const cssLinkInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-link-invalid-consecration-color').trim() || RED_COLOR;
        const cssLinkStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width')) || 2;
        const cssSurfaceColor = rootStyles.getPropertyValue('--viz-surface').trim() || '#1a1a1a';
        
        // Bind the same fresh links array to overlay links
        this.linkOverlay = this.linkOverlay.data(this.linksData, linkKey);
        this.linkOverlay.exit().remove();
        const newLinkOverlay = this.linkOverlay.enter().append('line')
            .attr('class', d => {
                let classes = 'viz-link';
                if (d.dashed || d.is_doubtfully_valid || d.is_doubtful) classes += ' dashed';
                return classes;
            })
            .attr('stroke', d => {
                // Always use normal link colors (green/grey) regardless of status
                // Status is indicated by icon color, not link color
                if (d.type === 'ordination') {
                    return cssLinkOrdinationColor;
                } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                    return cssLinkConsecrationColor;
                }
                return cssLinkConsecrationColor;
            })
            .attr('stroke-width', cssLinkStrokeWidth)
            .attr('stroke-dasharray', d => {
                // Use is_doubtfully_valid for new data, is_doubtful for backward compatibility
                if (d.is_doubtfully_valid || d.is_doubtful || d.dashed) {
                    return '5,5';
                }
                return 'none';
            })
            .attr('marker-end', d => {
                // Always use normal arrow markers (black/green) regardless of status
                // Status is indicated by icon color, not arrow color
                if (d.type === 'ordination') {
                    return 'url(#arrowhead-black)';
                } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                    return 'url(#arrowhead-green)';
                }
                return 'url(#arrowhead-green)';
            });
        this.linkOverlay = this.linkOverlay.merge(newLinkOverlay);

        // Update status icons
        if (this.linkStatusIcons) {
            const statusLinks = this.linksData.filter(d => this.getLinkStatus(d) !== 'valid');
            this.linkStatusIcons = this.linkStatusIcons.data(statusLinks, linkKey);
            this.linkStatusIcons.exit().remove();
            const newStatusIconGroups = this.linkStatusIcons.enter().append('g')
                .attr('class', d => `viz-link-status-icon-group status-${this.getLinkStatus(d)}`)
                .style('pointer-events', 'none')
                .style('opacity', d => d.filtered ? 0 : 1);

            // Add background circle for halo effect
            newStatusIconGroups.append('circle')
                .attr('r', 10)
                .attr('fill', rootStyles.getPropertyValue('--viz-surface').trim() || '#1a1a1a') // Background color from CSS variable
                .attr('opacity', 0.85);

            // Add text icon
            newStatusIconGroups.append('text')
                .attr('class', d => `viz-link-status-icon status-${this.getLinkStatus(d)}`)
                .text(d => this.getStatusIcon(this.getLinkStatus(d)))
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '16px')
                .attr('font-weight', 'bold')
                .attr('fill', d => this.getStatusIconColor(this.getLinkStatus(d)))
                .attr('stroke', rootStyles.getPropertyValue('--viz-surface').trim() || '#1a1a1a')
                .attr('stroke-width', '1px')
                .attr('paint-order', 'stroke');
            this.linkStatusIcons = this.linkStatusIcons.merge(newStatusIconGroups);
        }
        
        // Keep reference to overlay links for compatibility
        this.link = this.linkOverlay;
        
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
            .on('click', (event, d) => {
                // Prevent drag from interfering with click
                event.stopPropagation();
                this.handleNodeClick(event, d);
            });
        
        // Add shapes to new nodes (circle or square based on consecration year)
        newNodeGroups.append('circle')
            .attr('class', 'viz-node-outer viz-node-outer-circle')
            .attr('r', OUTER_RADIUS)
            .attr('fill', d => d.org_color)
            .attr('stroke', d => d.rank_color)
            .attr('stroke-width', 3)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        
        newNodeGroups.append('rect')
            .attr('class', 'viz-node-outer viz-node-outer-rect')
            .attr('width', OUTER_RADIUS * 2)
            .attr('height', OUTER_RADIUS * 2)
            .attr('x', -OUTER_RADIUS)
            .attr('y', -OUTER_RADIUS)
            .attr('fill', d => d.org_color)
            .attr('stroke', d => d.rank_color)
            .attr('stroke-width', 3)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        
        newNodeGroups.append('circle')
            .attr('class', 'viz-node-inner viz-node-inner-circle')
            .attr('r', INNER_RADIUS)
            .attr('fill', d => d.rank_color)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        
        newNodeGroups.append('rect')
            .attr('class', 'viz-node-inner viz-node-inner-rect')
            .attr('width', INNER_RADIUS * 2)
            .attr('height', INNER_RADIUS * 2)
            .attr('x', -INNER_RADIUS)
            .attr('y', -INNER_RADIUS)
            .attr('fill', d => d.rank_color)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        
        newNodeGroups.append('circle')
            .attr('class', 'viz-node-image-bg viz-node-image-bg-circle')
            .attr('r', IMAGE_SIZE / 2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        
        newNodeGroups.append('rect')
            .attr('class', 'viz-node-image-bg viz-node-image-bg-rect')
            .attr('width', IMAGE_SIZE)
            .attr('height', IMAGE_SIZE)
            .attr('x', -IMAGE_SIZE / 2)
            .attr('y', -IMAGE_SIZE / 2)
            .attr('fill', 'rgba(255, 255, 255, 1)')
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        
        newNodeGroups.append('circle')
            .attr('class', 'viz-node-image-border viz-node-image-border-circle')
            .attr('r', IMAGE_SIZE / 2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        
        newNodeGroups.append('rect')
            .attr('class', 'viz-node-image-border viz-node-image-border-rect')
            .attr('width', IMAGE_SIZE)
            .attr('height', IMAGE_SIZE)
            .attr('x', -IMAGE_SIZE / 2)
            .attr('y', -IMAGE_SIZE / 2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 1)')
            .attr('stroke-width', '1px')
            .style('opacity', d => d.image_url ? 1 : 0)
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        
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
                            newNodeGroups.filter(node => node.id === d.id)
                                .selectAll('.viz-node-image-bg')
                                .style('opacity', 1);
                            newNodeGroups.filter(node => node.id === d.id)
                                .selectAll('.viz-node-image-border')
                                .style('opacity', 1);
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

        // Ensure node shape visibility matches consecration flags
        this.node.selectAll('.viz-node-outer-circle')
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        this.node.selectAll('.viz-node-outer-rect')
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        this.node.selectAll('.viz-node-inner-circle')
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        this.node.selectAll('.viz-node-inner-rect')
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        this.node.selectAll('.viz-node-image-bg-circle, .viz-node-image-border-circle')
            .style('display', d => d.is_pre_1968_consecration ? 'none' : null);
        this.node.selectAll('.viz-node-image-bg-rect, .viz-node-image-border-rect')
            .style('display', d => d.is_pre_1968_consecration ? null : 'none');
        
        // CRITICAL: After D3 binds data, ensure datum objects reference simulation nodes
        // D3 might create new objects when binding, so we need to fix references after binding
        // Get fresh simulation nodes to ensure we have the latest references
        const finalSimulationNodes = this.simulation.nodes();
        const finalNodeMap = new Map(finalSimulationNodes.map(d => [d.id, d]));
        
        // Fix link node references in both linkBase and linkOverlay selections
        // This ensures the datum objects bound to DOM elements reference simulation nodes
        // The tick handler reads d.source.x and d.target.x, so these MUST be simulation node objects
        this.linkBase.each(function(d) {
            const sourceId = typeof d.source === 'object' && d.source.id ? d.source.id : d.source;
            const targetId = typeof d.target === 'object' && d.target.id ? d.target.id : d.target;
            const sourceNode = finalNodeMap.get(sourceId);
            const targetNode = finalNodeMap.get(targetId);
            if (sourceNode) d.source = sourceNode;
            if (targetNode) d.target = targetNode;
        });
        
        this.linkOverlay.each(function(d) {
            const sourceId = typeof d.source === 'object' && d.source.id ? d.source.id : d.source;
            const targetId = typeof d.target === 'object' && d.target.id ? d.target.id : d.target;
            const sourceNode = finalNodeMap.get(sourceId);
            const targetNode = finalNodeMap.get(targetId);
            if (sourceNode) d.source = sourceNode;
            if (targetNode) d.target = targetNode;
        });
        
        // Restart simulation with new data - this will cause links to update via tick handler
        // The tick handler will use d.source.x and d.target.x from the simulation node objects
        // Since we've ensured all links reference simulation nodes, positions will update correctly
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
                this.node.selectAll('.viz-node-outer-circle')
                    .attr('r', nodeStyles.outer_radius);
                this.node.selectAll('.viz-node-outer-rect')
                    .attr('width', nodeStyles.outer_radius * 2)
                    .attr('height', nodeStyles.outer_radius * 2)
                    .attr('x', -nodeStyles.outer_radius)
                    .attr('y', -nodeStyles.outer_radius);
            }
            
            // Update inner radius
            if (nodeStyles.inner_radius !== undefined) {
                window.INNER_RADIUS = nodeStyles.inner_radius;
                this.node.selectAll('.viz-node-inner-circle')
                    .attr('r', nodeStyles.inner_radius);
                this.node.selectAll('.viz-node-inner-rect')
                    .attr('width', nodeStyles.inner_radius * 2)
                    .attr('height', nodeStyles.inner_radius * 2)
                    .attr('x', -nodeStyles.inner_radius)
                    .attr('y', -nodeStyles.inner_radius);
            }
            
            // Update image size
            if (nodeStyles.image_size !== undefined) {
                window.IMAGE_SIZE = nodeStyles.image_size;
                const imageRadius = nodeStyles.image_size / 2;
                this.node.selectAll('.viz-node-image-bg-circle, .viz-node-image-border-circle')
                    .attr('r', imageRadius);
                this.node.selectAll('.viz-node-image-bg-rect, .viz-node-image-border-rect')
                    .attr('width', nodeStyles.image_size)
                    .attr('height', nodeStyles.image_size)
                    .attr('x', -imageRadius)
                    .attr('y', -imageRadius);
                
                // Update clip paths
                const defs = this.svg.select('defs');
                defs.selectAll('clipPath').selectAll('circle')
                    .attr('r', imageRadius);
                defs.selectAll('clipPath').selectAll('rect')
                    .attr('width', nodeStyles.image_size)
                    .attr('height', nodeStyles.image_size)
                    .attr('x', -imageRadius)
                    .attr('y', -imageRadius);
            }
            
            // Update stroke width
            if (nodeStyles.stroke_width !== undefined) {
                this.node.selectAll('.viz-node-outer-circle, .viz-node-outer-rect')
                    .attr('stroke-width', nodeStyles.stroke_width);
            }
            
            // Note: Organization and rank colors come from metadata (ranks/organizations),
            // not from style settings, so we don't update them here
        }
        
        // Update link styles - read from CSS variables for consistency
        const rootStyles = getComputedStyle(document.documentElement);
        const cssLinkOrdinationColor = rootStyles.getPropertyValue('--viz-link-ordination-color').trim();
        const cssLinkConsecrationColor = rootStyles.getPropertyValue('--viz-link-consecration-color').trim();
        const cssLinkInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-link-invalid-ordination-color').trim() || ORANGE_COLOR;
        const cssLinkInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-link-invalid-consecration-color').trim() || RED_COLOR;
        const cssLinkStrokeWidth = parseFloat(rootStyles.getPropertyValue('--viz-link-stroke-width'));
        const cssArrowOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-ordination-color').trim() || cssLinkOrdinationColor;
        const cssArrowConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-consecration-color').trim() || cssLinkConsecrationColor;
        const cssArrowInvalidOrdinationColor = rootStyles.getPropertyValue('--viz-arrow-invalid-ordination-color').trim() || cssLinkInvalidOrdinationColor;
        const cssArrowInvalidConsecrationColor = rootStyles.getPropertyValue('--viz-arrow-invalid-consecration-color').trim() || cssLinkInvalidConsecrationColor;
        
        if (styles.link) {
            const linkStyles = styles.link;
            
            // Update link colors from CSS variables
            if (cssLinkOrdinationColor || cssLinkConsecrationColor || cssLinkInvalidOrdinationColor || cssLinkInvalidConsecrationColor) {
                this.link.attr('stroke', d => {
                    // Invalid links override normal color - orange for ordinations, red for consecrations
                    if (d.is_invalid) {
                        if (d.type === 'ordination') {
                            return cssLinkInvalidOrdinationColor || linkStyles.invalid_ordination_color || ORANGE_COLOR;
                        } else {
                            return cssLinkInvalidConsecrationColor || linkStyles.invalid_consecration_color || RED_COLOR;
                        }
                    }
                    if (d.type === 'ordination') {
                        return cssLinkOrdinationColor || linkStyles.ordination_color || BLACK_COLOR;
                    } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                        return cssLinkConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                    }
                    return cssLinkConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                });
                
                // Update stroke-dasharray for doubtful links
                this.link.attr('stroke-dasharray', d => {
                    if (d.is_doubtful || d.dashed) {
                        return '5,5';
                    }
                    return 'none';
                });
                
                // Update arrow markers from CSS variables
                const defs = this.svg.select('defs');
                const arrowConfig = this.arrowConfig || { stroke: false };
                defs.selectAll('marker')
                    .selectAll('path')
                    .attr('fill', function() {
                        const markerId = d3.select(this.parentNode).attr('id');
                        if (markerId === 'arrowhead-black') {
                            return cssArrowOrdinationColor || linkStyles.ordination_color || BLACK_COLOR;
                        } else if (markerId === 'arrowhead-green') {
                            return cssArrowConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                        } else if (markerId === 'arrowhead-red') {
                            return cssArrowInvalidConsecrationColor || linkStyles.invalid_consecration_color || RED_COLOR;
                        } else if (markerId === 'arrowhead-orange') {
                            return cssArrowInvalidOrdinationColor || linkStyles.invalid_ordination_color || ORANGE_COLOR;
                        }
                        return GREEN_COLOR;
                    })
                    .attr('stroke', function() {
                        const markerId = d3.select(this.parentNode).attr('id');
                        if (!arrowConfig.stroke) return 'none';
                        if (markerId === 'arrowhead-black') {
                            return cssArrowOrdinationColor || linkStyles.ordination_color || BLACK_COLOR;
                        } else if (markerId === 'arrowhead-green') {
                            return cssArrowConsecrationColor || linkStyles.consecration_color || GREEN_COLOR;
                        } else if (markerId === 'arrowhead-red') {
                            return cssArrowInvalidConsecrationColor || linkStyles.invalid_consecration_color || RED_COLOR;
                        } else if (markerId === 'arrowhead-orange') {
                            return cssArrowInvalidOrdinationColor || linkStyles.invalid_ordination_color || ORANGE_COLOR;
                        }
                        return GREEN_COLOR;
                    });
                
                // Update marker-end to use colored markers for invalid links
                this.link.attr('marker-end', d => {
                    if (d.is_invalid) {
                        if (d.type === 'ordination') {
                            return 'url(#arrowhead-orange)';
                        } else {
                            return 'url(#arrowhead-red)';
                        }
                    }
                    if (d.type === 'ordination') {
                        return 'url(#arrowhead-black)';
                    } else if (d.type === 'consecration' || d.type === 'co-consecration') {
                        return 'url(#arrowhead-green)';
                    }
                    return 'url(#arrowhead-green)';
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
        // Disconnect resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Stop simulation
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
        
        // Remove SVG and all visualization elements
        if (this.container) {
            d3.select(this.container).selectAll('svg').remove();
        }
        
        // Clear references
        this.svg = null;
        this.g = null;
        this.node = null;
        this.link = null;
        this.linkBase = null;
        this.linkOverlay = null;
        this.container = null;
        
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
