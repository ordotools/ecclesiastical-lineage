// Search module for clergy visualization
import { centerNodeInViewport } from './ui.js';
import { handleNodeClick } from './modals.js';

// Search state
let searchIndex = [];
let currentSearchResults = [];

// Initialize search functionality
export function initializeSearch() {
  const searchInput = document.getElementById('clergy-search');
  const searchInputMobile = document.getElementById('clergy-search-mobile');
  const clearButton = document.getElementById('clear-search');
  const clearButtonMobile = document.getElementById('clear-search-mobile');
  const searchResults = document.getElementById('search-results');
  const searchResultsMobile = document.getElementById('search-results-mobile');
  
  if (searchInput) {
    // Build index lazily when user starts typing or focuses input
    searchInput.addEventListener('focus', ensureSearchIndex);
    searchInput.addEventListener('input', (e) => {
      ensureSearchIndex();
      handleSearchInput(e.target.value, searchResults);
    });
    searchInput.addEventListener('keydown', (e) => handleSearchKeydown(e, searchResults));
  }
  
  if (searchInputMobile) {
    // Build index lazily when user starts typing or focuses input
    searchInputMobile.addEventListener('focus', ensureSearchIndex);
    searchInputMobile.addEventListener('input', (e) => {
      ensureSearchIndex();
      handleSearchInput(e.target.value, searchResultsMobile);
    });
    searchInputMobile.addEventListener('keydown', (e) => handleSearchKeydown(e, searchResultsMobile));
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', () => clearSearch(searchInput, searchResults));
  }
  
  if (clearButtonMobile) {
    clearButtonMobile.addEventListener('click', () => clearSearch(searchInputMobile, searchResultsMobile));
  }
  
  // Initialize overlay search
  initializeOverlaySearch();
  
  // Search index will be built lazily when search is first used
  // This improves initial page load performance
}

// Initialize overlay search functionality
function initializeOverlaySearch() {
  const navbarSearchBtn = document.getElementById('navbar-search-btn');
  const searchOverlay = document.getElementById('search-overlay');
  const overlaySearchInput = document.getElementById('overlay-search-input');
  const clearOverlaySearch = document.getElementById('clear-overlay-search');
  const overlaySearchResults = document.getElementById('overlay-search-results');
  
  // Show search button on lineage visualization page
  if (navbarSearchBtn) {
    navbarSearchBtn.style.display = 'inline-flex';
  }
  
  // Open overlay search
  if (navbarSearchBtn && searchOverlay) {
    navbarSearchBtn.addEventListener('click', () => {
      showOverlaySearch();
    });
  }
  
  // Close overlay when clicking backdrop
  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) {
        hideOverlaySearch();
      }
    });
  }
  
  // Handle overlay search input
  if (overlaySearchInput && overlaySearchResults) {
    // Build index lazily when user starts typing or focuses input
    overlaySearchInput.addEventListener('focus', ensureSearchIndex);
    overlaySearchInput.addEventListener('input', (e) => {
      ensureSearchIndex();
      handleOverlaySearchInput(e.target.value, overlaySearchResults);
    });
    
    overlaySearchInput.addEventListener('keydown', (e) => {
      handleOverlaySearchKeydown(e, overlaySearchResults);
    });
  }
  
  // Clear overlay search
  if (clearOverlaySearch && overlaySearchInput && overlaySearchResults) {
    clearOverlaySearch.addEventListener('click', () => {
      clearOverlaySearchInput(overlaySearchInput, overlaySearchResults);
    });
  }
  
  // Close overlay with Escape key and open with Cmd/Ctrl+F
  document.addEventListener('keydown', (e) => {
    // Open search with Cmd/Ctrl+F
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault(); // Prevent browser's default search
      if (searchOverlay && searchOverlay.style.display === 'none') {
        showOverlaySearch();
      }
    }
    // Close search with Escape
    else if (e.key === 'Escape' && searchOverlay && searchOverlay.style.display !== 'none') {
      hideOverlaySearch();
    }
  });
}

// Show overlay search
function showOverlaySearch() {
  const searchOverlay = document.getElementById('search-overlay');
  const overlaySearchInput = document.getElementById('overlay-search-input');
  
  if (searchOverlay) {
    // Set appropriate keyboard shortcut hint based on OS
    if (overlaySearchInput) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const shortcut = isMac ? '⌘F' : 'Ctrl+F';
      overlaySearchInput.placeholder = `Search clergy by name, rank, or organization... (${shortcut})`;
    }
    
    searchOverlay.style.display = 'flex';
    // Trigger reflow to ensure display change is applied
    searchOverlay.offsetHeight;
    searchOverlay.classList.add('show');
    
    // Focus the input after animation
    setTimeout(() => {
      if (overlaySearchInput) {
        overlaySearchInput.focus();
      }
    }, 300);
  }
}

// Hide overlay search
function hideOverlaySearch() {
  const searchOverlay = document.getElementById('search-overlay');
  const overlaySearchInput = document.getElementById('overlay-search-input');
  const overlaySearchResults = document.getElementById('overlay-search-results');
  
  if (searchOverlay) {
    searchOverlay.classList.remove('show');
    
    // Hide after animation completes
    setTimeout(() => {
      searchOverlay.style.display = 'none';
      if (overlaySearchInput) {
        overlaySearchInput.value = '';
      }
      if (overlaySearchResults) {
        overlaySearchResults.style.display = 'none';
        overlaySearchResults.innerHTML = '';
      }
    }, 300);
  }
}

// Handle overlay search input
function handleOverlaySearchInput(query, resultsContainer) {
  const clearButton = document.getElementById('clear-overlay-search');
  
  if (!query.trim()) {
    hideOverlaySearchResults(resultsContainer);
    if (clearButton) {
      clearButton.style.display = 'none';
    }
    return;
  }
  
  if (clearButton) {
    clearButton.style.display = 'inline-block';
  }
  
  const results = performSearch(query);
  displayOverlaySearchResults(results, resultsContainer);
}

// Handle overlay search keydown events
function handleOverlaySearchKeydown(event, resultsContainer) {
  const results = resultsContainer.querySelectorAll('.search-result-item');
  const selectedResult = resultsContainer.querySelector('.search-result-item.selected');
  
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!selectedResult && results.length > 0) {
      results[0].classList.add('selected');
    } else if (selectedResult) {
      selectedResult.classList.remove('selected');
      const nextIndex = Array.from(results).indexOf(selectedResult) + 1;
      if (nextIndex < results.length) {
        results[nextIndex].classList.add('selected');
      } else {
        results[0].classList.add('selected');
      }
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!selectedResult && results.length > 0) {
      results[results.length - 1].classList.add('selected');
    } else if (selectedResult) {
      selectedResult.classList.remove('selected');
      const prevIndex = Array.from(results).indexOf(selectedResult) - 1;
      if (prevIndex >= 0) {
        results[prevIndex].classList.add('selected');
      } else {
        results[results.length - 1].classList.add('selected');
      }
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (selectedResult) {
      selectedResult.click();
    } else if (results.length > 0) {
      results[0].click();
    }
  }
}

// Display overlay search results
function displayOverlaySearchResults(results, resultsContainer) {
  const searchInputGroup = document.querySelector('.search-bar-input-group');
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-results">No clergy found</div>';
    resultsContainer.style.display = 'block';
    
    // Add has-dropdown class after a brief delay to show morphing effect
    setTimeout(() => {
      if (searchInputGroup) {
        searchInputGroup.classList.add('has-dropdown');
      }
    }, 50);
    return;
  }
  
  const html = results.map(result => `
    <div class="search-result-item" data-node-id="${result.id}">
      <div class="search-result-name">${highlightMatch(result.name, getCurrentOverlaySearchQuery())}</div>
      <div class="search-result-details">
        ${result.rank}${result.rank && result.organization ? ' • ' : ''}${result.organization}
      </div>
    </div>
  `).join('');
  
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
  
  // Add has-dropdown class after a brief delay to show morphing effect
  setTimeout(() => {
    if (searchInputGroup) {
      searchInputGroup.classList.add('has-dropdown');
    }
  }, 50);
  
  // Add click handlers
  resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const nodeId = parseInt(item.getAttribute('data-node-id'));
      const node = window.currentNodes?.find(n => n.id === nodeId);
      if (node) {
        selectOverlaySearchResult(node, resultsContainer);
      }
    });
    
    // Add hover handlers
    item.addEventListener('mouseenter', () => {
      resultsContainer.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
}

// Hide overlay search results
function hideOverlaySearchResults(resultsContainer) {
  const searchInputGroup = document.querySelector('.search-bar-input-group');
  
  // Remove has-dropdown class first to start reverse morphing
  if (searchInputGroup) {
    searchInputGroup.classList.remove('has-dropdown');
  }
  
  // Hide the dropdown after the morphing animation completes
  setTimeout(() => {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
  }, 200);
}

// Clear overlay search input
function clearOverlaySearchInput(searchInput, resultsContainer) {
  searchInput.value = '';
  hideOverlaySearchResults(resultsContainer);
  searchInput.focus();
  
  const clearButton = document.getElementById('clear-overlay-search');
  if (clearButton) {
    clearButton.style.display = 'none';
  }
}

// Get current overlay search query
function getCurrentOverlaySearchQuery() {
  const overlaySearchInput = document.getElementById('overlay-search-input');
  return overlaySearchInput?.value || '';
}

// Handle overlay search result selection
function selectOverlaySearchResult(node, resultsContainer) {
  // Clear search input
  const searchInput = document.getElementById('overlay-search-input');
  if (searchInput) {
    searchInput.value = node.name;
  }
  
  // Hide search results with morphing effect
  hideOverlaySearchResults(resultsContainer);
  
  // Hide the overlay after morphing completes
  setTimeout(() => {
    hideOverlaySearch();
  }, 250);
  
  // Center the node in viewport
  // DISABLED: Node centering on search selection
  // centerNodeInViewport(node);
  
  // Highlight the node temporarily
  highlightNode(node);
  
  // Show clergy info panel (no URL change)
  setTimeout(() => {
    if (window.innerWidth > 768) { // Only on desktop
      handleNodeClick(null, node);
    }
  }, 100);
}

// Build search index from nodes
export function buildSearchIndex(nodes) {
  searchIndex = nodes.map(node => ({
    id: node.id,
    name: node.name,
    rank: node.rank || '',
    organization: node.organization || '',
    // Keep the original searchText for backward compatibility
    searchText: `${node.name} ${node.rank || ''} ${node.organization || ''}`.toLowerCase(),
    node: node
  }));
}

// Handle search input
function handleSearchInput(query, resultsContainer) {
  if (!query.trim()) {
    hideSearchResults(resultsContainer);
    return;
  }
  
  const results = performSearch(query);
  displaySearchResults(results, resultsContainer);
}

// Handle search keydown events
function handleSearchKeydown(event, resultsContainer) {
  const results = resultsContainer.querySelectorAll('.search-result-item');
  const selectedResult = resultsContainer.querySelector('.search-result-item.selected');
  
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!selectedResult && results.length > 0) {
      results[0].classList.add('selected');
    } else if (selectedResult) {
      selectedResult.classList.remove('selected');
      const nextIndex = Array.from(results).indexOf(selectedResult) + 1;
      if (nextIndex < results.length) {
        results[nextIndex].classList.add('selected');
      } else {
        results[0].classList.add('selected');
      }
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!selectedResult && results.length > 0) {
      results[results.length - 1].classList.add('selected');
    } else if (selectedResult) {
      selectedResult.classList.remove('selected');
      const prevIndex = Array.from(results).indexOf(selectedResult) - 1;
      if (prevIndex >= 0) {
        results[prevIndex].classList.add('selected');
      } else {
        results[results.length - 1].classList.add('selected');
      }
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (selectedResult) {
      selectedResult.click();
    } else if (results.length > 0) {
      results[0].click();
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    const searchInput = resultsContainer.parentElement.querySelector('input');
    clearSearch(searchInput, resultsContainer);
  }
}

// Ensure search index is built (lazy initialization)
function ensureSearchIndex() {
  if (searchIndex.length === 0 && window.currentNodes) {
    buildSearchIndex(window.currentNodes);
  }
}

// Perform search using fuzzy search
function performSearch(query) {
  if (!query || !query.trim()) return [];
  
  // Build search index lazily if not already built
  ensureSearchIndex();
  
  // Use fuzzy search for better matching
  const searchResults = window.fuzzySearch(searchIndex, query.trim(), (item) => {
    // Create a searchable string that includes name, rank, and organization
    return `${item.name} ${item.rank || ''} ${item.organization || ''}`.trim();
  });
  
  // Filter out nodes that are currently filtered (hidden)
  const visibleResults = searchResults
    .filter(result => !result.item.node.filtered)
    .slice(0, 10); // Limit to top 10 results
  
  // Return the items in the expected format
  return visibleResults.map(result => result.item);
}

// Display search results
function displaySearchResults(results, resultsContainer) {
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-results text-muted small">No clergy found</div>';
    resultsContainer.style.display = 'block';
    return;
  }
  
  const html = results.map(result => `
    <div class="search-result-item" data-node-id="${result.id}">
      <div class="search-result-name">${highlightMatch(result.name, getCurrentSearchQuery())}</div>
      <div class="search-result-details text-muted small">
        ${result.rank}${result.rank && result.organization ? ' • ' : ''}${result.organization}
      </div>
    </div>
  `).join('');
  
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
  
  // Add click handlers
  resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const nodeId = parseInt(item.getAttribute('data-node-id'));
      const node = window.currentNodes?.find(n => n.id === nodeId);
      if (node) {
        selectSearchResult(node, resultsContainer);
      }
    });
    
    // Add hover handlers
    item.addEventListener('mouseenter', () => {
      resultsContainer.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
}

// Hide search results
function hideSearchResults(resultsContainer) {
  resultsContainer.style.display = 'none';
  resultsContainer.innerHTML = '';
}

// Clear search
function clearSearch(searchInput, resultsContainer) {
  searchInput.value = '';
  hideSearchResults(resultsContainer);
  searchInput.focus();
}

// Get current search query
function getCurrentSearchQuery() {
  const searchInput = document.getElementById('clergy-search');
  const searchInputMobile = document.getElementById('clergy-search-mobile');
  
  return searchInput?.value || searchInputMobile?.value || '';
}

// Highlight search matches in text using fuzzy search normalization
function highlightMatch(text, query) {
  if (!query.trim()) return text;
  
  // Use the same normalization as fuzzy search
  const normalizedQuery = window.normalizeString ? window.normalizeString(query) : { deAccented: query.toLowerCase() };
  const normalizedText = window.normalizeString ? window.normalizeString(text) : { deAccented: text.toLowerCase() };
  
  // Try to find matches in the normalized text
  const queryWords = normalizedQuery.deAccented.split(/\s+/).filter(word => word.length > 1);
  let highlightedText = text;
  
  // For each word in the query, try to find and highlight it
  queryWords.forEach(word => {
    // Create a regex that matches the word case-insensitively
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  });
  
  return highlightedText;
}

// Handle search result selection
function selectSearchResult(node, resultsContainer) {
  // Hide search results
  hideSearchResults(resultsContainer);
  
  // Clear search input
  const searchInput = resultsContainer.parentElement.querySelector('input');
  if (searchInput) {
    searchInput.value = node.name;
  }
  
  // Center the node in viewport
  // DISABLED: Node centering on search selection
  // centerNodeInViewport(node);
  
  // Highlight the node temporarily
  highlightNode(node);
  
  // Update URL with search parameter (only for side menu search)
  updateURLWithSearch(node.id);
}

// Highlight a node temporarily
function highlightNode(node) {
  // Find the node element in the DOM
  const svg = d3.select('#graph-container svg');
  const nodeElements = svg.selectAll('g').filter(d => d && d.id === node.id);
  
  if (!nodeElements.empty()) {
    // Add highlight styling
    nodeElements.select('circle:first-child')
      .attr('stroke-width', 6)
      .attr('stroke', '#ffc107');
    
    // Remove highlight after delay
    setTimeout(() => {
      nodeElements.select('circle:first-child')
        .attr('stroke-width', 3)
        .attr('stroke', d => d.rank_color);
    }, 2000);
  }
  
  // Also trigger the click handler to show clergy info
  setTimeout(() => {
    if (window.innerWidth > 768) { // Only on desktop
      handleNodeClick(null, node);
    }
  }, 100);
}

// Update URL with search parameter
function updateURLWithSearch(nodeId) {
  const url = new URL(window.location);
  url.searchParams.set('focus', nodeId);
  window.history.pushState({}, '', url);
}

// Handle URL search parameters on page load
export function handleURLSearch() {
  const url = new URL(window.location);
  const focusId = url.searchParams.get('focus');
  
  if (focusId && window.currentNodes) {
    const node = window.currentNodes.find(n => n.id === parseInt(focusId));
    if (node && !node.filtered) {
      setTimeout(() => {
        // DISABLED: Node centering on URL focus
        // centerNodeInViewport(node);
        highlightNode(node);
      }, 1000); // Wait for visualization to load
    }
  }
}