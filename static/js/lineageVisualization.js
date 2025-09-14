// Main entry point for the lineage visualization
// This file imports and initializes all modules

// Import all modules
import { initializeUI } from './ui.js';
import { initializeFilters } from './filters.js';
import { initializeHTMXHandlers } from './modals.js';
import { initializeVisualization } from './core.js';

// Start the visualization
console.log('Starting visualization initialization...');
console.log('Available data:', { 
  links: window.linksData ? window.linksData.length : 'undefined',
  nodes: window.nodesData ? window.nodesData.length : 'undefined'
});

// Initialize all components
function initializeAll() {
  // Initialize UI components first
  initializeUI();
  
  // Initialize filters
  initializeFilters();
  
  // Initialize HTMX handlers
  initializeHTMXHandlers();
  
  // Initialize the main visualization
  initializeVisualization();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAll);
} else {
  initializeAll();
}
