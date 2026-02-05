// Modal module for clergy forms and editing
import { showNotification, showLoadingSpinner, hideLoadingSpinner, getCurrentClergyId } from './utils.js';
// DISABLED: setClergyInfoViewDistance - not used, was causing graph to shift
// import { setClergyInfoViewDistance } from './core.js';
import { setModalState, getModalState } from './ui.js';
import { createClergyWindow, updateWindowContent, bringToFront } from './clergyWindows.js';

// Node click handler function
export async function handleNodeClick(event, d) {
  // Prevent click if node is filtered
  if (d.filtered) return;
  
  // Check if highlight mode is enabled
  try {
    const { isHighlightMode, highlightLineageChain } = await import('./highlightLineage.js');
    if (isHighlightMode()) {
      // Highlight the lineage chain
      highlightLineageChain(d);
      return; // Don't show panel in highlight mode
    }
  } catch (error) {
    console.error('Error importing highlightLineage module:', error);
  }
  
  // Store current clergy ID for relationship loading
  window.currentClergyId = d.id;
  
  // Create or bring to front draggable window
  const { getWindow } = await import('./clergyWindows.js');
  let windowElement = getWindow(d.id);
  
  if (windowElement) {
    // Window already exists, bring to front
    bringToFront(d.id);
  } else {
    // Create new window
    windowElement = createClergyWindow(d);
  }
  
  // Store node data on window for later use
  if (windowElement) {
    windowElement.currentNodeData = d;
  }
  
  // Update window content with node data
  updateWindowContent(d.id, d, null);
  
  // Load clergy relationships
  loadClergyRelationships(d.id);
}

// Function to center a node in the viewport when the aside panel is displayed
function centerNodeInViewport(node) {
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

// Function to update clergy panel content without triggering transitions
function updateClergyPanelContent(d) {
  // Populate aside with clergy data
  document.getElementById('clergy-aside-ordination').textContent = d.ordination_date || 'Not specified';
  document.getElementById('clergy-aside-consecration').textContent = d.consecration_date || 'Not specified';
  
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
  
  // Display status indicators
  displayStatusIndicators(d);
}

// Function to display status indicators in the info panel
function displayStatusIndicators(d) {
  // Check if there's already a status container, or create one
  let statusContainer = document.getElementById('clergy-status-indicators');
  
  if (!statusContainer) {
    // Create the status container after the image
    const asideContent = document.querySelector('.aside-content');
    const imageContainer = document.querySelector('.clergy-image-container');
    
    if (asideContent && imageContainer) {
      statusContainer = document.createElement('div');
      statusContainer.id = 'clergy-status-indicators';
      statusContainer.className = 'status-indicators-panel';
      imageContainer.parentNode.insertBefore(statusContainer, imageContainer.nextSibling);
    }
  }
  
  if (!statusContainer) return;
  
  // Clear existing content
  statusContainer.innerHTML = '';
  
  // Check if clergy has statuses
  if (!d.statuses || d.statuses.length === 0) {
    statusContainer.style.display = 'none';
    return;
  }
  
  statusContainer.style.display = 'block';
  
  // Create status badges
  const badgesHTML = d.statuses.map(status => `
    <div class="status-badge-item" title="${status.description || status.name}">
      <i class="fas ${status.icon}" style="color: ${status.color};"></i>
      <span>${status.name}</span>
    </div>
  `).join('');
  
  statusContainer.innerHTML = badgesHTML;
}

// Function to load clergy relationships
async function loadClergyRelationships(clergyId) {
  try {
    const response = await fetch(`/clergy/relationships/${clergyId}`);
    const data = await response.json();
    
    if (data.success) {
      // Update window content with relationships
      const { updateWindowContent, getWindow } = await import('./clergyWindows.js');
      const window = getWindow(clergyId);
      if (window) {
        // Get node data from window or current nodes
        const nodeData = window.currentNodeData || window.currentNodes?.find(n => n.id == clergyId) || {};
        updateWindowContent(clergyId, nodeData, data);
      } else {
        // Fallback to old aside panel display (for backwards compatibility)
        displayClergyRelationships(data);
      }
    } else {
      console.error('Failed to load clergy relationships:', data.message);
    }
  } catch (error) {
    console.error('Error loading clergy relationships:', error);
  }
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

// Function to add event listeners for clergy links and add clergy links
// Use event delegation on document to handle dynamically created links in windows
export function addClergyLinkEventListeners() {
  // Use event delegation for clergy links (works with dynamically created windows)
  document.addEventListener('click', function(e) {
    const clergyLink = e.target.closest('.clergy-link');
    if (clergyLink) {
      e.preventDefault();
      const clergyId = clergyLink.getAttribute('data-clergy-id');
      // Find the clergy node and click it to show its information
      const clergyNode = window.currentNodes?.find(node => node.id == clergyId);
      if (clergyNode) {
        handleNodeClick(e, clergyNode);
      }
    }
    
    const addClergyLink = e.target.closest('.add-clergy-link');
    if (addClergyLink) {
      e.preventDefault();
      const contextType = addClergyLink.getAttribute('data-context-type');
      const contextClergyId = addClergyLink.getAttribute('data-context-clergy-id');
      openAddClergyModal(contextType, contextClergyId);
    }
  });
}

// Function to clean up modal backdrop and restore page state
function cleanupModalBackdrop() {
  // Remove any lingering modal backdrops
  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => backdrop.remove());
  
  // Remove modal-open class from body
  document.body.classList.remove('modal-open');
  
  // Reset body padding if it was modified
  document.body.style.paddingRight = '';
  
  // Reset body overflow if it was modified
  document.body.style.overflow = '';
}

// Global event listener to clean up modal backdrop when modals are closed
document.addEventListener('hidden.bs.modal', function(event) {
  // Clean up any lingering backdrop after modal is fully hidden
  setTimeout(() => {
    cleanupModalBackdrop();
  }, 100);
});

// Function to open the edit clergy modal
export function openEditClergyModal(clergyId) {
  const modal = document.getElementById('clergyFormModal');
  const modalBody = document.getElementById('clergyFormModalBody');
  
  // Load the edit clergy form
  fetch(`/clergy/edit_from_lineage/${clergyId}`)
    .then(response => response.text())
    .then(html => {
      modalBody.innerHTML = html;
      
      // Show the modal
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
      
      // Set modal state to open
      setModalState(true);
      
      // Add event listener for modal close events (X button, Escape key, etc.)
      modal.addEventListener('hidden.bs.modal', function() {
        setModalState(false);
      });
      
      // Load necessary JavaScript for the form
      loadEditFormScripts();
      
      // Wait a moment for the modal to be fully rendered
      setTimeout(() => {
        // Initialize image editor functionality
        // Check for image-related form elements
        const imageInput = modalBody.querySelector('#clergyImage');
        const uploadBtn = modalBody.querySelector('#uploadBtn');
        const cropBtn = modalBody.querySelector('#cropExistingBtn');
        const removeBtn = modalBody.querySelector('#removeImageBtn');
        // Ensure we have an image editor instance
        if (!window.imageEditor && typeof ImageEditor !== 'undefined') {
          try {
            window.imageEditor = new ImageEditor();
          } catch (error) {
            console.error('Error creating image editor for edit form:', error);
          }
        }
        
        // Attach event listeners to the form elements
        if (window.imageEditor) {
          try {
            // Use the image editor's own method to avoid duplication
            window.imageEditor.reattachFormEventListeners();
          } catch (error) {
            console.error('Error attaching image editor form listeners to edit form:', error);
          }
        } else {
          console.warn('ImageEditor not available for edit form initialization');
        }
      }, 100);
      
      // Override the form submission for modal context
      const form = modalBody.querySelector('#clergyForm');
      if (form) {
        // Remove any existing HTMX attributes
        form.removeAttribute('hx-post');
        form.removeAttribute('hx-target');
        form.removeAttribute('hx-swap');
        form.removeAttribute('hx-on::after-request');
        
        // Add custom submit handler
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          
          // Show loading spinner
          showLoadingSpinner(form, 'Updating clergy...');
          // Debug: Check all form inputs
          const allInputs = form.querySelectorAll('input, select, textarea');
          allInputs.forEach((input, index) => {
          });
          
          // Manually build form data since FormData constructor seems to have issues
          const formData = new FormData();
          const requiredFields = ['name', 'rank', 'organization']; // Fields that must be preserved even if empty
          
          // Check for globally stored dropped file
          if (window.droppedFile) {
            formData.append('clergy_image', window.droppedFile);
            // Clear the global file after adding to form data
            delete window.droppedFile;
          }
          
          // Get all form inputs and manually add them to FormData
          const formInputs = form.querySelectorAll('input, select, textarea');
          formInputs.forEach((input) => {
            const name = input.name;
            const value = input.value;
            const type = input.type;
            
            // Skip inputs without names
            if (!name) return;
            
            // Handle different input types
            if (type === 'checkbox') {
              if (input.checked) {
                formData.append(name, value);
              }
            } else if (type === 'file') {
              // Handle file inputs
              if (input.files && input.files.length > 0) {
                formData.append(name, input.files[0]);
              }
            } else {
              // Handle text, select, textarea, etc.
              if (requiredFields.includes(name)) {
                // Always preserve required fields, even if empty
                formData.append(name, value || '');
              } else if (value && value !== 'None' && value !== '') {
                // For other fields, only include if they have a value and are not "None"
                formData.append(name, value);
              }
            }
          });
          
          // Debug: Log final form data
          for (let [key, value] of formData.entries()) {
          }
          
          fetch(form.action, {
            method: 'POST',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
          })
          .then(response => {
            return response.json();
          })
          .then(data => {
            if (data.success) {
              // Show success notification
              showNotification('Clergy member updated successfully!', 'success');
              
              // Close the modal
              bootstrapModal.hide();
              
              // Set modal state to closed
              setModalState(false);
              
              // Clean up modal backdrop after a short delay
              setTimeout(() => {
                cleanupModalBackdrop();
              }, 300);
              
              // Refresh the visualization data without reloading the page
              refreshVisualizationData();
            } else {
              // Hide loading spinner on error
              hideLoadingSpinner(form);
              showNotification('Error: ' + (data.message || 'Failed to update clergy member'), 'error');
            }
          })
          .catch(error => {
            console.error('Error:', error);
            // Hide loading spinner on error
            hideLoadingSpinner(form);
            showNotification('Error submitting form. Please try again.', 'error');
          });
        });
        
        // Handle cancel button to close modal
        const cancelBtn = form.querySelector('a[href="#"]');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            // Set modal state to closed BEFORE hiding the modal
            setModalState(false);
            setTimeout(() => {
              bootstrapModal.hide();
            }, 10);
          });
        }
      }
    })
    .catch(error => {
      console.error('Error loading edit form:', error);
      showNotification('Error loading edit form. Please try again.', 'error');
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
  fetch(`/clergy/add_from_lineage?context_type=${contextType}&context_clergy_id=${contextClergyId}`)
    .then(response => response.text())
    .then(html => {
      modalBody.innerHTML = html;
      
      // Show the modal
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
      
      // Set modal state to open
      setModalState(true);
      
      // Add event listener for modal close events (X button, Escape key, etc.)
      modal.addEventListener('hidden.bs.modal', function() {
        setModalState(false);
      });
      
      // Wait a moment for the modal to be fully rendered
      setTimeout(() => {
        // Initialize bishop autocomplete for the loaded form
        initModalBishopAutocomplete();
        
        // Initialize form field visibility based on current rank selection
        const rankSelect = modalBody.querySelector('#rank');
        if (rankSelect && window.toggleConsecrationFields) {
          window.toggleConsecrationFields(rankSelect.value);
        }
        
        // Initialize image editor functionality
        // Check for image-related form elements
        const imageInput = modalBody.querySelector('#clergyImage');
        const uploadBtn = modalBody.querySelector('#uploadBtn');
        const cropBtn = modalBody.querySelector('#cropExistingBtn');
        const removeBtn = modalBody.querySelector('#removeImageBtn');
        // Ensure we have an image editor instance
        if (!window.imageEditor && typeof ImageEditor !== 'undefined') {
          try {
            window.imageEditor = new ImageEditor();
          } catch (error) {
            console.error('Error creating image editor:', error);
          }
        }
        
        // Attach event listeners to the form elements
        if (window.imageEditor) {
          try {
            // Use the image editor's own method to avoid duplication
            window.imageEditor.reattachFormEventListeners();
          } catch (error) {
            console.error('Error attaching image editor form listeners:', error);
          }
        } else {
          console.warn('ImageEditor not available for form initialization');
        }
      }, 100);
      
      // Override the form submission for modal context
      const form = modalBody.querySelector('#clergyForm');
      if (form) {
        // Debug: Check form fields
        const ordainingBishopId = form.querySelector('#ordaining_bishop_id');
        const consecratorId = form.querySelector('#consecrator_id');
        const organization = form.querySelector('#organization');
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
          
          // Validate required fields before submission
          const nameInput = form.querySelector('input[name="name"]');
          const rankSelect = form.querySelector('select[name="rank"]');
          if (!nameInput || !nameInput.value.trim()) {
            showNotification('Name is required', 'error');
            return;
          }
          
          if (!rankSelect || !rankSelect.value) {
            showNotification('Rank is required', 'error');
            return;
          }
          // Show loading spinner
          showLoadingSpinner(form, 'Adding clergy...');
          const formData = new FormData(form);
          
          // Debug: Log all raw form data before cleaning
          for (let [key, value] of formData.entries()) {
          }
          
          // Debug: Check specific form elements
          const orgSelect = form.querySelector('select[name="organization"]');
          // Debug: Check all form elements
          const allInputs = form.querySelectorAll('input, select, textarea');
          allInputs.forEach((input, index) => {
          });
          
          // Clean up form data - remove empty fields and "None" values, but preserve required fields
          const cleanedFormData = new FormData();
          const requiredFields = ['name', 'rank', 'organization']; // Fields that must be preserved even if empty
          
          // If FormData constructor didn't capture the values properly, manually collect them
          if (formData.entries().next().done) {
            const allInputs = form.querySelectorAll('input, select, textarea');
            allInputs.forEach(input => {
              if (input.name && input.name !== '') {
                cleanedFormData.append(input.name, input.value || '');
              }
            });
          } else {
            for (let [key, value] of formData.entries()) {
              // Always preserve required fields, even if empty
              if (requiredFields.includes(key)) {
                cleanedFormData.append(key, value || '');
              }
              // For other fields, only include if they have a value and are not "None"
              else if (value && value !== 'None' && value !== '') {
                cleanedFormData.append(key, value);
              }
            }
          }
          
          // Log cleaned form data for debugging
          for (let [key, value] of cleanedFormData.entries()) {
          }
          
          fetch(form.action, {
            method: 'POST',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: cleanedFormData
          })
          .then(response => {
            return response.json();
          })
          .then(data => {
            if (data.success) {
              // Show success notification
              showNotification('Clergy member added successfully!', 'success');
              
              // Close the modal
              bootstrapModal.hide();
              
              // Set modal state to closed
              setModalState(false);
              
              // Clean up modal backdrop after a short delay
              setTimeout(() => {
                cleanupModalBackdrop();
              }, 300);
              
              // Refresh the visualization data without reloading the page
              refreshVisualizationData();
            } else {
              // Hide loading spinner on error
              hideLoadingSpinner(form);
              showNotification('Error: ' + (data.message || 'Failed to add clergy member'), 'error');
            }
          })
          .catch(error => {
            console.error('Error:', error);
            // Hide loading spinner on error
            hideLoadingSpinner(form);
            showNotification('Error submitting form. Please try again.', 'error');
          });
        });
        
        // Handle cancel button to close modal
        const cancelBtn = form.querySelector('a[href="#"]');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            setModalState(false);
            setTimeout(() => {
              bootstrapModal.hide();
            }, 10);
          });
        }
      }
    })
    .catch(error => {
      console.error('Error loading clergy form:', error);
      modalBody.innerHTML = '<div class="alert alert-danger">Error loading form. Please try again.</div>';
    });
}

// Function to load necessary scripts for edit form functionality
function loadEditFormScripts() {
  // Load fuzzySearch.js if not already loaded
  if (!window.attachAutocomplete) {
    const script1 = document.createElement('script');
    script1.src = '/static/js/fuzzySearch.js';
    script1.onload = function() {
      // Initialize bishop autocomplete after script loads
      initModalBishopAutocomplete();
    };
    document.head.appendChild(script1);
  } else {
    // Script already loaded, initialize directly
    initModalBishopAutocomplete();
  }
  
  // Initialize edit clergy functionality
  initModalEditClergy();
}

// Custom function to attach image editor event listeners to HTMX-loaded form
function attachImageEditorEventListeners(container, imageEditor) {
  const imageInput = container.querySelector('#clergyImage');
  const uploadBtn = container.querySelector('#uploadBtn');
  const cropBtn = container.querySelector('#cropExistingBtn');
  const removeBtn = container.querySelector('#removeImageBtn');
  if (imageInput) {
    // Clone the element to remove all event listeners
    const newImageInput = imageInput.cloneNode(true);
    imageInput.parentNode.replaceChild(newImageInput, imageInput);
    newImageInput.addEventListener('change', (e) => imageEditor.handleFormImageUpload(e));
  }
  
  if (uploadBtn) {
    // Clone the element to remove all event listeners
    const newUploadBtn = uploadBtn.cloneNode(true);
    uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
    newUploadBtn.addEventListener('click', () => {
      const input = container.querySelector('#clergyImage');
      if (input) input.click();
    });
  }
  
  if (cropBtn) {
    // Clone the element to remove all event listeners
    const newCropBtn = cropBtn.cloneNode(true);
    cropBtn.parentNode.replaceChild(newCropBtn, cropBtn);
    newCropBtn.addEventListener('click', async () => await imageEditor.editExistingImage());
  }
  
  if (removeBtn) {
    // Clone the element to remove all event listeners
    const newRemoveBtn = removeBtn.cloneNode(true);
    removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
    newRemoveBtn.addEventListener('click', () => imageEditor.removeFormImage());
  }
}

// Initialize bishop autocomplete for modal
function initModalBishopAutocomplete() {
  // Get all bishops data from the form (it should be available in the modal)
  const allBishopsScript = document.querySelector('script[data-bishops]');
  let bishopsData = [];
  if (allBishopsScript) {
    try {
      bishopsData = JSON.parse(allBishopsScript.textContent);
      if (bishopsData.length > 0) {
      }
    } catch (e) {
      console.error('Error parsing bishops data:', e);
      console.error('Raw script content:', allBishopsScript.textContent);
    }
  } else {
    console.warn('No bishops script found in modal');
  }
  
  // Initialize autocomplete for both bishop fields
  if (window.attachAutocomplete) {
    const ordainingBishopSearch = document.getElementById('ordaining_bishop_search');
    const ordainingBishopId = document.getElementById('ordaining_bishop_id');
    const ordainingBishopDropdown = document.getElementById('ordainingBishopDropdown');
    if (ordainingBishopSearch && ordainingBishopId && ordainingBishopDropdown) {
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
    if (consecratorSearch && consecratorId && consecratorDropdown) {
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
    // Check for image-related form elements
    const imageInput = modalBody.querySelector('#clergyImage');
    const uploadBtn = modalBody.querySelector('#uploadBtn');
    const cropBtn = modalBody.querySelector('#cropExistingBtn');
    const removeBtn = modalBody.querySelector('#removeImageBtn');
    if (imageEditorModal) {
      if (window.imageEditor) {
        try {
          window.imageEditor.reattachFormEventListeners();
        } catch (error) {
          console.error('Edit modal - Error reattaching image editor form listeners:', error);
        }
      } else if (typeof ImageEditor !== 'undefined') {
        try {
          window.imageEditor = new ImageEditor();
          window.imageEditor.reattachFormEventListeners();
        } catch (error) {
          console.error('Edit modal - Error creating image editor:', error);
        }
      } else {
        console.warn('Edit modal - ImageEditor class not available');
      }
    } else {
    }
  }
}

// Function to refresh visualization data without page reload
function refreshVisualizationData() {
  // Fetch updated data from the server
  fetch('/clergy/lineage-data')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update the global data
        window.linksData = data.links;
        window.nodesData = data.nodes;
        
        // Reinitialize the visualization with new data
        if (window.initializeVisualization) {
          // Clear the existing visualization
          const graphContainer = document.getElementById('graph-container');
          if (graphContainer) {
            graphContainer.innerHTML = '';
          }
          
          // Reinitialize with new data
          window.initializeVisualization();
        }
        
        // If we have a current clergy ID, keep the panel open and refresh its content
        if (window.currentClergyId) {
          // Find the updated clergy node
          const updatedNode = data.nodes.find(node => node.id == window.currentClergyId);
          if (updatedNode) {
            // Update the panel content with new data
            updateClergyPanelContent(updatedNode);
            // Reload relationships
            loadClergyRelationships(window.currentClergyId);
          }
        }
      } else {
        console.error('Failed to refresh data:', data.message);
        // Fallback to page reload if data refresh fails
        window.location.reload(true);
      }
    })
    .catch(error => {
      console.error('Error refreshing data:', error);
      // Fallback to page reload if data refresh fails
      window.location.reload(true);
    });
}

// HTMX event handling for clergy info panel
export function initializeHTMXHandlers() {
  // Initialize event listeners for clergy links (works with windows)
  addClergyLinkEventListeners();
  
  document.addEventListener('htmx:after-swap', function(event) {
    // Check if the clergy info panel was loaded (for backwards compatibility)
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
}
