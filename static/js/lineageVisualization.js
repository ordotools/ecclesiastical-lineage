// Main entry point for the lineage visualization
// This file imports and initializes all modules

// Import all modules
import { initializeUI } from './ui.js';
import { initializeFilters, applyPriestFilter, applyBackboneOnlyFilter } from './filters.js';
import { initializeHTMXHandlers } from './modals.js';
import { initializeVisualization } from './core.js';
import { initializeSearch, buildSearchIndex, handleURLSearch } from './search.js';

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
  
  // Search index will be built lazily when search is first used
  // This defers the work until needed, improving initial page load performance
  
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
