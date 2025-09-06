// Filter module for priest filtering and timeline view
import { BLACK_COLOR, GREEN_COLOR, width, height } from './constants.js';
import { showNotification } from './utils.js';

// Wire up filter controls and sync mobile/desktop
const hidePriestsCheckbox = document.getElementById('hide-priests');
const hidePriestsMobileCheckbox = document.getElementById('hide-priests-mobile');

// Wire up timeline view controls and sync mobile/desktop
const timelineViewCheckbox = document.getElementById('timeline-view');
const timelineViewMobileCheckbox = document.getElementById('timeline-view-mobile');

// Timeline view state
let isTimelineViewEnabled = false;
let timelineData = null;

export function syncPriestFilters() {
  if (hidePriestsCheckbox && hidePriestsMobileCheckbox) {
    hidePriestsMobileCheckbox.checked = hidePriestsCheckbox.checked;
  }
}

export function syncTimelineFilters() {
  if (timelineViewCheckbox && timelineViewMobileCheckbox) {
    timelineViewMobileCheckbox.checked = timelineViewCheckbox.checked;
  }
}

// Function to parse dates and prepare timeline data
export function prepareTimelineData(nodes) {
  const dates = [];
  
  nodes.forEach(node => {
    let dateStr = null;
    
    // Use consecration date for bishops, ordination date for priests
    if (node.rank && node.rank.toLowerCase() === 'bishop' && node.consecration_date) {
      dateStr = node.consecration_date;
    } else if (node.ordination_date) {
      dateStr = node.ordination_date;
    }
    
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        dates.push(date);
        node.timelineDate = date;
      }
    }
  });
  
  // Create infinite timeline from year 0 to 2x current year
  const currentYear = new Date().getFullYear();
  const timelineMin = new Date(0, 0, 1); // Year 0 (infinite past)
  const timelineMax = new Date(currentYear * 2, 11, 31); // 2x current year (infinite future)
  
  // Create a much larger timeline container for better spacing
  // Use 10x the viewport width to spread out the dates
  const timelineWidth = width * 10;
  
  // Debug: Log the timeline bounds
  console.log('Timeline bounds:', {
    minDate: timelineMin.getFullYear(),
    maxDate: timelineMax.getFullYear(),
    timelineWidth: timelineWidth
  });
  
  return {
    minDate: timelineMin,
    maxDate: timelineMax,
    scale: d3.scaleTime()
      .domain([timelineMin, timelineMax])
      .range([0, timelineWidth]),
    timelineWidth: timelineWidth
  };
}

// Function to apply timeline view
export function applyTimelineView() {
  const shouldEnableTimeline = timelineViewCheckbox ? timelineViewCheckbox.checked : false;
  isTimelineViewEnabled = shouldEnableTimeline;
  
  if (!window.currentSimulation || !window.currentNodes) return;
  
  if (shouldEnableTimeline) {
    // Prepare timeline data
    timelineData = prepareTimelineData(window.currentNodes);
    
    if (timelineData) {
      // Add timeline positioning force - use X position for timeline
      window.currentSimulation.force('timeline', d3.forceX()
        .x(d => {
          if (d.timelineDate && !d.filtered) {
            return timelineData.scale(d.timelineDate);
          }
          return d.x; // Keep current position if no timeline date
        })
        .strength(0.8));
    }
    
    // Show timeline elements
    showTimelineElements();
    
    // Auto-zoom out to show the full timeline when first enabled
    setTimeout(() => {
      if (window.currentZoom) {
        const svg = d3.select('#graph-container svg');
        // Calculate scale to fit the entire timeline in viewport
        const timelineScale = width / timelineData.timelineWidth;
        const centerX = timelineData.timelineWidth / 2;
        
        const transform = d3.zoomIdentity
          .translate(width / 2 - centerX * timelineScale, 0)
          .scale(timelineScale);
        
        svg.transition()
          .duration(1000)
          .call(window.currentZoom.transform, transform);
      }
    }, 100);
  } else {
    // Remove timeline positioning force
    window.currentSimulation.force('timeline', null);
    
    // Hide timeline elements
    hideTimelineElements();
  }
  
  // Restart simulation to apply changes
  window.currentSimulation.alpha(1).restart();
}

// Function to show timeline elements
export function showTimelineElements() {
  if (!timelineData) return;
  
  const svg = d3.select('#graph-container svg');
  
  // Remove existing timeline elements from both container and fixed positions
  svg.selectAll('.timeline').remove();
  svg.selectAll('.timeline-fixed').remove();
  
  // Add fixed timeline groups that don't move with zoom/pan
  const timelineGroupTop = svg.append('g').attr('class', 'timeline-fixed timeline-top');
  const timelineGroupBottom = svg.append('g').attr('class', 'timeline-fixed timeline-bottom');
  
  // Create nested groups for lines and text to handle scaling differently
  const timelineLinesTop = timelineGroupTop.append('g').attr('class', 'timeline-lines');
  const timelineTextsTop = timelineGroupTop.append('g').attr('class', 'timeline-texts');
  const timelineLinesBottom = timelineGroupBottom.append('g').attr('class', 'timeline-lines');
  const timelineTextsBottom = timelineGroupBottom.append('g').attr('class', 'timeline-texts');
  
  // Get current year at the top of the function
  const currentYear = new Date().getFullYear();
  
  // Create timeline line at top (fixed position) - extend beyond the last marker
  const lastYear = new Date(currentYear * 2, 0, 1);
  const lastYearX = timelineData.scale(lastYear);
  const lineExtension = 100; // Extend 100 pixels beyond the last marker
  
  timelineLinesTop.append('line')
    .attr('x1', 0)
    .attr('x2', lastYearX + lineExtension)
    .attr('y1', 50)
    .attr('y2', 50)
    .attr('stroke', BLACK_COLOR)
    .attr('stroke-width', 2)
    .attr('opacity', 0.7);
  
  // Create timeline line at bottom (fixed position) - extend beyond the last marker
  timelineLinesBottom.append('line')
    .attr('x1', 0)
    .attr('x2', lastYearX + lineExtension)
    .attr('y1', height - 50)
    .attr('y2', height - 50)
    .attr('stroke', BLACK_COLOR)
    .attr('stroke-width', 2)
    .attr('opacity', 0.7);
  
  // Add timeline markers - create key milestone years manually to ensure full coverage
  const keyYears = [];
  
  // Add key milestone years: 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, and then every 100 years to 2x current year
  keyYears.push(new Date(0, 0, 1)); // Year 0
  keyYears.push(new Date(100, 0, 1)); // Year 100
  keyYears.push(new Date(200, 0, 1)); // Year 200
  keyYears.push(new Date(300, 0, 1)); // Year 300
  keyYears.push(new Date(400, 0, 1)); // Year 400
  keyYears.push(new Date(500, 0, 1)); // Year 500
  keyYears.push(new Date(600, 0, 1)); // Year 600
  keyYears.push(new Date(700, 0, 1)); // Year 700
  keyYears.push(new Date(800, 0, 1)); // Year 800
  keyYears.push(new Date(900, 0, 1)); // Year 900
  keyYears.push(new Date(1000, 0, 1)); // Year 1000
  keyYears.push(new Date(1100, 0, 1)); // Year 1100
  keyYears.push(new Date(1200, 0, 1)); // Year 1200
  keyYears.push(new Date(1300, 0, 1)); // Year 1300
  keyYears.push(new Date(1400, 0, 1)); // Year 1400
  keyYears.push(new Date(1500, 0, 1)); // Year 1500
  keyYears.push(new Date(1600, 0, 1)); // Year 1600
  keyYears.push(new Date(1700, 0, 1)); // Year 1700
  keyYears.push(new Date(1800, 0, 1)); // Year 1800
  keyYears.push(new Date(1900, 0, 1)); // Year 1900
  keyYears.push(new Date(2000, 0, 1)); // Year 2000
  
  // Add every 100 years from 2100 to 2x current year
  for (let year = 2100; year <= currentYear * 2; year += 100) {
    keyYears.push(new Date(year, 0, 1));
  }
  
  // Debug: Log the key years
  console.log('Key timeline years:', keyYears.map(d => d.getFullYear()));
  
  keyYears.forEach(year => {
    const x = timelineData.scale(year);
    
    // Debug: Log each marker position
    console.log(`Year ${year.getFullYear()}: x = ${x}`);
    
    // Top timeline markers
    timelineLinesTop.append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', 40)
      .attr('y2', 60)
      .attr('stroke', BLACK_COLOR)
      .attr('stroke-width', 1)
      .attr('opacity', 0.7);
    
    timelineTextsTop.append('text')
      .attr('x', x)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', BLACK_COLOR)
      .attr('opacity', 0.8)
      .text(year.getFullYear());
    
    // Bottom timeline markers
    timelineLinesBottom.append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', height - 60)
      .attr('y2', height - 40)
      .attr('stroke', BLACK_COLOR)
      .attr('stroke-width', 1)
      .attr('opacity', 0.7);
    
    timelineTextsBottom.append('text')
      .attr('x', x)
      .attr('y', height - 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', BLACK_COLOR)
      .attr('opacity', 0.8)
      .text(year.getFullYear());
  });
}

// Function to hide timeline elements
export function hideTimelineElements() {
  const svg = d3.select('#graph-container svg');
  svg.selectAll('.timeline').remove();
  svg.selectAll('.timeline-fixed').remove();
}

// Function to update timeline positions during zoom/pan
export function updateTimelinePositions(transform) {
  if (!isTimelineViewEnabled || !timelineData) return;
  
  const svg = d3.select('#graph-container svg');
  const timelineTop = svg.select('.timeline-top');
  const timelineBottom = svg.select('.timeline-bottom');
  
  if (!timelineTop.empty() && !timelineBottom.empty()) {
    // Apply scaling and translation to lines
    timelineTop.select('.timeline-lines').attr('transform', `translate(${transform.x}, 0) scale(${transform.k}, 1)`);
    timelineBottom.select('.timeline-lines').attr('transform', `translate(${transform.x}, 0) scale(${transform.k}, 1)`);
    
    // Update the main timeline lines to extend beyond the last marker
    const timelineCurrentYear = new Date().getFullYear();
    const lastYear = new Date(timelineCurrentYear * 2, 0, 1);
    const lastYearX = timelineData.scale(lastYear);
    const lineExtension = 100;
    
    timelineTop.select('.timeline-lines').selectAll('line').each(function(d, i) {
      if (i === 0) { // Main timeline line
        d3.select(this)
          .attr('x2', lastYearX + lineExtension);
      }
    });
    
    timelineBottom.select('.timeline-lines').selectAll('line').each(function(d, i) {
      if (i === 0) { // Main timeline line
        d3.select(this)
          .attr('x2', lastYearX + lineExtension);
      }
    });
    
    // Apply only translation to text (no scaling to prevent distortion)
    // Use the same key years as in the timeline creation
    const keyYears = [];
    const currentYear = new Date().getFullYear();
    
    keyYears.push(new Date(0, 0, 1)); // Year 0
    keyYears.push(new Date(100, 0, 1)); // Year 100
    keyYears.push(new Date(200, 0, 1)); // Year 200
    keyYears.push(new Date(300, 0, 1)); // Year 300
    keyYears.push(new Date(400, 0, 1)); // Year 400
    keyYears.push(new Date(500, 0, 1)); // Year 500
    keyYears.push(new Date(600, 0, 1)); // Year 600
    keyYears.push(new Date(700, 0, 1)); // Year 700
    keyYears.push(new Date(800, 0, 1)); // Year 800
    keyYears.push(new Date(900, 0, 1)); // Year 900
    keyYears.push(new Date(1000, 0, 1)); // Year 1000
    keyYears.push(new Date(1100, 0, 1)); // Year 1100
    keyYears.push(new Date(1200, 0, 1)); // Year 1200
    keyYears.push(new Date(1300, 0, 1)); // Year 1300
    keyYears.push(new Date(1400, 0, 1)); // Year 1400
    keyYears.push(new Date(1500, 0, 1)); // Year 1500
    keyYears.push(new Date(1600, 0, 1)); // Year 1600
    keyYears.push(new Date(1700, 0, 1)); // Year 1700
    keyYears.push(new Date(1800, 0, 1)); // Year 1800
    keyYears.push(new Date(1900, 0, 1)); // Year 1900
    keyYears.push(new Date(2000, 0, 1)); // Year 2000
    
    for (let year = 2100; year <= currentYear * 2; year += 100) {
      keyYears.push(new Date(year, 0, 1));
    }
    
    timelineTop.select('.timeline-texts').selectAll('text').each(function(d, i) {
      const year = keyYears[i];
      if (year) {
        const originalX = timelineData.scale(year);
        const scaledX = originalX * transform.k + transform.x;
        d3.select(this)
          .attr('x', scaledX);
      }
    });
    
    timelineBottom.select('.timeline-texts').selectAll('text').each(function(d, i) {
      const year = keyYears[i];
      if (year) {
        const originalX = timelineData.scale(year);
        const scaledX = originalX * transform.k + transform.x;
        d3.select(this)
          .attr('x', scaledX);
      }
    });
  }
}

export function applyPriestFilter() {
  const shouldHidePriests = hidePriestsCheckbox ? hidePriestsCheckbox.checked : true;
  
  // Filter nodes and links to hide/show priests
  if (window.currentNodes && window.currentLinks) {
    // Update node visibility
    window.currentNodes.forEach(node => {
      const isPriest = node.rank && node.rank.toLowerCase() === 'priest';
      if (isPriest) {
        node.filtered = shouldHidePriests; // Hide priests if requested
      } else {
        node.filtered = false; // Show non-priest clergy
      }
    });
    
    // Update link visibility - hide links connected to priests
    window.currentLinks.forEach(link => {
      const sourceIsPriest = link.source.rank && link.source.rank.toLowerCase() === 'priest';
      const targetIsPriest = link.target.rank && link.target.rank.toLowerCase() === 'priest';
      const isBlackLink = link.color === BLACK_COLOR; // Ordination links
      
      // Hide black links (ordinations) when hiding priests
      if (shouldHidePriests && isBlackLink && (sourceIsPriest || targetIsPriest)) {
        link.filtered = true;
      } else {
        link.filtered = false;
      }
    });
    
    // Update force simulation to exclude filtered nodes/links from physics
    if (window.currentSimulation) {
      // Update link force to exclude filtered links
      window.currentSimulation.force('link', d3.forceLink(window.currentLinks.filter(l => !l.filtered)).id(d => d.id).distance(150));
      
      // Update charge force to exclude filtered nodes
      window.currentSimulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : -400));
      
      // Update collision force to exclude filtered nodes
      window.currentSimulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : 60));
      
      // Restart simulation to apply changes
      window.currentSimulation.alpha(1).restart();
    }
  }
}

// Initialize filter event listeners
export function initializeFilters() {
  // Sync checkboxes when either changes
  if (hidePriestsCheckbox) {
    hidePriestsCheckbox.addEventListener('change', function() {
      syncPriestFilters();
      applyPriestFilter();
    });
  }

  if (hidePriestsMobileCheckbox) {
    hidePriestsMobileCheckbox.addEventListener('change', function() {
      syncPriestFilters();
      applyPriestFilter();
    });
  }

  // Sync timeline checkboxes when either changes
  if (timelineViewCheckbox) {
    timelineViewCheckbox.addEventListener('change', function() {
      syncTimelineFilters();
      applyTimelineView();
    });
  }

  if (timelineViewMobileCheckbox) {
    timelineViewMobileCheckbox.addEventListener('change', function() {
      syncTimelineFilters();
      applyTimelineView();
    });
  }
}
