// Edit Clergy JavaScript functionality
// Handles dynamic form fields, comments, and visual connections

console.log('editClergy.js loaded');

// Global variables
let allBishops = [];

// Simple notification system for editClergy.js
function showNotification(message, type = 'info') {
  // Create notification container if it doesn't exist
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 400px;
    `;
    document.body.appendChild(notificationContainer);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  const alertClass = type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
  notification.className = `alert ${alertClass} alert-dismissible fade show`;
  notification.style.cssText = `
    margin-bottom: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: none;
    border-radius: 8px;
  `;
  
  notification.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Add to container
  notificationContainer.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// Loading spinner system for form submissions
function showLoadingSpinner(form, message = 'Saving...') {
  // Find the submit button
  const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
  if (!submitBtn) return;
  
  // Store original button content and state
  const originalContent = submitBtn.innerHTML;
  const originalDisabled = submitBtn.disabled;
  
  // Create loading state
  submitBtn.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
    ${message}
  `;
  submitBtn.disabled = true;
  
  // Store references for cleanup
  submitBtn._originalContent = originalContent;
  submitBtn._originalDisabled = originalDisabled;
  submitBtn._isLoading = true;
  
  // Disable all form inputs during submission
  const formInputs = form.querySelectorAll('input, select, textarea, button');
  formInputs.forEach(input => {
    if (input !== submitBtn) {
      input.disabled = true;
    }
  });
}

function hideLoadingSpinner(form) {
  // Find the submit button
  const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
  if (!submitBtn || !submitBtn._isLoading) return;
  
  // Restore original button content and state
  submitBtn.innerHTML = submitBtn._originalContent;
  submitBtn.disabled = submitBtn._originalDisabled;
  submitBtn._isLoading = false;
  
  // Re-enable all form inputs
  const formInputs = form.querySelectorAll('input, select, textarea, button');
  formInputs.forEach(input => {
    input.disabled = false;
  });
}

// Initialize the edit clergy functionality
function initEditClergy(bishopsData) {
    console.log('initEditClergy called with bishopsData:', bishopsData);
    allBishops = bishopsData || [];
    
    document.addEventListener('DOMContentLoaded', function() {
        console.log('editClergy.js DOMContentLoaded fired');
        // Initialize autocomplete for bishop fields
        initBishopAutocomplete();
        
        // Initialize comment functionality
        initCommentSystem();
        
        // Initialize form submission handlers
        initFormHandlers();
        
        // Initialize visual connections
        initVisualConnections();
        
        // Dynamic form fields are handled by clergyForm.js
        console.log('editClergy.js initialization complete');
    });
}

// Initialize bishop autocomplete functionality
function initBishopAutocomplete() {
    // Use the attachAutocomplete utility for both bishop fields
    if (window.attachAutocomplete) {
        const ordainingBishopSearch = document.getElementById('ordaining_bishop_search');
        const ordainingBishopId = document.getElementById('ordaining_bishop_id');
        const ordainingBishopDropdown = document.getElementById('ordainingBishopDropdown');
        
        if (ordainingBishopSearch && ordainingBishopId && ordainingBishopDropdown) {
            window.attachAutocomplete(
                ordainingBishopSearch,
                ordainingBishopId,
                ordainingBishopDropdown,
                allBishops,
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
                allBishops,
                b => b.name,
                b => b.id
            );
        }
    }
}

// Dynamic form fields functionality is now handled by clergyForm.js

// Initialize comment system
function initCommentSystem() {
    const addCommentBtn = document.getElementById('add-comment-btn');
    const commentForm = document.getElementById('comment-form');
    const newCommentForm = document.getElementById('new-comment-form');
    const cancelCommentBtn = document.getElementById('cancel-comment-btn');
    const commentField = document.getElementById('comment-field');
    const commentFieldName = document.getElementById('comment-field-name');
    const commentContent = document.getElementById('comment-content');

    // Handle add comment button
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', function() {
            commentForm.style.display = 'block';
            commentField.value = 'General Comment';
            commentFieldName.value = '';
            commentContent.focus();
            commentForm.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Handle field-specific comment buttons
    document.querySelectorAll('.comment-btn').forEach(btn => {
        // Add tooltip if not already present
        if (!btn.getAttribute('title')) {
            const fieldLabel = btn.getAttribute('data-field-label');
            btn.setAttribute('title', `Add comment about ${fieldLabel}`);
        }
        
        btn.addEventListener('click', function() {
            const fieldName = this.getAttribute('data-field');
            const fieldLabel = this.getAttribute('data-field-label');
            
            // Remove active class from all buttons
            document.querySelectorAll('.comment-btn').forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            commentForm.style.display = 'block';
            commentField.value = fieldLabel;
            commentFieldName.value = fieldName;
            commentContent.focus();
            commentForm.scrollIntoView({ behavior: 'smooth' });
            
            // Highlight the related form field
            const formField = document.querySelector(`[name="${fieldName}"]`);
            if (formField) {
                formField.classList.add('highlighted');
                setTimeout(() => {
                    formField.classList.remove('highlighted');
                }, 2000);
            }
        });
    });

    // Handle cancel button
    if (cancelCommentBtn) {
        cancelCommentBtn.addEventListener('click', function() {
            commentForm.style.display = 'none';
            newCommentForm.reset();
            
            // Remove active class from all comment buttons
            document.querySelectorAll('.comment-btn').forEach(b => b.classList.remove('active'));
        });
    }

    // Handle comment form submission
    if (newCommentForm) {
        newCommentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const content = commentContent.value.trim();
            if (!content) {
                showNotification('Please enter a comment.', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('content', content);
            formData.append('field_name', commentFieldName.value);
            formData.append('is_public', document.getElementById('isPublic').checked ? '1' : '0');
            
            // Get the clergy ID from the current URL or form action
            const clergyId = getClergyIdFromContext();
            if (!clergyId) {
                showNotification('Unable to determine clergy ID for comment submission.', 'error');
                return;
            }
            
            fetch(`/clergy/${clergyId}/comments/add`, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                const contentType = response.headers.get('content-type');
                if (!response.ok) {
                    return response.text().then(text => { throw new Error(text); });
                }
                if (!contentType || !contentType.includes('application/json')) {
                    return response.text().then(text => { throw new Error('Expected JSON, got: ' + text); });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Hide form and reload comments
                    commentForm.style.display = 'none';
                    newCommentForm.reset();
                    
                    // Remove active class from all comment buttons
                    document.querySelectorAll('.comment-btn').forEach(b => b.classList.remove('active'));
                    
                    location.reload();
                } else {
                    showNotification('Error: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('An error occurred while submitting the comment: ' + error.message, 'error');
            });
        });
    }

    // Handle resolve comment buttons
    document.querySelectorAll('.resolve-comment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Mark this comment as resolved?')) {
                const commentId = this.getAttribute('data-comment-id');
                
                fetch(`/comments/${commentId}/resolve`, {
                    method: 'POST'
                })
                .then(response => {
                    const contentType = response.headers.get('content-type');
                    if (!response.ok) {
                        return response.text().then(text => { throw new Error(text); });
                    }
                    if (!contentType || !contentType.includes('application/json')) {
                        return response.text().then(text => { throw new Error('Expected JSON, got: ' + text); });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        showNotification('Error: ' + data.message, 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showNotification('An error occurred while resolving the comment: ' + error.message, 'error');
                });
            }
        });
    });
}

// Initialize form submission handlers
function initFormHandlers() {
    const editForm = document.getElementById('clergyForm');
    const cancelBtn = document.getElementById('cancel-btn');
    
    // Cancel button should work with default behavior (no event handler needed)
    
    if (editForm) {
        // Only attach handler if form is NOT in a modal context
        const isInModal = editForm.closest('.modal') !== null;
        if (isInModal) {
            console.log('Edit form is in modal context, skipping editClergy.js handler');
            return;
        }
        
        console.log('Edit form is not in modal context, attaching editClergy.js handler');
        editForm.addEventListener('submit', function(e) {
            console.log('Form submit event fired');
            e.preventDefault();
            
            const formData = new FormData(this);
            
            // Check for globally stored dropped file
            if (window.droppedFile) {
                console.log('Adding globally stored file to FormData:', window.droppedFile);
                formData.append('clergy_image', window.droppedFile);
                // Clear the global file after adding to form data
                delete window.droppedFile;
            }
            
            fetch(this.action, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                const contentType = response.headers.get('content-type');
                if (!response.ok) {
                    return response.text().then(text => { throw new Error(text); });
                }
                if (!contentType || !contentType.includes('application/json')) {
                    return response.text().then(text => { throw new Error('Expected JSON, got: ' + text); });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    showNotification('Clergy record updated successfully!', 'success');
                    // Optionally reload the page to show updated data
                    location.reload();
                } else {
                    showNotification('Error: ' + data.message, 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('An error occurred while saving the record: ' + error.message, 'danger');
            });
        });
    }
}

// Initialize visual connections between comments and form fields
function initVisualConnections() {
    const connectionLines = document.getElementById('connection-lines');

    // Clear connections function
    function clearConnections() {
        if (!connectionLines) return;
        connectionLines.innerHTML = '';
    }

    // Create connection function
    function createConnection(from, to, anchorType = 'auto') {
        if (!connectionLines) return;
        
        clearConnections();
        
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        
        // Create SVG for the connection
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', window.innerWidth);
        svg.setAttribute('height', window.innerHeight);
        svg.style.position = 'fixed';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Smart anchoring system
        function getAnchorPoint(element, anchorType) {
            const rect = element.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            
            const computedStyle = window.getComputedStyle(element);
            const transform = computedStyle.transform;
            let offsetX = 0;
            
            if (transform && transform !== 'none') {
                const matrix = new DOMMatrix(transform);
                offsetX = matrix.m41;
            }
            
            switch(anchorType) {
                case 'comment-button':
                    const commentBtn = element.querySelector('.comment-btn');
                    if (commentBtn) {
                        const btnRect = commentBtn.getBoundingClientRect();
                        return { x: btnRect.right + offsetX, y: btnRect.top + btnRect.height / 2 };
                    }
                    return { x: rect.right + offsetX, y: centerY };
                case 'comment':
                    return { x: rect.left + offsetX, y: centerY };
                case 'comment-right':
                    return { x: rect.right + offsetX, y: centerY };
                case 'field':
                    return { x: rect.right + offsetX, y: centerY };
                default:
                    if (element.classList.contains('comment-btn')) {
                        return { x: rect.right + offsetX, y: centerY };
                    } else if (element.classList.contains('comment-item')) {
                        return { x: rect.left + offsetX, y: centerY };
                    } else {
                        return { x: rect.right + offsetX, y: centerY };
                    }
            }
        }
        
        const isFromComment = from.classList.contains('comment-item');
        const isToComment = to.classList.contains('comment-item');
        
        const fieldElement = isFromComment ? to : from;
        const commentElement = isFromComment ? from : to;
        
        const fromAnchor = getAnchorPoint(fieldElement, 'field');
        const toAnchor = getAnchorPoint(commentElement, 'comment');
        
        const distance = Math.abs(toAnchor.x - fromAnchor.x);
        const controlDistance = Math.min(distance * 0.3, 100);
        
        let cp1x, cp1y, cp2x, cp2y;
        
        if (fromAnchor.x < toAnchor.x) {
            cp1x = fromAnchor.x + controlDistance;
            cp1y = fromAnchor.y;
            cp2x = toAnchor.x - controlDistance;
            cp2y = toAnchor.y;
        } else {
            cp1x = fromAnchor.x - controlDistance;
            cp1y = fromAnchor.y;
            cp2x = toAnchor.x + controlDistance;
            cp2y = toAnchor.y;
        }
        
        const path = `M ${fromAnchor.x} ${fromAnchor.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toAnchor.x} ${toAnchor.y}`;
        line.setAttribute('d', path);
        
        const isClickedConnection = from.classList.contains('clicked') || to.classList.contains('clicked');
        line.setAttribute('class', `connection-line${isClickedConnection ? ' clicked' : ''}`);
        
        line.setAttribute('stroke', '#ffc107');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('fill', 'none');
        
        svg.appendChild(line);
        connectionLines.appendChild(svg);
    }

    // Focused connection system
    document.querySelectorAll('.comment-item').forEach(commentItem => {
        let isClicked = false;
        
        commentItem.addEventListener('mouseenter', function() {
            const anyCommentClicked = document.querySelector('.comment-item.clicked');
            if (anyCommentClicked) return;
            
            const fieldName = this.getAttribute('data-field');
            if (fieldName) {
                const formField = document.querySelector(`[name="${fieldName}"]`);
                if (formField) {
                    formField.classList.add('highlighted');
                    createConnection(formField, this);
                }
            }
            this.classList.add('highlighted');
        });

        commentItem.addEventListener('mouseleave', function() {
            const anyCommentClicked = document.querySelector('.comment-item.clicked');
            if (anyCommentClicked) return;
            
            const fieldName = this.getAttribute('data-field');
            if (fieldName) {
                const formField = document.querySelector(`[name="${fieldName}"]`);
                if (formField) {
                    formField.classList.remove('highlighted');
                }
            }
            this.classList.remove('highlighted');
            clearConnections();
        });
        
        commentItem.addEventListener('click', function() {
            const fieldName = this.getAttribute('data-field');
            if (fieldName) {
                const formField = document.querySelector(`[name="${fieldName}"]`);
                if (formField) {
                    if (this.classList.contains('clicked')) {
                        this.classList.remove('clicked');
                        this.classList.remove('highlighted');
                        formField.classList.remove('highlighted');
                        formField.classList.remove('clicked');
                        
                        const commentBtn = formField.parentElement.querySelector('.comment-btn');
                        if (commentBtn) {
                            commentBtn.classList.remove('clicked');
                        }
                        
                        clearConnections();
                        return;
                    }
                    
                    document.querySelectorAll('.comment-item').forEach(item => {
                        if (item !== this) {
                            item.classList.remove('clicked');
                            item.classList.remove('highlighted');
                        }
                    });
                    document.querySelectorAll('input, textarea, select').forEach(field => {
                        field.classList.remove('highlighted');
                        field.classList.remove('clicked');
                    });
                    document.querySelectorAll('.comment-btn').forEach(btn => {
                        btn.classList.remove('clicked');
                    });
                    clearConnections();
                    
                    this.classList.add('clicked');
                    this.classList.add('highlighted');
                    
                    formField.classList.add('highlighted');
                    formField.classList.add('clicked');
                    formField.focus();
                    
                    const commentBtn = formField.parentElement.querySelector('.comment-btn');
                    if (commentBtn) {
                        commentBtn.classList.add('clicked');
                    }
                    
                    createConnection(formField, this);
                    
                    formField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    });
    
    // Clear clicked state when clicking elsewhere
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.comment-item') && !e.target.closest('input, textarea, select')) {
            document.querySelectorAll('.comment-item').forEach(item => {
                item.classList.remove('clicked');
                item.classList.remove('highlighted');
            });
            document.querySelectorAll('input, textarea, select').forEach(field => {
                field.classList.remove('highlighted');
                field.classList.remove('clicked');
            });
            document.querySelectorAll('.comment-btn').forEach(btn => {
                btn.classList.remove('clicked');
            });
            clearConnections();
        }
    });

    // Show connections when form fields are focused
    document.querySelectorAll('input, textarea, select').forEach(field => {
        field.addEventListener('focus', function() {
            const fieldName = this.getAttribute('name');
            
            document.querySelectorAll('.comment-item').forEach(comment => {
                comment.classList.remove('highlighted');
                comment.classList.remove('clicked');
            });
            document.querySelectorAll('input, textarea, select').forEach(field => {
                if (field !== this) {
                    field.classList.remove('highlighted');
                    field.classList.remove('clicked');
                }
            });
            document.querySelectorAll('.comment-btn').forEach(btn => {
                btn.classList.remove('clicked');
            });
            clearConnections();
            
            if (fieldName) {
                const comments = document.querySelectorAll(`.comment-item[data-field="${fieldName}"]`);
                if (comments.length > 0) {
                    const clickedComment = Array.from(comments).find(comment => comment.classList.contains('clicked'));
                    
                    if (clickedComment) {
                        this.classList.add('clicked');
                        createConnection(clickedComment, this);
                    } else {
                        comments.forEach(comment => {
                            comment.classList.add('highlighted');
                        });
                        createConnection(comments[0], this);
                    }
                }
            }
        });

        field.addEventListener('blur', function() {
            const fieldName = this.getAttribute('name');
            if (fieldName) {
                const comments = document.querySelectorAll(`.comment-item[data-field="${fieldName}"]`);
                const hasClickedComment = Array.from(comments).some(comment => comment.classList.contains('clicked'));
                
                if (!hasClickedComment) {
                    comments.forEach(comment => {
                        comment.classList.remove('highlighted');
                    });
                    this.classList.remove('clicked');
                    clearConnections();
                }
            }
        });
    });
}

// Helper function to get clergy ID from context
function getClergyIdFromContext() {
    // Try to get from URL path
    const pathMatch = window.location.pathname.match(/\/clergy\/(\d+)/);
    if (pathMatch) {
        return pathMatch[1];
    }
    
    // Try to get from form action
    const form = document.getElementById('clergyForm');
    if (form && form.action) {
        const actionMatch = form.action.match(/\/clergy\/(\d+)/);
        if (actionMatch) {
            return actionMatch[1];
        }
    }
    
    return null;
}

// Notification function
function showNotification(message, type) {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = 9999;
        document.body.appendChild(container);
    }
    const notif = document.createElement('div');
    notif.className = `alert alert-${type}`;
    notif.textContent = message;
    notif.style.minWidth = '220px';
    notif.style.marginBottom = '10px';
    notif.style.boxShadow = '0 2px 8px rgba(44,62,80,0.10)';
    container.appendChild(notif);
    setTimeout(() => {
        notif.remove();
    }, 3000);
}

// Make functions globally available
window.initEditClergy = initEditClergy;
window.showNotification = showNotification;
