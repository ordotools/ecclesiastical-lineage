/**
 * Chapel Globe Overlay
 * Clean implementation for overlaying chapel locations on a D3.js globe
 * Built to work with the existing GeographicLineageVisualization
 */

class ChapelGlobeOverlay {
    constructor(globeVisualization) {
        this.globe = globeVisualization;
        this.chapelData = [];
        this.chapelOverlayGroup = null;
        this.selectedChapel = null;
        
        // Initialize centralized styling
        this.styles = new LocationMarkerStyles();
        
        this.init();
    }
    
    init() {
        console.log('Initializing Chapel Globe Overlay');
        this.createOverlayGroup();
        this.loadTestData();
    }
    
    createOverlayGroup() {
        if (!this.globe || !this.globe.g) {
            console.error('Globe visualization not available');
            return;
        }
        
        // Create overlay group for chapel markers
        this.chapelOverlayGroup = this.globe.g.append('g')
            .attr('class', 'chapel-overlay-group')
            .style('pointer-events', 'all');
        
        console.log('Chapel overlay group created');
    }
    
    loadTestData() {
        // Load test chapel data
        this.chapelData = [
            {
                id: 'vatican',
                name: 'St. Peter\'s Basilica',
                type: 'cathedral',
                lat: 41.9022,
                lng: 12.4539,
                city: 'Vatican City',
                country: 'Vatican',
                description: 'The papal basilica of St. Peter in the Vatican',
                yearFounded: 1506
            },
            {
                id: 'notre-dame',
                name: 'Notre-Dame de Paris',
                type: 'cathedral',
                lat: 48.8530,
                lng: 2.3499,
                city: 'Paris',
                country: 'France',
                description: 'Medieval Catholic cathedral',
                yearFounded: 1163
            },
            {
                id: 'westminster',
                name: 'Westminster Abbey',
                type: 'abbey',
                lat: 51.4994,
                lng: -0.1274,
                city: 'London',
                country: 'United Kingdom',
                description: 'Gothic abbey church',
                yearFounded: 960
            }
        ];
        
        console.log('Loaded test chapel data:', this.chapelData.length);
        this.renderChapels();
    }
    
    renderChapels() {
        if (!this.chapelOverlayGroup || !this.chapelOverlayGroup.node()) {
            console.error('Chapel overlay group not initialized or not ready');
            return;
        }
        
        try {
            // Clear existing chapel markers
            this.chapelOverlayGroup.selectAll('.chapel-marker').remove();
            
            // Create chapel markers
            const chapelMarkers = this.chapelOverlayGroup.selectAll('.chapel-marker')
                .data(this.chapelData)
                .enter()
                .append('g')
                .attr('class', 'chapel-marker')
                .attr('data-chapel-id', d => d.id);
            
            // Add glow effect and main marker for each chapel using centralized styling
            const self = this;
            chapelMarkers.each(function(d) {
                const chapelGroup = d3.select(this);
                const normalStyle = self.styles.getChapelStyle('normal');
                
                // Outer glow
                chapelGroup.append('circle')
                    .attr('class', self.styles.getCSSClass('chapelGlow'))
                    .attr('r', normalStyle.glowRadius)
                    .attr('fill', normalStyle.fillColor)
                    .attr('opacity', normalStyle.glowOpacity)
                    .style('filter', 'blur(2px)')
                    .style('pointer-events', 'none');
                
                // Main chapel marker
                chapelGroup.append('circle')
                    .attr('class', self.styles.getCSSClass('chapelDot'))
                    .attr('r', normalStyle.radius)
                    .attr('fill', normalStyle.fillColor)
                    .attr('stroke', normalStyle.strokeColor)
                    .attr('stroke-width', normalStyle.strokeWidth)
                    .attr('opacity', normalStyle.opacity)
                    .style('pointer-events', 'all')
                    .style('cursor', 'pointer');
            });
            
            // Position chapel markers
            this.updateChapelPositions();
            
            // Add event listeners
            this.addChapelEventListeners();
            
            console.log(`Rendered ${this.chapelData.length} chapel markers`);
        } catch (error) {
            console.error('Error rendering chapel markers:', error);
        }
    }
    
    updateChapelPositions() {
        if (!this.chapelOverlayGroup || !this.chapelOverlayGroup.node()) {
            return;
        }
        
        const chapelMarkers = this.chapelOverlayGroup.selectAll('.chapel-marker');
        const self = this; // Store reference to class instance
        
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            chapelMarkers.each(function(d) {
                const chapelGroup = d3.select(this);
                
                // Use the main globe's visibility function for consistency
                const isVisible = self.globe.isLocationVisible(d.lng, d.lat);
                
                if (isVisible) {
                    // Get current projection from the globe for positioning
                    const projection = self.globe.projection;
                    const coords = projection([d.lng, d.lat]);
                    
                    if (coords && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        const [x, y] = coords;
                        // Point is visible, show it - direct DOM manipulation for performance
                        chapelGroup.node().setAttribute('transform', `translate(${x}, ${y})`);
                        chapelGroup.node().style.opacity = '1';
                        chapelGroup.node().style.pointerEvents = 'all';
                    } else {
                        // Fallback: hide if projection fails but keep in DOM for click handlers
                        chapelGroup.node().style.opacity = '0';
                        chapelGroup.node().style.pointerEvents = 'none';
                    }
                } else {
                    // Point is on the back side, hide it but keep in DOM for click handlers
                    chapelGroup.node().style.opacity = '0';
                    chapelGroup.node().style.pointerEvents = 'none';
                }
            });
        });
    }
    
    addChapelEventListeners() {
        const chapelDots = this.chapelOverlayGroup.selectAll('.chapel-dot');
        
        chapelDots
            .on('mouseover', (event, d) => this.onChapelHover(event, d))
            .on('mouseout', (event, d) => this.onChapelOut(event, d))
            .on('click', (event, d) => this.onChapelClick(event, d));
    }
    
    onChapelHover(event, chapel) {
        // Change appearance on hover using centralized styling
        const chapelGroup = d3.select(event.target.parentNode);
        const hoverStyle = this.styles.getChapelStyle('hover');
        
        chapelGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
            .attr('r', hoverStyle.glowRadius)
            .attr('opacity', hoverStyle.glowOpacity);
            
        chapelGroup.select('.' + this.styles.getCSSClass('chapelDot'))
            .attr('r', hoverStyle.radius)
            .attr('fill', hoverStyle.fillColor)
            .attr('stroke-width', hoverStyle.strokeWidth)
            .attr('opacity', hoverStyle.opacity);
        
        // Show tooltip
        this.showChapelTooltip(event, chapel);
    }
    
    onChapelOut(event, chapel) {
        // Reset appearance unless selected
        if (this.selectedChapel && this.selectedChapel.id === chapel.id) {
            return; // Keep selected styling
        }
        
        const chapelGroup = d3.select(event.target.parentNode);
        const normalStyle = this.styles.getChapelStyle('normal');
        
        chapelGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
            .attr('r', normalStyle.glowRadius)
            .attr('opacity', normalStyle.glowOpacity);
            
        chapelGroup.select('.' + this.styles.getCSSClass('chapelDot'))
            .attr('r', normalStyle.radius)
            .attr('fill', normalStyle.fillColor)
            .attr('stroke-width', normalStyle.strokeWidth)
            .attr('opacity', normalStyle.opacity);
        
        // Hide tooltip
        this.hideTooltip();
    }
    
    onChapelClick(event, chapel) {
        // Select chapel
        this.selectChapel(chapel);
        
        // Show persistent tooltip instead of side panel
        this.styles.showPersistentTooltip(event, chapel, 'chapel');
    }
    
    selectChapel(chapel) {
        // Deselect previous chapel
        if (this.selectedChapel) {
            const prevGroup = this.chapelOverlayGroup.select(`[data-chapel-id="${this.selectedChapel.id}"]`);
            const normalStyle = this.styles.getChapelStyle('normal');
            
            prevGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
                .attr('r', normalStyle.glowRadius)
                .attr('opacity', normalStyle.glowOpacity);
            prevGroup.select('.' + this.styles.getCSSClass('chapelDot'))
                .attr('r', normalStyle.radius)
                .attr('fill', normalStyle.fillColor)
                .attr('stroke-width', normalStyle.strokeWidth)
                .attr('opacity', normalStyle.opacity);
        }
        
        // Select new chapel
        this.selectedChapel = chapel;
        const chapelGroup = this.chapelOverlayGroup.select(`[data-chapel-id="${chapel.id}"]`);
        const selectedStyle = this.styles.getChapelStyle('selected');
        
        chapelGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
            .attr('r', selectedStyle.glowRadius)
            .attr('opacity', selectedStyle.glowOpacity);
            
        chapelGroup.select('.' + this.styles.getCSSClass('chapelDot'))
            .attr('r', selectedStyle.radius)
            .attr('fill', selectedStyle.fillColor)
            .attr('stroke-width', selectedStyle.strokeWidth)
            .attr('opacity', selectedStyle.opacity);
        
        console.log('Selected chapel:', chapel.name);
    }
    
    showChapelTooltip(event, chapel) {
        // Use the globe's tooltip if available, otherwise create our own
        let tooltip = this.globe.tooltip;
        if (!tooltip) {
            // Create tooltip if it doesn't exist
            tooltip = d3.select('body')
                .append('div')
                .attr('class', this.styles.getCSSClass('tooltip'))
                .style('opacity', 0);
            
            // Apply base tooltip styling
            const tooltipStyle = this.styles.getTooltipStyle('base');
            Object.entries(tooltipStyle).forEach(([key, value]) => {
                if (key !== 'opacity') {
                    tooltip.style(key, value);
                }
            });
            
            this.globe.tooltip = tooltip;
        }
        
        this.styles.showTooltip(tooltip, event, chapel, 'chapel');
    }
    
    showChapelDetails(chapel) {
        const asidePanel = document.getElementById('location-info-panel');
        if (!asidePanel) return;
        
        const color = this.styles.getChapelColor(chapel.type);
        
        asidePanel.innerHTML = `
            <div class="card">
                <div class="card-header" style="background: ${color}; color: white;">
                    <h5 class="mb-0">
                        <i class="fas fa-church me-2"></i>
                        ${chapel.name}
                    </h5>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <span class="badge" style="background: ${color};">
                            ${chapel.type.charAt(0).toUpperCase() + chapel.type.slice(1)}
                        </span>
                    </div>
                    
                    <div class="mb-2">
                        <strong>Location:</strong><br>
                        <span class="text-muted">${chapel.city}, ${chapel.country}</span>
                    </div>
                    
                    ${chapel.yearFounded ? `
                    <div class="mb-2">
                        <strong>Founded:</strong><br>
                        <span class="text-muted">${chapel.yearFounded}</span>
                    </div>
                    ` : ''}
                    
                    <div class="mb-2">
                        <strong>Coordinates:</strong><br>
                        <span class="text-muted">${chapel.lat.toFixed(6)}, ${chapel.lng.toFixed(6)}</span>
                    </div>
                    
                    ${chapel.description ? `
                    <div class="mb-3">
                        <strong>Description:</strong><br>
                        <span class="text-muted">${chapel.description}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Show the panel
        asidePanel.classList.add('show');
    }
    
    addChapel(chapel) {
        this.chapelData.push(chapel);
        this.renderChapels();
    }
    
    removeChapel(chapelId) {
        this.chapelData = this.chapelData.filter(c => c.id !== chapelId);
        this.renderChapels();
    }
    
    updateChapel(chapel) {
        const index = this.chapelData.findIndex(c => c.id === chapel.id);
        if (index !== -1) {
            this.chapelData[index] = chapel;
            this.renderChapels();
        }
    }
    
    hideTooltip() {
        if (this.globe.tooltip) {
            this.styles.hideTooltip(this.globe.tooltip);
        }
        
        // Also hide any persistent tooltips
        this.styles.removePersistentTooltips();
    }
    
    destroy() {
        if (this.chapelOverlayGroup) {
            this.chapelOverlayGroup.remove();
        }
        this.chapelData = [];
        this.selectedChapel = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChapelGlobeOverlay;
} else {
    window.ChapelGlobeOverlay = ChapelGlobeOverlay;
}
