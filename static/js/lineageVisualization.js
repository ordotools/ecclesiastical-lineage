// Main entry point for the lineage visualization
// This file imports and initializes all modules

// Import all modules
import { initializeUI } from './ui.js';
import { initializeFilters, applyPriestFilter, applyBackboneOnlyFilter } from './filters.js';
import { initializeHTMXHandlers } from './modals.js';
import { initializeVisualization } from './core.js';
import { initializeSearch, buildSearchIndex, handleURLSearch } from './search.js';

// Start the visualization
console.log('Starting visualization initialization...');
console.log('Available data:', { 
  links: window.linksData ? window.linksData.length : 'undefined',
  nodes: window.nodesData ? window.nodesData.length : 'undefined'
});

// Debug: Log sample data
if (window.linksData && window.linksData.length > 0) {
  console.log('Sample link data:', window.linksData[0]);
}
if (window.nodesData && window.nodesData.length > 0) {
  console.log('Sample node data:', window.nodesData[0]);
}

// Initialize all components
async function initializeAll() {
  // Initialize UI components first
  initializeUI();
  
  // Initialize filters
  initializeFilters();
  
  // Initialize HTMX handlers
  initializeHTMXHandlers();
  
  // Initialize search functionality
  initializeSearch();
  
  // Initialize the main visualization
  await initializeVisualization();
  
  // Apply initial filters after visualization is set up
  if (typeof applyPriestFilter === 'function') {
    applyPriestFilter();
  }
  if (typeof applyBackboneOnlyFilter === 'function') {
    applyBackboneOnlyFilter();
  }
  
  // Build search index when nodes are available
  if (window.currentNodes) {
    buildSearchIndex(window.currentNodes);
  }
  
  // Handle URL search parameters
  handleURLSearch();
  
  // Make initializeVisualization available globally for refresh
  window.initializeVisualization = initializeVisualization;
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAll);
} else {
  initializeAll();
}
