// View controller - manages switching between tree and force graph views
// Clears container on switch to avoid cross-contamination; tree does not touch window.currentSimulation

let currentView = 'tree';

export function setView(view) {
  currentView = view === 'force' ? 'force' : 'tree';
}

export function getView() {
  return currentView;
}

export async function initializeView() {
  const container = document.getElementById('graph-container');
  if (!container) return;

  // Clear container on every switch - prevents stale refs between views
  container.innerHTML = '';

  // When switching to tree: clear force simulation ref (container already cleared, sim is gone)
  // When switching to force: tree SVG is gone (container cleared). No stale refs.
  if (currentView === 'tree') {
    window.currentSimulation = null;
  }

  if (currentView === 'tree') {
    const { initializeTreeView } = await import('./lineageTreeView.js');
    await initializeTreeView();
  } else {
    const { initializeVisualization } = await import('./core.js');
    await initializeVisualization();
  }
}
