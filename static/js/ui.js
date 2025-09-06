// UI module for mobile menu, side menu, and controls
import { width, height } from './constants.js';

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
        clergyAside.classList.remove('expanded');
      }
    });
    
    // Close aside when clicking outside
    document.addEventListener('click', (event) => {
      if (!clergyAside.contains(event.target) && !event.target.closest('.node')) {
        clergyAside.classList.remove('expanded');
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
