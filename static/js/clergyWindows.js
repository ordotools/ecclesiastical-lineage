/**
 * Draggable Clergy Info Windows Module
 * 
 * Manages multiple draggable windows that display clergy information.
 * Each window can be moved independently and multiple windows can be open simultaneously.
 */

// d3 is loaded globally, access via window.d3 or d3

// Track all open windows
const openWindows = new Map(); // Map<clergyId, windowElement>
let nextZIndex = 1000;
let windowCounter = 0;

// Get or create windows container
function getWindowsContainer() {
  let container = document.getElementById('clergy-windows-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'clergy-windows-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none'; // Allow clicks to pass through to graph
    container.style.zIndex = '1050';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Convert SVG coordinates to viewport coordinates
 * @param {Object} node - Node data with x, y coordinates
 * @returns {Object} Viewport coordinates {x, y}
 */
function svgToViewport(node) {
  // d3 is available globally
  const d3 = window.d3 || (typeof d3 !== 'undefined' ? d3 : null);
  if (!d3) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  
  const svg = d3.select('#graph-container svg');
  if (svg.empty()) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  
  const zoom = window.currentZoom;
  if (!zoom) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  
  const transform = d3.zoomTransform(svg.node());
  const viewportX = (node.x * transform.k) + transform.x;
  const viewportY = (node.y * transform.k) + transform.y;
  
  return { x: viewportX, y: viewportY };
}

/**
 * Ensure window stays within viewport bounds
 * @param {number} x - Desired x position
 * @param {number} y - Desired y position
 * @param {number} width - Window width
 * @param {number} height - Window height
 * @returns {Object} Bounded coordinates {x, y}
 */
function constrainToViewport(x, y, width, height) {
  const padding = 20;
  const maxX = window.innerWidth - width - padding;
  const maxY = window.innerHeight - height - padding;
  
  return {
    x: Math.max(padding, Math.min(x, maxX)),
    y: Math.max(padding, Math.min(y, maxY))
  };
}

/**
 * Create a new draggable clergy info window
 * @param {Object} nodeData - Node data from visualization
 * @returns {HTMLElement} The created window element
 */
export function createClergyWindow(nodeData) {
  const clergyId = nodeData.id;
  
  // Check if window already exists for this clergy
  if (openWindows.has(clergyId)) {
    // Bring existing window to front
    bringToFront(clergyId);
    return openWindows.get(clergyId);
  }
  
  const windowId = `clergy-window-${clergyId}-${windowCounter++}`;
  const container = getWindowsContainer();
  
  // Calculate initial position near clicked node
  const nodeViewportPos = svgToViewport(nodeData);
  const windowWidth = 320;
  const windowHeight = 500; // Approximate, will adjust based on content
  
  // Offset from node position (50px right, 50px down)
  let initialX = nodeViewportPos.x + 50;
  let initialY = nodeViewportPos.y + 50;
  
  // Constrain to viewport
  const constrained = constrainToViewport(initialX, initialY, windowWidth, windowHeight);
  initialX = constrained.x;
  initialY = constrained.y;
  
  // Create window element
  const window = document.createElement('div');
  window.className = 'clergy-window';
  window.setAttribute('data-clergy-id', clergyId);
  window.setAttribute('data-window-id', windowId);
  window.style.left = `${initialX}px`;
  window.style.top = `${initialY}px`;
  window.style.zIndex = nextZIndex++;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'clergy-window-header';
  
  const title = document.createElement('span');
  title.className = 'clergy-window-title';
  title.textContent = nodeData.name || 'Unknown Clergy';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'clergy-window-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '×';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeWindow(clergyId);
  };
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'clergy-window-content';
  content.setAttribute('data-clergy-id', clergyId);
  
  // Add loading placeholder
  content.innerHTML = `
    <div class="text-center p-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Loading clergy information...</p>
    </div>
  `;
  
  window.appendChild(header);
  window.appendChild(content);
  container.appendChild(window);
  
  // Store node data on window for later use
  window.currentNodeData = nodeData;
  
  // Store user edit status on window (from global)
  window.userCanEditClergy = window.userCanEditClergy || false;
  
  // Initialize drag functionality
  initializeDragHandlers(window);
  
  // Store window reference
  openWindows.set(clergyId, window);
  
  // Bring to front on click (but not when dragging)
  let isDragging = false;
  window.addEventListener('mousedown', (e) => {
    // Only bring to front if not starting a drag
    if (!e.target.closest('.clergy-window-header')) {
      bringToFront(clergyId);
    }
  });
  
  return window;
}

/**
 * Close a specific window
 * @param {string|number} clergyId - The clergy ID whose window to close
 */
export function closeWindow(clergyId) {
  const window = openWindows.get(clergyId);
  if (window) {
    window.remove();
    openWindows.delete(clergyId);
  }
}

/**
 * Close all windows
 */
export function closeAllWindows() {
  openWindows.forEach((window, clergyId) => {
    window.remove();
  });
  openWindows.clear();
}

/**
 * Bring a window to the front (highest z-index)
 * @param {string|number} clergyId - The clergy ID whose window to bring to front
 */
export function bringToFront(clergyId) {
  const window = openWindows.get(clergyId);
  if (window) {
    window.style.zIndex = nextZIndex++;
  }
}

/**
 * Initialize drag handlers for a window
 * @param {HTMLElement} windowElement - The window element to make draggable
 */
function initializeDragHandlers(windowElement) {
  const header = windowElement.querySelector('.clergy-window-header');
  if (!header) return;
  
  let isDragging = false;
  let startX, startY, initialX, initialY;
  
  header.style.cursor = 'move';
  
  header.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on close button or links
    if (e.target.closest('.clergy-window-close') || 
        e.target.closest('a') || 
        e.target.closest('button')) {
      return;
    }
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = windowElement.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Bring to front when starting drag
    const clergyId = windowElement.getAttribute('data-clergy-id');
    if (clergyId) {
      bringToFront(clergyId);
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newX = initialX + deltaX;
    let newY = initialY + deltaY;
    
    // Constrain to viewport
    const rect = windowElement.getBoundingClientRect();
    const constrained = constrainToViewport(newX, newY, rect.width, rect.height);
    
    windowElement.style.left = `${constrained.x}px`;
    windowElement.style.top = `${constrained.y}px`;
    
    e.preventDefault();
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

/**
 * Update window content with clergy data
 * @param {string|number} clergyId - The clergy ID
 * @param {Object} nodeData - Node data
 * @param {Object} relationshipsData - Relationships data from API
 */
export function updateWindowContent(clergyId, nodeData, relationshipsData) {
  const window = openWindows.get(clergyId);
  if (!window) return;
  
  const content = window.querySelector('.clergy-window-content');
  if (!content) return;
  
  const windowId = window.getAttribute('data-window-id');
  const canEdit = window.userCanEditClergy === true || window.userCanEditClergy === 'true';
  
  // Generate unique IDs for this window's elements
  const getWindowId = (baseId) => `${baseId}-${windowId}`;
  
  // Check if clergy is a bishop (has consecration date or rank indicates bishop)
  const isBishop = nodeData.consecration_date || 
                   (nodeData.rank && (
                     nodeData.rank.toLowerCase().includes('bishop') ||
                     nodeData.rank.toLowerCase().includes('archbishop') ||
                     nodeData.rank.toLowerCase() === 'pope'
                   ));
  
  // Build HTML content (similar to _clergy_info_panel.html)
  let html = `
    <div class="aside-content">
      <div class="clergy-image-container">
        <img id="${getWindowId('clergy-window-image')}" src="" alt="Clergy portrait" class="clergy-aside-image">
        ${canEdit ? `
        <button id="${getWindowId('edit-clergy-btn')}" class="edit-clergy-btn-overlay" aria-label="Edit clergy" style="display: none;">
          <i class="fas fa-edit"></i>
        </button>
        ` : ''}
      </div>

      <div class="dates-section mb-1" style="font-size: 10pt; line-height: 1.1; margin-bottom: 0.25rem;">
        <div class="d-flex justify-content-center align-items-center gap-2">
          <div class="date-item text-center p-0" style="min-width: 0;">
            <div id="${getWindowId('clergy-window-ordination')}" class="date-value" style="font-size: 10pt; font-weight: 300;"></div>
            <div class="date-label" style="font-size: 8pt; color: #888;">Ordination</div>
          </div>
          ${isBishop ? `
          <span style="font-size: 9pt; color: #bbb;">|</span>
          <div class="date-item text-center p-0" style="min-width: 0;">
            <div id="${getWindowId('clergy-window-consecration')}" class="date-value" style="font-size: 10pt; font-weight: 300;"></div>
            <div class="date-label" style="font-size: 8pt; color: #888;">Consecration</div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="info-section mt-1">
        <div class="relationships-section mt-1">
          <div class="relationship-item mb-1">
            <strong>Ordained by:</strong>
            <span id="${getWindowId('ordained-by-info')}"></span>
          </div>
          
          ${isBishop ? `
          <div class="relationship-item mb-1" id="${getWindowId('consecrated-by-section')}" style="display: none;">
            <strong>Consecrated by:</strong>
            <span id="${getWindowId('consecrated-by-info')}"></span>
          </div>
          ` : ''}
          
          ${isBishop ? `
          <div class="relationship-item mb-1">
            <strong>Ordained:</strong>
            <div id="${getWindowId('ordained-clergy-list')}"></div>
          </div>
          ` : ''}
          
          ${isBishop ? `
          <div class="relationship-item mb-1" id="${getWindowId('consecrated-clergy-section')}" style="display: none;">
            <strong>Consecrated:</strong>
            <div id="${getWindowId('consecrated-clergy-list')}"></div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  
  content.innerHTML = html;
  
  // Populate basic info
  const ordinationEl = document.getElementById(getWindowId('clergy-window-ordination'));
  const consecrationEl = document.getElementById(getWindowId('clergy-window-consecration'));
  const imageEl = document.getElementById(getWindowId('clergy-window-image'));
  
  if (ordinationEl) {
    ordinationEl.textContent = nodeData.ordination_date || 'N/A';
  }
  if (consecrationEl && isBishop) {
    consecrationEl.textContent = nodeData.consecration_date || 'N/A';
  }
  
  // Set image
  if (imageEl) {
    if (nodeData.image_url) {
      imageEl.src = nodeData.image_url;
      imageEl.style.display = 'block';
      imageEl.style.filter = 'blur(2px)';
      
      // Load high-res image if available
      if (nodeData.high_res_image_url) {
        const highResImage = new Image();
        highResImage.onload = function() {
          imageEl.src = nodeData.high_res_image_url;
          imageEl.style.filter = 'none';
        };
        highResImage.onerror = function() {
          imageEl.style.filter = 'none';
        };
        highResImage.src = nodeData.high_res_image_url;
      } else {
        imageEl.style.filter = 'none';
      }
    } else {
      imageEl.style.display = 'none';
    }
  }
  
  // Populate relationships if provided
  if (relationshipsData) {
    populateWindowRelationships(clergyId, relationshipsData, getWindowId, canEdit);
  }
  
  // Display status indicators if present
  if (nodeData.statuses && nodeData.statuses.length > 0) {
    displayWindowStatusIndicators(clergyId, nodeData, getWindowId);
  }
  
  // Set up edit button if applicable
  if (canEdit) {
    const editBtn = document.getElementById(getWindowId('edit-clergy-btn'));
    if (editBtn) {
      editBtn.style.display = 'flex';
      editBtn.onclick = function() {
        // Import and call openEditClergyModal
        import('./modals.js').then(module => {
          if (module.openEditClergyModal) {
            module.openEditClergyModal(clergyId);
          }
        });
      };
    }
  }
  
  // Store helper function on window for relationship updates
  window.getWindowId = getWindowId;
}

/**
 * Display status indicators in a window
 * @param {string|number} clergyId - The clergy ID
 * @param {Object} nodeData - Node data with statuses
 * @param {Function} getWindowId - Function to get window-specific IDs
 */
function displayWindowStatusIndicators(clergyId, nodeData, getWindowId) {
  const window = openWindows.get(clergyId);
  if (!window) return;
  
  const content = window.querySelector('.clergy-window-content');
  if (!content) return;
  
  const imageContainer = content.querySelector('.clergy-image-container');
  if (!imageContainer) return;
  
  // Check if status container already exists
  let statusContainer = content.querySelector(`#${getWindowId('clergy-status-indicators')}`);
  
  if (!statusContainer) {
    statusContainer = document.createElement('div');
    statusContainer.id = getWindowId('clergy-status-indicators');
    statusContainer.className = 'status-indicators-panel';
    imageContainer.parentNode.insertBefore(statusContainer, imageContainer.nextSibling);
  }
  
  // Clear existing content
  statusContainer.innerHTML = '';
  
  // Check if clergy has statuses
  if (!nodeData.statuses || nodeData.statuses.length === 0) {
    statusContainer.style.display = 'none';
    return;
  }
  
  statusContainer.style.display = 'block';
  
  // Create status badges
  const badgesHTML = nodeData.statuses.map(status => `
    <div class="status-badge-item" title="${status.description || status.name}">
      <i class="fas ${status.icon}" style="color: ${status.color};"></i>
      <span>${status.name}</span>
    </div>
  `).join('');
  
  statusContainer.innerHTML = badgesHTML;
}

/**
 * Populate relationships in a window
 * @param {string|number} clergyId - The clergy ID
 * @param {Object} data - Relationships data
 * @param {Function} getWindowId - Function to get window-specific IDs
 * @param {boolean} canEdit - Whether user can edit
 */
function populateWindowRelationships(clergyId, data, getWindowId, canEdit) {
  // Get window to check if clergy is a bishop
  const window = openWindows.get(clergyId);
  const nodeData = window?.currentNodeData || {};
  const isBishop = nodeData.consecration_date || 
                   (nodeData.rank && (
                     nodeData.rank.toLowerCase().includes('bishop') ||
                     nodeData.rank.toLowerCase().includes('archbishop') ||
                     nodeData.rank.toLowerCase() === 'pope'
                   ));
  
  // Display ordained by
  const ordainedByInfo = document.getElementById(getWindowId('ordained-by-info'));
  if (ordainedByInfo) {
    if (data.ordaining_bishop) {
      if (canEdit) {
        ordainedByInfo.innerHTML = `<a href="#" class="clergy-link" data-clergy-id="${data.ordaining_bishop.id}">${data.ordaining_bishop.name}</a>`;
      } else {
        ordainedByInfo.innerHTML = `<span>${data.ordaining_bishop.name}</span>`;
      }
    } else {
      if (canEdit) {
        ordainedByInfo.innerHTML = `<a href="#" class="add-clergy-link" data-context-type="ordination" data-context-clergy-id="${clergyId}">?</a>`;
      } else {
        ordainedByInfo.innerHTML = `<span>N/A</span>`;
      }
    }
  }
  
  // Display consecrated by (only for bishops)
  if (isBishop) {
    const consecratedBySection = document.getElementById(getWindowId('consecrated-by-section'));
    const consecratedByInfo = document.getElementById(getWindowId('consecrated-by-info'));
    if (consecratedByInfo && consecratedBySection) {
      if (data.consecrator) {
        if (canEdit) {
          consecratedByInfo.innerHTML = `<a href="#" class="clergy-link" data-clergy-id="${data.consecrator.id}">${data.consecrator.name}</a>`;
        } else {
          consecratedByInfo.innerHTML = `<span>${data.consecrator.name}</span>`;
        }
        consecratedBySection.style.display = 'block';
      } else {
        if (canEdit) {
          consecratedByInfo.innerHTML = `<a href="#" class="add-clergy-link" data-context-type="consecration" data-context-clergy-id="${clergyId}">?</a>`;
        } else {
          consecratedByInfo.innerHTML = `<span>N/A</span>`;
        }
        consecratedBySection.style.display = 'block';
      }
    }
  }
  
  // Display ordained clergy list (only for bishops)
  if (isBishop) {
    const ordainedClergyList = document.getElementById(getWindowId('ordained-clergy-list'));
    if (ordainedClergyList) {
      if (data.ordained_clergy && data.ordained_clergy.length > 0) {
        let html = '';
        data.ordained_clergy.forEach(clergy => {
          if (canEdit) {
            html += `<div class="clergy-item mb-1"><a href="#" class="clergy-link" data-clergy-id="${clergy.id}">${clergy.name}</a> (${clergy.rank || ''})</div>`;
          } else {
            html += `<div class="clergy-item mb-1"><span>${clergy.name}</span> (${clergy.rank || ''})</div>`;
          }
        });
        if (canEdit) {
          html += `<div class="mt-2"><a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="ordained" data-context-clergy-id="${clergyId}">+</a></div>`;
        }
        ordainedClergyList.innerHTML = html;
      } else {
        if (canEdit) {
          ordainedClergyList.innerHTML = `<a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="ordained" data-context-clergy-id="${clergyId}">+</a>`;
        } else {
          ordainedClergyList.innerHTML = `<span>N/A</span>`;
        }
      }
    }
  }
  
  // Display consecrated clergy list (only for bishops)
  if (isBishop) {
    const consecratedClergySection = document.getElementById(getWindowId('consecrated-clergy-section'));
    const consecratedClergyList = document.getElementById(getWindowId('consecrated-clergy-list'));
    if (consecratedClergyList && consecratedClergySection) {
      if (data.consecrated_clergy && data.consecrated_clergy.length > 0) {
        let html = '';
        data.consecrated_clergy.forEach(clergy => {
          if (canEdit) {
            html += `<div class="clergy-item mb-1"><a href="#" class="clergy-link" data-clergy-id="${clergy.id}">${clergy.name}</a> (${clergy.rank || ''})</div>`;
          } else {
            html += `<div class="clergy-item mb-1"><span>${clergy.name}</span> (${clergy.rank || ''})</div>`;
          }
        });
        if (canEdit) {
          html += `<div class="mt-2"><a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="consecrated" data-context-clergy-id="${clergyId}">+</a></div>`;
        }
        consecratedClergyList.innerHTML = html;
        consecratedClergySection.style.display = 'block';
      } else {
        if (canEdit) {
          consecratedClergyList.innerHTML = `<a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="consecrated" data-context-clergy-id="${clergyId}">+</a>`;
        } else {
          consecratedClergyList.innerHTML = `<span>N/A</span>`;
        }
        consecratedClergySection.style.display = 'block';
      }
    }
  }
}

/**
 * Get window element for a clergy ID
 * @param {string|number} clergyId - The clergy ID
 * @returns {HTMLElement|null} The window element or null
 */
export function getWindow(clergyId) {
  return openWindows.get(clergyId) || null;
}

/**
 * Check if a window exists for a clergy ID
 * @param {string|number} clergyId - The clergy ID
 * @returns {boolean} True if window exists
 */
export function hasWindow(clergyId) {
  return openWindows.has(clergyId);
}
