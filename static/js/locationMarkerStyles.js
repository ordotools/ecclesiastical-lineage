/**
 * Location Marker and Tooltip Styling Configuration
 * Centralized styling definitions for location markers and tooltips across the application
 */

class LocationMarkerStyles {
    constructor() {
        // Location marker color mapping based on type
        this.locationTypeColors = {
            'church': '#27ae60',      // Green for churches
            'cathedral': '#9b59b6',   // Purple for cathedrals
            'chapel': '#e74c3c',      // Red for chapels
            'monastery': '#f39c12',   // Orange for monasteries
            'seminary': '#1abc9c',    // Teal for seminaries
            'abbey': '#8e44ad'        // Dark purple for abbeys
        };

        // Default color for unknown types
        this.defaultColor = '#95a5a6';

        // Location marker styling configuration
        this.markerStyles = {
            normal: {
                radius: 5,
                strokeColor: '#ffffff',
                strokeWidth: 1,
                opacity: 1,
                cursor: 'pointer',
                zIndex: 1000
            },
            hover: {
                radius: 10,
                strokeColor: '#ffffff',
                strokeWidth: 4,
                opacity: 1,
                filter: 'brightness(1.2)',
                cursor: 'pointer',
                zIndex: 1000
            },
            hidden: {
                radius: 8,
                strokeColor: '#ffffff',
                strokeWidth: 3,
                opacity: 0,
                cursor: 'pointer',
                zIndex: 1000,
                pointerEvents: 'none'
            }
        };

        // Chapel marker styling (for ChapelGlobeOverlay system)
        this.chapelStyles = {
            normal: {
                radius: 4,
                fillColor: '#8B4513', // Saddle brown - warm earth tone
                strokeColor: '#F5F5DC', // Beige - vintage map border color
                strokeWidth: 1.5,
                opacity: 0.9,
                glowRadius: 8,
                glowOpacity: 0.2
            },
            selected: {
                radius: 6,
                fillColor: '#CD853F', // Peru - golden brown
                strokeColor: '#F5F5DC', // Beige
                strokeWidth: 2,
                opacity: 1,
                glowRadius: 12,
                glowOpacity: 0.3
            },
            hover: {
                radius: 5,
                fillColor: '#A0522D', // Sienna - rich brown
                strokeColor: '#F5F5DC', // Beige
                strokeWidth: 2,
                opacity: 1,
                glowRadius: 10,
                glowOpacity: 0.25
            }
        };

        // Chapel type colors for details panel
        this.chapelTypeColors = {
            'cathedral': '#8B4513', // Saddle brown
            'basilica': '#CD853F', // Peru - golden brown
            'abbey': '#A0522D', // Sienna - rich brown
            'church': '#D2B48C', // Tan - warm earth tone
            'chapel': '#BC8F8F', // Rosy brown - muted rose
            'monastery': '#8B4513', // Saddle brown
            'seminary': '#A0522D' // Sienna - rich brown
        };

        // Tooltip styling configuration
        this.tooltipStyles = {
            base: {
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.95)',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                pointerEvents: 'none',
                zIndex: 1000,
                maxWidth: '320px',
                minWidth: '280px',
                opacity: 0,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)'
            },
            persistent: {
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.95)',
                color: 'white',
                padding: '16px 20px',
                borderRadius: '12px',
                fontSize: '12px',
                pointerEvents: 'auto',
                zIndex: 1001,
                maxWidth: '400px',
                minWidth: '320px',
                opacity: 1,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                cursor: 'move',
                userSelect: 'none'
            },
            title: {
                margin: '0 0 8px 0',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#f39c12',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                paddingBottom: '6px'
            },
            content: {
                margin: '4px 0',
                fontSize: '12px',
                opacity: 0.9,
                lineHeight: '1.4'
            },
            chapelTitle: {
                margin: '0 0 8px 0',
                fontSize: '16px',
                color: '#f39c12',
                fontWeight: 'bold',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                paddingBottom: '6px'
            },
            chapelContent: {
                margin: '4px 0',
                fontSize: '12px',
                lineHeight: '1.4'
            },
            actionButtons: {
                margin: '12px 0 0 0',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
            },
            button: {
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                border: 'none'
            },
            primaryButton: {
                background: '#3498db',
                color: 'white'
            },
            secondaryButton: {
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)'
            },
            dangerButton: {
                background: '#e74c3c',
                color: 'white'
            },
            closeButton: {
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px'
            }
        };

        // CSS class definitions for markers
        this.cssClasses = {
            locationMarker: 'location-marker',
            chapelMarker: 'chapel-marker',
            chapelDot: 'chapel-dot',
            chapelGlow: 'chapel-glow',
            chapelOverlayGroup: 'chapel-overlay-group',
            locationNodes: 'location-nodes',
            tooltip: 'tooltip',
            chapelTooltip: 'chapel-tooltip',
            persistentTooltip: 'persistent-tooltip',
            tooltipContent: 'tooltip-content',
            tooltipActions: 'tooltip-actions',
            tooltipClose: 'tooltip-close'
        };
    }

    /**
     * Get color for a location type
     * @param {string} locationType - The type of location
     * @returns {string} - The color hex code
     */
    getLocationColor(locationType) {
        return this.locationTypeColors[locationType] || this.defaultColor;
    }

    /**
     * Get color for a chapel type
     * @param {string} chapelType - The type of chapel
     * @returns {string} - The color hex code
     */
    getChapelColor(chapelType) {
        return this.chapelTypeColors[chapelType] || this.defaultColor;
    }

    /**
     * Get marker styling for a specific state
     * @param {string} state - 'normal', 'hover', or 'hidden'
     * @returns {object} - The styling object
     */
    getMarkerStyle(state = 'normal') {
        return this.markerStyles[state] || this.markerStyles.normal;
    }

    /**
     * Get chapel marker styling for a specific state
     * @param {string} state - 'normal', 'hover', or 'selected'
     * @returns {object} - The styling object
     */
    getChapelStyle(state = 'normal') {
        return this.chapelStyles[state] || this.chapelStyles.normal;
    }

    /**
     * Get tooltip styling
     * @param {string} type - 'base', 'title', 'content', 'chapelTitle', or 'chapelContent'
     * @returns {object} - The styling object
     */
    getTooltipStyle(type = 'base') {
        return this.tooltipStyles[type] || this.tooltipStyles.base;
    }

    /**
     * Apply marker styling to a D3 selection
     * @param {object} selection - D3 selection
     * @param {string} state - 'normal', 'hover', or 'hidden'
     * @param {string} fillColor - The fill color for the marker
     */
    applyMarkerStyle(selection, state = 'normal', fillColor) {
        const style = this.getMarkerStyle(state);
        
        selection
            .attr('r', style.radius)
            .attr('fill', fillColor || this.defaultColor)
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('opacity', style.opacity)
            .style('cursor', style.cursor)
            .style('pointer-events', style.pointerEvents || 'all')
            .style('z-index', style.zIndex);

        if (state === 'hover' && style.filter) {
            selection.style('filter', style.filter);
        }
    }

    /**
     * Apply chapel marker styling to a D3 selection
     * @param {object} selection - D3 selection
     * @param {string} state - 'normal', 'hover', or 'selected'
     */
    applyChapelStyle(selection, state = 'normal') {
        const style = this.getChapelStyle(state);
        
        selection
            .attr('r', style.radius)
            .attr('fill', style.fillColor)
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('opacity', style.opacity);
    }

    /**
     * Create tooltip HTML content
     * @param {object} data - The data object containing tooltip information
     * @param {string} type - 'location', 'chapel', or 'country'
     * @param {boolean} persistent - Whether this is a persistent tooltip with actions
     * @returns {string} - HTML string for tooltip
     */
    createTooltipHTML(data, type = 'location', persistent = false) {
        // Handle backward compatibility - if persistent is not a boolean, it might be the old signature
        if (typeof persistent !== 'boolean') {
            // Old signature: createTooltipHTML(data, type) - persistent defaults to false
            persistent = false;
        }
        
        // Debug logging
        console.log('Creating tooltip HTML:', { data, type, persistent });
        
        const baseStyle = persistent ? this.tooltipStyles.persistent : this.tooltipStyles.base;
        const cssClass = persistent ? this.cssClasses.persistentTooltip : this.cssClasses.tooltip;
        
        switch (type) {
            case 'chapel':
                return this.createChapelTooltipHTML(data, persistent, baseStyle, cssClass);
            case 'country':
                return this.createCountryTooltipHTML(data, persistent, baseStyle, cssClass);
            case 'location':
            default:
                return this.createLocationTooltipHTML(data, persistent, baseStyle, cssClass);
        }
    }

    /**
     * Create comprehensive chapel tooltip HTML
     */
    createChapelTooltipHTML(data, persistent, baseStyle, cssClass) {
        const closeButton = persistent ? 
            `<button class="${this.cssClasses.tooltipClose}" style="${this.getInlineStyle(this.tooltipStyles.closeButton)}">×</button>` : '';
        
        const actions = persistent ? this.createActionButtons(data) : '';
        
        // Handle different data structures - chapel vs location data
        const lat = data.lat || data.latitude;
        const lng = data.lng || data.longitude;
        const type = data.type || data.location_type || 'Chapel';
        const city = data.city || 'Unknown';
        const country = data.country || 'Unknown';
        
        return `
            <div class="${cssClass}" style="${this.getInlineStyle(baseStyle)}">
                ${closeButton}
                <div class="${this.cssClasses.tooltipContent}">
                    <h6 style="${this.getInlineStyle(this.tooltipStyles.chapelTitle)}">${data.name || 'Unknown Name'}</h6>
                    <p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Type:</strong> ${type}</p>
                    <p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Location:</strong> ${city}, ${country}</p>
                    ${data.yearFounded ? `<p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Founded:</strong> ${data.yearFounded}</p>` : ''}
                    ${data.description ? `<p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Description:</strong> ${data.description}</p>` : ''}
                    ${data.pastor_name ? `<p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Pastor:</strong> ${data.pastor_name}</p>` : ''}
                    ${data.organization ? `<p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Organization:</strong> ${data.organization}</p>` : ''}
                    ${lat && lng ? `<p style="${this.getInlineStyle(this.tooltipStyles.chapelContent)}"><strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>` : ''}
                    ${actions}
                </div>
            </div>
        `;
    }

    /**
     * Create comprehensive location tooltip HTML
     */
    createLocationTooltipHTML(data, persistent, baseStyle, cssClass) {
        const closeButton = persistent ? 
            `<button class="${this.cssClasses.tooltipClose}" style="${this.getInlineStyle(this.tooltipStyles.closeButton)}">×</button>` : '';
        
        const actions = persistent ? this.createActionButtons(data) : '';
        
        // Handle different data structures - chapel vs location data
        const lat = data.lat || data.latitude;
        const lng = data.lng || data.longitude;
        const type = data.location_type || data.type || 'Unknown';
        const city = data.city || 'Unknown';
        const country = data.country || 'Unknown';
        
        return `
            <div class="${cssClass}" style="${this.getInlineStyle(baseStyle)}">
                ${closeButton}
                <div class="${this.cssClasses.tooltipContent}">
                    <h6 style="${this.getInlineStyle(this.tooltipStyles.title)}">${data.name || 'Unknown Name'}</h6>
                    <p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Type:</strong> ${type}</p>
                    <p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Location:</strong> ${city}, ${country}</p>
                    ${data.pastor_name ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Pastor:</strong> ${data.pastor_name}</p>` : ''}
                    ${data.organization ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Organization:</strong> ${data.organization}</p>` : ''}
                    ${data.description ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Description:</strong> ${data.description}</p>` : ''}
                    ${data.address ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Address:</strong> ${data.address}</p>` : ''}
                    ${lat && lng ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>` : ''}
                    ${actions}
                </div>
            </div>
        `;
    }

    /**
     * Create country tooltip HTML
     */
    createCountryTooltipHTML(data, persistent, baseStyle, cssClass) {
        const closeButton = persistent ? 
            `<button class="${this.cssClasses.tooltipClose}" style="${this.getInlineStyle(this.tooltipStyles.closeButton)}">×</button>` : '';
        
        const actions = persistent ? this.createActionButtons(data) : '';
        
        return `
            <div class="${cssClass}" style="${this.getInlineStyle(baseStyle)}">
                ${closeButton}
                <div class="${this.cssClasses.tooltipContent}">
                    <h6 style="${this.getInlineStyle(this.tooltipStyles.title)}">${data.name}</h6>
                    ${data.capital ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Capital:</strong> ${data.capital}</p>` : ''}
                    ${data.population ? `<p style="${this.getInlineStyle(this.tooltipStyles.content)}"><strong>Population:</strong> ${data.population.toLocaleString()}</p>` : ''}
                    ${actions}
                </div>
            </div>
        `;
    }

    /**
     * Create action buttons for persistent tooltips
     */
    createActionButtons(data) {
        // Handle different coordinate formats
        const lat = data.lat || data.latitude;
        const lng = data.lng || data.longitude;
        
        if (!lat || !lng) return '';
        
        const buttons = [];
        
        // Google Earth link
        // const googleEarthUrl = `https://earth.google.com/web/@${lat},${lng},1000a,35y,0h,0t,0r`;
        // buttons.push(`
        //     <a href="${googleEarthUrl}" target="_blank" rel="noopener noreferrer"
        //        style="${this.getInlineStyle({...this.tooltipStyles.button, ...this.tooltipStyles.primaryButton})}"
        //        onmouseover="this.style.background='#2980b9'"
        //        onmouseout="this.style.background='#3498db'">
        //         🌍 Google Earth
        //     </a>
        // `);
        
        // Google Maps link
        const address = encodeURIComponent(data.address || data.name);
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
        buttons.push(`
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer"
               style="${this.getInlineStyle({...this.tooltipStyles.button, ...this.tooltipStyles.secondaryButton})}"
               onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'"
               onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
                🗺️ Google Maps
            </a>
        `);
        
        // OpenStreetMap link
        // const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`;
        // buttons.push(`
        //     <a href="${osmUrl}" target="_blank" rel="noopener noreferrer"
        //        style="${this.getInlineStyle({...this.tooltipStyles.button, ...this.tooltipStyles.secondaryButton})}"
        //        onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'"
        //        onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
        //         🌐 OpenStreetMap
        //     </a>
        // `);
        
        // Copy coordinates button
        // buttons.push(`
        //     <button onclick="navigator.clipboard.writeText('${lat}, ${lng}'); this.textContent='Copied!'; setTimeout(() => this.textContent='📋 Copy Coords', 2000)"
        //             style="${this.getInlineStyle({...this.tooltipStyles.button, ...this.tooltipStyles.secondaryButton})}"
        //             onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'"
        //             onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
        //         📋 Copy Coords
        //     </button>
        // `);
        
        return `
            <div class="${this.cssClasses.tooltipActions}" style="${this.getInlineStyle(this.tooltipStyles.actionButtons)}">
                ${buttons.join('')}
            </div>
        `;
    }

    /**
     * Convert style object to inline CSS string
     * @param {object} styles - Style object
     * @returns {string} - Inline CSS string
     */
    getInlineStyle(styles) {
        return Object.entries(styles)
            .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
            .join('; ');
    }

    /**
     * Get CSS class name
     * @param {string} type - The type of CSS class
     * @returns {string} - The CSS class name
     */
    getCSSClass(type) {
        return this.cssClasses[type] || '';
    }

    /**
     * Show a regular tooltip (non-persistent)
     * @param {object} tooltip - D3 tooltip selection
     * @param {object} event - Mouse event
     * @param {object} data - Data object
     * @param {string} type - Tooltip type
     */
    showTooltip(tooltip, event, data, type = 'location') {
        if (!tooltip) {
            console.error('No tooltip element provided');
            return;
        }
        
        console.log('Showing tooltip with data:', data);
        
        // Create very simple HTML
        const simpleHtml = `<strong>${data.name || 'Unknown Name'}</strong><br>Type: ${data.type || data.location_type || 'Unknown'}<br>Location: ${data.city || 'Unknown'}, ${data.country || 'Unknown'}`;
        
        console.log('Generated HTML content:', simpleHtml);
        
        // Set tooltip content and position
        tooltip
            .style('opacity', 1)
            .style('display', 'block')
            .html(simpleHtml)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        
        console.log('Tooltip should now be visible');
    }

    /**
     * Hide a regular tooltip
     * @param {object} tooltip - D3 tooltip selection
     */
    hideTooltip(tooltip) {
        if (tooltip) {
            tooltip.style('opacity', 0).style('display', 'none');
        }
    }

    /**
     * Show a persistent tooltip (clicked)
     * @param {object} event - Mouse event
     * @param {object} data - Data object
     * @param {string} type - Tooltip type
     * @returns {HTMLElement} - The created persistent tooltip element
     */
    showPersistentTooltip(event, data, type = 'location') {
        // Create new persistent tooltip (don't remove existing ones)
        const tooltipElement = document.createElement('div');
        tooltipElement.innerHTML = this.createTooltipHTML(data, type, true);
        tooltipElement.className = this.cssClasses.persistentTooltip;
        tooltipElement.style.position = 'absolute';
        tooltipElement.style.zIndex = this.getNextZIndex();
        
        // Position the tooltip
        let left = event.pageX + 10;
        let top = event.pageY - 10;
        
        // Adjust position if tooltip would go off-screen
        if (left + 400 > window.innerWidth) {
            left = event.pageX - 410;
        }
        if (top + 300 > window.innerHeight) {
            top = event.pageY - 310;
        }
        
        tooltipElement.style.left = left + 'px';
        tooltipElement.style.top = top + 'px';
        
        // Add to document
        document.body.appendChild(tooltipElement);
        
        // Make tooltip draggable
        this.makeDraggable(tooltipElement);
        
        // Add click outside to close functionality (only for the X button)
        this.addCloseButtonListener(tooltipElement);
        
        return tooltipElement;
    }

    /**
     * Remove all persistent tooltips
     */
    removePersistentTooltips() {
        const existingTooltips = document.querySelectorAll(`.${this.cssClasses.persistentTooltip}`);
        existingTooltips.forEach(tooltip => tooltip.remove());
    }

    /**
     * Get the next z-index for stacking tooltips
     */
    getNextZIndex() {
        const existingTooltips = document.querySelectorAll(`.${this.cssClasses.persistentTooltip}`);
        let maxZIndex = 1001;
        existingTooltips.forEach(tooltip => {
            const zIndex = parseInt(tooltip.style.zIndex) || 1001;
            maxZIndex = Math.max(maxZIndex, zIndex);
        });
        return maxZIndex + 1;
    }

    /**
     * Add close button listener to close persistent tooltip
     * @param {HTMLElement} tooltipElement - The tooltip element
     */
    addCloseButtonListener(tooltipElement) {
        const closeButton = tooltipElement.querySelector(`.${this.cssClasses.tooltipClose}`);
        if (closeButton) {
            closeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                tooltipElement.remove();
            });
        }
    }

    /**
     * Make a tooltip element draggable
     * @param {HTMLElement} tooltipElement - The tooltip element
     */
    makeDraggable(tooltipElement) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        // Add cursor style to indicate draggability
        tooltipElement.style.cursor = 'move';

        // Mouse down - start dragging
        tooltipElement.addEventListener('mousedown', (event) => {
            // Only start dragging if not clicking on buttons or links
            if (event.target.tagName === 'BUTTON' || event.target.tagName === 'A') {
                return;
            }

            isDragging = true;
            startX = event.clientX;
            startY = event.clientY;
            
            const rect = tooltipElement.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            // Bring to front when dragging starts
            tooltipElement.style.zIndex = this.getNextZIndex();

            event.preventDefault();
        });

        // Mouse move - update position
        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;

            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;

            let newX = initialX + deltaX;
            let newY = initialY + deltaY;

            // Keep tooltip within viewport bounds
            const tooltipRect = tooltipElement.getBoundingClientRect();
            const maxX = window.innerWidth - tooltipRect.width;
            const maxY = window.innerHeight - tooltipRect.height;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            tooltipElement.style.left = newX + 'px';
            tooltipElement.style.top = newY + 'px';
        });

        // Mouse up - stop dragging
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Touch events for mobile support
        tooltipElement.addEventListener('touchstart', (event) => {
            if (event.target.tagName === 'BUTTON' || event.target.tagName === 'A') {
                return;
            }

            isDragging = true;
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
            
            const rect = tooltipElement.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            tooltipElement.style.zIndex = this.getNextZIndex();

            event.preventDefault();
        });

        document.addEventListener('touchmove', (event) => {
            if (!isDragging) return;

            const deltaX = event.touches[0].clientX - startX;
            const deltaY = event.touches[0].clientY - startY;

            let newX = initialX + deltaX;
            let newY = initialY + deltaY;

            const tooltipRect = tooltipElement.getBoundingClientRect();
            const maxX = window.innerWidth - tooltipRect.width;
            const maxY = window.innerHeight - tooltipRect.height;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            tooltipElement.style.left = newX + 'px';
            tooltipElement.style.top = newY + 'px';

            event.preventDefault();
        });

        document.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    /**
     * Handle marker click to show persistent tooltip
     * @param {object} event - Click event
     * @param {object} data - Data object
     * @param {string} type - Tooltip type
     * @returns {HTMLElement} - The created persistent tooltip element
     */
    handleMarkerClick(event, data, type = 'location') {
        event.stopPropagation();
        return this.showPersistentTooltip(event, data, type);
    }

    /**
     * Setup tooltip event handlers for a D3 selection
     * @param {object} selection - D3 selection of markers
     * @param {object} tooltip - D3 tooltip selection
     * @param {string} dataType - Type of data for tooltip
     */
    setupTooltipHandlers(selection, tooltip, dataType = 'location') {
        selection
            .on('mouseover', (event, data) => {
                this.showTooltip(tooltip, event, data, dataType);
            })
            .on('mouseout', () => {
                this.hideTooltip(tooltip);
            })
            .on('click', (event, data) => {
                this.handleMarkerClick(event, data, dataType);
            });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationMarkerStyles;
} else {
    window.LocationMarkerStyles = LocationMarkerStyles;
}

/**
 * USAGE EXAMPLE:
 * 
 * // Initialize the styles class
 * const styles = new LocationMarkerStyles();
 * 
 * // Setup tooltip (for D3-based visualizations)
 * const tooltip = d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0);
 * 
 * // Apply to marker selection
 * const markers = d3.selectAll('.marker');
 * styles.setupTooltipHandlers(markers, tooltip, 'chapel');
 * 
 * // For manual tooltip creation:
 * const chapelData = {
 *     name: 'St. Peter\'s Basilica',
 *     type: 'basilica',
 *     city: 'Vatican City',
 *     country: 'Vatican',
 *     lat: 41.9022,
 *     lng: 12.4539,
 *     yearFounded: 1626,
 *     description: 'A major basilica in Vatican City'
 * };
 * 
 * // Regular tooltip (on hover)
 * styles.showTooltip(tooltip, event, chapelData, 'chapel');
 * 
 * // Persistent tooltip (on click)
 * styles.showPersistentTooltip(event, chapelData, 'chapel');
 * 
 * FEATURES:
 * - Hover tooltips: Show basic info on mouseover, hide on mouseout
 * - Click tooltips: Persistent tooltips with action buttons
 * - External links: Google Earth, Google Maps, OpenStreetMap
 * - Copy coordinates: One-click coordinate copying
 * - Auto-positioning: Adjusts position to stay on screen
 * - Click outside to close: Click anywhere to close persistent tooltips
 * - Close button: X button in top-right corner
 */
