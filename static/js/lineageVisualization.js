// Visualization constants - UPDATED for standardized image sizes (25% smaller for better quality)
const LINK_DISTANCE = 150; // Reduced from 200 for smaller nodes
const CHARGE_STRENGTH = -400;
const COLLISION_RADIUS = 60; // Reduced from 80 for smaller nodes
const OUTER_RADIUS = 30; // Organization ring - reduced from 40 to surround 48×48 images
const INNER_RADIUS = 24; // Rank ring - reduced from 32 to be visible around images
const IMAGE_SIZE = 48; // Reduced from 64 to 48×48 for better image quality
const LABEL_DY =  35; // Reduced from 50 for smaller nodes
const ARROWHEAD_LENGTH = 16; // Reduced from 18 for smaller nodes

// Show/hide floating menu button and hide side menu on mobile
function handleMobileMenuDisplay() {
  const isMobile = window.innerWidth <= 768;
  document.getElementById('mobile-menu-btn').style.display = isMobile ? 'block' : 'none';
  
  // Hide side menu on mobile
  const sideMenu = document.getElementById('side-menu');
  if (sideMenu) {
    sideMenu.style.display = isMobile ? 'none' : 'flex';
  }
  
  // Hide aside on mobile
  if (clergyAside) {
    clergyAside.style.display = isMobile ? 'none' : 'block';
  }
}
window.addEventListener('resize', handleMobileMenuDisplay);
document.addEventListener('DOMContentLoaded', handleMobileMenuDisplay);

// Mobile menu open/close logic
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

// Wire up mobile controls to main controls
const resetZoomMobile = document.getElementById('reset-zoom-mobile');
const centerGraphMobile = document.getElementById('center-graph-mobile');
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

// Wire up side menu toggle
const sideMenuToggle = document.getElementById('side-menu-toggle');
const sideMenu = document.getElementById('side-menu');

// Wire up aside functionality
const clergyAside = document.getElementById('clergy-aside');

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

// Wire up aside close button using event delegation
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

// Node click handler function
function handleNodeClick(event, d) {
  // Prevent click if node is filtered
  if (d.filtered) return;
  
  // Store current clergy ID for relationship loading
  window.currentClergyId = d.id;
  
  // Show aside panel
  if (clergyAside) {
    // Populate aside with clergy data
    document.getElementById('clergy-aside-ordination').textContent = d.ordination_date || 'Not specified';
    document.getElementById('clergy-aside-consecration').textContent = d.consecration_date || 'Not specified';
    
    // Populate bio if available (commented out for now)
    // const bioElement = document.getElementById('clergy-aside-bio');
    // if (d.bio && d.bio.trim()) {
    //   bioElement.textContent = d.bio;
    //   bioElement.style.display = 'block';
    // } else {
    //   bioElement.textContent = 'No biography available.';
    //   bioElement.style.display = 'block';
    // }
    
    // Set image with loading system - start with low-res blurred placeholder
    const asideImage = document.getElementById('clergy-aside-image');
    
    // Always show the low-res image first as a blurred placeholder
    if (d.image_url) {
      asideImage.src = d.image_url;
      asideImage.style.display = 'block';
      asideImage.style.filter = 'blur(2px)'; // Add blur for loading effect
    } else {
      asideImage.style.display = 'none';
    }
    
    // Load high-resolution image if available
    if (d.high_res_image_url) {
      const highResImage = new Image();
      highResImage.onload = function() {
        // Replace with high-res image and remove blur
        asideImage.src = d.high_res_image_url;
        asideImage.style.filter = 'none';
      };
      highResImage.onerror = function() {
        // If high-res fails, keep the low-res image but remove blur
        asideImage.style.filter = 'none';
      };
      highResImage.src = d.high_res_image_url;
    } else {
      // No high-res image available, remove blur from low-res
      asideImage.style.filter = 'none';
    }
    
    // Expand aside
    clergyAside.classList.add('expanded');
    
    // Show edit button if user can edit
    const editBtn = document.getElementById('edit-clergy-btn');
    if (editBtn && window.userCanEditClergy === true) {
      editBtn.style.display = 'flex';
      editBtn.onclick = function() {
        openEditClergyModal(d.id);
      };
    } else if (editBtn) {
      editBtn.style.display = 'none';
    }
    
    // Load clergy relationships
    loadClergyRelationships(d.id);
  }
}

// Function to load clergy relationships
function loadClergyRelationships(clergyId) {
  fetch(`/clergy/relationships/${clergyId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        displayClergyRelationships(data);
      } else {
        console.error('Failed to load clergy relationships:', data.message);
      }
    })
    .catch(error => {
      console.error('Error loading clergy relationships:', error);
    });
}

// Function to display clergy relationships
function displayClergyRelationships(data) {
  // Check if user can edit clergy
  const canEdit = window.userCanEditClergy === true;
  
  // Display ordained by information
  const ordainedByInfo = document.getElementById('ordained-by-info');
  if (ordainedByInfo) {
    if (data.ordaining_bishop) {
      if (canEdit) {
        ordainedByInfo.innerHTML = `<a href="#" class="clergy-link" data-clergy-id="${data.ordaining_bishop.id}">${data.ordaining_bishop.name}</a>`;
      } else {
        ordainedByInfo.innerHTML = `<span>${data.ordaining_bishop.name}</span>`;
      }
    } else {
      if (canEdit) {
        ordainedByInfo.innerHTML = `<a href="#" class="add-clergy-link" data-context-type="ordination" data-context-clergy-id="${getCurrentClergyId()}">?</a>`;
      } else {
        ordainedByInfo.innerHTML = `<span>Not specified</span>`;
      }
    }
  }
  
  // Display consecrated by information (only for bishops)
  const consecratedBySection = document.getElementById('consecrated-by-section');
  const consecratedByInfo = document.getElementById('consecrated-by-info');
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
        consecratedByInfo.innerHTML = `<a href="#" class="add-clergy-link" data-context-type="consecration" data-context-clergy-id="${getCurrentClergyId()}">?</a>`;
      } else {
        consecratedByInfo.innerHTML = `<span>Not specified</span>`;
      }
      consecratedBySection.style.display = 'block';
    }
  }
  
  // Display ordained clergy list
  const ordainedClergyList = document.getElementById('ordained-clergy-list');
  if (ordainedClergyList) {
    if (data.ordained_clergy && data.ordained_clergy.length > 0) {
      let html = '';
      data.ordained_clergy.forEach(clergy => {
        if (canEdit) {
          html += `<div class="clergy-item mb-1"><a href="#" class="clergy-link" data-clergy-id="${clergy.id}">${clergy.name}</a> (${clergy.rank})</div>`;
        } else {
          html += `<div class="clergy-item mb-1"><span>${clergy.name}</span> (${clergy.rank})</div>`;
        }
      });
      if (canEdit) {
        html += `<div class="mt-2"><a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="ordained" data-context-clergy-id="${getCurrentClergyId()}">+</a></div>`;
      }
      ordainedClergyList.innerHTML = html;
    } else {
      if (canEdit) {
        ordainedClergyList.innerHTML = `<a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="ordained" data-context-clergy-id="${getCurrentClergyId()}">+</a>`;
      } else {
        ordainedClergyList.innerHTML = `<span>None</span>`;
      }
    }
  }
  
  // Display consecrated clergy list (only for bishops)
  const consecratedClergySection = document.getElementById('consecrated-clergy-section');
  const consecratedClergyList = document.getElementById('consecrated-clergy-list');
  if (consecratedClergyList && consecratedClergySection) {
    if (data.consecrated_clergy && data.consecrated_clergy.length > 0) {
      let html = '';
      data.consecrated_clergy.forEach(clergy => {
        if (canEdit) {
          html += `<div class="clergy-item mb-1"><a href="#" class="clergy-link" data-clergy-id="${clergy.id}">${clergy.name}</a> (${clergy.rank})</div>`;
        } else {
          html += `<div class="clergy-item mb-1"><span>${clergy.name}</span> (${clergy.rank})</div>`;
        }
      });
      if (canEdit) {
        html += `<div class="mt-2"><a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="consecrated" data-context-clergy-id="${getCurrentClergyId()}">+</a></div>`;
      }
      consecratedClergyList.innerHTML = html;
      consecratedClergySection.style.display = 'block';
    } else {
      if (canEdit) {
        consecratedClergyList.innerHTML = `<a href="#" class="add-clergy-link btn btn-sm btn-outline-primary" data-context-type="consecrated" data-context-clergy-id="${getCurrentClergyId()}">+</a>`;
      } else {
        consecratedClergyList.innerHTML = `<span>None</span>`;
      }
      consecratedClergySection.style.display = 'block';
    }
  }
  
  // Add event listeners for clergy links and add clergy links
  addClergyLinkEventListeners();
  
  // Show edit button if user can edit and we have a clergy ID
  const editBtn = document.getElementById('edit-clergy-btn');
  if (editBtn && canEdit && getCurrentClergyId()) {
    editBtn.style.display = 'flex';
    editBtn.onclick = function() {
      const clergyId = getCurrentClergyId();
      if (clergyId) {
        openEditClergyModal(clergyId);
      }
    };
  } else if (editBtn) {
    editBtn.style.display = 'none';
  }
}

// Function to open the edit clergy modal
function openEditClergyModal(clergyId) {
  const modal = document.getElementById('clergyFormModal');
  const modalBody = document.getElementById('clergyFormModalBody');
  
  // Load the edit clergy form
  console.log(`Opening edit modal for clergy ID: ${clergyId}`);
  fetch(`/clergy/edit_from_lineage/${clergyId}`)
    .then(response => response.text())
    .then(html => {
      modalBody.innerHTML = html;
      
      // Show the modal
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
      
      // Load necessary JavaScript for the form
      loadEditFormScripts();
      
      // Override the form submission for modal context
      const form = modalBody.querySelector('#clergyForm');
      if (form) {
        console.log('Edit form loaded, setting up handlers');
        
        // Remove any existing HTMX attributes
        form.removeAttribute('hx-post');
        form.removeAttribute('hx-target');
        form.removeAttribute('hx-swap');
        form.removeAttribute('hx-on::after-request');
        
        // Add custom submit handler
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          
          console.log('Edit form submitted, sending data to:', form.action);
          const formData = new FormData(form);
          
          // Clean up form data - remove empty fields and "None" values
          const cleanedFormData = new FormData();
          for (let [key, value] of formData.entries()) {
            if (value && value !== 'None' && value !== '') {
              cleanedFormData.append(key, value);
            }
          }
          
          // Log cleaned form data for debugging
          for (let [key, value] of cleanedFormData.entries()) {
            console.log(`Cleaned form field: ${key} = ${value}`);
          }
          
          fetch(form.action, {
            method: 'POST',
            body: cleanedFormData
          })
          .then(response => {
            console.log('Response status:', response.status);
            return response.json();
          })
          .then(data => {
            console.log('Form submission response:', data);
            if (data.success) {
              console.log('Clergy updated successfully, refreshing page...');
              
              // Close the modal
              bootstrapModal.hide();
              
              // Refresh the visualization to show the updated clergy
              console.log('Reloading page...');
              window.location.reload(true);
            } else {
              alert('Error: ' + (data.message || 'Failed to update clergy member'));
            }
          })
          .catch(error => {
            console.error('Error:', error);
            alert('Error submitting form. Please try again.');
          });
        });
        
        // Handle cancel button to close modal
        const cancelBtn = form.querySelector('a[href="#"]');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            bootstrapModal.hide();
          });
        }
      }
    })
    .catch(error => {
      console.error('Error loading edit form:', error);
      alert('Error loading edit form. Please try again.');
    });
}

// Function to load necessary scripts for edit form functionality
function loadEditFormScripts() {
  // Load fuzzySearch.js if not already loaded
  if (!window.attachAutocomplete) {
    const script1 = document.createElement('script');
    script1.src = '/static/js/fuzzySearch.js';
    script1.onload = function() {
      console.log('fuzzySearch.js loaded for modal');
      // Initialize bishop autocomplete after script loads
      initModalBishopAutocomplete();
    };
    document.head.appendChild(script1);
  } else {
    // Script already loaded, initialize directly
    initModalBishopAutocomplete();
  }
  
  // Load editClergy.js if not already loaded
  if (!window.initEditClergy) {
    const script2 = document.createElement('script');
    script2.src = '/static/js/editClergy.js';
    script2.onload = function() {
      console.log('editClergy.js loaded for modal');
      // Initialize edit clergy functionality
      initModalEditClergy();
    };
    document.head.appendChild(script2);
  } else {
    // Script already loaded, initialize directly
    initModalEditClergy();
  }
}

// Custom function to attach image editor event listeners to HTMX-loaded form
function attachImageEditorEventListeners(container, imageEditor) {
  console.log('Attaching image editor event listeners to container');
  
  const imageInput = container.querySelector('#clergyImage');
  const uploadBtn = container.querySelector('#uploadBtn');
  const cropBtn = container.querySelector('#cropExistingBtn');
  const removeBtn = container.querySelector('#removeImageBtn');
  
  console.log('Found elements for event listeners:', {
    imageInput: !!imageInput,
    uploadBtn: !!uploadBtn,
    cropBtn: !!cropBtn,
    removeBtn: !!removeBtn
  });
  
  if (imageInput) {
    // Remove any existing listeners first
    imageInput.removeEventListener('change', imageEditor.handleFormImageUpload);
    imageInput.addEventListener('change', (e) => imageEditor.handleFormImageUpload(e));
    console.log('Image input event listener attached');
  }
  
  if (uploadBtn) {
    // Remove any existing listeners first
    uploadBtn.removeEventListener('click', () => document.getElementById('clergyImage').click());
    uploadBtn.addEventListener('click', () => {
      const input = container.querySelector('#clergyImage');
      if (input) input.click();
    });
    console.log('Upload button event listener attached');
  }
  
  if (cropBtn) {
    // Remove any existing listeners first
    cropBtn.removeEventListener('click', () => imageEditor.editExistingImage());
    cropBtn.addEventListener('click', () => imageEditor.editExistingImage());
    console.log('Crop button event listener attached');
  }
  
  if (removeBtn) {
    // Remove any existing listeners first
    removeBtn.removeEventListener('click', () => imageEditor.removeFormImage());
    removeBtn.addEventListener('click', () => imageEditor.removeFormImage());
    console.log('Remove button event listener attached');
  }
}

// Initialize bishop autocomplete for modal
function initModalBishopAutocomplete() {
  console.log('=== initModalBishopAutocomplete START ===');
  
  // Get all bishops data from the form (it should be available in the modal)
  const allBishopsScript = document.querySelector('script[data-bishops]');
  let bishopsData = [];
  
  console.log('initModalBishopAutocomplete called');
  console.log('allBishopsScript found:', !!allBishopsScript);
  
  if (allBishopsScript) {
    console.log('Script content length:', allBishopsScript.textContent.length);
    console.log('Script content preview:', allBishopsScript.textContent.substring(0, 200) + '...');
    try {
      bishopsData = JSON.parse(allBishopsScript.textContent);
      console.log('Bishops data loaded:', bishopsData.length, 'bishops');
      if (bishopsData.length > 0) {
        console.log('First bishop example:', bishopsData[0]);
      }
    } catch (e) {
      console.error('Error parsing bishops data:', e);
      console.error('Raw script content:', allBishopsScript.textContent);
    }
  } else {
    console.warn('No bishops script found in modal');
    console.log('Available script tags:', document.querySelectorAll('script').length);
    console.log('Script tags with data-bishops:', document.querySelectorAll('script[data-bishops]').length);
  }
  
  // Initialize autocomplete for both bishop fields
  if (window.attachAutocomplete) {
    console.log('attachAutocomplete function available');
    console.log('fuzzySearch function available:', !!window.fuzzySearch);
    const ordainingBishopSearch = document.getElementById('ordaining_bishop_search');
    const ordainingBishopId = document.getElementById('ordaining_bishop_id');
    const ordainingBishopDropdown = document.getElementById('ordainingBishopDropdown');
    
    console.log('Ordaining bishop elements found:', {
      search: !!ordainingBishopSearch,
      id: !!ordainingBishopId,
      dropdown: !!ordainingBishopDropdown
    });
    
    if (ordainingBishopSearch && ordainingBishopId && ordainingBishopDropdown) {
      console.log('Initializing ordaining bishop autocomplete');
      window.attachAutocomplete(
        ordainingBishopSearch,
        ordainingBishopId,
        ordainingBishopDropdown,
        bishopsData,
        b => b.name,
        b => b.id
      );
    }
    
    const consecratorSearch = document.getElementById('consecrator_search');
    const consecratorId = document.getElementById('consecrator_id');
    const consecratorDropdown = document.getElementById('consecratorDropdown');
    
    console.log('Consecrator elements found:', {
      search: !!consecratorSearch,
      id: !!consecratorId,
      dropdown: !!consecratorDropdown
    });
    
    if (consecratorSearch && consecratorId && consecratorDropdown) {
      console.log('Initializing consecrator autocomplete');
      window.attachAutocomplete(
        consecratorSearch,
        consecratorId,
        consecratorDropdown,
        bishopsData,
        b => b.name,
        b => b.id
      );
    }
  } else {
    console.warn('attachAutocomplete function not available');
  }
  
  console.log('=== initModalBishopAutocomplete END ===');
}

// Initialize edit clergy functionality for modal
function initModalEditClergy() {
  // Get bishops data
  const allBishopsScript = document.querySelector('script[data-bishops]');
  let bishopsData = [];
  
  if (allBishopsScript) {
    try {
      bishopsData = JSON.parse(allBishopsScript.textContent);
    } catch (e) {
      console.error('Error parsing bishops data:', e);
    }
  }
  
  // Initialize the edit clergy functionality
  if (window.initEditClergy) {
    window.initEditClergy(bishopsData);
  }
  
  // Initialize rank-based field visibility
  const rankSelect = document.getElementById('rank');
  if (rankSelect && window.toggleConsecrationFields) {
    // Set initial visibility
    window.toggleConsecrationFields(rankSelect.value);
    
    // Add change event listener
    rankSelect.addEventListener('change', function() {
      window.toggleConsecrationFields(this.value);
    });
  }
  
  // Initialize image editor functionality for edit modal
  const modalBody = document.getElementById('clergyFormModalBody');
  if (modalBody) {
    const imageEditorModal = modalBody.querySelector('#imageEditorModal');
    console.log('Edit modal - Image editor modal found:', !!imageEditorModal);
    console.log('Edit modal - Existing image editor instance:', !!window.imageEditor);
    console.log('Edit modal - ImageEditor class available:', typeof ImageEditor);
    
    // Check for image-related form elements
    const imageInput = modalBody.querySelector('#clergyImage');
    const uploadBtn = modalBody.querySelector('#uploadBtn');
    const cropBtn = modalBody.querySelector('#cropExistingBtn');
    const removeBtn = modalBody.querySelector('#removeImageBtn');
    
    console.log('Edit modal - Image form elements found:', {
      imageInput: !!imageInput,
      uploadBtn: !!uploadBtn,
      cropBtn: !!cropBtn,
      removeBtn: !!removeBtn
    });
    
    if (imageEditorModal) {
      if (window.imageEditor) {
        console.log('Edit modal - Reattaching form event listeners to existing image editor');
        try {
          attachImageEditorEventListeners(modalBody, window.imageEditor);
          console.log('Edit modal - Image editor form listeners reattached successfully');
        } catch (error) {
          console.error('Edit modal - Error reattaching image editor form listeners:', error);
        }
      } else if (typeof ImageEditor !== 'undefined') {
        console.log('Edit modal - Creating new ImageEditor instance for modal form');
        try {
          window.imageEditor = new ImageEditor();
          attachImageEditorEventListeners(modalBody, window.imageEditor);
          console.log('Edit modal - Image editor created and initialized successfully');
        } catch (error) {
          console.error('Edit modal - Error creating image editor:', error);
        }
      } else {
        console.warn('Edit modal - ImageEditor class not available');
      }
    } else {
      console.log('Edit modal - No image editor modal found in form');
    }
  }
}

// Function to get current clergy ID from the aside
function getCurrentClergyId() {
  return window.currentClergyId;
}

// Function to add event listeners for clergy links and add clergy links
function addClergyLinkEventListeners() {
  // Add event listeners for clergy links (to show their information)
  document.querySelectorAll('.clergy-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const clergyId = this.getAttribute('data-clergy-id');
      // Find the clergy node and click it to show its information
      const clergyNode = window.currentNodes.find(node => node.id == clergyId);
      if (clergyNode) {
        handleNodeClick(e, clergyNode);
      }
    });
  });
  
  // Add event listeners for add clergy links
  document.querySelectorAll('.add-clergy-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const contextType = this.getAttribute('data-context-type');
      const contextClergyId = this.getAttribute('data-context-clergy-id');
      openAddClergyModal(contextType, contextClergyId);
    });
  });
}

// Function to open the add clergy modal
function openAddClergyModal(contextType, contextClergyId) {
  // Check if user is logged in and has permission
  // We'll check this on the server side instead of client side
  // The server will return an error if user doesn't have permission
  
  const modal = document.getElementById('clergyFormModal');
  const modalBody = document.getElementById('clergyFormModalBody');
  
  // Load the clergy form
  console.log(`Opening modal with context: type=${contextType}, clergy_id=${contextClergyId}`);
  fetch(`/clergy/add_from_lineage?context_type=${contextType}&context_clergy_id=${contextClergyId}`)
    .then(response => response.text())
    .then(html => {
      console.log('Form HTML loaded, length:', html.length);
      modalBody.innerHTML = html;
      
      // Show the modal
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
      
      // Wait a moment for the modal to be fully rendered
      setTimeout(() => {
        console.log('Starting form initialization after modal render');
        console.log('Available functions check:', {
          attachAutocomplete: !!window.attachAutocomplete,
          fuzzySearch: !!window.fuzzySearch
        });
        
        // Initialize bishop autocomplete for the loaded form
        console.log('Calling initModalBishopAutocomplete...');
        initModalBishopAutocomplete();
        
        // Initialize form field visibility based on current rank selection
        const rankSelect = modalBody.querySelector('#rank');
        console.log('Rank select found:', !!rankSelect);
        if (rankSelect && window.toggleConsecrationFields) {
          console.log('Calling toggleConsecrationFields with value:', rankSelect.value);
          window.toggleConsecrationFields(rankSelect.value);
        }
        
        // Initialize image editor functionality if modal exists
        const imageEditorModal = modalBody.querySelector('#imageEditorModal');
        console.log('Image editor modal found:', !!imageEditorModal);
        console.log('Existing image editor instance:', !!window.imageEditor);
        console.log('ImageEditor class available:', typeof ImageEditor);
        
        // Check for image-related form elements
        const imageInput = modalBody.querySelector('#clergyImage');
        const uploadBtn = modalBody.querySelector('#uploadBtn');
        const cropBtn = modalBody.querySelector('#cropExistingBtn');
        const removeBtn = modalBody.querySelector('#removeImageBtn');
        
        console.log('Image form elements found:', {
          imageInput: !!imageInput,
          uploadBtn: !!uploadBtn,
          cropBtn: !!cropBtn,
          removeBtn: !!removeBtn
        });
        
        if (imageEditorModal) {
          if (window.imageEditor) {
            console.log('Reattaching form event listeners to existing image editor');
            try {
              // Custom event listener attachment for HTMX-loaded form
              attachImageEditorEventListeners(modalBody, window.imageEditor);
              console.log('Image editor form listeners reattached successfully');
            } catch (error) {
              console.error('Error reattaching image editor form listeners:', error);
            }
          } else if (typeof ImageEditor !== 'undefined') {
            console.log('Creating new ImageEditor instance for modal form');
            try {
              window.imageEditor = new ImageEditor();
              attachImageEditorEventListeners(modalBody, window.imageEditor);
              console.log('Image editor created and initialized successfully');
            } catch (error) {
              console.error('Error creating image editor:', error);
            }
          } else {
            console.warn('ImageEditor class not available');
          }
        } else {
          console.log('No image editor modal found in form');
        }
      }, 100);
      
      // Override the form submission for modal context
      const form = modalBody.querySelector('#clergyForm');
      if (form) {
        // Debug: Check form fields
        console.log('Form loaded, checking fields:');
        const ordainingBishopId = form.querySelector('#ordaining_bishop_id');
        const consecratorId = form.querySelector('#consecrator_id');
        const organization = form.querySelector('#organization');
        console.log('ordaining_bishop_id:', ordainingBishopId ? ordainingBishopId.value : 'not found');
        console.log('consecrator_id:', consecratorId ? consecratorId.value : 'not found');
        console.log('organization:', organization ? organization.value : 'not found');
        
        // Remove any remaining HTMX attributes
        form.removeAttribute('hx-post');
        form.removeAttribute('hx-target');
        form.removeAttribute('hx-swap');
        form.removeAttribute('hx-trigger');
        form.removeAttribute('hx-push-url');
        form.removeAttribute('hx-on::after-request');
        
        // Add custom submit handler
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          
          console.log('Form submitted, sending data to:', form.action);
          const formData = new FormData(form);
          
          // Clean up form data - remove empty fields and "None" values
          const cleanedFormData = new FormData();
          for (let [key, value] of formData.entries()) {
            if (value && value !== 'None' && value !== '') {
              cleanedFormData.append(key, value);
            }
          }
          
          // Log cleaned form data for debugging
          for (let [key, value] of cleanedFormData.entries()) {
            console.log(`Cleaned form field: ${key} = ${value}`);
          }
          
          fetch(form.action, {
            method: 'POST',
            body: cleanedFormData
          })
          .then(response => {
            console.log('Response status:', response.status);
            return response.json();
          })
          .then(data => {
            console.log('Form submission response:', data);
            if (data.success) {
              console.log('Clergy added successfully, refreshing page...');
              console.log('New clergy ID:', data.clergy_id);
              
              // Close the modal
              bootstrapModal.hide();
              
              // Refresh the visualization to show the new clergy
              // Force a complete page reload to get fresh data
              console.log('Reloading page...');
              window.location.reload(true);
            } else {
              alert('Error: ' + (data.message || 'Failed to add clergy member'));
            }
          })
          .catch(error => {
            console.error('Error:', error);
            alert('Error submitting form. Please try again.');
          });
        });
        
        // Handle cancel button to close modal
        const cancelBtn = form.querySelector('a[href="#"]');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            bootstrapModal.hide();
          });
        }
      }
    })
    .catch(error => {
      console.error('Error loading clergy form:', error);
      modalBody.innerHTML = '<div class="alert alert-danger">Error loading form. Please try again.</div>';
    });
}

// Function to refresh the visualization after adding clergy
function refreshVisualization() {
  // Reload the page to get updated data
  window.location.reload();
}

// Wire up filter controls and sync mobile/desktop
const hidePriestsCheckbox = document.getElementById('hide-priests');
const hidePriestsMobileCheckbox = document.getElementById('hide-priests-mobile');

function syncPriestFilters() {
  if (hidePriestsCheckbox && hidePriestsMobileCheckbox) {
    hidePriestsMobileCheckbox.checked = hidePriestsCheckbox.checked;
  }
}

function applyPriestFilter() {
  const shouldHidePriests = hidePriestsCheckbox ? hidePriestsCheckbox.checked : true;
  
  // Filter nodes and links to hide/show priests
  if (window.currentNodes && window.currentLinks) {
    // Update node visibility
    window.currentNodes.forEach(node => {
      const isPriest = node.rank && node.rank.toLowerCase() === 'priest';
      if (isPriest) {
        node.filtered = shouldHidePriests; // Hide priests if requested
      } else {
        node.filtered = false; // Show non-priest clergy
      }
    });
    
    // Update link visibility - hide links connected to priests
    window.currentLinks.forEach(link => {
      const sourceIsPriest = link.source.rank && link.source.rank.toLowerCase() === 'priest';
      const targetIsPriest = link.target.rank && link.target.rank.toLowerCase() === 'priest';
      const isBlackLink = link.color === BLACK_COLOR; // Ordination links
      
      // Hide black links (ordinations) when hiding priests
      if (shouldHidePriests && isBlackLink && (sourceIsPriest || targetIsPriest)) {
        link.filtered = true;
      } else {
        link.filtered = false;
      }
    });
    
    // Update force simulation to exclude filtered nodes/links from physics
    if (window.currentSimulation) {
      // Update link force to exclude filtered links
      window.currentSimulation.force('link', d3.forceLink(window.currentLinks.filter(l => !l.filtered)).id(d => d.id).distance(LINK_DISTANCE));
      
      // Update charge force to exclude filtered nodes
      window.currentSimulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : CHARGE_STRENGTH));
      
      // Update collision force to exclude filtered nodes
      window.currentSimulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : COLLISION_RADIUS));
      
      // Restart simulation to apply changes
      window.currentSimulation.alpha(1).restart();
    }
  }
}

// Sync checkboxes when either changes
if (hidePriestsCheckbox) {
  hidePriestsCheckbox.addEventListener('change', function() {
    syncPriestFilters();
    applyPriestFilter();
  });
}

if (hidePriestsMobileCheckbox) {
  hidePriestsMobileCheckbox.addEventListener('change', function() {
    syncPriestFilters();
    applyPriestFilter();
  });
}

// Specify the dimensions of the chart
const width = window.innerWidth;
const height = window.innerHeight - 76;

// Define color constants for consistency
const GREEN_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-green').trim() || '#27ae60';
const BLACK_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-black').trim() || '#000000';

// Initialize the visualization
function initializeVisualization() {
    console.log('initializeVisualization called');
    console.log('Window data check:', {
        linksData: window.linksData,
        nodesData: window.nodesData,
        linksLength: window.linksData ? window.linksData.length : 'undefined',
        nodesLength: window.nodesData ? window.nodesData.length : 'undefined'
    });
    console.time('Visualization initialization');
    
    // The force simulation mutates links and nodes, so create a copy
    const linksRaw = window.linksData || [];
    const nodesRaw = window.nodesData || [];

    // Validate data before processing
    if (!Array.isArray(linksRaw) || !Array.isArray(nodesRaw)) {
        console.error('Invalid data received:', { linksRaw, nodesRaw });
        document.getElementById('graph-container').innerHTML = '<div class="text-center p-4"><p class="text-muted">Unable to load lineage data. Please refresh the page.</p></div>';
        return;
    }

    const nodes = nodesRaw.map(d => ({...d}));
    const links = linksRaw.map(d => ({...d}));

    // Convert link source/target IDs to node references - OPTIMIZED
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    links.forEach(link => {
        if (typeof link.source === 'number') {
            link.source = nodeMap.get(link.source);
        }
        if (typeof link.target === 'number') {
            link.target = nodeMap.get(link.target);
        }
    });

    // Filter out any links with missing source or target
    const validLinks = links.filter(link => {
        if (!link.source || !link.target) {
            console.warn('Invalid link found:', link);
            return false;
        }
        return true;
    });

    // Function to detect and offset parallel links
    function processParallelLinks(links) {
        // Group links by source-target pairs
        const linkGroups = {};
        
        links.forEach(link => {
            const key = `${link.source.id}-${link.target.id}`;
            if (!linkGroups[key]) {
                linkGroups[key] = [];
            }
            linkGroups[key].push(link);
        });
        
        // Add offset to parallel links
        Object.values(linkGroups).forEach(group => {
            if (group.length > 1) {
                // Sort by type to ensure consistent ordering
                group.sort((a, b) => {
                    const typeOrder = { 'ordination': 0, 'consecration': 1, 'co-consecration': 2 };
                    return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
                });
                
                // Calculate offset for each link
                const offset = 8; // Distance between parallel lines
                const totalOffset = (group.length - 1) * offset / 2;
                
                group.forEach((link, index) => {
                    link.parallelOffset = (index * offset) - totalOffset;
                });
            }
        });
    }

    // Process parallel links
    processParallelLinks(validLinks);

    // Create SVG container
    const svg = d3.select('#graph-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('background', 'transparent'); // Transparent background to show page background

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', function(event) {
            container.attr('transform', event.transform);
        });
    svg.call(zoom);

    // Create container group for zoom
    const container = svg.append('g');

    // Add arrow markers
    container.append('defs').selectAll('marker')
        .data(['arrowhead-black', 'arrowhead-green'])
        .enter().append('marker')
        .attr('id', d => d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', OUTER_RADIUS * 0.95) // Position arrows slightly farther from nodes (85% of radius)
        .attr('refY', 0)
        .attr('markerWidth', 8) // Increased for larger nodes
        .attr('markerHeight', 8) // Increased for larger nodes
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', d => d === 'arrowhead-black' ? BLACK_COLOR : GREEN_COLOR);

    // Create force simulation - OPTIMIZED for faster convergence
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(validLinks).id(d => d.id).distance(LINK_DISTANCE))
        .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(COLLISION_RADIUS))
        .alphaDecay(0.1) // Faster decay for quicker convergence
        .velocityDecay(0.4); // More damping for stability

    // Add repulsion between bishops
    const bishopNodes = nodes.filter(n => n.rank && n.rank.toLowerCase() === 'bishop');
    if (bishopNodes.length > 0) {
        simulation.force('bishop-repulsion', d3.forceManyBody().strength(-800));
    }
    
    // Override force functions to exclude filtered nodes from physics
    const originalLinkForce = simulation.force('link');
    simulation.force('link', d3.forceLink(validLinks.filter(l => !l.filtered)).id(d => d.id).distance(LINK_DISTANCE));
    
    const originalChargeForce = simulation.force('charge');
    simulation.force('charge', d3.forceManyBody().strength(d => d.filtered ? 0 : CHARGE_STRENGTH));
    
    const originalCollisionForce = simulation.force('collision');
    simulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : COLLISION_RADIUS));

    // Create links first (so they render behind nodes)
    const link = container.append('g')
        .selectAll('line')
        .data(validLinks)
        .enter().append('line')
        .attr('stroke', d => d.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', d => d.dashed ? '5,5' : 'none')
        .style('opacity', d => d.filtered ? 0 : 1) // Hide filtered links
        .style('pointer-events', d => d.filtered ? 'none' : 'all') // Disable pointer events for filtered links
        .attr('marker-end', d => {
            // Ensure we have a valid color and map it to the correct marker
            if (d.color === BLACK_COLOR) {
                return 'url(#arrowhead-black)';
            } else if (d.color === GREEN_COLOR) {
                return 'url(#arrowhead-green)';
            } else {
                // Default to green if color is undefined or doesn't match
                return 'url(#arrowhead-green)';
            }
        });

    // Store references globally for filtering
    window.currentNodes = nodes;
    window.currentLinks = validLinks;
    window.currentSimulation = simulation;
    
    // Initialize filtered state for all nodes and links
    nodes.forEach(node => {
        const isPriest = node.rank && node.rank.toLowerCase() === 'priest';
        node.filtered = isPriest; // Start with priests hidden
    });
    
    validLinks.forEach(link => {
        const sourceIsPriest = link.source.rank && link.source.rank.toLowerCase() === 'priest';
        const targetIsPriest = link.target.rank && link.target.rank.toLowerCase() === 'priest';
        const isBlackLink = link.color === BLACK_COLOR;
        link.filtered = isBlackLink && (sourceIsPriest || targetIsPriest); // Hide black links to priests
    });

    // Create nodes after links (so they render on top)
    const node = container.append('g')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .style('pointer-events', d => d.filtered ? 'none' : 'all') // Disable pointer events for filtered nodes
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // Add node circles
    node.append('circle')
        .attr('r', OUTER_RADIUS)
        .attr('fill', d => d.org_color)
        .attr('stroke', d => d.rank_color)
        .attr('stroke-width', 3);

    // Add rank indicator
    node.append('circle')
        .attr('r', INNER_RADIUS)
        .attr('fill', d => d.rank_color)
        .attr('cx', 0)
        .attr('cy', 0);

    // Add clergy images with proper clipping
    node.append('image')
        .attr('xlink:href', d => d.image_url || '')
        .attr('x', -IMAGE_SIZE/2)
        .attr('y', -IMAGE_SIZE/2)
        .attr('width', IMAGE_SIZE)
        .attr('height', IMAGE_SIZE)
        .attr('clip-path', `circle(${IMAGE_SIZE/2}px at ${IMAGE_SIZE/2}px ${IMAGE_SIZE/2}px)`) // Dynamic clipping for larger images
        .style('opacity', d => d.image_url ? 1 : 0) // Hide if no image
        .on('error', function() {
            // Hide image if it fails to load
            d3.select(this).style('opacity', 0);
        });

    // Add fallback placeholder icon when no image is available
    node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .style('pointer-events', 'none')
        .style('opacity', d => d.image_url ? 0 : 1) // Show only when no image
        .text('👤'); // Person icon as fallback

    // Add labels
    node.append('text')
        .attr('dy', LABEL_DY)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none')
        .style('fill', '#ffffff') // White text for dark background
        .style('filter', 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))') // Subtle drop shadow
        .style('text-shadow', '0 0 3px rgba(0,0,0,0.9)') // Additional glow effect
        .text(d => d.name);

    // Add tooltips
    node.append('title')
        .text(d => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x + (d.parallelOffset || 0))
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x + (d.parallelOffset || 0))
            .attr('y2', d => d.target.y)
            .style('opacity', d => d.filtered ? 0 : 1) // Update link opacity on tick
            .style('pointer-events', d => d.filtered ? 'none' : 'all'); // Disable pointer events for filtered links

        node
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .style('opacity', d => d.filtered ? 0 : 1) // Hide filtered nodes completely
            .style('pointer-events', d => d.filtered ? 'none' : 'all'); // Update pointer events on tick
    });

    // Stop simulation after it converges to improve performance
    simulation.on('end', () => {
        console.log('Force simulation converged');
        // Hide loading indicator when simulation is complete
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    });

    // Fallback: hide loading indicator after 10 seconds to prevent infinite loading
    setTimeout(() => {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }, 10000);

    console.timeEnd('Visualization initialization');

    // Track drag state for click detection
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    let dragThreshold = 100; // pixels - increased for much better click detection
    let dragStartTime = 0;
    let maxClickDuration = 300; // milliseconds

    // Drag functions
    function dragstarted(event, d) {
        // Prevent dragging of filtered nodes
        if (d.filtered) return;
        
        isDragging = false;
        dragStartPos = { x: event.x, y: event.y };
        dragStartTime = Date.now();
        
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        // Prevent dragging of filtered nodes
        if (d.filtered) return;
        
        // Check if we've moved enough to consider this a drag
        const dx = event.x - dragStartPos.x;
        const dy = event.y - dragStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > dragThreshold) {
            isDragging = true;
        }
        
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        // Prevent dragging of filtered nodes
        if (d.filtered) return;
        
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        
        // Check if this was a quick click (not a drag)
        const dragDuration = Date.now() - dragStartTime;
        const wasQuickClick = dragDuration < maxClickDuration && !isDragging;
        
        if (wasQuickClick) {
            // Use a small delay to ensure drag state is fully cleared
            setTimeout(() => {
                handleNodeClick(event, d);
            }, 50);
        }
    }

    // Control button handlers
    document.getElementById('reset-zoom').addEventListener('click', () => {
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
        );
    });

    document.getElementById('center-graph').addEventListener('click', () => {
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(1).restart();
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight - 76;
        svg.attr('width', newWidth).attr('height', newHeight);
        simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
        simulation.alpha(1).restart();
    });

    // Initialize mobile display
    handleMobileMenuDisplay();
    
    // Initialize side menu state
    if (sideMenu) {
      sideMenu.style.display = window.innerWidth <= 768 ? 'none' : 'flex';
      // Start with menu collapsed
      sideMenu.classList.remove('expanded');
    }
    
    // Initialize aside state
    if (clergyAside) {
      clergyAside.style.display = window.innerWidth <= 768 ? 'none' : 'block';
      // Start with aside collapsed
      clergyAside.classList.remove('expanded');
    }
    
    // Apply initial priest filter
    applyPriestFilter();

} // Close initializeVisualization function

// Start the visualization
console.log('Starting visualization initialization...');
console.log('Available data:', { 
    links: window.linksData ? window.linksData.length : 'undefined',
    nodes: window.nodesData ? window.nodesData.length : 'undefined'
});
initializeVisualization();

// HTMX event handling for clergy info panel
document.addEventListener('htmx:after-swap', function(event) {
    // Check if the clergy info panel was loaded
    if (event.target.id === 'clergy-info-panel') {
        // If we have a current clergy ID, load the relationships
        if (window.currentClergyId) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                loadClergyRelationships(window.currentClergyId);
            }, 100);
        }
    }
});
