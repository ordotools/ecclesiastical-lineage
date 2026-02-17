// Main entry point for the lineage visualization
// This file imports and initializes all modules

// Import all modules
import { initializeUI } from './ui.js';
import { initializeFilters, applyPriestFilter, applyBackboneOnlyFilter } from './filters.js';
import { initializeHTMXHandlers } from './modals.js';
import { initializeView, getView } from './viewController.js';
import { initializeSearch, buildSearchIndex, handleURLSearch } from './search.js';
import { loadVisualizationStyles } from './visualization-styles-loader.js';

// Initialize all components
async function initializeAll() {
  // Load visualization styles from database first (sets CSS variables)
  await loadVisualizationStyles();

  // Initialize UI components first
  initializeUI();

  // Initialize filters
  initializeFilters();

  // Initialize HTMX handlers
  initializeHTMXHandlers();

  // Initialize search functionality
  initializeSearch();

  // Initialize the main visualization via view controller (default: tree)
  await initializeView();

  // Apply filters only when force view is active (tree view ignores these)
  if (getView() === 'force' && typeof applyPriestFilter === 'function') {
    applyPriestFilter();
  }
  if (getView() === 'force' && typeof applyBackboneOnlyFilter === 'function') {
    applyBackboneOnlyFilter();
  }

  // Search index will be built lazily when search is first used
  // This defers the work until needed, improving initial page load performance

  // Handle URL search parameters
  handleURLSearch();

  // Make initializeVisualization available globally for refresh (routes through view controller)
  window.initializeVisualization = () => initializeView();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAll);
} else {
  initializeAll();
}
