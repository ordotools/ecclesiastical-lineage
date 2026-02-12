/**
 * Clergy Form Submission Handler
 * Handles form submission with automatic bishop creation for missing ordainers, consecrators, and co-consecrators
 */

// Global functions for form submission
window.collectBishopNames = function(form) {
    const bishopNames = new Set();
    
    
    // Collect ordaining bishops
    const ordainingBishopInputs = form.querySelectorAll('input[name*="ordaining_bishop_input"]');
    ordainingBishopInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="ordaining_bishop_id"]');
        const id = idInput ? idInput.value : '';
        if (name && !id) {
            bishopNames.add(name);
        }
    });
    
    // Collect consecrators
    const consecratorInputs = form.querySelectorAll('input[name*="consecrator_input"]');
    consecratorInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="consecrator_id"]');
        const id = idInput ? idInput.value : '';
        if (name && !id) {
            bishopNames.add(name);
        }
    });
    
    // Collect co-consecrators
    const coConsecratorInputs = form.querySelectorAll('input[name*="co_consecrators"][name*="input"]');
    coConsecratorInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="id"]');
        const id = idInput ? idInput.value : '';
        if (name && !id) {
            bishopNames.add(name);
        }
    });
    
    const result = Array.from(bishopNames);
    return result;
};

window.checkAndCreateBishops = function(bishopNames) {
        return new Promise((resolve, reject) => {
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
                    updateFormWithBishopIds(data.bishop_mapping);
                    resolve(data);
                } else {
                    reject(new Error(data.message || 'Failed to create bishops'));
                }
            })
            .catch(error => {
                reject(error);
            });
        });
};

window.allFormBishopsAreNewlyCreated = function(form, newlyCreatedIds) {
    if (!form || !Array.isArray(newlyCreatedIds) || newlyCreatedIds.length === 0) {
        return false;
    }
    const createdSet = new Set(newlyCreatedIds.map(id => Number(id)));
    const formBishopIds = new Set();
    const collect = (entries, type) => {
        const selector = type === 'consecration' ? 'input[name*="[consecrator_id]"]' : 'input[name*="[ordaining_bishop_id]"]';
        entries.forEach(entry => {
            const input = entry.querySelector(selector);
            if (input && input.value) {
                const id = parseInt(input.value, 10);
                if (!Number.isNaN(id)) formBishopIds.add(id);
            }
        });
    };
    collect(form.querySelectorAll('.ordination-entry'), 'ordination');
    collect(form.querySelectorAll('.consecration-entry'), 'consecration');
    if (formBishopIds.size === 0) return false;
    return [...formBishopIds].every(id => createdSet.has(id));
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
        if (data.success) {
            if (typeof window.resetClergyFormDirtyState === 'function') {
                window.resetClergyFormDirtyState();
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification(data.message || 'Clergy record saved successfully!', 'success');
            } else {
                alert(data.message || 'Clergy record saved successfully!');
            }
            
            const isEditorContext = form.closest('#clergyFormContainer') || form.closest('.right-panel');
            const hideOverlayAndReset = () => {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && typeof window.resetSubmitButton === 'function') {
                    window.resetSubmitButton(submitBtn, submitBtn._originalHtml || 'Save Clergy Record');
                }
                if (typeof window.hideFormSubmissionOverlay === 'function') {
                    window.hideFormSubmissionOverlay();
                }
            };
            
            if (isEditorContext && typeof window.submitFormWithData === 'function') {
                if (data.clergy_id && typeof window.softUpdateClergyListItem === 'function') {
                    window.softUpdateClergyListItem(data.clergy_id);
                }
                
                const markDeletedCheckbox = form.querySelector('input[name="mark_deleted"]');
                const wasMarkedDeleted = markDeletedCheckbox && markDeletedCheckbox.checked;
                
                if (wasMarkedDeleted && typeof window.clearFormForNewEntry === 'function') {
                    window.clearFormForNewEntry().then(hideOverlayAndReset).catch(hideOverlayAndReset);
                } else if (data.clergy_id && typeof window.switchToEditMode === 'function') {
                    window.switchToEditMode(data.clergy_id).then(hideOverlayAndReset).catch(hideOverlayAndReset);
                } else {
                    hideOverlayAndReset();
                }
                
                if (data.clergy_id && typeof window.startSpritesheetPolling === 'function') {
                    window.startSpritesheetPolling(data.clergy_id);
                }
            } else {
                setTimeout(() => {
                    if (typeof window.clearFormCompletely === 'function') {
                        window.clearFormCompletely();
                    }
                    if (typeof window.clearFormForNewEntry === 'function') {
                        window.clearFormForNewEntry();
                    } else if (typeof htmx !== 'undefined') {
                        const formContainer = form.closest('#clergyFormContainer') || form.closest('.modal-body');
                        if (formContainer) {
                            htmx.ajax('GET', form.action.replace(/\/edit\/\d+/, '').replace(/\/add/, '') || '/clergy/add', {
                                target: formContainer,
                                swap: 'innerHTML'
                            });
                        }
                    }
                }, 500);
                hideOverlayAndReset();
            }
            
            const modal = bootstrap?.Modal?.getInstance(document.getElementById('clergyFormModal'));
            if (modal) {
                setTimeout(() => {
                    modal.hide();
                    if (typeof window.setModalState === 'function') {
                        window.setModalState(false);
                    }
                }, 1000);
            } else if (data.redirect) {
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
            window.resetSubmitButton(submitBtn, submitBtn._originalHtml || 'Save Clergy Record');
        }
        if (typeof window.hideFormSubmissionOverlay === 'function') {
            window.hideFormSubmissionOverlay();
        }
    });
};

window.resetSubmitButton = function(button, originalTextOrHTML) {
    if (originalTextOrHTML && originalTextOrHTML.includes('<')) {
        button.innerHTML = originalTextOrHTML;
    } else {
        button.textContent = originalTextOrHTML || 'Save Clergy Record';
    }
    button.disabled = false;
};

// Initialize form submission handler using event delegation (works with HTMX-loaded content)
(function() {
    'use strict';
    
    // Use event delegation to catch form submissions (works with dynamically loaded forms)
    document.addEventListener('submit', function(e) {
        // Check if this is our clergy form
        if (e.target && e.target.id === 'clergyForm') {
            e.preventDefault();
            e.stopPropagation();
            
            const form = e.target;
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn._originalHtml = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                submitBtn.disabled = true;
            }

            const runStatusInheritanceValidation = (skipBishopIds) => {
                if (window.StatusInheritance && typeof window.StatusInheritance.validateFormStatus === 'function') {
                    if (submitBtn) {
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating status...';
                    }
                    return window.StatusInheritance.validateFormStatus(form, { skipBishopIds });
                }
                return Promise.resolve({ valid: true, violations: [] });
            };

            const handleValidationResult = (result) => {
                if (result && result.valid === false) {
                    const message = result.message || 'Status inheritance rules not met. Please update the ordination or consecration status.';
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(message, 'warning');
                    } else {
                        alert(message);
                    }
                    const btn = form.querySelector('button[type="submit"]');
                    if (btn && typeof window.resetSubmitButton === 'function') {
                        window.resetSubmitButton(btn, btn._originalHtml || 'Save Clergy Record');
                    }
                    return;
                }
                const btn = form.querySelector('button[type="submit"]');
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting form...';
                }
                window.submitForm(form);
            };

            const handleValidationError = (error) => {
                console.error('Status inheritance validation failed:', error);
                const message = 'Unable to validate status inheritance. Please try again.';
                if (typeof window.showNotification === 'function') {
                    window.showNotification(message, 'error');
                } else {
                    alert(message);
                }
                const btn = form.querySelector('button[type="submit"]');
                if (btn && typeof window.resetSubmitButton === 'function') {
                    window.resetSubmitButton(btn, btn._originalHtml || 'Save Clergy Record');
                }
            };

            // Collect all bishop names that need to be checked
            const bishopNames = window.collectBishopNames(form);
            
            if (bishopNames.length > 0) {
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating ' + bishopNames.length + ' bishop record' + (bishopNames.length > 1 ? 's' : '') + '...';
                }
                window.checkAndCreateBishops(bishopNames)
                    .then(async (data) => {
                        window._lastNewlyCreatedBishopIds = data.newly_created_bishop_ids || [];
                        await Promise.resolve();
                        if (window.allFormBishopsAreNewlyCreated && window.allFormBishopsAreNewlyCreated(form, window._lastNewlyCreatedBishopIds)) {
                            const btn = form.querySelector('button[type="submit"]');
                            if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting form...';
                            window.submitForm(form);
                            return;
                        }
                        return runStatusInheritanceValidation(window._lastNewlyCreatedBishopIds)
                            .then(handleValidationResult)
                            .catch(handleValidationError);
                    })
                    .catch(error => {
                        console.error('🔄 Error creating bishops:', error);
                        alert(`Error creating missing bishops: ${error.message}\n\nPlease ensure all bishop names are correct and try again.`);
                        const btn = form.querySelector('button[type="submit"]');
                        if (btn && typeof window.resetSubmitButton === 'function') {
                            window.resetSubmitButton(btn, btn._originalHtml || 'Save Clergy Record');
                        }
                    });
            } else {
                runStatusInheritanceValidation()
                    .then(handleValidationResult)
                    .catch(handleValidationError);
            }
        }
    });
})();
