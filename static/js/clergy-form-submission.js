/**
 * Clergy Form Submission Handler
 * Handles form submission with automatic bishop creation for missing ordainers, consecrators, and co-consecrators
 */

// Global functions for form submission
window.collectBishopNames = function(form) {
    const bishopNames = new Set();
    
    console.log('Collecting bishop names...');
    
    // Collect ordaining bishops
    const ordainingBishopInputs = form.querySelectorAll('input[name*="ordaining_bishop_input"]');
    console.log('Found ordaining bishop inputs:', ordainingBishopInputs.length);
    ordainingBishopInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="ordaining_bishop_id"]');
        const id = idInput ? idInput.value : '';
        console.log(`Ordaining bishop: "${name}", ID: "${id}"`);
        if (name && !id) {
            bishopNames.add(name);
            console.log(`Added to bishop names: "${name}"`);
        }
    });
    
    // Collect consecrators
    const consecratorInputs = form.querySelectorAll('input[name*="consecrator_input"]');
    console.log('Found consecrator inputs:', consecratorInputs.length);
    consecratorInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="consecrator_id"]');
        const id = idInput ? idInput.value : '';
        console.log(`Consecrator: "${name}", ID: "${id}"`);
        if (name && !id) {
            bishopNames.add(name);
            console.log(`Added to bishop names: "${name}"`);
        }
    });
    
    // Collect co-consecrators
    const coConsecratorInputs = form.querySelectorAll('input[name*="co_consecrators"][name*="input"]');
    console.log('Found co-consecrator inputs:', coConsecratorInputs.length);
    coConsecratorInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="id"]');
        const id = idInput ? idInput.value : '';
        console.log(`Co-consecrator: "${name}", ID: "${id}"`);
        if (name && !id) {
            bishopNames.add(name);
            console.log(`Added to bishop names: "${name}"`);
        }
    });
    
    const result = Array.from(bishopNames);
    console.log('Final bishop names to check:', result);
    return result;
};

window.checkAndCreateBishops = function(bishopNames) {
        return new Promise((resolve, reject) => {
            // Send AJAX request to check and create bishops
            fetch('/api/check-and-create-bishops', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    bishop_names: bishopNames
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update form with the created bishop IDs
                    updateFormWithBishopIds(data.bishop_mapping);
                    resolve();
                } else {
                    reject(new Error(data.message || 'Failed to create bishops'));
                }
            })
            .catch(error => {
                reject(error);
            });
        });
};

window.updateFormWithBishopIds = function(bishopMapping) {
    const form = document.getElementById('clergyForm');
    if (!form) return;
    
    // Update ordaining bishops
    const ordainingBishopInputs = form.querySelectorAll('input[name*="ordaining_bishop_input"]');
        ordainingBishopInputs.forEach(input => {
            const name = input.value.trim();
            if (bishopMapping[name]) {
                const idInput = input.parentElement.querySelector('input[name*="ordaining_bishop_id"]');
                idInput.value = bishopMapping[name];
            }
        });
        
        // Update consecrators
        const consecratorInputs = form.querySelectorAll('input[name*="consecrator_input"]');
        consecratorInputs.forEach(input => {
            const name = input.value.trim();
            if (bishopMapping[name]) {
                const idInput = input.parentElement.querySelector('input[name*="consecrator_id"]');
                idInput.value = bishopMapping[name];
            }
        });
        
        // Update co-consecrators
        const coConsecratorInputs = form.querySelectorAll('input[name*="co_consecrators"][name*="input"]');
        coConsecratorInputs.forEach(input => {
            const name = input.value.trim();
            if (bishopMapping[name]) {
                const idInput = input.parentElement.querySelector('input[name*="id"]');
                idInput.value = bishopMapping[name];
            }
        });
};

window.submitForm = function(form) {
    // Accept form parameter or find it
    if (!form) {
        form = document.getElementById('clergyForm');
    }
    if (!form) {
        console.error('submitForm: No form found');
        return;
    }
    
    // Show overlay and progress using global functions
    if (typeof window.showFormSubmissionOverlay === 'function') {
        window.showFormSubmissionOverlay();
        window.updateFormSubmissionProgress(20, 'Submitting form...');
    }
    
    // Create FormData from the form
    const formData = new FormData(form);
    
    // Add dropped file if exists
    if (window.droppedFile) {
        console.log('Adding globally stored file to FormData:', window.droppedFile);
        formData.append('clergy_image', window.droppedFile);
    }
    
    // Add processed image data if exists
    if (window.processedImageData) {
        formData.append('image_data_json', JSON.stringify(window.processedImageData));
    }
    
    if (typeof window.updateFormSubmissionProgress === 'function') {
        window.updateFormSubmissionProgress(40, 'Uploading data...');
    }
    
    // Submit the form
    fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (typeof window.updateFormSubmissionProgress === 'function') {
            window.updateFormSubmissionProgress(70, 'Processing response...');
        }
        console.log('Response status:', response.status);
        
        if (response.ok) {
            return response.json();
        } else {
            throw new Error(`Form submission failed with status ${response.status}`);
        }
    })
    .then(data => {
        if (typeof window.updateFormSubmissionProgress === 'function') {
            window.updateFormSubmissionProgress(90, 'Finalizing...');
        }
        console.log('Response data:', data);
        if (data.success) {
            // Show success message
            if (typeof window.showNotification === 'function') {
                window.showNotification(data.message || 'Clergy record saved successfully!', 'success');
            } else {
                alert(data.message || 'Clergy record saved successfully!');
            }
            
            // Check if we're in editor context and use editor-specific handlers
            const isEditorContext = form.closest('#clergyFormContainer') || form.closest('.right-panel');
            
            if (isEditorContext && typeof window.submitFormWithData === 'function') {
                // Editor-specific handling: use the editor's submission handler for soft updates
                // But we've already submitted, so just handle the success response
                if (data.clergy_id && typeof window.softUpdateClergyListItem === 'function') {
                    window.softUpdateClergyListItem(data.clergy_id);
                }
                
                // Check if the record was marked for deletion
                const markDeletedCheckbox = form.querySelector('input[name="mark_deleted"]');
                const wasMarkedDeleted = markDeletedCheckbox && markDeletedCheckbox.checked;
                
                if (wasMarkedDeleted) {
                    // Record was marked for deletion - clear form and switch to add mode
                    if (typeof window.clearFormForNewEntry === 'function') {
                        window.clearFormForNewEntry();
                    }
                } else if (data.clergy_id && typeof window.switchToEditMode === 'function') {
                    // Normal save - switch to edit mode and refresh the form
                    window.switchToEditMode(data.clergy_id);
                }
                
                // Start polling for spritesheet completion if needed
                if (data.clergy_id && typeof window.startSpritesheetPolling === 'function') {
                    window.startSpritesheetPolling(data.clergy_id);
                }
            } else {
                // Non-editor context: use standard form clearing
                setTimeout(() => {
                    if (typeof window.clearFormCompletely === 'function') {
                        window.clearFormCompletely();
                    }
                    
                    // Trigger "add new" event - reload form in add mode
                    if (typeof window.clearFormForNewEntry === 'function') {
                        window.clearFormForNewEntry();
                    } else if (typeof htmx !== 'undefined') {
                        // Fallback: reload form via HTMX
                        const formContainer = form.closest('#clergyFormContainer') || form.closest('.modal-body');
                        if (formContainer) {
                            htmx.ajax('GET', form.action.replace(/\/edit\/\d+/, '').replace(/\/add/, '') || '/clergy/add', {
                                target: formContainer,
                                swap: 'innerHTML'
                            });
                        }
                    }
                }, 500);
            }
            
            // Close the modal if it exists
            const modal = bootstrap?.Modal?.getInstance(document.getElementById('clergyFormModal'));
            if (modal) {
                setTimeout(() => {
                    modal.hide();
                    // Notify UI system that modal is closed
                    if (typeof window.setModalState === 'function') {
                        window.setModalState(false);
                    }
                }, 1000);
            } else if (data.redirect) {
                // Only redirect if not in modal
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1000);
            }
        } else {
            throw new Error(data.message || 'Form submission failed');
        }
    })
    .catch(error => {
        console.error('Form submission error:', error);
        if (typeof window.showNotification === 'function') {
            window.showNotification('Error submitting form: ' + error.message, 'error');
        } else {
            alert('Error submitting form: ' + error.message);
        }
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && typeof window.resetSubmitButton === 'function') {
            window.resetSubmitButton(submitBtn, 'Save Clergy Record');
        }
    })
    .finally(() => {
        // Hide overlay
        if (typeof window.hideFormSubmissionOverlay === 'function') {
            window.hideFormSubmissionOverlay();
        }
    });
};

window.resetSubmitButton = function(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
};

// Initialize form submission handler using event delegation (works with HTMX-loaded content)
(function() {
    'use strict';
    
    // Use event delegation to catch form submissions (works with dynamically loaded forms)
    document.addEventListener('submit', function(e) {
        // Check if this is our clergy form
        if (e.target && e.target.id === 'clergyForm') {
            console.log('Clergy form submit event caught via delegation!');
            e.preventDefault();
            e.stopPropagation();
            
            const form = e.target;
            
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.textContent : 'Save';
            if (submitBtn) {
                submitBtn.textContent = 'Processing...';
                submitBtn.disabled = true;
            }

            // Collect all bishop names that need to be checked
            const bishopNames = window.collectBishopNames(form);
            
            if (bishopNames.length > 0) {
                console.log('🔄 Found bishops to create:', bishopNames);
                // Show user feedback about bishop creation
                if (submitBtn) {
                    submitBtn.textContent = `Creating ${bishopNames.length} bishop record${bishopNames.length > 1 ? 's' : ''}...`;
                }
                
                // Check and create missing bishops
                window.checkAndCreateBishops(bishopNames)
                    .then(() => {
                        console.log('🔄 Bishop creation successful, proceeding with form submission');
                        // Update button text for final submission
                        if (submitBtn) {
                            submitBtn.textContent = 'Submitting form...';
                        }
                        // Submit the form after bishops are created
                        window.submitForm(form);
                    })
                    .catch(error => {
                        console.error('🔄 Error creating bishops:', error);
                        alert(`Error creating missing bishops: ${error.message}\n\nPlease ensure all bishop names are correct and try again.`);
                        if (submitBtn && typeof window.resetSubmitButton === 'function') {
                            window.resetSubmitButton(submitBtn, originalText);
                        }
                    });
            } else {
                console.log('🔄 No bishops to create, submitting form directly');
                // No bishops to check, submit directly
                window.submitForm(form);
            }
        }
    });
})();
