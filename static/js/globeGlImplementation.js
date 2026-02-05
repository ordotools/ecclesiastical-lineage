/**
 * Globe.gl Implementation for Geographic Lineage Visualization
 * A modern 3D globe using Globe.gl library
 */

class GlobeGlVisualization {
    constructor() {
        this.globe = null;
        this.container = null;
        this.clergyData = [];
        this.linksData = [];
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
        this.setupContainer();
        this.loadData();
        this.setupGlobe();
        this.setupEventListeners();
        this.hideLoadingIndicator();
    }
    
    setupContainer() {
        this.container = document.getElementById('globe-container');
        if (!this.container) {
            console.error('Globe container not found');
            return;
        }
        
        // Clear any existing content
        this.container.innerHTML = '';
    }
    
    loadData() {
        // Load clergy and links data from global variables
        this.clergyData = window.nodesData || [];
        this.linksData = window.linksData || [];
        
    }
    
    setupGlobe() {
        try {
            
            // Check if Globe is available
            if (typeof Globe !== 'function') {
                throw new Error('Globe.gl library not loaded properly');
            }
            
            // Check if container exists
            if (!this.container) {
                throw new Error('Container element not found');
            }
            
            // Initialize Globe.gl without container first
            this.globe = Globe();
            
            // Configure the globe
            this.globe
                .width(this.container.offsetWidth)
                .height(this.container.offsetHeight)
                .backgroundColor('#000011')
                .showGlobe(true)
                .globeMaterial({ color: '#4a90e2' })
                .showAtmosphere(true)
                .atmosphereColor('#4a90e2')
                .atmosphereAltitude(0.15)
                .enablePointerInteraction(true);
            
            // Add to container after configuration - Globe.gl returns a function that creates the DOM element
            const globeElement = this.globe();
            this.container.appendChild(globeElement);
            
            
            // Check if canvas was created
            setTimeout(() => {
                const canvas = this.container.querySelector('canvas');
                if (canvas) {
                } else {
                }
            }, 100);
            
            // Add a simple test point to see if globe is working
            this.addTestPoint();
            
            // Add clergy points
            this.addClergyPoints();
            
            // Add lineage arcs
            this.addLineageArcs();
            
        } catch (error) {
            console.error('Error setting up Globe.gl:', error);
            this.createFallbackGlobe();
        }
    }
    
    addTestPoint() {
        const testPoints = [{
            lat: 41.9029,
            lng: 12.4534,
            size: 1,
            color: '#ff0000',
            name: 'Test Vatican Point'
        }];
        
        this.globe
            .pointsData(testPoints)
            .pointColor('color')
            .pointAltitude(0.01)
            .pointRadius('size')
            .pointResolution(8);
            
    }
    
    addClergyPoints() {
        if (!this.clergyData.length || !this.globe) {
            return;
        }
        
        
        // Group clergy by location
        const locationGroups = this.groupClergyByLocation(this.clergyData);
        
        // Convert to Globe.gl format
        const points = [];
        Object.entries(locationGroups).forEach(([location, clergyList]) => {
            if (this.geographicData[location]) {
                const coords = this.geographicData[location];
                clergyList.forEach((clergy, index) => {
                    // Offset multiple clergy at same location
                    const offset = this.calculateOffset(index, clergyList.length);
                    points.push({
                        lat: coords.lat + offset.lat,
                        lng: coords.lng + offset.lng,
                        size: this.getClergySize(clergy.rank),
                        color: this.getClergyColor(clergy.type),
                        name: clergy.name,
                        rank: clergy.rank,
                        organization: clergy.organization,
                        id: clergy.id,
                        type: clergy.type
                    });
                });
            }
        });
        
        
        this.globe
            .pointsData(points)
            .pointColor('color')
            .pointAltitude(0.01)
            .pointRadius('size')
            .pointResolution(8);
            
    }
    
    addLineageArcs() {
        if (!this.linksData.length || !this.globe) return;
        
        // Convert links to Globe.gl arc format
        const arcs = this.linksData.map(link => {
            const sourceLocation = this.findLocationForClergy(link.source);
            const targetLocation = this.findLocationForClergy(link.target);
            
            if (sourceLocation && targetLocation) {
                return {
                    startLat: sourceLocation.lat,
                    startLng: sourceLocation.lng,
                    endLat: targetLocation.lat,
                    endLng: targetLocation.lng,
                    color: link.type === 'consecration' ? '#27ae60' : '#000000',
                    stroke: 2
                };
            }
            return null;
        }).filter(arc => arc !== null);
        
        this.globe
            .arcsData(arcs)
            .arcColor('color')
            .arcStroke('stroke')
            .arcDashLength(0.4)
            .arcDashGap(0.2)
            .arcDashAnimateTime(2000);
    }
    
    groupClergyByLocation(clergy) {
        const groups = {};
        
        clergy.forEach(clergy => {
            let location = 'Rome'; // Default location
            
            if (clergy.organization) {
                const org = clergy.organization.toLowerCase();
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
            groups[location].push(clergy);
        });
        
        return groups;
    }
    
    calculateOffset(index, total) {
        if (total === 1) return { lat: 0, lng: 0 };
        
        const angle = (index / total) * 2 * Math.PI;
        const radius = 0.5; // degrees
        return {
            lat: Math.cos(angle) * radius,
            lng: Math.sin(angle) * radius
        };
    }
    
    getClergySize(rank) {
        if (!rank) return 0.3;
        
        const rankLower = rank.toLowerCase();
        if (rankLower.includes('pope')) return 0.8;
        if (rankLower.includes('archbishop')) return 0.6;
        if (rankLower.includes('bishop')) return 0.5;
        if (rankLower.includes('priest')) return 0.3;
        return 0.4;
    }
    
    getClergyColor(type) {
        return type === 'consecration' ? '#27ae60' : '#000000';
    }
    
    findLocationForClergy(clergyId) {
        // Find clergy by ID and return their location
        const clergy = this.clergyData.find(c => c.id === clergyId);
        if (!clergy) return null;
        
        // Find location based on organization
        const locationGroups = this.groupClergyByLocation([clergy]);
        const location = Object.keys(locationGroups)[0];
        return this.geographicData[location];
    }
    
    onHover(point, prevPoint, event) {
        if (point) {
            this.showTooltip(event, point);
        } else {
            this.hideTooltip();
        }
    }
    
    onClick(point, event) {
        if (point) {
            this.selectClergy(point);
        }
    }
    
    onZoom(zoom) {
    }
    
    onRotate(rotation) {
    }
    
    showTooltip(event, clergy) {
        // Create or update tooltip
        let tooltip = document.getElementById('globe-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'globe-tooltip';
            tooltip.className = 'tooltip';
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 1000;
                max-width: 200px;
            `;
            document.body.appendChild(tooltip);
        }
        
        tooltip.innerHTML = `
            <h6>${clergy.name}</h6>
            <p><strong>Rank:</strong> ${clergy.rank || 'Unknown'}</p>
            <p><strong>Organization:</strong> ${clergy.organization || 'Unknown'}</p>
            <p><strong>Type:</strong> ${clergy.type || 'Unknown'}</p>
        `;
        
        tooltip.style.left = (event.clientX + 10) + 'px';
        tooltip.style.top = (event.clientY - 10) + 'px';
        tooltip.style.display = 'block';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('globe-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    selectClergy(clergy) {
        // Handle clergy selection
        // You can add clergy selection logic here
    }
    
    setupEventListeners() {
        // Control buttons
        const resetBtn = document.getElementById('reset-zoom');
        const centerBtn = document.getElementById('center-graph');
        const resetBtnMobile = document.getElementById('reset-zoom-mobile');
        const centerBtnMobile = document.getElementById('center-graph-mobile');
        
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetView());
        if (centerBtn) centerBtn.addEventListener('click', () => this.centerView());
        if (resetBtnMobile) resetBtnMobile.addEventListener('click', () => this.resetView());
        if (centerBtnMobile) centerBtnMobile.addEventListener('click', () => this.centerView());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    resetView() {
        if (this.globe) {
            this.globe.pointOfView({ lat: 0, lng: 0, altitude: 2 }, 1000);
        }
    }
    
    centerView() {
        if (this.globe) {
            this.globe.pointOfView({ lat: 0, lng: 0, altitude: 2 }, 1000);
        }
    }
    
    handleResize() {
        if (this.globe && this.container) {
            this.globe
                .width(this.container.offsetWidth)
                .height(this.container.offsetHeight);
        }
    }
    
    createFallbackGlobe() {
        
        // Create a simple fallback visualization with some basic 3D-like styling
        this.container.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
                color: white;
                font-family: Arial, sans-serif;
                text-align: center;
                position: relative;
            ">
                <div style="position: relative; z-index: 2;">
                    <h3>Geographic Lineage Visualization</h3>
                    <p>Globe.gl initialization failed - using fallback visualization</p>
                    <p><small>This indicates a compatibility issue with the Globe.gl library.</small></p>
                    <div style="margin-top: 20px;">
                        <div style="width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #4a90e2, #2e5bba); margin: 0 auto; position: relative; box-shadow: 0 0 50px rgba(74, 144, 226, 0.3);">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 12px;">Globe Preview</div>
                        </div>
                    </div>
                </div>
                <div style="
                    position: absolute;
                    top: 20%;
                    left: 10%;
                    width: 20px;
                    height: 20px;
                    background: #ff0000;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                "></div>
                <div style="
                    position: absolute;
                    top: 60%;
                    right: 15%;
                    width: 15px;
                    height: 15px;
                    background: #00ff00;
                    border-radius: 50%;
                    animation: pulse 2s infinite 1s;
                "></div>
                <style>
                    @keyframes pulse {
                        0% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.2); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                </style>
            </div>
        `;
        
        this.hideLoadingIndicator();
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
    new GlobeGlVisualization();
});
