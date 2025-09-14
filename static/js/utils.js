// Utility functions for notifications, loading spinners, and helpers

// Notification system to replace alerts
export function showNotification(message, type = 'info') {
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
export function showLoadingSpinner(form, message = 'Saving...') {
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

export function hideLoadingSpinner(form) {
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

// Function to get current clergy ID from the aside
export function getCurrentClergyId() {
  return window.currentClergyId;
}

// Function to refresh the visualization after adding clergy
export function refreshVisualization() {
  // Reload the page to get updated data
  window.location.reload();
}
