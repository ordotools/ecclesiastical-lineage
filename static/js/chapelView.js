/**
 * Chapel View Visualization
 * Interactive 3D globe showing chapel locations and relationships
 */

class ChapelViewVisualization {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.projection = d3.geoOrthographic();
        this.path = d3.geoPath().projection(this.projection);
        this.svg = null;
        this.g = null;
        this.tooltip = null;
        this.rotation = [0, -20, 0]; // Start with a view showing Europe/Africa
        this.isDragging = false;
        this.lastMousePosition = null;
        this.clipAngle = 90; // Clip angle for backface culling
        
        // Initialize centralized styling
        this.styles = new LocationMarkerStyles();
        
        // Country color palette - traditional paper map colors
        this.countryColors = {
            // Europe - muted earth tones
            'Italy': '#D4B896',
            'France': '#B8A082',
            'Spain': '#C4A484',
            'Germany': '#A09070',
            'United Kingdom': '#9C8A6A',
            'Ireland': '#B09C7C',
            'Netherlands': '#A89474',
            'Belgium': '#B4A084',
            'Switzerland': '#AC9878',
            'Austria': '#A08C6C',
            'Poland': '#C0987A',
            'Czech Republic': '#B49072',
            'Hungary': '#BC9476',
            'Romania': '#B89478',
            'Bulgaria': '#C09A7C',
            'Greece': '#B89074',
            'Portugal': '#C49A7E',
            'Russia': '#A88868',
            
            // Asia - warmer earth tones
            'China': '#D0A080',
            'Japan': '#D8A888',
            'India': '#E0B090',
            'South Korea': '#D4A484',
            'Thailand': '#DCA888',
            'Vietnam': '#D8A884',
            'Indonesia': '#E4B490',
            'Philippines': '#DCAC8C',
            'Malaysia': '#E0B090',
            'Singapore': '#D8A888',
            'Turkey': '#D0A080',
            'Iran': '#CCA078',
            'Saudi Arabia': '#C89870',
            'Israel': '#D4A484',
            'Jordan': '#D0A080',
            'Lebanon': '#D4A484',
            'Syria': '#D0A080',
            'Iraq': '#CCA078',
            
            // Africa - golden earth tones
            'Egypt': '#E4B890',
            'Libya': '#E0B48C',
            'Tunisia': '#DCB088',
            'Algeria': '#D8AC84',
            'Morocco': '#D4A880',
            'Sudan': '#E0B48C',
            'Ethiopia': '#E4B890',
            'Kenya': '#E8BC94',
            'Nigeria': '#E4B890',
            'South Africa': '#E0B48C',
            'Ghana': '#E4B890',
            'Tanzania': '#E8BC94',
            'Uganda': '#E4B890',
            'Zimbabwe': '#E0B48C',
            'Angola': '#E4B890',
            'Cameroon': '#E8BC94',
            
            // Americas - varied earth tones
            'United States': '#D0A078',
            'Canada': '#C89870',
            'Mexico': '#D8A880',
            'Brazil': '#E0B088',
            'Argentina': '#D4A078',
            'Chile': '#D8A480',
            'Colombia': '#DCA884',
            'Peru': '#E0AC88',
            'Venezuela': '#DCA884',
            'Cuba': '#D8A480',
            'Dominican Republic': '#D4A078',
            'Haiti': '#D8A480',
            'Jamaica': '#DCA884',
            'Trinidad and Tobago': '#DCA884',
            'Guyana': '#E0AC88',
            'Suriname': '#DCA884',
            
            // Oceania - warm earth tones
            'Australia': '#E4B490',
            'New Zealand': '#E0B08C',
            'Papua New Guinea': '#E4B490',
            'Fiji': '#E0B08C',
            'Samoa': '#E4B490',
            'Tonga': '#E0B08C',
            
            // Default color for unrecognized countries
            'default': '#D2B48C'
        };
        
        // Fallback color palette for when country names don't match - traditional map colors
        this.fallbackColors = [
            '#D4B896', '#B8A082', '#C4A484', '#A09070', '#9C8A6A',
            '#B09C7C', '#A89474', '#B4A084', '#AC9878', '#A08C6C',
            '#C0987A', '#B49072', '#BC9476', '#B89478', '#C09A7C',
            '#B89074', '#C49A7E', '#A88868', '#D0A080', '#D8A888',
            '#E0B090', '#D4A484', '#DCA888', '#D8A884', '#E4B490'
        ];
        
        // Sample geographic coordinates for clergy (you can expand this)
        this.geographicData = {
            // Vatican City
            'Vatican': { lat: 41.9029, lng: 12.4534, name: 'Vatican City' },
            // Rome
            'Rome': { lat: 41.9028, lng: 12.4964, name: 'Rome' },
            // Canterbury
            'Canterbury': { lat: 51.2802, lng: 1.0789, name: 'Canterbury' },
            // New York
            'New York': { lat: 40.7128, lng: -74.0060, name: 'New York' },
            // London
            'London': { lat: 51.5074, lng: -0.1278, name: 'London' },
            // Paris
            'Paris': { lat: 48.8566, lng: 2.3522, name: 'Paris' },
            // Moscow
            'Moscow': { lat: 55.7558, lng: 37.6176, name: 'Moscow' },
            // Constantinople/Istanbul
            'Istanbul': { lat: 41.0082, lng: 28.9784, name: 'Istanbul' },
            // Jerusalem
            'Jerusalem': { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
            // Alexandria
            'Alexandria': { lat: 31.2001, lng: 29.9187, name: 'Alexandria' },
            // Antioch
            'Antioch': { lat: 36.2021, lng: 36.1603, name: 'Antioch' },
            // Athens
            'Athens': { lat: 37.9838, lng: 23.7275, name: 'Athens' },
            // Dublin
            'Dublin': { lat: 53.3498, lng: -6.2603, name: 'Dublin' },
            // Madrid
            'Madrid': { lat: 40.4168, lng: -3.7038, name: 'Madrid' },
            // Cologne
            'Cologne': { lat: 50.9375, lng: 6.9603, name: 'Cologne' },
            // Milan
            'Milan': { lat: 45.4642, lng: 9.1900, name: 'Milan' },
            // Florence
            'Florence': { lat: 43.7696, lng: 11.2558, name: 'Florence' },
            // Venice
            'Venice': { lat: 45.4408, lng: 12.3155, name: 'Venice' },
            // Naples
            'Naples': { lat: 40.8518, lng: 14.2681, name: 'Naples' },
            // Barcelona
            'Barcelona': { lat: 41.3851, lng: 2.1734, name: 'Barcelona' }
        };
        
        this.init();
    }
    
    getCountryColor(countryName, index = 0) {
        // Normalize country name for matching
        const normalizedName = countryName ? countryName.trim() : '';
        
        // If no name provided, use fallback color based on index
        if (!normalizedName || normalizedName === 'Unknown') {
            return this.fallbackColors[index % this.fallbackColors.length];
        }
        
        // Direct match first
        if (this.countryColors[normalizedName]) {
            return this.countryColors[normalizedName];
        }
        
        // Try partial matches for common variations
        for (const [key, color] of Object.entries(this.countryColors)) {
            if (key.toLowerCase().includes(normalizedName.toLowerCase()) || 
                normalizedName.toLowerCase().includes(key.toLowerCase())) {
                return color;
            }
        }
        
        // Try some common country name variations and mappings
        const countryMappings = {
            'United States of America': 'United States',
            'USA': 'United States',
            'UK': 'United Kingdom',
            'Great Britain': 'United Kingdom',
            'Britain': 'United Kingdom',
            'South Korea': 'South Korea',
            'North Korea': 'South Korea', // Use same color for now
            'Republic of Korea': 'South Korea',
            'Russian Federation': 'Russia',
            'People\'s Republic of China': 'China',
            'PRC': 'China',
            'Federal Republic of Germany': 'Germany',
            'Deutschland': 'Germany',
            'French Republic': 'France',
            'République Française': 'France',
            'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
            'Kingdom of Spain': 'Spain',
            'Reino de España': 'Spain',
            'Italian Republic': 'Italy',
            'Repubblica Italiana': 'Italy',
            'Republic of India': 'India',
            'Bharat': 'India',
            'State of Japan': 'Japan',
            'Nippon': 'Japan',
            'Australia': 'Australia',
            'Commonwealth of Australia': 'Australia',
            'Canada': 'Canada',
            'United Mexican States': 'Mexico',
            'Estados Unidos Mexicanos': 'Mexico',
            'Federative Republic of Brazil': 'Brazil',
            'República Federativa do Brasil': 'Brazil'
        };
        
        // Check mappings
        if (countryMappings[normalizedName]) {
            return this.countryColors[countryMappings[normalizedName]] || this.fallbackColors[index % this.fallbackColors.length];
        }
        
        // Return fallback color based on index if no match found
        return this.fallbackColors[index % this.fallbackColors.length];
    }
    
    applyBackfaceCulling() {
        // Apply backface culling to hide countries on the back side of the globe
        this.projection.clipAngle(this.clipAngle);
        
        // Update all paths with new clipping
        this.g.selectAll('.country-path').attr('d', this.path);
        this.g.selectAll('.globe-graticule').attr('d', this.path);
        
        // Update location node positions
        this.updateLocationPositions();
        
        // console.log(`Back-face culling applied with clip angle: ${this.clipAngle}`);
    }
    
    updateLocationPositions() {
        // Update location marker positions with proper backface culling
        const markers = this.g.selectAll('.location-marker');
        
        markers.each((d, i, nodes) => {
            const marker = d3.select(nodes[i]);
            const locationId = marker.attr('data-location-id');
            
            // Find the location data by ID
            const location = window.nodesData.find(loc => loc.id == locationId);
            if (location && location.latitude !== undefined && location.longitude !== undefined) {
                // Check if location is visible using 3D backface culling
                const isVisible = this.isLocationVisible(location.longitude, location.latitude);
                
                if (isVisible) {
                    // Get coordinates using the main projection
                    const [x, y] = this.projection([location.longitude, location.latitude]);
                    
                    if (x !== undefined && y !== undefined) {
                        // Update position and show the marker
                        marker.attr('cx', x).attr('cy', y);
                        marker.style('opacity', '1');
                        marker.style('pointer-events', 'all');
                    } else {
                        // Hide the location if projection fails
                        marker.style('opacity', '0');
                        marker.style('pointer-events', 'none');
                    }
                } else {
                    // Hide the location if it's on the back side of the globe
                    marker.style('opacity', '0');
                    marker.style('pointer-events', 'none');
                }
            }
        });
    }
    
    isLocationVisible(longitude, latitude) {
        // Use D3's geoRotation for proper backface culling
        // This leverages D3's built-in spherical math functions

        try {
            // Get the projected coordinates first
            const projected = this.projection([longitude, latitude]);
            
            // If projection returns null, the point is not visible
            if (!projected || projected.length !== 2) {
                return false;
            }

            const [x, y] = projected;

            // Check if coordinates are valid numbers
            if (isNaN(x) || isNaN(y)) {
                return false;
            }

            // Use D3's geoRotation to get the rotated point
            const rotation = this.projection.rotate();
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
            console.warn('Error in location visibility check:', error);
            return false;
        }
    }
    
    init() {
        console.log('Initializing Chapel View Visualization');
        this.setupSVG();
        this.setupTooltip();
        this.loadWorldData();
        this.setupEventListeners();
        this.hideLoadingIndicator();
    }
    
    setupSVG() {
        const container = d3.select('#globe-container');
        const containerNode = container.node();
        
        // Get actual container dimensions
        const containerWidth = containerNode.offsetWidth;
        const containerHeight = containerNode.offsetHeight;
        
        // Use container dimensions instead of this.width/this.height
        this.width = containerWidth;
        this.height = containerHeight;
        
        this.svg = container
            .append('svg')
            .attr('class', 'globe-svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('z-index', '10')
            .style('overflow', 'hidden')
            .style('max-width', '100%')
            .style('max-height', '100%');
            
            
        this.g = this.svg.append('g');
        
        // Set initial projection with backface culling
        this.projection
            .scale(Math.min(this.width, this.height) / 2 - 50)
            .translate([this.width / 2, this.height / 2])
            .clipAngle(this.clipAngle)
            .rotate(this.rotation);
            
        
        // Add rotation indicator for debugging
        this.addRotationIndicator();
    }
    
    setupTooltip() {
        // Create a simple, reliable tooltip
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('max-width', '200px')
            .style('opacity', 0)
            .style('display', 'none');
        
        console.log('Tooltip setup complete:', this.tooltip);
    }
    
    createOceanGradient() {
        // Create SVG defs for ocean gradient only
        const defs = this.svg.append('defs');
        
        // Ocean gradient - clear blue water
        const oceanGradient = defs.append('radialGradient')
            .attr('id', 'oceanGradient')
            .attr('cx', '30%')
            .attr('cy', '30%')
            .attr('r', '70%');
            
        oceanGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#4A90E2')
            .attr('stop-opacity', 0.8);
            
        oceanGradient.append('stop')
            .attr('offset', '70%')
            .attr('stop-color', '#2E5BBA')
            .attr('stop-opacity', 0.7);
            
        oceanGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#1E3A8A')
            .attr('stop-opacity', 0.6);
        
        // Atmospheric glow
        const glowGradient = defs.append('radialGradient')
            .attr('id', 'glowGradient')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');
            
        glowGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#ffffff')
            .attr('stop-opacity', 0.3);
            
        glowGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#ffffff')
            .attr('stop-opacity', 0);
    }
    
    async loadWorldData() {
        try {
            // Try multiple data sources for world map - using working sources
            let world;
            const dataSources = [
                'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
                'https://unpkg.com/world-atlas@1/world/110m.json',
                'https://raw.githubusercontent.com/d3/d3-geo/master/test/data/world-110m.json'
            ];
            
            for (const url of dataSources) {
                try {
                    console.log(`Trying to load world data from: ${url}`);
                    world = await d3.json(url);
                    console.log('Successfully loaded world data from:', url);
                    break;
                } catch (err) {
                    console.warn(`Failed to load from ${url}:`, err);
                    continue;
                }
            }
            
            if (!world) {
                throw new Error('All world data sources failed');
            }
            
            // Create graticule
            const graticule = d3.geoGraticule();
            
            // Draw world map - handle both TopoJSON and GeoJSON formats
            let worldData;
            if (world.objects && world.objects.land) {
                // TopoJSON format
                worldData = topojson.feature(world, world.objects.land);
            } else if (world.features) {
                // GeoJSON format
                worldData = world;
            } else {
                throw new Error('Unknown world data format');
            }
            
            // Create ocean gradient for background
            this.createOceanGradient();
            
            // Create ocean background as a circle that rotates with the globe
            this.g.append('circle')
                .attr('class', 'ocean-background')
                .attr('cx', this.width / 2)
                .attr('cy', this.height / 2)
                .attr('r', Math.min(this.width, this.height) / 2 - 50)
                .attr('fill', 'url(#oceanGradient)')
                .attr('stroke', '#2E5BBA')
                .attr('stroke-width', 2)
                .attr('opacity', 1.0);
            
            // Debug: Log the first few features to see the data structure
            if (worldData.features && worldData.features.length > 0) {
                console.log('Sample world data feature:', worldData.features[0]);
                console.log('Available properties:', Object.keys(worldData.features[0].properties || {}));
            }
            
            // Draw world map with individual country colors
            this.g.selectAll('.country-path')
                .data(worldData.features)
                .enter()
                .append('path')
                .attr('class', 'country-path')
                .attr('d', this.path)
                .attr('fill', (d, i) => {
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN || d.properties.name_en || d.properties.ADMIN || d.properties.ADMIN_EN || 'Unknown';
                    const color = this.getCountryColor(countryName, i);
                    // console.log(`Country ${i}: ${countryName}, Color: ${color}`);
                    return color;
                })
                .attr('stroke', '#4A3E33')
                .attr('stroke-width', 0.3)
                .attr('opacity', 1)
                .on('mouseover', (event, d) => {
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN || d.properties.name_en || d.properties.ADMIN || d.properties.ADMIN_EN || 'Unknown';
                    this.showCountryTooltip(event, countryName);
                })
                .on('mouseout', () => this.hideTooltip());
            
            // Apply backface culling after countries are rendered
            this.applyBackfaceCulling();
            
            
                
            // Draw graticule with subtle styling
            this.g.append('path')
                .datum(graticule)
                .attr('class', 'globe-graticule')
                .attr('d', this.path)
                .attr('fill', 'none')
                .attr('stroke', '#666')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.6);
            
            // Add atmospheric glow effect first (so it's behind everything)
            this.addAtmosphericGlow();
            
            // Add location nodes last (so they're on top of everything)
            this.addLocationNodes();
            
        } catch (error) {
            console.error('Error loading world data:', error);
            this.showError('Failed to load world map data - using fallback visualization');
            this.createFallbackVisualization();
        }
    }
    
    addLocationNodes() {
        if (!window.nodesData) {
            console.warn('No location data available');
            return;
        }
        
        const nodes = window.nodesData;
        console.log('Adding location nodes:', nodes.length);
        
        // Remove any existing location nodes
        this.g.selectAll('.location-nodes').remove();
        
        // Create a new group for location nodes
        const locationGroup = this.g.append('g').attr('class', 'location-nodes');
        
        nodes.forEach((location, index) => {
            // Check if location is visible using 3D backface culling
            const isVisible = this.isLocationVisible(location.longitude, location.latitude);
            
            if (isVisible) {
                // Get projected coordinates
                const [x, y] = this.projection([location.longitude, location.latitude]);
                
                if (x !== undefined && y !== undefined) {
                    // Create a simple, clean location marker using centralized styling
                    const marker = locationGroup.append('circle')
                        .attr('class', this.styles.getCSSClass('locationMarker'))
                        .attr('cx', x)
                        .attr('cy', y)
                        .attr('data-location-id', location.id);
                    
                    // Apply styling using centralized configuration
                    this.styles.applyMarkerStyle(marker, 'normal', location.color);
                    
                    // Add click handler
                    marker.on('click', (event) => {
                        console.log('Location clicked:', location.name);
                        event.stopPropagation();
                        this.handleLocationClick(event, location);
                    });
                    
                    // Add hover effects using centralized styling
                    marker.on('mouseover', (event) => {
                        this.styles.applyMarkerStyle(d3.select(event.target), 'hover', location.color);
                        this.showLocationTooltip(event, location);
                    });
                    
                    marker.on('mouseout', (event) => {
                        this.styles.applyMarkerStyle(d3.select(event.target), 'normal', location.color);
                        this.hideTooltip();
                    });
                } else {
                    console.error(`Failed to project coordinates for ${location.name}: [${location.longitude}, ${location.latitude}]`);
                }
            } else {
                // Location is on the back side of the globe, create hidden marker
                const marker = locationGroup.append('circle')
                    .attr('class', this.styles.getCSSClass('locationMarker'))
                    .attr('cx', 0)
                    .attr('cy', 0)
                    .attr('data-location-id', location.id);
                
                // Apply hidden styling using centralized configuration
                this.styles.applyMarkerStyle(marker, 'hidden', location.color);
                
                // Add click handler (will be enabled when visible)
                marker.on('click', (event) => {
                    console.log('Location clicked:', location.name);
                    event.stopPropagation();
                    this.handleLocationClick(location);
                });
                
                // Add hover effects (will be enabled when visible)
                marker.on('mouseover', (event) => {
                    this.styles.applyMarkerStyle(d3.select(event.target), 'hover', location.color);
                    this.showLocationTooltip(event, location);
                });
                
                marker.on('mouseout', (event) => {
                    this.styles.applyMarkerStyle(d3.select(event.target), 'normal', location.color);
                    this.hideTooltip();
                });
            }
        });
        
        console.log('Location nodes created successfully');
    }
    
    
    groupNodesByLocation(nodes) {
        const groups = {};
        
        nodes.forEach(node => {
            // Simple heuristic: assign nodes to locations based on organization or name
            let location = 'Rome'; // Default location
            
            if (node.organization) {
                const org = node.organization.toLowerCase();
                if (org.includes('vatican') || org.includes('rome')) location = 'Vatican';
                else if (org.includes('canterbury')) location = 'Canterbury';
                else if (org.includes('new york') || org.includes('america')) location = 'New York';
                else if (org.includes('london') || org.includes('england')) location = 'London';
                else if (org.includes('paris') || org.includes('france')) location = 'Paris';
                else if (org.includes('moscow') || org.includes('russia')) location = 'Moscow';
                else if (org.includes('constantinople') || org.includes('istanbul')) location = 'Istanbul';
                else if (org.includes('jerusalem')) location = 'Jerusalem';
                else if (org.includes('alexandria')) location = 'Alexandria';
                else if (org.includes('antioch')) location = 'Antioch';
                else if (org.includes('athens') || org.includes('greece')) location = 'Athens';
                else if (org.includes('dublin') || org.includes('ireland')) location = 'Dublin';
                else if (org.includes('madrid') || org.includes('spain')) location = 'Madrid';
                else if (org.includes('cologne') || org.includes('germany')) location = 'Cologne';
                else if (org.includes('milan')) location = 'Milan';
                else if (org.includes('florence')) location = 'Florence';
                else if (org.includes('venice')) location = 'Venice';
                else if (org.includes('naples')) location = 'Naples';
                else if (org.includes('barcelona')) location = 'Barcelona';
            }
            
            if (!groups[location]) {
                groups[location] = [];
            }
            groups[location].push(node);
        });
        
        return groups;
    }
    
    getNodeRadius(rank) {
        if (!rank) return 2;
        
        const rankLower = rank.toLowerCase();
        if (rankLower.includes('pope')) return 6;
        if (rankLower.includes('archbishop')) return 5;
        if (rankLower.includes('bishop')) return 4;
        if (rankLower.includes('priest')) return 2;
        return 3;
    }
    
    addLineageConnections() {
        if (!window.linksData) {
            console.warn('No links data available');
            return;
        }
        
        // window.linksData is already a JavaScript object, not a JSON string
        const links = window.linksData;
        console.log('Adding lineage connections:', links.length);
        
        const linkGroup = this.g.append('g').attr('class', 'lineage-links');
        
        links.forEach(link => {
            // Find source and target nodes
            const sourceNode = this.findNodeByLocation(link.source);
            const targetNode = this.findNodeByLocation(link.target);
            
            if (sourceNode && targetNode) {
                const sourceCoords = this.geographicData[sourceNode.location];
                const targetCoords = this.geographicData[targetNode.location];
                
                    if (sourceCoords && targetCoords) {
                        const [x1, y1] = this.projection([sourceCoords.lng, sourceCoords.lat]);
                        const [x2, y2] = this.projection([targetCoords.lng, targetCoords.lat]);
                        
                        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
                            linkGroup.append('line')
                                .attr('class', `lineage-link ${link.type}`)
                                .attr('data-source-location', sourceNode.location)
                                .attr('data-target-location', targetNode.location)
                                .attr('x1', x1)
                                .attr('y1', y1)
                                .attr('x2', x2)
                                .attr('y2', y2);
                        }
                    }
            }
        });
    }
    
    findNodeByLocation(nodeId) {
        // This is a simplified implementation
        // In a real implementation, you'd need to track node locations more precisely
        return null;
    }
    
    addAtmosphericGlow() {
        // Add a subtle atmospheric glow around the globe
        const glowRadius = Math.min(this.width, this.height) / 2 - 30;
        
        this.g.append('circle')
            .attr('class', 'atmospheric-glow')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', glowRadius)
            .attr('fill', 'url(#glowGradient)')
            .attr('stroke', 'none')
            .style('filter', 'blur(2px)')
            .style('opacity', 0.4);
    }
    
    setupEventListeners() {
        // Drag to rotate globe - only on empty space, not on location markers
        this.svg
            .call(d3.drag()
                .filter((event) => {
                    // Only allow dragging if not clicking on a location marker
                    const target = event.target;
                    return !target.classList.contains('location-marker');
                })
                .on('start', (event) => {
                    this.isDragging = true;
                    this.lastMousePosition = d3.pointer(event, this.svg.node());
                    this.svg.classed('dragging', true);
                })
                .on('drag', (event) => {
                    if (this.isDragging) {
                        const currentMousePosition = d3.pointer(event, this.svg.node());
                        const deltaX = currentMousePosition[0] - this.lastMousePosition[0];
                        const deltaY = currentMousePosition[1] - this.lastMousePosition[1];
                        
                        this.rotation[0] += deltaX * 0.5;
                        this.rotation[1] -= deltaY * 0.5;
                        
                        this.projection.rotate(this.rotation);
                        this.updateGlobe();
                        this.updateRotationIndicator();
                        
                        this.lastMousePosition = currentMousePosition;
                    }
                })
                .on('end', () => {
                    this.isDragging = false;
                    this.svg.classed('dragging', false);
                }));
        
        // Zoom
        this.svg
            .call(d3.zoom()
                .scaleExtent([0.5, 3])
                .on('zoom', (event) => {
                    const scale = event.transform.k;
                    this.projection.scale((Math.min(this.width, this.height) / 2 - 50) * scale);
                    this.updateGlobe();
                    
                    // Trigger chapel updates during zoom
                    this.svg.dispatch('update-chapels');
                }));
        
        // Control buttons
        d3.select('#reset-zoom').on('click', () => this.resetView());
        d3.select('#center-graph').on('click', () => this.centerGlobe());
        d3.select('#reset-zoom-mobile').on('click', () => this.resetView());
        d3.select('#center-graph-mobile').on('click', () => this.centerGlobe());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Panel-specific resize observer for better responsiveness
        if (window.ResizeObserver) {
            const container = d3.select('#globe-container').node();
            if (container) {
                this.resizeObserver = new ResizeObserver(() => {
                    this.handleResize();
                });
                this.resizeObserver.observe(container);
            }
        }
    }
    
    updateGlobe() {
        // Get current scale from projection
        const currentScale = this.projection.scale();
        
        // Update ocean background circle with current scale
        this.g.selectAll('.ocean-background')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', currentScale);
        
        // Update country paths with backface culling
        this.applyBackfaceCulling();
        
        // No links to update for locations
        
        // Update atmospheric glow with current scale
        this.g.selectAll('.atmospheric-glow')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', currentScale - 30);
        
        // Update fallback globe circle if it exists
        this.g.selectAll('.globe-fallback')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', currentScale - 30);
    }
    
    resetView() {
        this.rotation = [0, 0, 0];
        this.projection
            .scale(Math.min(this.width, this.height) / 2 - 50)
            .clipAngle(this.clipAngle)
            .rotate(this.rotation);
        this.updateGlobe();
        this.updateRotationIndicator();
        
        // Trigger chapel updates
        this.svg.dispatch('update-chapels');
    }
    
    centerGlobe() {
        this.rotation = [0, 0, 0];
        this.projection
            .clipAngle(this.clipAngle)
            .rotate(this.rotation);
        this.updateGlobe();
        this.updateRotationIndicator();
        
        // Trigger chapel updates
        this.svg.dispatch('update-chapels');
    }
    
    handleResize() {
        const container = d3.select('#globe-container');
        const containerNode = container.node();
        
        if (!containerNode) return;
        
        // Get actual container dimensions
        const containerWidth = containerNode.offsetWidth;
        const containerHeight = containerNode.offsetHeight;
        
        // Update dimensions
        this.width = containerWidth;
        this.height = containerHeight;
        
        // Update SVG dimensions
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
            
        // Update projection
        this.projection
            .scale(Math.min(this.width, this.height) / 2 - 50)
            .translate([this.width / 2, this.height / 2]);
            
        // Update the globe
        this.updateGlobe();
    }
    
    showLocationTooltip(event, location) {
        this.styles.showTooltip(this.tooltip, event, location, 'location');
    }
    
    showTooltip(event, clergy, location) {
        this.tooltip
            .style('opacity', 1)
            .html(`
                <h6>${clergy.name}</h6>
                <p><strong>Rank:</strong> ${clergy.rank || 'Unknown'}</p>
                <p><strong>Organization:</strong> ${clergy.organization || 'Unknown'}</p>
                <p><strong>Location:</strong> ${location}</p>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    showCountryTooltip(event, countryName) {
        this.tooltip
            .style('opacity', 1)
            .html(`
                <h6>${countryName}</h6>
                <p><strong>Color:</strong> ${this.getCountryColor(countryName)}</p>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    hideTooltip() {
        this.styles.hideTooltip(this.tooltip);
    }
    
    handleLocationClick(event, location) {
        console.log('=== LOCATION CLICKED ===');
        console.log('Location:', location.name);
        console.log('Type:', location.location_type);
        console.log('Coordinates:', [location.latitude, location.longitude]);
        
        // Use persistent tooltip instead of side panel
        this.styles.showPersistentTooltip(event, location, 'location');
    }
    
    selectLocation(event, location) {
        console.log('Selected location:', location);
        this.showLocationDetails(location);
    }
    
    showLocationDetails(location) {
        console.log('showLocationDetails called for:', location.name, location);
        const asidePanel = document.getElementById('location-info-panel');
        if (!asidePanel) {
            console.error('location-info-panel not found!');
            return;
        }
        console.log('Found aside panel:', asidePanel);
        
        const locationTypeColors = {
            'church': '#27ae60',
            'cathedral': '#9b59b6', 
            'monastery': '#f39c12',
            'seminary': '#1abc9c',
            'organization': '#3498db',
            'address': '#e74c3c'
        };
        
        const color = locationTypeColors[location.location_type] || '#95a5a6';
        
        asidePanel.innerHTML = `
            <div class="card">
                <div class="card-header" style="background: ${color}; color: white;">
                    <h5 class="mb-0">
                        <i class="fas fa-map-marker-alt me-2"></i>
                        ${location.name}
                    </h5>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <span class="badge" style="background: ${color};">
                            ${location.location_type.charAt(0).toUpperCase() + location.location_type.slice(1)}
                        </span>
                    </div>
                    
                    ${location.pastor_name ? `
                    <div class="mb-2">
                        <strong>Pastor/Leader:</strong><br>
                        <span class="text-muted">${location.pastor_name}</span>
                    </div>
                    ` : ''}
                    
                    ${location.organization ? `
                    <div class="mb-2">
                        <strong>Organization:</strong><br>
                        <span class="text-muted">${location.organization}</span>
                    </div>
                    ` : ''}
                    
                    ${location.address ? `
                    <div class="mb-2">
                        <strong>Address:</strong><br>
                        <span class="text-muted">${location.address}</span>
                    </div>
                    ` : ''}
                    
                    <div class="mb-2">
                        <strong>Coordinates:</strong><br>
                        <span class="text-muted">${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</span>
                    </div>
                    
                    ${location.notes ? `
                    <div class="mb-3">
                        <strong>Notes:</strong><br>
                        <span class="text-muted">${location.notes}</span>
                    </div>
                    ` : ''}
                    
                    <div class="d-grid gap-2">
                        <a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" 
                           target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="fas fa-external-link-alt me-1"></i>View on Google Maps
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Show the aside panel
        const aside = document.getElementById('location-aside');
        console.log('Found aside element:', aside);
        if (aside) {
            console.log('Adding show class to aside panel');
            aside.classList.add('show');
            aside.style.transform = 'translateX(0)';
            aside.style.display = 'block';
            aside.style.visibility = 'visible';
            console.log('Aside panel classes after adding show:', aside.className);
            console.log('Aside panel styles after forcing show:', {
                transform: aside.style.transform,
                display: aside.style.display,
                visibility: aside.style.visibility
            });
        } else {
            console.error('location-aside element not found!');
        }
    }
    
    selectClergy(event, clergy) {
        console.log('Selected clergy:', clergy);
        // You can add clergy selection logic here
        // For example, load clergy details in the side panel
    }
    
    createFallbackVisualization() {
        console.log('Creating fallback visualization');
        
        // Create ocean gradient for fallback
        this.createOceanGradient();
        
        // Get initial scale from projection
        const initialScale = this.projection.scale();
        
        // Create ocean background as circle for fallback
        this.g.append('circle')
            .attr('class', 'ocean-background')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', initialScale)
            .attr('fill', 'url(#oceanGradient)')
                .attr('stroke', '#2E5BBA')
                .attr('stroke-width', 1.5)
                .attr('opacity', 1.0);
        
        // Create a simple circle to represent land with traditional map color
        this.g.append('circle')
            .attr('class', 'globe-fallback')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', initialScale - 30)
            .attr('fill', '#D4B896') // Traditional map land color
            .attr('stroke', '#4A3E33')
            .attr('stroke-width', 0.5)
            .attr('opacity', 1);
        
        // Add some grid lines to simulate a globe
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x1 = this.width / 2 + Math.cos(angle) * initialScale;
            const y1 = this.height / 2 + Math.sin(angle) * initialScale;
            const x2 = this.width / 2 - Math.cos(angle) * initialScale;
            const y2 = this.height / 2 - Math.sin(angle) * initialScale;
            
            this.g.append('line')
                .attr('class', 'globe-graticule')
                .attr('x1', x1)
                .attr('y1', y1)
                .attr('x2', x2)
                .attr('y2', y2)
                .attr('stroke', '#333')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.6);
        }
        
        // Add location nodes
        this.addLocationNodes();
    }
    
    showError(message) {
        console.error(message);
        // You can add error display logic here
    }
    
    addRotationIndicator() {
        // Add a small rotation indicator in the corner
        this.rotationIndicator = d3.select('#globe-container')
            .append('div')
            .attr('class', 'rotation-indicator')
            .style('position', 'absolute')
            .style('top', '10px')
            .style('right', '10px')
            .style('background', 'rgba(0, 0, 0, 0.7)')
            .style('color', 'white')
            .style('padding', '4px 8px')
            .style('border-radius', '4px')
            .style('font-size', '10px')
            .style('font-family', 'monospace')
            .style('z-index', '1000')
            .style('opacity', '0.7')
            .text(`Lat: ${this.rotation[0].toFixed(1)}°, Lng: ${this.rotation[1].toFixed(1)}°`);
    }
    
    updateRotationIndicator() {
        if (this.rotationIndicator) {
            this.rotationIndicator.text(`Lat: ${this.rotation[0].toFixed(1)}°, Lng: ${this.rotation[1].toFixed(1)}°`);
        }
    }
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    // Debug function to test culling behavior
    debugCulling() {
        console.log('=== Culling Debug Information ===');
        const [rotateX, rotateY, rotateZ] = this.projection.rotate();
        console.log(`Current rotation: X=${rotateX.toFixed(1)}°, Y=${rotateY.toFixed(1)}°, Z=${rotateZ.toFixed(1)}°`);
        console.log(`Clip angle: ${this.clipAngle}°`);
        
        // Test some key coordinates
        const testCoords = [
            { name: 'Vatican', lng: 12.4539, lat: 41.9022 },
            { name: 'New York', lng: -74.0060, lat: 40.7128 },
            { name: 'London', lng: -0.1278, lat: 51.5074 },
            { name: 'Paris', lng: 2.3522, lat: 48.8566 },
            { name: 'Moscow', lng: 37.6176, lat: 55.7558 },
            { name: 'Istanbul', lng: 28.9784, lat: 41.0082 },
            { name: 'Jerusalem', lng: 35.2137, lat: 31.7683 },
            { name: 'Sydney', lng: 151.2093, lat: -33.8688 },
            { name: 'Tokyo', lng: 139.6917, lat: 35.6895 },
            { name: 'Equator/Prime Meridian', lng: 0, lat: 0 }
        ];
        
        console.log('\nVisibility test results:');
        testCoords.forEach(coord => {
            const isVisible = this.isLocationVisible(coord.lng, coord.lat);
            const projection = this.projection([coord.lng, coord.lat]);
            console.log(`${coord.name}: Visible=${isVisible}, Projection=[${projection[0]?.toFixed(1) || 'undefined'}, ${projection[1]?.toFixed(1) || 'undefined'}]`);
        });
        
        console.log('=== End Debug Information ===');
    }
    
    // Test function to verify location click functionality
    testLocationClicks() {
        console.log('=== Testing Location Click Functionality ===');
        
        // Check if location data exists
        if (!window.nodesData || window.nodesData.length === 0) {
            console.error('No location data available for testing');
            return;
        }
        
        console.log(`Found ${window.nodesData.length} locations in data`);
        console.log('Sample location:', window.nodesData[0]);
        
        // Check if location nodes exist in DOM
        const locationDots = this.g.selectAll('.location-dot');
        console.log(`Found ${locationDots.size()} location dots in DOM`);
        
        // Test clicking the first visible location
        const firstLocation = window.nodesData[0];
        console.log('Testing click on first location:', firstLocation.name);
        
        // Simulate a click event
        const mockEvent = { preventDefault: () => {} };
        this.selectLocation(mockEvent, firstLocation);
        
        console.log('=== End Location Click Test ===');
    }
    
    // Function to refresh location data from the server
    async refreshLocationData() {
        console.log('Refreshing location data from server...');
        
        try {
            // Fetch updated location data from the API endpoint
            const response = await fetch('/api/chapel-locations');
            const data = await response.json();
            
            if (data.success) {
                console.log(`Updated location data: ${data.count} locations`);
                console.log('Sample updated location:', data.nodes[0]);
                
                // Update the global data
                window.nodesData = data.nodes;
                
                // Clear existing location nodes
                this.g.selectAll('.location-nodes').remove();
                
                // Re-render location nodes with updated data
                this.addLocationNodes();
                
                console.log('Location data refreshed successfully');
                return true;
            } else {
                console.error('API returned error:', data.error);
                return false;
            }
        } catch (error) {
            console.error('Error refreshing location data:', error);
            return false;
        }
    }
    
    cleanup() {
        // Remove resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Remove tooltip
        if (this.tooltip) {
            this.tooltip.remove();
        }
        
        // Clear the container
        d3.select('#globe-container').selectAll('*').remove();
    }
    
    // Method to add a single location node dynamically
    addSingleLocationNode(locationData) {
        console.log('Adding single location node:', locationData);
        
        if (!this.g || !locationData.latitude || !locationData.longitude) {
            console.warn('Cannot add location node - missing globe or coordinates');
            return;
        }
        
        // Check if location is visible using 3D backface culling
        const isVisible = this.isLocationVisible(locationData.longitude, locationData.latitude);
        
        // Find or create the location nodes group
        let locationGroup = this.g.select('.location-nodes');
        if (locationGroup.empty()) {
            locationGroup = this.g.append('g').attr('class', 'location-nodes');
        }
        
        if (isVisible) {
            // Get projected coordinates
            const [x, y] = this.projection([locationData.longitude, locationData.latitude]);
            
            if (x === undefined || y === undefined) {
                console.warn('Could not project coordinates for location:', locationData.name);
                return;
            }
            
            // Create the location marker
            const marker = locationGroup.append('circle')
                .attr('class', 'location-marker')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 8)
                .attr('fill', locationData.color)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 3)
                .attr('data-location-id', locationData.id)
                .style('cursor', 'pointer')
                .style('pointer-events', 'all')
                .style('opacity', 1)
                .style('z-index', '1000');
            
            // Add click handler
            marker.on('click', (event) => {
                console.log('Location clicked:', locationData.name);
                event.stopPropagation();
                this.handleLocationClick(event, locationData);
            });
            
            // Add hover effects
            marker.on('mouseover', (event) => {
                d3.select(event.target)
                    .attr('r', 10);
                this.showLocationTooltip(event, locationData);
            });
            
            marker.on('mouseout', (event) => {
                d3.select(event.target)
                    .attr('r', 8);
                this.hideLocationTooltip();
            });
        } else {
            // Location is on the back side of the globe, create hidden marker
            const marker = locationGroup.append('circle')
                .attr('class', 'location-marker')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', 8)
                .attr('fill', locationData.color)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 3)
                .attr('data-location-id', locationData.id)
                .style('cursor', 'pointer')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .style('z-index', '1000');
            
            // Add click handler (will be enabled when visible)
            marker.on('click', (event) => {
                console.log('Location clicked:', locationData.name);
                event.stopPropagation();
                this.handleLocationClick(event, locationData);
            });
            
            // Add hover effects (will be enabled when visible)
            marker.on('mouseover', (event) => {
                d3.select(event.target)
                    .attr('r', 10);
                this.showLocationTooltip(event, locationData);
            });
            
            marker.on('mouseout', (event) => {
                d3.select(event.target)
                    .attr('r', 8);
                this.hideLocationTooltip();
            });
        }
        
        console.log('Single location node added successfully');
    }
    
    // Method to update a single location node dynamically
    updateSingleLocationNode(locationData) {
        console.log('Updating single location node:', locationData);
        
        if (!this.g || !locationData.latitude || !locationData.longitude) {
            console.warn('Cannot update location node - missing globe or coordinates');
            return;
        }
        
        // Find the existing marker by location ID
        const existingMarker = this.g.select(`[data-location-id="${locationData.id}"]`);
        
        if (existingMarker.empty()) {
            console.log('Location marker not found, adding as new node');
            this.addSingleLocationNode(locationData);
            return;
        }
        
        // Check if location is visible using 3D backface culling
        const isVisible = this.isLocationVisible(locationData.longitude, locationData.latitude);
        
        if (isVisible) {
            // Get projected coordinates
            const [x, y] = this.projection([locationData.longitude, locationData.latitude]);
            
            if (x === undefined || y === undefined) {
                console.warn('Could not project coordinates for location:', locationData.name);
                return;
            }
            
            // Update the existing marker
            existingMarker
                .attr('cx', x)
                .attr('cy', y)
                .attr('fill', locationData.color)
                .attr('data-location-id', locationData.id)
                .style('opacity', '1')
                .style('pointer-events', 'all');
        } else {
            // Location is on the back side of the globe, hide it
            existingMarker
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('fill', locationData.color)
                .attr('data-location-id', locationData.id)
                .style('opacity', '0')
                .style('pointer-events', 'none');
        }
        
        // Update the click handler with new data
        existingMarker.on('click', (event) => {
            console.log('Location clicked:', locationData.name);
            event.stopPropagation();
            this.handleLocationClick(locationData);
        });
        
        // Update hover handlers with new data
        existingMarker.on('mouseover', (event) => {
            d3.select(event.target)
                .attr('r', 10);
            this.showLocationTooltip(event, locationData);
        });
        
        existingMarker.on('mouseout', (event) => {
            d3.select(event.target)
                .attr('r', 8);
            this.hideLocationTooltip();
        });
        
        console.log('Single location node updated successfully');
    }
    
    // Method to remove a single location node dynamically
    removeLocationNode(locationId) {
        console.log('Removing single location node:', locationId);
        
        if (!this.g) {
            console.warn('Cannot remove location node - globe not available');
            return;
        }
        
        // Find and remove the existing marker by location ID
        const existingMarker = this.g.select(`[data-location-id="${locationId}"]`);
        
        if (existingMarker.empty()) {
            console.warn('Location marker not found for removal:', locationId);
            return;
        }
        
        // Remove the marker
        existingMarker.remove();
        
        console.log('Single location node removed successfully');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Chapel View Visualization');
    window.geographicVisualization = new ChapelViewVisualization();
    
    // Add test function to global scope for debugging
    window.testCountryColors = function() {
        if (window.geographicVisualization) {
            console.log('Testing country color function:');
            console.log('Italy:', window.geographicVisualization.getCountryColor('Italy'));
            console.log('France:', window.geographicVisualization.getCountryColor('France'));
            console.log('Unknown Country:', window.geographicVisualization.getCountryColor('Unknown Country', 0));
            console.log('Fallback colors:', window.geographicVisualization.fallbackColors);
        }
    };
    
    // Add location click test function to global scope
    window.testLocationClicks = function() {
        if (window.geographicVisualization) {
            window.geographicVisualization.testLocationClicks();
        } else {
            console.error('Geographic visualization not initialized yet');
        }
    };
    
    // Add location refresh function to global scope
    window.refreshLocationData = async function() {
        if (window.geographicVisualization) {
            return await window.geographicVisualization.refreshLocationData();
        } else {
            console.error('Geographic visualization not initialized yet');
            return false;
        }
    };
    
    // Add test function to simulate location clicks
    window.testLocationClick = function(locationIndex = 0) {
        if (window.geographicVisualization && window.nodesData && window.nodesData.length > 0) {
            const location = window.nodesData[locationIndex];
            if (location) {
                console.log('Testing click on location:', location.name);
                const mockEvent = { preventDefault: () => {} };
                window.geographicVisualization.selectLocation(mockEvent, location);
            } else {
                console.error('Location not found at index:', locationIndex);
            }
        } else {
            console.error('Geographic visualization or location data not available');
        }
    };
    
    // Add function to list all available locations
    window.listLocations = function() {
        if (window.nodesData && window.nodesData.length > 0) {
            console.log('Available locations:');
            window.nodesData.forEach((location, index) => {
                console.log(`${index}: ${location.name} (${location.location_type}) at [${location.longitude}, ${location.latitude}]`);
            });
        } else {
            console.log('No location data available');
        }
    };
    
    // Add function to test location marker creation and clickability
    window.testLocationMarkers = function() {
        if (window.geographicVisualization) {
            const markers = window.geographicVisualization.g.selectAll('.location-marker');
            console.log('Found location markers:', markers.size());
            
            markers.each(function(d, i) {
                const marker = d3.select(this);
                console.log(`Marker ${i}:`, {
                    class: marker.attr('class'),
                    id: marker.attr('data-location-id'),
                    cx: marker.attr('cx'),
                    cy: marker.attr('cy'),
                    pointerEvents: marker.style('pointer-events'),
                    opacity: marker.style('opacity')
                });
            });
            
            // Test if markers are visible and clickable
            const visibleMarkers = markers.filter(function() {
                const marker = d3.select(this);
                return marker.style('opacity') !== '0' && marker.style('pointer-events') === 'all';
            });
            console.log('Visible and clickable markers:', visibleMarkers.size());
        } else {
            console.log('Geographic visualization not available');
        }
    };
    
    // Add function to simulate a click on the first visible location marker
    window.simulateLocationClick = function() {
        if (window.geographicVisualization) {
            const markers = window.geographicVisualization.g.selectAll('.location-marker');
            const firstMarker = markers.filter(function() {
                const marker = d3.select(this);
                return marker.style('opacity') !== '0' && marker.style('pointer-events') === 'all';
            }).nodes()[0];
            
            if (firstMarker) {
                console.log('Simulating click on first visible marker');
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                firstMarker.dispatchEvent(clickEvent);
            } else {
                console.log('No visible clickable markers found');
            }
        } else {
            console.log('Geographic visualization not available');
        }
    };
    
    // Add function to test the aside panel directly
    window.testAsidePanel = function() {
        const aside = document.getElementById('location-aside');
        const panel = document.getElementById('location-info-panel');
        
        console.log('Aside element:', aside);
        console.log('Panel element:', panel);
        
        if (aside) {
            console.log('Current aside classes:', aside.className);
            console.log('Current aside transform:', window.getComputedStyle(aside).transform);
            console.log('Current aside display:', window.getComputedStyle(aside).display);
            console.log('Current aside visibility:', window.getComputedStyle(aside).visibility);
        }
        
        if (panel) {
            console.log('Panel innerHTML length:', panel.innerHTML.length);
            console.log('Panel innerHTML preview:', panel.innerHTML.substring(0, 200));
        }
    };
    
    // Add function to force show the aside panel
    window.forceShowAside = function() {
        const aside = document.getElementById('location-aside');
        if (aside) {
            aside.classList.add('show');
            aside.style.transform = 'translateX(0)';
            aside.style.display = 'block';
            console.log('Forced aside panel to show');
        }
    };
    
    // Add function to debug marker DOM elements
    window.debugMarkerDOM = function() {
        console.log('=== MARKER DOM DEBUG ===');
        
        // Check SVG structure
        const svg = document.querySelector('.globe-svg');
        console.log('SVG element:', svg);
        
        // Check location nodes group
        const locationNodes = document.querySelector('.location-nodes');
        console.log('Location nodes group:', locationNodes);
        
        // Check individual markers
        const markers = document.querySelectorAll('.location-marker');
        console.log('Number of marker elements found:', markers.length);
        
        markers.forEach((marker, index) => {
            console.log(`Marker ${index}:`, {
                element: marker,
                cx: marker.getAttribute('cx'),
                cy: marker.getAttribute('cy'),
                r: marker.getAttribute('r'),
                fill: marker.getAttribute('fill'),
                class: marker.className,
                style: marker.style.cssText,
                computedStyle: window.getComputedStyle(marker),
                pointerEvents: window.getComputedStyle(marker).pointerEvents,
                cursor: window.getComputedStyle(marker).cursor
            });
        });
        
        console.log('=== END MARKER DOM DEBUG ===');
    };
    
    // Add function to test clicking directly on DOM element
    window.testDirectClick = function() {
        const markers = document.querySelectorAll('.location-marker');
        if (markers.length > 0) {
            const firstMarker = markers[0];
            console.log('Testing direct click on first marker:', firstMarker);
            
            // Simulate a click event
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            firstMarker.dispatchEvent(clickEvent);
        } else {
            console.log('No markers found in DOM');
        }
    };
    
    // Add function to highlight the marker visually for debugging
    window.highlightMarker = function() {
        const markers = document.querySelectorAll('.location-marker');
        if (markers.length > 0) {
            const firstMarker = markers[0];
            console.log('Highlighting first marker:', firstMarker);
            
            // Make it very obvious
            firstMarker.style.stroke = '#ff0000';
            firstMarker.style.strokeWidth = '5';
            firstMarker.style.filter = 'brightness(2)';
            firstMarker.setAttribute('r', '15');
            
            console.log('Marker highlighted - you should see a large red-bordered circle');
        } else {
            console.log('No markers found to highlight');
        }
    };
});

// Make the class globally available
window.ChapelViewVisualization = ChapelViewVisualization;
