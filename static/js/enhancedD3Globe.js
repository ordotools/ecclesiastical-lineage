/**
 * Enhanced D3.js Globe Visualization
 * Improved version with better styling and functionality
 */

class EnhancedD3Globe {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.projection = d3.geoOrthographic();
        this.path = d3.geoPath().projection(this.projection);
        this.svg = null;
        this.g = null;
        this.tooltip = null;
        this.rotation = [0, -20, 0];
        this.isDragging = false;
        this.lastMousePosition = null;
        
        // Geographic data for clergy locations
        this.geographicData = {
            'Vatican': { lat: 41.9029, lng: 12.4534, name: 'Vatican City' },
            'Rome': { lat: 41.9028, lng: 12.4964, name: 'Rome' },
            'Canterbury': { lat: 51.2802, lng: 1.0789, name: 'Canterbury' },
            'New York': { lat: 40.7128, lng: -74.0060, name: 'New York' },
            'London': { lat: 51.5074, lng: -0.1278, name: 'London' },
            'Paris': { lat: 48.8566, lng: 2.3522, name: 'Paris' },
            'Moscow': { lat: 55.7558, lng: 37.6176, name: 'Moscow' },
            'Istanbul': { lat: 41.0082, lng: 28.9784, name: 'Istanbul' },
            'Jerusalem': { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
            'Alexandria': { lat: 31.2001, lng: 29.9187, name: 'Alexandria' },
            'Antioch': { lat: 36.2021, lng: 36.1603, name: 'Antioch' },
            'Athens': { lat: 37.9838, lng: 23.7275, name: 'Athens' },
            'Dublin': { lat: 53.3498, lng: -6.2603, name: 'Dublin' },
            'Madrid': { lat: 40.4168, lng: -3.7038, name: 'Madrid' },
            'Cologne': { lat: 50.9375, lng: 6.9603, name: 'Cologne' },
            'Milan': { lat: 45.4642, lng: 9.1900, name: 'Milan' },
            'Florence': { lat: 43.7696, lng: 11.2558, name: 'Florence' },
            'Venice': { lat: 45.4408, lng: 12.3155, name: 'Venice' },
            'Naples': { lat: 40.8518, lng: 14.2681, name: 'Naples' },
            'Barcelona': { lat: 41.3851, lng: 2.1734, name: 'Barcelona' }
        };
        
        this.init();
    }
    
    init() {
        this.setupSVG();
        this.setupTooltip();
        this.createGradients();
        this.loadWorldData();
        this.setupEventListeners();
        this.hideLoadingIndicator();
    }
    
    setupSVG() {
        const container = d3.select('#globe-container');
        
        this.svg = container
            .append('svg')
            .attr('class', 'globe-svg')
            .attr('width', this.width)
            .attr('height', this.height);
            
        this.g = this.svg.append('g');
        
        // Set initial projection
        this.projection
            .scale(Math.min(this.width, this.height) / 2 - 50)
            .translate([this.width / 2, this.height / 2])
            .clipAngle(90)
            .rotate(this.rotation);
    }
    
    setupTooltip() {
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('max-width', '200px');
    }
    
    createGradients() {
        const defs = this.svg.append('defs');
        
        // Ocean gradient
        const oceanGradient = defs.append('radialGradient')
            .attr('id', 'oceanGradient')
            .attr('cx', '30%')
            .attr('cy', '30%')
            .attr('r', '70%');
            
        oceanGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#1e3a8a')
            .attr('stop-opacity', 0.8);
            
        oceanGradient.append('stop')
            .attr('offset', '70%')
            .attr('stop-color', '#1e40af')
            .attr('stop-opacity', 0.6);
            
        oceanGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#1e3a8a')
            .attr('stop-opacity', 0.4);
        
        // Land gradient - realistic green earth tones
        const landGradient = defs.append('radialGradient')
            .attr('id', 'landGradient')
            .attr('cx', '30%')
            .attr('cy', '30%')
            .attr('r', '70%');
            
        landGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#4A7C59')
            .attr('stop-opacity', 1);
            
        landGradient.append('stop')
            .attr('offset', '40%')
            .attr('stop-color', '#5D8B5D')
            .attr('stop-opacity', 1);
            
        landGradient.append('stop')
            .attr('offset', '70%')
            .attr('stop-color', '#6B9B6B')
            .attr('stop-opacity', 1);
            
        landGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#4A6B4A')
            .attr('stop-opacity', 1);
        
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
    
    async detectConnectionSpeed() {
        // Use Network Information API if available
        if ('connection' in navigator) {
            const connection = navigator.connection;
            const effectiveType = connection.effectiveType;
            
            
            if (effectiveType === '4g' || effectiveType === '5g') {
                return 'fast';
            } else if (effectiveType === '3g') {
                return 'medium';
            } else {
                return 'slow';
            }
        }
        
        // Fallback: Test download speed with a small image
        try {
            const startTime = performance.now();
            const testImage = new Image();
            
            return new Promise((resolve) => {
                testImage.onload = () => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    // Rough speed estimation based on load time
                    if (duration < 500) {
                        resolve('fast');
                    } else if (duration < 1500) {
                        resolve('medium');
                    } else {
                        resolve('slow');
                    }
                };
                
                testImage.onerror = () => {
                    resolve('slow'); // Default to slow if test fails
                };
                
                // Use a small test image (1KB)
                testImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            });
        } catch (error) {
            console.warn('Connection speed detection failed:', error);
            return 'medium'; // Default fallback
        }
    }
    
    async loadWorldData() {
        try {
            let world;
            
            // Detect connection speed and choose appropriate data source
            const connectionSpeed = await this.detectConnectionSpeed();
            
            // Store connection speed for rendering optimization
            this.connectionSpeed = connectionSpeed;
            
            // Define data sources - use working sources
            const dataSources = [
                'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
                'https://raw.githubusercontent.com/d3/d3-geo/master/test/data/world-110m.json',
                'https://unpkg.com/world-atlas@1/world/110m.json'
            ];
            
            for (const url of dataSources) {
                try {
                    world = await d3.json(url);
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
            
            // Process world data
            let worldData;
            if (world.objects && world.objects.land) {
                worldData = topojson.feature(world, world.objects.land);
            } else if (world.features) {
                worldData = world;
            } else {
                throw new Error('Unknown world data format');
            }
            
            // Create ocean background as a circle
            this.g.append('circle')
                .attr('class', 'ocean-background')
                .attr('cx', this.width / 2)
                .attr('cy', this.height / 2)
                .attr('r', Math.min(this.width, this.height) / 2 - 50)
                .attr('fill', 'url(#oceanGradient)')
                .attr('stroke', '#2E5BBA')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.8);
            
            // Draw world map (land areas) with colors and back-face culling
            this.addWorldMapWithColors(worldData);
            
            // Apply back-face culling after initial rendering
            this.applyBackFaceCulling();
                
            // Draw graticule with back-face culling
            this.addGraticuleWithCulling();
            
            // Add clergy nodes
            this.addClergyNodes();
            
            // Add lineage connections
            this.addLineageConnections();
            
            // Add atmospheric glow
            this.addAtmosphericGlow();
            
        } catch (error) {
            console.error('Error loading world data:', error);
            this.createFallbackVisualization();
        }
    }
    
    addClergyNodes() {
        if (!window.nodesData) {
            console.warn('No nodes data available');
            return;
        }
        
        const nodes = window.nodesData;
        
        const locationGroups = this.groupNodesByLocation(nodes);
        const nodeGroup = this.g.append('g').attr('class', 'clergy-nodes');
        
        Object.entries(locationGroups).forEach(([location, clergyList]) => {
            let x, y;
            
            if (this.geographicData[location]) {
                const coords = this.geographicData[location];
                [x, y] = this.projection([coords.lng, coords.lat]);
            } else {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.min(this.width, this.height) / 4;
                x = this.width / 2 + Math.cos(angle) * radius;
                y = this.height / 2 + Math.sin(angle) * radius;
            }
            
            if (x !== undefined && y !== undefined) {
                const clusterGroup = nodeGroup.append('g')
                    .attr('class', 'location-cluster')
                    .attr('data-location', location)
                    .attr('transform', `translate(${x}, ${y})`);
                
                clergyList.forEach((clergy, index) => {
                    const angle = (index / clergyList.length) * 2 * Math.PI;
                    const radius = Math.min(15, 5 + clergyList.length * 2);
                    const nodeX = Math.cos(angle) * radius;
                    const nodeY = Math.sin(angle) * radius;
                    
                    const node = clusterGroup.append('circle')
                        .attr('class', `clergy-node ${clergy.rank?.toLowerCase() || 'priest'} ${clergy.type || 'ordination'}`)
                        .attr('cx', nodeX)
                        .attr('cy', nodeY)
                        .attr('r', this.getNodeRadius(clergy.rank))
                        .attr('data-clergy-id', clergy.id)
                        .attr('data-clergy-name', clergy.name)
                        .attr('data-clergy-rank', clergy.rank || 'Unknown')
                        .attr('data-clergy-organization', clergy.organization || 'Unknown')
                        .attr('data-location', location);
                    
                    node
                        .on('mouseover', (event, d) => this.showTooltip(event, clergy, location))
                        .on('mouseout', () => this.hideTooltip())
                        .on('click', (event) => this.selectClergy(event, clergy));
                });
                
                clusterGroup.append('text')
                    .attr('class', 'location-label')
                    .attr('x', 0)
                    .attr('y', -25)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#ccc')
                    .attr('font-size', '10px')
                    .text(location);
            }
        });
    }
    
    groupNodesByLocation(nodes) {
        const groups = {};
        
        nodes.forEach(node => {
            let location = 'Rome';
            
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
        
        const links = window.linksData;
        
        const linkGroup = this.g.append('g').attr('class', 'lineage-links');
        
        links.forEach(link => {
            const sourceLocation = this.findLocationForClergy(link.source);
            const targetLocation = this.findLocationForClergy(link.target);
            
            if (sourceLocation && targetLocation) {
                const [x1, y1] = this.projection([sourceLocation.lng, sourceLocation.lat]);
                const [x2, y2] = this.projection([targetLocation.lng, targetLocation.lat]);
                
                if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
                    linkGroup.append('line')
                        .attr('class', `lineage-link ${link.type}`)
                        .attr('data-source-location', sourceLocation.name)
                        .attr('data-target-location', targetLocation.name)
                        .attr('x1', x1)
                        .attr('y1', y1)
                        .attr('x2', x2)
                        .attr('y2', y2);
                }
            }
        });
    }
    
    findLocationForClergy(clergyId) {
        const clergy = window.nodesData.find(c => c.id === clergyId);
        if (!clergy) return null;
        
        const locationGroups = this.groupNodesByLocation([clergy]);
        const location = Object.keys(locationGroups)[0];
        return this.geographicData[location];
    }
    
    addAtmosphericGlow() {
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
    
    addWorldMapWithColors(worldData) {
        const worldGroup = this.g.append('g').attr('class', 'world-map-group');
        
        // Apply detail level based on connection speed
        const detailLevel = this.getDetailLevel();
        
        // Draw the world map with country colors
        if (worldData.features) {
            // Filter features based on detail level for performance
            let featuresToRender = worldData.features;
            const totalFeatures = worldData.features.length;
            
            if (detailLevel === 'low') {
                // For slow connections, only render larger countries
                featuresToRender = worldData.features.filter(d => {
                    const area = d3.geoArea(d);
                    return area > 0.01; // Increased threshold for more dramatic difference
                });
            } else if (detailLevel === 'medium') {
                // For medium connections, filter out very small features
                featuresToRender = worldData.features.filter(d => {
                    const area = d3.geoArea(d);
                    return area > 0.001; // Increased threshold
                });
            }
            // For fast connections, render all features
            
            
            worldGroup.selectAll('path')
                .data(featuresToRender)
                .enter()
                .append('path')
                .attr('class', 'globe-path')
                .attr('d', this.path)
                .attr('fill', (d, i) => {
                    // Get country name for color variation
                    const countryName = d.properties?.NAME || d.properties?.name || d.properties?.NAME_EN || `Country_${i}`;
                    return this.getCountryColor(countryName);
                })
                .attr('stroke', detailLevel === 'high' ? '#2D4A2D' : detailLevel === 'medium' ? '#4A6B4A' : '#6B8B6B')
                .attr('stroke-width', detailLevel === 'high' ? 0.3 : detailLevel === 'medium' ? 0.8 : 1.2)
                .attr('opacity', 1);
        } else {
            // Fallback for single geometry
            worldGroup.append('path')
                .datum(worldData)
                .attr('class', 'globe-path')
                .attr('d', this.path)
                .attr('fill', this.getCountryColor('World'))
                .attr('stroke', detailLevel === 'high' ? '#2D4A2D' : detailLevel === 'medium' ? '#4A6B4A' : '#6B8B6B')
                .attr('stroke-width', detailLevel === 'high' ? 0.3 : detailLevel === 'medium' ? 0.8 : 1.2)
                .attr('opacity', 1);
        }
    }
    
    getDetailLevel() {
        // Return detail level based on connection speed
        if (this.connectionSpeed === 'fast') {
            return 'high';
        } else if (this.connectionSpeed === 'medium') {
            return 'medium';
        } else {
            return 'low';
        }
    }
    
    getCountryColor(countryName) {
        // Generate more distinct and vibrant colors for countries
        const colors = [
            '#2E8B57', '#32CD32', '#228B22', '#00FF7F',
            '#3CB371', '#20B2AA', '#00CED1', '#40E0D0',
            '#00FA9A', '#98FB98', '#90EE90', '#8FBC8F',
            '#9ACD32', '#ADFF2F', '#7FFF00', '#7CFC00'
        ];
        
        // Simple hash function to get consistent color for each country
        let hash = 0;
        for (let i = 0; i < countryName.length; i++) {
            hash = ((hash << 5) - hash + countryName.charCodeAt(i)) & 0xffffffff;
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    applyBackFaceCulling() {
        // Always use clip angle of 90 to show only the front half of the globe
        this.projection.clipAngle(90);
        
        // Update all paths
        this.g.selectAll('.globe-path').attr('d', this.path);
        
    }
    
    
    addGraticuleWithCulling() {
        const graticuleGroup = this.g.append('g').attr('class', 'globe-graticule-group');
        
        // Create graticule lines using the correct D3.js API
        const meridians = [];
        const parallels = [];
        
        // Generate meridians (longitude lines)
        for (let i = -180; i <= 180; i += 30) {
            const meridian = {
                type: "LineString",
                coordinates: Array.from({length: 181}, (_, j) => [i, j - 90])
            };
            meridians.push(meridian);
        }
        
        // Generate parallels (latitude lines)
        for (let i = -90; i <= 90; i += 15) {
            const parallel = {
                type: "LineString", 
                coordinates: Array.from({length: 361}, (_, j) => [j - 180, i])
            };
            parallels.push(parallel);
        }
        
        // Draw meridians (always visible)
        meridians.forEach((meridian, i) => {
            const pathData = this.path(meridian);
            if (pathData) {
                graticuleGroup.append('path')
                    .datum(meridian)
                    .attr('class', 'globe-meridian')
                    .attr('d', pathData)
                    .attr('fill', 'none')
                    .attr('stroke', '#999')
                    .attr('stroke-width', 0.3)
                    .attr('opacity', 0.5);
            }
        });
        
        // Draw parallels (always visible)
        parallels.forEach((parallel, i) => {
            const pathData = this.path(parallel);
            if (pathData) {
                graticuleGroup.append('path')
                    .datum(parallel)
                    .attr('class', 'globe-parallel')
                    .attr('d', pathData)
                    .attr('fill', 'none')
                    .attr('stroke', '#999')
                    .attr('stroke-width', 0.3)
                    .attr('opacity', 0.5);
            }
        });
    }
    
    isGraticuleVisible(geometry) {
        // Enhanced back-face culling: check multiple points along the geometry
        if (!geometry || !geometry.coordinates) return true;
        
        const coords = geometry.coordinates;
        if (coords.length < 2) return true;
        
        // Sample points along the geometry (start, middle, end)
        const sampleIndices = [0, Math.floor(coords.length / 2), coords.length - 1];
        let visibleCount = 0;
        
        for (const index of sampleIndices) {
            const [lng, lat] = coords[index];
            
            // Convert to 3D coordinates
            const lambda = lng * Math.PI / 180;
            const phi = lat * Math.PI / 180;
            
            // Get current rotation
            const [rotateX, rotateY, rotateZ] = this.rotation;
            
            // Apply rotation transformations
            const cosX = Math.cos(rotateX * Math.PI / 180);
            const sinX = Math.sin(rotateX * Math.PI / 180);
            const cosY = Math.cos(rotateY * Math.PI / 180);
            const sinY = Math.sin(rotateY * Math.PI / 180);
            
            // Transform coordinates
            let x = Math.cos(phi) * Math.cos(lambda);
            let y = Math.cos(phi) * Math.sin(lambda);
            let z = Math.sin(phi);
            
            // Apply Y rotation
            const x2 = x * cosY - z * sinY;
            const z2 = x * sinY + z * cosY;
            
            // Apply X rotation
            const y3 = y * cosX - z2 * sinX;
            const z3 = y * sinX + z2 * cosX;
            
            // Check if the point is on the front side (positive Z)
            if (z3 > 0) visibleCount++;
        }
        
        // Show the graticule if at least half of the sample points are visible
        return visibleCount >= Math.ceil(sampleIndices.length / 2);
    }
    
    setupEventListeners() {
        // Drag to rotate globe
        this.svg
            .call(d3.drag()
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
                        
                        this.rotation[0] += deltaX * 0.15;
                        this.rotation[1] -= deltaY * 0.15;
                        
                        this.projection.rotate(this.rotation);
                        this.updateGlobe();
                        
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
                }));
        
        // Control buttons
        d3.select('#reset-zoom').on('click', () => this.resetView());
        d3.select('#center-graph').on('click', () => this.centerGlobe());
        d3.select('#reset-zoom-mobile').on('click', () => this.resetView());
        d3.select('#center-graph-mobile').on('click', () => this.centerGlobe());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    updateGlobe() {
        // Get current scale from projection
        const currentScale = this.projection.scale();
        
        // Update ocean background circle with current scale
        this.g.selectAll('.ocean-background')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', currentScale);
        
        // Update world map paths with back-face culling
        this.applyBackFaceCulling();
        
        // Update graticule (always visible)
        this.g.selectAll('.globe-meridian').each((d, i, nodes) => {
            const path = d3.select(nodes[i]);
            path.attr('d', this.path(d));
        });
        
        this.g.selectAll('.globe-parallel').each((d, i, nodes) => {
            const path = d3.select(nodes[i]);
            path.attr('d', this.path(d));
        });
        
        // Update node positions
        this.g.selectAll('.location-cluster').each((d, i, nodes) => {
            const cluster = d3.select(nodes[i]);
            const location = cluster.attr('data-location');
            
            if (this.geographicData[location]) {
                const coords = this.geographicData[location];
                const [x, y] = this.projection([coords.lng, coords.lat]);
                
                if (x !== undefined && y !== undefined) {
                    cluster.attr('transform', `translate(${x}, ${y})`);
                }
            }
        });
        
        // Update link positions
        this.g.selectAll('.lineage-link').each((d, i, nodes) => {
            const link = d3.select(nodes[i]);
            const sourceLocation = link.attr('data-source-location');
            const targetLocation = link.attr('data-target-location');
            
            if (sourceLocation && targetLocation) {
                const sourceCoords = this.geographicData[Object.keys(this.geographicData).find(key => this.geographicData[key].name === sourceLocation)];
                const targetCoords = this.geographicData[Object.keys(this.geographicData).find(key => this.geographicData[key].name === targetLocation)];
                
                if (sourceCoords && targetCoords) {
                    const [x1, y1] = this.projection([sourceCoords.lng, sourceCoords.lat]);
                    const [x2, y2] = this.projection([targetCoords.lng, targetCoords.lat]);
                    
                    if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
                        link.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
                    }
                }
            }
        });
        
        // Update atmospheric glow with current scale
        this.g.selectAll('.atmospheric-glow')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', currentScale - 30);
    }
    
    resetView() {
        this.rotation = [0, 0, 0];
        this.projection
            .scale(Math.min(this.width, this.height) / 2 - 50)
            .clipAngle(90)
            .rotate(this.rotation);
        this.updateGlobe();
    }
    
    centerGlobe() {
        this.rotation = [0, 0, 0];
        this.projection
            .clipAngle(90)
            .rotate(this.rotation);
        this.updateGlobe();
    }
    
    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
            
        this.projection
            .scale(Math.min(this.width, this.height) / 2 - 50)
            .translate([this.width / 2, this.height / 2])
            .clipAngle(90);
            
        this.updateGlobe();
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
    
    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }
    
    selectClergy(event, clergy) {
    }
    
    createFallbackVisualization() {
        
        // Create gradients for fallback
        this.createGradients();
        
        // Create ocean background for fallback
        this.g.append('circle')
            .attr('class', 'ocean-background')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', Math.min(this.width, this.height) / 2 - 50)
            .attr('fill', 'url(#oceanGradient)')
            .attr('stroke', '#2E5BBA')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.8);
        
        // Create a simple circle to represent land with styling
        this.g.append('circle')
            .attr('class', 'globe-fallback')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', Math.min(this.width, this.height) / 2 - 80)
            .attr('fill', 'url(#landGradient)')
            .attr('stroke', '#2D4A2D')
            .attr('stroke-width', 0.5)
            .attr('opacity', 1);
        
        // Add graticule with back-face culling
        this.addGraticuleWithCulling();
        
        // Add clergy nodes
        this.addClergyNodes();
        
        // Add lineage connections
        this.addLineageConnections();
    }
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new EnhancedD3Globe();
});
