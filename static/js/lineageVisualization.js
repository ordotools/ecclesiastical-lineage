// Main entry point for the lineage visualization
// This file imports and initializes all modules

// Import all modules
import { initializeUI } from './ui.js';
import { initializeFilters } from './filters.js';
import { initializeHTMXHandlers } from './modals.js';
import { initializeVisualization } from './core.js';
import { initializeSearch, buildSearchIndex, handleURLSearch } from './search.js';

// Start the visualization
console.log('Starting visualization initialization...');
console.log('Available data:', { 
  links: window.linksData ? window.linksData.length : 'undefined',
  nodes: window.nodesData ? window.nodesData.length : 'undefined'
});

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
