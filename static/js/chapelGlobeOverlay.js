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
        this.createOverlayGroup();
        this.loadOrganizationColors();
        this.loadTestData();
    }
    
    async loadOrganizationColors() {
        try {
            const response = await fetch('/api/organizations');
            const data = await response.json();
            
            if (data.success) {
                this.styles.updateOrganizationColors(data.organizations);
            } else {
                console.error('Failed to load organization colors:', data.error);
            }
        } catch (error) {
            console.error('Error loading organization colors:', error);
        }
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
        
    }
    
    loadTestData() {
        // Load test chapel data with organizations to demonstrate organization-based coloring
        this.chapelData = [
            {
                id: 'vatican',
                name: 'St. Peter\'s Basilica',
                type: 'cathedral',
                organization: 'Roman Catholic',
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
                organization: 'Roman Catholic',
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
                organization: 'Anglican',
                lat: 51.4994,
                lng: -0.1274,
                city: 'London',
                country: 'United Kingdom',
                description: 'Gothic abbey church',
                yearFounded: 960
            },
            {
                id: 'st-basil',
                name: 'St. Basil\'s Cathedral',
                type: 'cathedral',
                organization: 'Orthodox',
                lat: 55.7525,
                lng: 37.6231,
                city: 'Moscow',
                country: 'Russia',
                description: 'Russian Orthodox cathedral',
                yearFounded: 1555
            },
            {
                id: 'st-pauls',
                name: 'St. Paul\'s Cathedral',
                type: 'cathedral',
                organization: 'Anglican',
                lat: 51.5138,
                lng: -0.0984,
                city: 'London',
                country: 'United Kingdom',
                description: 'Anglican cathedral',
                yearFounded: 1675
            }
        ];
        
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
                
                // Get organization-based color if available
                const orgColor = self.styles.getLocationColorWithOrganization(d.type, d.organization, d) || normalStyle.fillColor;
                
                // Outer glow
                chapelGroup.append('circle')
                    .attr('class', self.styles.getCSSClass('chapelGlow'))
                    .attr('r', normalStyle.glowRadius)
                    .attr('fill', orgColor)
                    .attr('opacity', normalStyle.glowOpacity)
                    .style('filter', 'blur(2px)')
                    .style('pointer-events', 'none');
                
                // Main chapel marker
                chapelGroup.append('circle')
                    .attr('class', self.styles.getCSSClass('chapelDot'))
                    .attr('r', normalStyle.radius)
                    .attr('fill', orgColor)
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
        
        // Add touch event support for mobile devices
        this.addTouchEventListeners();
    }
    
    addTouchEventListeners() {
        const chapelDots = this.chapelOverlayGroup.selectAll('.chapel-dot');
        
        // Touch events for mobile interaction
        chapelDots
            .on('touchstart', (event, d) => {
                event.preventDefault();
                this.touchStartTime = Date.now();
                this.touchStartPosition = this.getTouchPosition(event.touches[0]);
            })
            .on('touchend', (event, d) => {
                event.preventDefault();
                
                // Check if this was a tap (quick touch and release)
                if (this.touchStartTime && Date.now() - this.touchStartTime < 300) {
                    const touch = event.changedTouches[0];
                    const touchPosition = this.getTouchPosition(touch);
                    const startPosition = this.touchStartPosition;
                    
                    // Check if the touch didn't move much (tap vs drag)
                    const distance = Math.sqrt(
                        Math.pow(touchPosition[0] - startPosition[0], 2) + 
                        Math.pow(touchPosition[1] - startPosition[1], 2)
                    );
                    
                    if (distance < 10) { // 10px threshold for tap
                        this.onChapelClick(event, d);
                    }
                }
            })
            .on('touchmove', (event, d) => {
                // Prevent default to avoid scrolling
                event.preventDefault();
            });
    }
    
    getTouchPosition(touch) {
        const rect = this.globe.svg.node().getBoundingClientRect();
        return [
            touch.clientX - rect.left,
            touch.clientY - rect.top
        ];
    }
    
    onChapelHover(event, chapel) {
        // Change appearance on hover using centralized styling
        const chapelGroup = d3.select(event.target.parentNode);
        const hoverStyle = this.styles.getChapelStyle('hover');
        
        // Get organization-based color if available
        const orgColor = this.styles.getLocationColorWithOrganization(chapel.type, chapel.organization, chapel) || hoverStyle.fillColor;
        
        chapelGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
            .attr('r', hoverStyle.glowRadius)
            .attr('opacity', hoverStyle.glowOpacity);
            
        chapelGroup.select('.' + this.styles.getCSSClass('chapelDot'))
            .attr('r', hoverStyle.radius)
            .attr('fill', orgColor)
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
        
        // Get organization-based color if available
        const orgColor = this.styles.getLocationColorWithOrganization(chapel.type, chapel.organization, chapel) || normalStyle.fillColor;
        
        chapelGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
            .attr('r', normalStyle.glowRadius)
            .attr('opacity', normalStyle.glowOpacity);
            
        chapelGroup.select('.' + this.styles.getCSSClass('chapelDot'))
            .attr('r', normalStyle.radius)
            .attr('fill', orgColor)
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
            
            // Get organization-based color if available
            const prevOrgColor = this.styles.getLocationColorWithOrganization(this.selectedChapel.type, this.selectedChapel.organization, this.selectedChapel) || normalStyle.fillColor;
            
            prevGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
                .attr('r', normalStyle.glowRadius)
                .attr('opacity', normalStyle.glowOpacity);
            prevGroup.select('.' + this.styles.getCSSClass('chapelDot'))
                .attr('r', normalStyle.radius)
                .attr('fill', prevOrgColor)
                .attr('stroke-width', normalStyle.strokeWidth)
                .attr('opacity', normalStyle.opacity);
        }
        
        // Select new chapel
        this.selectedChapel = chapel;
        const chapelGroup = this.chapelOverlayGroup.select(`[data-chapel-id="${chapel.id}"]`);
        const selectedStyle = this.styles.getChapelStyle('selected');
        
        // Get organization-based color if available
        const orgColor = this.styles.getLocationColorWithOrganization(chapel.type, chapel.organization, chapel) || selectedStyle.fillColor;
        
        chapelGroup.select('.' + this.styles.getCSSClass('chapelGlow'))
            .attr('r', selectedStyle.glowRadius)
            .attr('opacity', selectedStyle.glowOpacity);
            
        chapelGroup.select('.' + this.styles.getCSSClass('chapelDot'))
            .attr('r', selectedStyle.radius)
            .attr('fill', orgColor)
            .attr('stroke-width', selectedStyle.strokeWidth)
            .attr('opacity', selectedStyle.opacity);
        
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
