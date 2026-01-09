/**
 * Clergy Form Submission Overlay and Progress Bar
 * Handles showing/hiding overlay and updating progress during form submission
 */

// Overlay and progress bar functions - Global scope for accessibility
window.showFormSubmissionOverlay = function() {
    const form = document.getElementById('clergyForm');
    if (!form) {
        console.warn('showFormSubmissionOverlay: No form found');
        return;
    }
    
    // Try to find overlay in editor panel first
    let overlay = document.getElementById('formSubmissionOverlay');
    
    // If not found, create a temporary overlay
    if (!overlay) {
        // Find the form's parent container (could be modal-body, clergyFormContainer, or direct parent)
        const formContainer = form.closest('.modal-body') || 
                             form.closest('#clergyFormContainer') || 
                             form.closest('div[style*="position"]') ||
                             form.parentElement;
        
        if (formContainer) {
            // Ensure container has relative positioning
            const currentPosition = window.getComputedStyle(formContainer).position;
            if (currentPosition === 'static') {
                formContainer.style.position = 'relative';
            }
            
            overlay = document.createElement('div');
            overlay.id = 'formSubmissionOverlay';
            overlay.className = 'form-submission-overlay';
            overlay.innerHTML = `
                <div class="overlay-content">
                    <div class="spinner"></div>
                    <div class="overlay-title">Saving clergy record...</div>
                    <div class="progress-container">
                        <div id="formSubmissionProgressBar" class="progress-bar"></div>
                    </div>
                    <div id="formSubmissionProgressText" class="progress-text">0%</div>
                </div>
            `;
            formContainer.appendChild(overlay);
        } else {
            console.warn('showFormSubmissionOverlay: Could not find form container');
            return;
        }
    }
    
    if (overlay) {
        overlay.classList.add('active');
        window.updateFormSubmissionProgress(10, 'Preparing form data...');
    }
};

window.hideFormSubmissionOverlay = function() {
    const overlay = document.getElementById('formSubmissionOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        window.updateFormSubmissionProgress(0, '');
    }
};

window.updateFormSubmissionProgress = function(percent, text) {
    const progressBar = document.getElementById('formSubmissionProgressBar');
    const progressText = document.getElementById('formSubmissionProgressText');
    
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    
    if (progressText) {
        progressText.textContent = text || `${percent}%`;
    }
};
