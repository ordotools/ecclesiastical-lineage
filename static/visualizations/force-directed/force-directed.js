/**
 * Force-directed lineage visualization entry.
 * Imports core, shared nodes (via core), filters, search, styles-loader, and UI/modals.
 */
import { initializeUI } from '../../js/ui.js';
import { initializeFilters, applyPriestFilter, applyBackboneOnlyFilter } from '../../js/filters.js';
import { initializeHTMXHandlers } from '../../js/modals.js';
import { initializeVisualization } from '../../js/core.js';
import { initializeSearch, handleURLSearch } from '../../js/search.js';
import { loadVisualizationStyles } from '../../js/visualization-styles-loader.js';

async function initializeAll() {
  await loadVisualizationStyles();

  initializeUI();
  initializeFilters();
  initializeHTMXHandlers();
  initializeSearch();
  await initializeVisualization();

  if (typeof applyPriestFilter === 'function') {
    applyPriestFilter();
  }
  if (typeof applyBackboneOnlyFilter === 'function') {
    applyBackboneOnlyFilter();
  }

  handleURLSearch();
  window.initializeVisualization = initializeVisualization;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAll);
} else {
  initializeAll();
}
