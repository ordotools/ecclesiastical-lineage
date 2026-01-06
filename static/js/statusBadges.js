// Status Badges Rendering Module
// Renders circular status indicator badges around clergy nodes in the lineage visualization

/**
 * Calculate badge position around node perimeter using polar coordinates
 * @param {number} nodeRadius - Radius of the node circle
 * @param {number} badgePosition - Position index (0-7) for placement
 * @param {number} totalBadges - Total number of badges to distribute
 * @returns {Object} - {x, y} coordinates for badge placement
 */
function calculateBadgePosition(nodeRadius, badgePosition, totalBadges) {
    const badgeRadius = 8; // Half of badge diameter (16px)
    const distanceFromCenter = nodeRadius + badgeRadius + 2; // Node radius + badge radius + spacing
    
    // Distribute badges evenly around the circle
    // Start from top (270 degrees) and go clockwise
    const angleStep = (2 * Math.PI) / Math.max(totalBadges, 8);
    const angle = (Math.PI * 1.5) + (badgePosition * angleStep); // Start from top
    
    return {
        x: Math.cos(angle) * distanceFromCenter,
        y: Math.sin(angle) * distanceFromCenter
    };
}

/**
 * Render status badges around a node
 * @param {Object} nodeGroup - D3 selection of the node group (SVG g element)
 * @param {Array} statuses - Array of status objects {id, name, description, icon, color, badge_position}
 * @param {number} nodeRadius - Radius of the clergy node circle
 */
export function renderStatusBadges(nodeGroup, statuses, nodeRadius = 24) {
    if (!statuses || statuses.length === 0) {
        return;
    }
    
    // Remove existing badges
    nodeGroup.selectAll('.status-badge').remove();
    
    // Create badge group
    const badgeGroup = nodeGroup.append('g')
        .attr('class', 'status-badges');
    
    // Render each badge
    statuses.forEach((status, index) => {
        const position = calculateBadgePosition(nodeRadius, index, statuses.length);
        
        const badge = badgeGroup.append('g')
            .attr('class', 'status-badge')
            .attr('transform', `translate(${position.x}, ${position.y})`)
            .attr('data-status-id', status.id)
            .attr('data-status-name', status.name)
            .style('cursor', 'help');
        
        // Background circle
        badge.append('circle')
            .attr('r', 8)
            .attr('fill', status.color)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5)
            .attr('class', 'status-badge-circle');
        
        // Icon (using Font Awesome via foreignObject)
        const iconFO = badge.append('foreignObject')
            .attr('x', -6)
            .attr('y', -6)
            .attr('width', 12)
            .attr('height', 12)
            .attr('class', 'status-badge-icon');
        
        iconFO.append('xhtml:div')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('font-size', '8px')
            .style('color', '#ffffff')
            .style('pointer-events', 'none')
            .html(`<i class="fas ${status.icon}"></i>`);
        
        // Tooltip on hover
        badge.append('title')
            .text(`${status.name}: ${status.description || 'No description'}`);
        
        // Hover effects
        badge.on('mouseenter', function() {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('r', 9)
                .attr('stroke-width', 2);
        });
        
        badge.on('mouseleave', function() {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('r', 8)
                .attr('stroke-width', 1.5);
        });
    });
}

/**
 * Update status badges for a node (used when node data changes)
 * @param {Object} nodeGroup - D3 selection of the node group
 * @param {Array} statuses - Updated array of status objects
 * @param {number} nodeRadius - Radius of the node circle
 */
export function updateStatusBadges(nodeGroup, statuses, nodeRadius = 24) {
    // Simply re-render the badges
    renderStatusBadges(nodeGroup, statuses, nodeRadius);
}

/**
 * Remove all status badges from a node
 * @param {Object} nodeGroup - D3 selection of the node group
 */
export function clearStatusBadges(nodeGroup) {
    nodeGroup.selectAll('.status-badge').remove();
    nodeGroup.selectAll('.status-badges').remove();
}

// Export all functions
export default {
    renderStatusBadges,
    updateStatusBadges,
    clearStatusBadges
};

