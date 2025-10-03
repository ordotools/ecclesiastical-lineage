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
        
        // Chapel styling configuration
        this.styles = {
            chapel: {
                radius: 4,
                fillColor: '#e74c3c',
                strokeColor: '#ffffff',
                strokeWidth: 1.5,
                opacity: 0.9,
                glowRadius: 8,
                glowOpacity: 0.3
            },
            selected: {
                radius: 6,
                fillColor: '#f39c12',
                strokeColor: '#ffffff',
                strokeWidth: 2,
                opacity: 1,
                glowRadius: 12,
                glowOpacity: 0.5
            },
            hover: {
                radius: 5,
                fillColor: '#e67e22',
                strokeColor: '#ffffff',
                strokeWidth: 2,
                opacity: 1,
                glowRadius: 10,
                glowOpacity: 0.4
            }
        };
        
        this.init();
    }
    
    init() {
        console.log('Initializing Chapel Globe Overlay');
        this.createOverlayGroup();
        // Load test data will be called after overlay group is created
        this.setupEventListeners();
    }
    
    createOverlayGroup() {
        // Wait for the globe's SVG to be ready
        if (!this.globe || 
            !this.globe.svg || 
            !this.globe.svg.node()) {
            console.warn('Globe SVG not ready, retrying...');
            setTimeout(() => this.createOverlayGroup(), 100);
            return;
        }
        
        try {
            // Create a dedicated group for chapel overlays directly on the SVG
            // This avoids issues with the globe's internal group structure
            this.chapelOverlayGroup = this.globe.svg.append('g')
                .attr('class', 'chapel-overlay-group');
                
            console.log('Chapel overlay group created');
            
            // Now load test data since the overlay group is ready
            this.loadTestData();
        } catch (error) {
            console.error('Error creating chapel overlay group:', error);
            setTimeout(() => this.createOverlayGroup(), 100);
        }
    }
    
    loadTestData() {
        // No test data - only use database locations
        this.chapelData = [];
        console.log('No test chapel data loaded - using database locations only');
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
            
            // Add glow effect and main marker for each chapel
            chapelMarkers.each(function(d) {
                const chapelGroup = d3.select(this);
                
                // Outer glow
                chapelGroup.append('circle')
                    .attr('class', 'chapel-glow')
                    .attr('r', 8)
                    .attr('fill', '#e74c3c')
                    .attr('opacity', 0.3)
                    .style('filter', 'blur(2px)')
                    .style('pointer-events', 'none');
                
                // Main chapel marker
                chapelGroup.append('circle')
                    .attr('class', 'chapel-dot')
                    .attr('r', 4)
                    .attr('fill', '#e74c3c')
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 1.5)
                    .attr('opacity', 0.9)
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
                
                // Use the same 3D culling logic as the main globe
                const isVisible = self.isChapelVisible(d.lng, d.lat);
                
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
    isChapelVisible(longitude, latitude) {
        // Use D3's geoRotation for proper backface culling
        // This leverages D3's built-in spherical math functions
        try {
            // Get the projected coordinates first
            const projected = this.globe.projection([longitude, latitude]);

            if (!projected || projected.length !== 2) {
                return false;
            }

            const [x, y] = projected;

            // Check if coordinates are valid numbers
            if (isNaN(x) || isNaN(y)) {
                return false;
            }

            // Use D3's geoRotation to get the rotated point
            const rotation = this.globe.projection.rotate();
            const geoRotation = d3.geoRotation(rotation);
            const rotatedPoint = geoRotation([longitude, latitude]);
            
            // Convert the rotated point to 3D coordinates
            const phi = (90 - rotatedPoint[1]) * Math.PI / 180;
            const theta = (rotatedPoint[0] + 180) * Math.PI / 180;
            
            const x3d = Math.sin(phi) * Math.cos(theta);
            const y3d = Math.cos(phi);
            const z3d = Math.sin(phi) * Math.sin(theta);

            // The view direction is looking at the center (0, 0, 1) in the rotated coordinate system
            // If z-coordinate is negative, the point is on the back side
            if (x3d > 0) {
                return false;
            }
            
            // Point is visible if it's on the front side
            return true;

        } catch (error) {
            // If there's any error in projection, consider it not visible
            console.warn('Error in chapel visibility check:', error);
            return false;
        }
    }
    
    addChapelEventListeners() {
        const chapelDots = this.chapelOverlayGroup.selectAll('.chapel-dot');
        
        chapelDots
            .on('mouseover', (event, d) => this.onChapelHover(event, d))
            .on('mouseout', (event, d) => this.onChapelOut(event, d))
            .on('click', (event, d) => this.onChapelClick(event, d));
    }
    
    onChapelHover(event, chapel) {
        // Change appearance on hover
        const chapelGroup = d3.select(event.target.parentNode);
        
        chapelGroup.select('.chapel-glow')
            .attr('r', this.styles.hover.glowRadius)
            .attr('opacity', this.styles.hover.glowOpacity);
            
        chapelGroup.select('.chapel-dot')
            .attr('r', this.styles.hover.radius)
            .attr('fill', this.styles.hover.fillColor)
            .attr('stroke-width', this.styles.hover.strokeWidth)
            .attr('opacity', this.styles.hover.opacity);
        
        // Show tooltip
        this.showChapelTooltip(event, chapel);
    }
    
    onChapelOut(event, chapel) {
        // Reset appearance unless selected
        if (this.selectedChapel && this.selectedChapel.id === chapel.id) {
            return; // Keep selected styling
        }
        
        const chapelGroup = d3.select(event.target.parentNode);
        
        chapelGroup.select('.chapel-glow')
            .attr('r', this.styles.chapel.glowRadius)
            .attr('opacity', this.styles.chapel.glowOpacity);
            
        chapelGroup.select('.chapel-dot')
            .attr('r', this.styles.chapel.radius)
            .attr('fill', this.styles.chapel.fillColor)
            .attr('stroke-width', this.styles.chapel.strokeWidth)
            .attr('opacity', this.styles.chapel.opacity);
        
        // Hide tooltip
        this.hideTooltip();
    }
    
    onChapelClick(event, chapel) {
        // Select chapel
        this.selectChapel(chapel);
        
        // Show detailed information
        this.showChapelDetails(chapel);
    }
    
    selectChapel(chapel) {
        // Deselect previous chapel
        if (this.selectedChapel) {
            const prevGroup = this.chapelOverlayGroup.select(`[data-chapel-id="${this.selectedChapel.id}"]`);
            prevGroup.select('.chapel-glow')
                .attr('r', this.styles.chapel.glowRadius)
                .attr('opacity', this.styles.chapel.glowOpacity);
            prevGroup.select('.chapel-dot')
                .attr('r', this.styles.chapel.radius)
                .attr('fill', this.styles.chapel.fillColor)
                .attr('stroke-width', this.styles.chapel.strokeWidth)
                .attr('opacity', this.styles.chapel.opacity);
        }
        
        // Select new chapel
        this.selectedChapel = chapel;
        const chapelGroup = this.chapelOverlayGroup.select(`[data-chapel-id="${chapel.id}"]`);
        
        chapelGroup.select('.chapel-glow')
            .attr('r', this.styles.selected.glowRadius)
            .attr('opacity', this.styles.selected.glowOpacity);
            
        chapelGroup.select('.chapel-dot')
            .attr('r', this.styles.selected.radius)
            .attr('fill', this.styles.selected.fillColor)
            .attr('stroke-width', this.styles.selected.strokeWidth)
            .attr('opacity', this.styles.selected.opacity);
        
        console.log('Selected chapel:', chapel.name);
    }
    
    showChapelTooltip(event, chapel) {
        if (!this.globe.tooltip) return;
        
        this.globe.tooltip
            .style('opacity', 1)
            .html(`
                <div class="chapel-tooltip">
                    <h6>${chapel.name}</h6>
                    <p><strong>Type:</strong> ${chapel.type}</p>
                    <p><strong>Location:</strong> ${chapel.city}, ${chapel.country}</p>
                    ${chapel.yearFounded ? `<p><strong>Founded:</strong> ${chapel.yearFounded}</p>` : ''}
                    <p><strong>Coordinates:</strong> ${chapel.lat.toFixed(4)}, ${chapel.lng.toFixed(4)}</p>
                </div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    showChapelDetails(chapel) {
        const asidePanel = document.getElementById('location-info-panel');
        if (!asidePanel) return;
        
        const typeColors = {
            'cathedral': '#9b59b6',
            'basilica': '#e74c3c',
            'abbey': '#f39c12',
            'church': '#3498db',
            'chapel': '#1abc9c'
        };
        
        const color = typeColors[chapel.type] || '#95a5a6';
        
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
                    
                    <div class="d-grid gap-2">
                        <a href="https://www.google.com/maps?q=${chapel.lat},${chapel.lng}" 
                           target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="fas fa-external-link-alt me-1"></i>View on Google Maps
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Show the aside panel
        const aside = document.getElementById('location-aside');
        if (aside) {
            aside.classList.add('show');
        }
    }
    
    hideTooltip() {
        if (this.globe.tooltip) {
            this.globe.tooltip.style('opacity', 0);
        }
    }
    
    setupEventListeners() {
        // Listen for globe updates (rotation, zoom, etc.)
        if (this.globe.svg) {
            this.globe.svg.on('update-chapels', () => {
                this.updateChapelPositions();
            });
        }
    }
    
    // Public methods for external control
    addChapel(chapelData) {
        this.chapelData.push(chapelData);
        this.renderChapels();
    }
    
    removeChapel(chapelId) {
        this.chapelData = this.chapelData.filter(chapel => chapel.id !== chapelId);
        this.renderChapels();
    }
    
    clearChapels() {
        this.chapelData = [];
        if (this.chapelOverlayGroup) {
            this.chapelOverlayGroup.selectAll('.chapel-marker').remove();
        }
    }
    
    updateChapelData(newData) {
        this.chapelData = newData;
        this.renderChapels();
    }
    
    // Method to be called when globe updates
    onGlobeUpdate() {
        this.updateChapelPositions();
    }
    
    // Enhanced method to handle globe rotation and zoom
    onGlobeTransform() {
        // Update chapel positions when globe transforms
        this.updateChapelPositions();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for the main globe visualization to be ready
    const initChapelOverlay = () => {
        if (window.geographicVisualization && 
            window.geographicVisualization.svg && 
            window.geographicVisualization.svg.node()) {
            
            console.log('Initializing Chapel Globe Overlay');
            window.chapelOverlay = new ChapelGlobeOverlay(window.geographicVisualization);
            
            // The chapel overlay will automatically listen for 'update-chapels' events
            // which are dispatched by the main globe during rotation and zoom
            console.log('Chapel overlay initialized and ready');
        } else {
            // Retry after a short delay
            console.log('Globe not ready yet, retrying...');
            setTimeout(initChapelOverlay, 300);
        }
    };
    
    // Wait longer to ensure globe is fully initialized
    setTimeout(initChapelOverlay, 1000);
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChapelGlobeOverlay;
}

// Make the class globally available
window.ChapelGlobeOverlay = ChapelGlobeOverlay;
