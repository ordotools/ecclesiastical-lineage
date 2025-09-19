// UI module for mobile menu, side menu, and controls
import { width, height } from './constants.js';
import { resetToDefaultViewDistance } from './core.js';

// Modal state tracking
let isModalOpen = false;

// Function to check if any modal is currently open
function isAnyModalOpen() {
  // Check for Bootstrap modals
  const bootstrapModals = document.querySelectorAll('.modal.show');
  if (bootstrapModals.length > 0) {
    return true;
  }
  
  // Check for custom modals
  const customModals = document.querySelectorAll('.mobile-menu-modal[style*="block"]');
  if (customModals.length > 0) {
    return true;
  }
  
  return false;
}

// Function to update modal state
function updateModalState() {
  isModalOpen = isAnyModalOpen();
  console.log('Modal state updated:', isModalOpen);
}

// Export function to manually update modal state (for use by other modules)
export function setModalState(open) {
  console.log('setModalState called with:', open, 'previous state:', isModalOpen);
  isModalOpen = open;
  console.log('Modal state is now:', isModalOpen);
}

// Export function to check modal state
export function getModalState() {
  return isModalOpen;
}

// Listen for modal events to track state
document.addEventListener('DOMContentLoaded', function() {
  // Listen for Bootstrap modal events
  document.addEventListener('show.bs.modal', function() {
    isModalOpen = true;
  });
  
  document.addEventListener('hide.bs.modal', function() {
    // Small delay to ensure modal is fully closed
    setTimeout(updateModalState, 100);
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

// Wire up aside functionality
export function initializeAside() {
  const clergyAside = document.getElementById('clergy-aside');
  
  if (clergyAside) {
    // Use event delegation for the close button since it's loaded via HTMX
    clergyAside.addEventListener('click', (event) => {
      if (event.target.closest('#close-aside')) {
        console.log('Close button clicked, modal open:', isModalOpen);
        // Only close if no modal is open
        if (!isModalOpen) {
          clergyAside.classList.remove('expanded');
          // Reset to default view distance when closing clergy info panel
          resetToDefaultViewDistance();
        } else {
          console.log('Panel close prevented - modal is open');
        }
      }
    });
    
    // Close aside when clicking outside (but not when modal is open)
    document.addEventListener('click', (event) => {
      console.log('Click detected, modal open:', isModalOpen, 'target:', event.target);
      
      // Check if click is inside a modal
      const isInsideModal = event.target.closest('.modal') || event.target.closest('[data-bs-toggle="modal"]');
      
      if (!isModalOpen && !clergyAside.contains(event.target) && !event.target.closest('.node') && !isInsideModal) {
        console.log('Outside click - closing panel');
        clergyAside.classList.remove('expanded');
        // Reset to default view distance when closing clergy info panel
        resetToDefaultViewDistance();
      } else if (isModalOpen) {
        console.log('Outside click ignored - modal is open');
      } else if (isInsideModal) {
        console.log('Click ignored - inside modal');
      } else {
        console.log('Click ignored - inside panel or on node');
      }
    });
    
    // Add keyboard event handler to prevent closing on keypress when modal is open
    document.addEventListener('keydown', (event) => {
      // Only handle escape key
      if (event.key === 'Escape') {
        console.log('Escape key pressed, modal open:', isModalOpen);
        // If a modal is open, don't close the aside panel
        if (isModalOpen) {
          console.log('Escape key ignored - modal is open');
          event.stopPropagation();
          return;
        }
        
        // If no modal is open and aside is expanded, close it
        if (clergyAside.classList.contains('expanded')) {
          console.log('Escape key - closing panel');
          clergyAside.classList.remove('expanded');
          resetToDefaultViewDistance();
        }
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
    const scale = currentTransform.k;
    
    // Calculate the translation needed to center the node
    const translateX = targetX - (nodeX * scale);
    const translateY = targetY - (nodeY * scale);
    
    // Create the new transform
    const newTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);
    
    // Apply the transform with smooth animation using the stored zoom behavior
    svg.transition()
      .duration(750)
      .call(zoom.transform, newTransform);
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
