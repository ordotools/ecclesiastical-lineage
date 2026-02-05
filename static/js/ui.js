// UI module for mobile menu, side menu, and controls
import { width, height } from './constants.js';
import { resetToDefaultViewDistance } from './core.js';

// Modal state tracking
let isModalOpen = false;

// Function to check if any modal is currently open
function isAnyModalOpen() {
  // Check for Bootstrap modals (more comprehensive check)
  const bootstrapModals = document.querySelectorAll('.modal.show, .modal[style*="block"]');
  if (bootstrapModals.length > 0) {
    return true;
  }
  
  // Check for modals with Bootstrap's backdrop
  const modalBackdrops = document.querySelectorAll('.modal-backdrop');
  if (modalBackdrops.length > 0) {
    return true;
  }
  
  // Check for custom modals
  const customModals = document.querySelectorAll('.mobile-menu-modal[style*="block"]');
  if (customModals.length > 0) {
    return true;
  }
  
  // Check if body has modal-open class (Bootstrap sets this)
  if (document.body.classList.contains('modal-open')) {
    return true;
  }
  
  return false;
}

// Function to update modal state
function updateModalState() {
  isModalOpen = isAnyModalOpen();
}

// Export function to manually update modal state (for use by other modules)
export function setModalState(open) {
  isModalOpen = open;
}

// Make setModalState available globally for use in templates
window.setModalState = setModalState;

// Export function to check modal state
export function getModalState() {
  return isModalOpen;
}

// Listen for modal events to track state
document.addEventListener('DOMContentLoaded', function() {
  // Listen for Bootstrap modal events with more comprehensive coverage
  document.addEventListener('show.bs.modal', function() {
    isModalOpen = true;
  });
  
  document.addEventListener('shown.bs.modal', function() {
    isModalOpen = true;
  });
  
  document.addEventListener('hide.bs.modal', function() {
    // Small delay to ensure modal is fully closed
    setTimeout(updateModalState, 100);
  });
  
  document.addEventListener('hidden.bs.modal', function() {
    updateModalState();
  });
  
  // Listen for custom modal events (mobile menu)
  const mobileMenuModal = document.getElementById('mobile-menu-modal');
  if (mobileMenuModal) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          updateModalState();
        }
      });
    });
    observer.observe(mobileMenuModal, { attributes: true, attributeFilter: ['style'] });
  }
  
  // Also listen for dynamic content changes (for dynamically loaded modals)
  const modalObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        // Check if a modal was added to the DOM
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            if (node.classList && (node.classList.contains('modal') || node.querySelector('.modal'))) {
              setTimeout(updateModalState, 50);
            }
          }
        });
      }
    });
  });
  
  // Observe the entire document for modal additions
  modalObserver.observe(document.body, { childList: true, subtree: true });
});

// Show/hide floating menu button and hide side menu on mobile
export function handleMobileMenuDisplay() {
  const isMobile = window.innerWidth <= 768;
  document.getElementById('mobile-menu-btn').style.display = isMobile ? 'block' : 'none';
  
  // Hide side menu on mobile
  const sideMenu = document.getElementById('side-menu');
  if (sideMenu) {
    sideMenu.style.display = isMobile ? 'none' : 'flex';
  }
  
  // Hide aside on mobile
  const clergyAside = document.getElementById('clergy-aside');
  if (clergyAside) {
    clergyAside.style.display = isMobile ? 'none' : 'block';
  }
}

// Mobile menu open/close logic
export function initializeMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menuModal = document.getElementById('mobile-menu-modal');
  const closeBtn = document.getElementById('close-mobile-menu');
  
  if (menuBtn && menuModal && closeBtn) {
    menuBtn.addEventListener('click', () => {
      menuModal.style.display = 'block';
    });
    closeBtn.addEventListener('click', () => {
      menuModal.style.display = 'none';
    });
    menuModal.addEventListener('click', (e) => {
      if (e.target === menuModal) menuModal.style.display = 'none';
    });
  }
}

// Wire up mobile controls to main controls
export function initializeMobileControls() {
  const resetZoomMobile = document.getElementById('reset-zoom-mobile');
  const centerGraphMobile = document.getElementById('center-graph-mobile');
  const menuModal = document.getElementById('mobile-menu-modal');
  
  // Control buttons
  if (resetZoomMobile) {
    resetZoomMobile.addEventListener('click', function() {
      document.getElementById('reset-zoom').click();
      menuModal.style.display = 'none';
    });
  }
  if (centerGraphMobile) {
    centerGraphMobile.addEventListener('click', function() {
      document.getElementById('center-graph').click();
      menuModal.style.display = 'none';
    });
  }
  
  // Sync search inputs
  const searchInput = document.getElementById('clergy-search');
  const searchInputMobile = document.getElementById('clergy-search-mobile');
  
  if (searchInput && searchInputMobile) {
    searchInput.addEventListener('input', function() {
      searchInputMobile.value = this.value;
    });
    searchInputMobile.addEventListener('input', function() {
      searchInput.value = this.value;
    });
  }
}

// Wire up side menu toggle
export function initializeSideMenu() {
  const sideMenuToggle = document.getElementById('side-menu-toggle');
  const sideMenu = document.getElementById('side-menu');

  if (sideMenuToggle && sideMenu) {
    sideMenuToggle.addEventListener('click', () => {
      sideMenu.classList.toggle('expanded');
      
      // Update toggle button icon
      const icon = sideMenuToggle.querySelector('i');
      if (sideMenu.classList.contains('expanded')) {
        icon.className = 'fas fa-times';
        sideMenuToggle.setAttribute('aria-label', 'Close side menu');
      } else {
        icon.className = 'fas fa-bars';
        sideMenuToggle.setAttribute('aria-label', 'Open side menu');
      }
    });
    
    // Close side menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!sideMenu.contains(event.target)) {
        sideMenu.classList.remove('expanded');
        const icon = sideMenuToggle.querySelector('i');
        icon.className = 'fas fa-bars';
        sideMenuToggle.setAttribute('aria-label', 'Open side menu');
      }
    });
  }
}

// Wire up aside functionality (disabled - using draggable windows instead)
export function initializeAside() {
  // Aside panel is now replaced by draggable windows
  // Keeping this function for backwards compatibility but it does nothing
  return;
  
  const clergyAside = document.getElementById('clergy-aside');
  
  if (clergyAside) {
    // Use event delegation for the close button since it's loaded via HTMX
    clergyAside.addEventListener('click', (event) => {
      if (event.target.closest('#close-aside')) {
        // Only close if no modal is open
        if (!isModalOpen) {
          clergyAside.classList.remove('expanded');
          // Reset to default view distance when closing clergy info panel
          resetToDefaultViewDistance();
        } else {
        }
      }
    });
    
    // Close aside when clicking outside (but not when modal is open)
    document.addEventListener('click', (event) => {
      // Only check if the aside panel is actually open
      if (!clergyAside.classList.contains('expanded')) {
        return; // Panel is closed, no need to check anything
      }
      
      
      // Check if click is inside a modal
      const isInsideModal = event.target.closest('.modal') || 
                           event.target.closest('[data-bs-toggle="modal"]') ||
                           event.target.closest('#clergyFormModalBody') ||
                           event.target.closest('#clergyFormModal');
      
      // If modal is open and click is inside modal, don't interfere with the click
      if (isModalOpen && isInsideModal) {
        return; // Don't interfere with modal interactions
      }
      
      if (isInsideModal) {
        return;
      }
      
      // Check if modal is open (only when panel is expanded)
      if (isAnyModalOpen()) {
        return;
      }
      
      // Check if click is inside the aside panel or on a node
      if (clergyAside.contains(event.target) || event.target.closest('.node')) {
        return;
      }
      
      // If we get here, it's an outside click and we should close the panel
      clergyAside.classList.remove('expanded');
      // DISABLED: Center the graph when closing the panel - prevents graph movement
      // centerGraphOnPanelClose();
    });
    
    // Add keyboard event handler to prevent closing on keypress when modal is open
    document.addEventListener('keydown', (event) => {
      // Only handle escape key
      if (event.key === 'Escape') {
        // Only check if the aside panel is actually open
        if (!clergyAside.classList.contains('expanded')) {
          return; // Panel is closed, no need to check anything
        }
        
        
        // If a modal is open, don't close the aside panel
        if (isAnyModalOpen()) {
          event.stopPropagation();
          return;
        }
        
        // Close the panel
        clergyAside.classList.remove('expanded');
        // DISABLED: Center the graph when closing the panel - prevents graph movement
        // centerGraphOnPanelClose();
      }
    });
  }
}

// Function to center a node in the viewport when the aside panel is displayed
export function centerNodeInViewport(node) {
  // Get the SVG and zoom behavior
  const svg = d3.select('#graph-container svg');
  const zoom = window.currentZoom;
  
  if (!svg.empty() && zoom) {
    // Get current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 76; // Account for navbar height
    
    // Get aside panel dimensions and position
    const asidePanel = document.getElementById('clergy-aside');
    const asideRect = asidePanel.getBoundingClientRect();
    
    // Check if aside panel is visible and expanded
    const isAsideVisible = asidePanel && asidePanel.classList.contains('expanded') && asideRect.width > 0;
    
    let targetX, targetY;
    
    if (isAsideVisible) {
      // Calculate the available space for the graph (left of the aside panel)
      const availableWidth = asideRect.left - 12; // 12px margin from left edge
      const availableHeight = viewportHeight;
      
      // Calculate the center point of the available space
      targetX = availableWidth / 2;
      targetY = availableHeight / 2;
    } else {
      // If aside panel is not visible, center in the full viewport
      targetX = viewportWidth / 2;
      targetY = viewportHeight / 2;
    }
    
    // Get the node's current position
    const nodeX = node.x;
    const nodeY = node.y;
    
    // Calculate the transform needed to center the node
    const currentTransform = d3.zoomTransform(svg.node());
    const scale = currentTransform.k; // Keep the current zoom level
    
    // Calculate the translation needed to center the node
    const translateX = targetX - (nodeX * scale);
    const translateY = targetY - (nodeY * scale);
    
    // Create the new transform - only translate, don't change zoom
    const newTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);
    
    // Apply the transform with smooth animation to coordinate with panel slide
    svg.transition()
      .duration(300)
      .call(zoom.transform, newTransform);
  }
}

// Function to center the graph when the aside panel is closed
function centerGraphOnPanelClose() {
  // Get the SVG and zoom behavior
  const svg = d3.select('#graph-container svg');
  const zoom = window.currentZoom;
  
  if (!svg.empty() && zoom) {
    // Get current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 76; // Account for navbar height
    
    // Center in the full viewport
    const targetX = viewportWidth / 2;
    const targetY = viewportHeight / 2;
    
    // Get current transform to preserve zoom level
    const currentTransform = d3.zoomTransform(svg.node());
    const scale = currentTransform.k;
    
    // Calculate the translation needed to center the graph
    const translateX = targetX - (viewportWidth / 2);
    const translateY = targetY - (viewportHeight / 2);
    
    // Create the new transform - only translate, don't change zoom
    const newTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);
    
    // Apply the transform with smooth animation
    svg.transition()
      .duration(300)
      .call(zoom.transform, newTransform);
  }
}

// Initialize filter menu (bottom menu)
export function initializeFilterMenu() {
  
  // Wait a bit to ensure DOM is ready
  const tryInit = () => {
    const organizationsBtn = document.getElementById('organizations-dropdown-btn');
    const organizationsMenu = document.getElementById('organizations-dropdown-menu');
    const viewPriestsToggle = document.getElementById('view-priests-toggle');
    const highlightLineageToggle = document.getElementById('highlight-lineage-toggle');

    // If elements don't exist yet, try again after a short delay
    if (!organizationsBtn || !organizationsMenu || !viewPriestsToggle) {
      setTimeout(tryInit, 100);
      return;
    }

    // Continue with initialization
    initFilterMenuElements(organizationsBtn, organizationsMenu, viewPriestsToggle, highlightLineageToggle);
  };

  tryInit();
}

function initFilterMenuElements(organizationsBtn, organizationsMenu, viewPriestsToggle, highlightLineageToggle) {

  // Initialize organizations dropdown
  if (organizationsBtn && organizationsMenu) {
    // Toggle dropdown on button click
    organizationsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      organizationsMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    // Use capture phase to ensure it runs before other click handlers
    document.addEventListener('click', (e) => {
      if (organizationsMenu.classList.contains('show') && 
          !organizationsBtn.contains(e.target) && 
          !organizationsMenu.contains(e.target)) {
        organizationsMenu.classList.remove('show');
      }
    }, true);

    // Handle organization selection
    organizationsMenu.addEventListener('click', async (e) => {
      const item = e.target.closest('.filter-dropdown-item');
      if (item) {
        const selectedOrg = item.dataset.org;
        
        // Remove active class from all items
        organizationsMenu.querySelectorAll('.filter-dropdown-item').forEach(i => {
          i.classList.remove('active');
        });
        // Add active class to selected item
        item.classList.add('active');
        // Update button text
        const orgName = selectedOrg === 'all' ? 'Organizations' : item.textContent.trim();
        organizationsBtn.innerHTML = `${orgName} <i class="fas fa-chevron-down ms-1"></i>`;
        // Close dropdown
        organizationsMenu.classList.remove('show');
        
        // Apply organization filter
        try {
          const { applyOrganizationFilter } = await import('./filters.js');
          applyOrganizationFilter(selectedOrg);
        } catch (error) {
          console.error('Error applying organization filter:', error);
        }
      }
    });

    // Fetch and populate organizations
    fetch('/api/organizations')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        
        if (data.success && data.organizations && Array.isArray(data.organizations)) {
          const dropdownContainer = organizationsMenu;
          
          // Find the divider
          const divider = dropdownContainer.querySelector('.dropdown-divider');
          
          // Clear existing organization items (keep "All Organizations" and divider)
          const allItems = dropdownContainer.querySelectorAll('.filter-dropdown-item');
          allItems.forEach(item => {
            if (item.dataset.org !== 'all') {
              item.remove();
            }
          });
          
          
          // Create a document fragment for better performance
          const fragment = document.createDocumentFragment();
          
          // Add organizations to dropdown - insert after divider
          data.organizations.forEach((org, index) => {
            const orgItem = document.createElement('div');
            orgItem.className = 'filter-dropdown-item';
            orgItem.dataset.org = org.name;
            orgItem.innerHTML = `<span>${org.name}${org.abbreviation ? ` (${org.abbreviation})` : ''}</span>`;
            fragment.appendChild(orgItem);
          });
          
          // Insert fragment after divider
          if (divider) {
            // Insert after divider
            if (divider.nextSibling) {
              dropdownContainer.insertBefore(fragment, divider.nextSibling);
            } else {
              // Divider is last element, append after it
              dropdownContainer.appendChild(fragment);
            }
          } else {
            // No divider, just append
            dropdownContainer.appendChild(fragment);
          }
          
          
        } else {
          console.warn('Organizations API returned unsuccessful response:', data);
          console.warn('Response structure:', {
            hasSuccess: 'success' in data,
            successValue: data.success,
            hasOrganizations: 'organizations' in data,
            organizationsType: typeof data.organizations,
            isArray: Array.isArray(data.organizations)
          });
        }
      })
      .catch(error => {
        console.error('Error fetching organizations:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      });
  } else {
    console.warn('Organizations dropdown elements not found');
  }

  // Initialize view priests toggle - wire it up to the filter system
  if (viewPriestsToggle) {
    // Import applyPriestFilter to wire up the toggle
    import('./filters.js').then(({ applyPriestFilter }) => {
      viewPriestsToggle.addEventListener('change', (e) => {
        // Apply the filter using the existing filter system
        applyPriestFilter();
      });
    }).catch(error => {
      console.error('Error importing filters module:', error);
    });
  } else {
    console.warn('View priests toggle not found');
  }

  // Initialize highlight lineage toggle
  if (highlightLineageToggle) {
    import('./highlightLineage.js').then(({ setHighlightMode, clearHighlight }) => {
      highlightLineageToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        setHighlightMode(enabled);
        if (!enabled) {
          clearHighlight();
        }
      });
    }).catch(error => {
      console.error('Error importing highlightLineage module:', error);
    });
  } else {
    console.warn('Highlight lineage toggle not found');
  }
  
}

// Initialize all UI components
export function initializeUI() {
  // Set up event listeners
  window.addEventListener('resize', handleMobileMenuDisplay);
  document.addEventListener('DOMContentLoaded', handleMobileMenuDisplay);
  
  // Initialize all UI components
  initializeMobileMenu();
  initializeMobileControls();
  initializeSideMenu();
  initializeAside();
  initializeFilterMenu();
  
  // Initialize mobile display
  handleMobileMenuDisplay();
  
  // Initialize side menu state
  const sideMenu = document.getElementById('side-menu');
  if (sideMenu) {
    sideMenu.style.display = window.innerWidth <= 768 ? 'none' : 'flex';
    // Start with menu collapsed
    sideMenu.classList.remove('expanded');
  }
  
  // Initialize aside state
  const clergyAside = document.getElementById('clergy-aside');
  if (clergyAside) {
    clergyAside.style.display = window.innerWidth <= 768 ? 'none' : 'block';
    // Start with aside collapsed
    clergyAside.classList.remove('expanded');
  }
}
