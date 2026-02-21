/**
 * Force-directed lineage visualization entry.
 * Imports core, shared nodes (via core), filters, search, styles-loader, and UI/modals.
 * Handles view toggle: force-directed vs tree; teardown/init on switch.
 */
import { initializeUI } from '../../js/ui.js';
import { initializeFilters, applyPriestFilter, applyBackboneOnlyFilter } from '../../js/filters.js';
import { initializeHTMXHandlers } from '../../js/modals.js';
import { initializeVisualization, destroyVisualization } from '../../js/core.js';
import { initializeSearch, handleURLSearch } from '../../js/search.js';
import { loadVisualizationStyles } from '../../js/visualization-styles-loader.js';
import { initializeTreeVisualization } from '../tree/tree.js';

function getView() {
  return typeof window.getLineageView === 'function' ? window.getLineageView() : 'force';
}

/** Clear tree SVG and zoom ref. Call before switching to force. */
function destroyTreeView() {
  window.currentZoom = null;
  const container = document.getElementById('graph-container');
  if (container) container.innerHTML = '';
}

async function runForceView() {
  await initializeVisualization();
  if (typeof applyPriestFilter === 'function') applyPriestFilter();
  if (typeof applyBackboneOnlyFilter === 'function') applyBackboneOnlyFilter();
}

async function runTreeView() {
  await initializeTreeVisualization();
}

async function switchToView(view) {
  if (view === 'tree') {
    destroyVisualization();
    await runTreeView();
  } else {
    destroyTreeView();
    await runForceView();
  }
}

async function initializeAll() {
  await loadVisualizationStyles();

  initializeUI();
  initializeFilters();
  initializeHTMXHandlers();
  initializeSearch();

  // Run force first so currentNodes/currentLinks and filters are set, then show requested view
  await runForceView();
  const view = getView();
  if (view === 'tree') {
    destroyVisualization();
    await runTreeView();
  }

  handleURLSearch();
  window.initializeVisualization = () => switchToView('force');
}

function onLineageViewChanged(event) {
  const view = event.detail?.view ?? getView();
  switchToView(view);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeAll();
    window.addEventListener('lineage-view-changed', onLineageViewChanged);
    window.addEventListener('lineage-filters-applied', () => {
      if (getView() === 'tree') runTreeView();
    });
  });
} else {
  initializeAll();
  window.addEventListener('lineage-view-changed', onLineageViewChanged);
  window.addEventListener('lineage-filters-applied', () => {
    if (getView() === 'tree') runTreeView();
  });
}
