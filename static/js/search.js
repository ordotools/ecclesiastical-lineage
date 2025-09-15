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
    searchInput.addEventListener('input', (e) => handleSearchInput(e.target.value, searchResults));
    searchInput.addEventListener('keydown', (e) => handleSearchKeydown(e, searchResults));
  }
  
  if (searchInputMobile) {
    searchInputMobile.addEventListener('input', (e) => handleSearchInput(e.target.value, searchResultsMobile));
    searchInputMobile.addEventListener('keydown', (e) => handleSearchKeydown(e, searchResultsMobile));
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', () => clearSearch(searchInput, searchResults));
  }
  
  if (clearButtonMobile) {
    clearButtonMobile.addEventListener('click', () => clearSearch(searchInputMobile, searchResultsMobile));
  }
  
  // Build search index when nodes are available
  if (window.currentNodes) {
    buildSearchIndex(window.currentNodes);
  }
}

// Build search index from nodes
export function buildSearchIndex(nodes) {
  searchIndex = nodes.map(node => ({
    id: node.id,
    name: node.name,
    rank: node.rank || '',
    organization: node.organization || '',
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

// Perform search
function performSearch(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);
  
  return searchIndex
    .filter(item => {
      // Check if the node is currently visible (not filtered)
      if (item.node.filtered) return false;
      
      // Check if all search words match
      return words.every(word => item.searchText.includes(word));
    })
    .sort((a, b) => {
      // Sort by relevance: exact name matches first, then partial matches
      const aNameMatch = a.name.toLowerCase().includes(normalizedQuery);
      const bNameMatch = b.name.toLowerCase().includes(normalizedQuery);
      
      if (aNameMatch && !bNameMatch) return -1;
      if (bNameMatch && !aNameMatch) return 1;
      
      // Then sort alphabetically
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10); // Limit to top 10 results
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

// Highlight search matches in text
function highlightMatch(text, query) {
  if (!query.trim()) return text;
  
  const words = query.toLowerCase().trim().split(/\s+/);
  let highlightedText = text;
  
  words.forEach(word => {
    if (word.length > 1) { // Only highlight words longer than 1 character
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }
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
  centerNodeInViewport(node);
  
  // Highlight the node temporarily
  highlightNode(node);
  
  // Update URL with search parameter
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
      .transition()
      .duration(200)
      .attr('stroke-width', 6)
      .attr('stroke', '#ffc107')
      .transition()
      .delay(2000)
      .duration(500)
      .attr('stroke-width', 3)
      .attr('stroke', d => d.rank_color);
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
        centerNodeInViewport(node);
        highlightNode(node);
      }, 1000); // Wait for visualization to load
    }
  }
}