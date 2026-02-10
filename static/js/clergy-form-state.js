/**
 * Clergy Form State Management
 * Handles clearing form state when switching between clergy members
 * and dirty-state tracking (disable save until form has changes)
 */

// --- Dirty State Tracking ---

function getFormState(form) {
    if (!form) return '';
    const parts = [];
    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.name || el.type === 'hidden') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            parts.push(el.name + '=' + (el.checked ? el.value : '__unchecked__'));
        } else {
            parts.push(el.name + '=' + (el.value || ''));
        }
    });
    return parts.sort().join('|');
}

function isFormDirty(form) {
    if (!form || !form._dirtyInitialState) return false;
    return getFormState(form) !== form._dirtyInitialState;
}

function setSaveButtonEnabled(form, enabled) {
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    if (btn) btn.disabled = !enabled;
}

function attachDirtyListeners(form) {
    if (!form || form._dirtyListenersAttached) return;
    form._dirtyListenersAttached = true;

    const checkDirty = () => {
        if (isFormDirty(form)) setSaveButtonEnabled(form, true);
    };
    form._dirtyCheck = checkDirty;

    // MutationObserver for dynamic ordination/consecration rows
    const ord = document.getElementById('ordinationsContainer');
    const con = document.getElementById('consecrationsContainer');
    const ob = new MutationObserver(checkDirty);
    if (ord) ob.observe(ord, { childList: true, subtree: true });
    if (con) ob.observe(con, { childList: true, subtree: true });
}

// Event delegation: single listener on document catches all input/change (works with HTMX-swapped forms)
function initDirtyDelegation() {
    if (window._dirtyDelegationInit) return;
    window._dirtyDelegationInit = true;
    const handler = (e) => {
        const form = e.target.closest('#clergyForm');
        if (form && typeof form._dirtyCheck === 'function') form._dirtyCheck();
    };
    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
}

window.initClergyFormDirtyState = function() {
    initDirtyDelegation();
    const form = document.getElementById('clergyForm');
    if (!form) return;

    form._dirtyInitialState = getFormState(form);
    // Keep button enabled so form can submit; dirty detection can enable if it was disabled
    setSaveButtonEnabled(form, true);
    attachDirtyListeners(form);
};

window.resetClergyFormDirtyState = function() {
    const form = document.getElementById('clergyForm');
    if (!form) return;

    form._dirtyInitialState = getFormState(form);
    setSaveButtonEnabled(form, true);
};

// Function to clear form state - idempotent, safe to call multiple times
window.clearFormState = function() {
    const form = document.getElementById('clergyForm');
    if (!form) {
        return;
    }
    
    // Clear ordinations container (all dynamic entries)
    const ordinationsContainer = document.getElementById('ordinationsContainer');
    if (ordinationsContainer) {
        ordinationsContainer.innerHTML = '';
    }
    
    // Clear consecrations container (all dynamic entries)
    const consecrationsContainer = document.getElementById('consecrationsContainer');
    if (consecrationsContainer) {
        consecrationsContainer.innerHTML = '';
    }
    
    // Find and clear sample ordination entry (the one with name="ordinations[0][...]")
    const ordinationsSection = form.querySelector('#ordinationsField');
    if (ordinationsSection) {
        // Find ALL inputs/textarea with ordinations[0] in the name (more aggressive)
        const allOrdinationInputs = ordinationsSection.querySelectorAll('input, textarea, select');
        allOrdinationInputs.forEach(input => {
            const name = input.getAttribute('name') || '';
            if (name.includes('ordinations[0]')) {
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else if (input.tagName === 'SELECT') {
                    input.selectedIndex = 0;
                } else {
                    input.value = '';
                }
            }
        });
        
        // Also try to find the sample entry div and clear it more aggressively
        const sampleOrdinationDivs = ordinationsSection.querySelectorAll('div[style*="border"]');
        sampleOrdinationDivs.forEach(div => {
            const ordinationsContainer = document.getElementById('ordinationsContainer');
            // Only clear if it's NOT in the container (meaning it's the template)
            if (!ordinationsContainer || !ordinationsContainer.contains(div)) {
                const inputs = div.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    if (input.type === 'checkbox') {
                        input.checked = false;
                    } else if (input.tagName === 'SELECT') {
                        input.selectedIndex = 0;
                    } else {
                        input.value = '';
                    }
                });
            }
        });
    }
    
    // Find and clear sample consecration entry (the one with name="consecrations[0][...]")
    const consecrationsSection = form.querySelector('#consecrationsField');
    if (consecrationsSection) {
        // Find ALL inputs/textarea with consecrations[0] in the name (more aggressive)
        const allConsecrationInputs = consecrationsSection.querySelectorAll('input, textarea, select');
        allConsecrationInputs.forEach(input => {
            const name = input.getAttribute('name') || '';
            if (name.includes('consecrations[0]')) {
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else if (input.tagName === 'SELECT') {
                    input.selectedIndex = 0;
                } else {
                    input.value = '';
                }
            }
        });
        
        // Also try to find the sample entry div and clear it more aggressively
        const sampleConsecrationDivs = consecrationsSection.querySelectorAll('.consecration-entry, div[style*="border"]');
        sampleConsecrationDivs.forEach(div => {
            const consecrationsContainer = document.getElementById('consecrationsContainer');
            // Only clear if it's NOT in the container (meaning it's the template)
            if (!consecrationsContainer || !consecrationsContainer.contains(div)) {
                // Clear all inputs in this div
                const inputs = div.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    if (input.type === 'checkbox') {
                        input.checked = false;
                    } else if (input.tagName === 'SELECT') {
                        input.selectedIndex = 0;
                    } else {
                        input.value = '';
                    }
                });
                
                // Clear co-consecrators list
                const coConsecratorsList = div.querySelector('.co-consecrators-list');
                if (coConsecratorsList) {
                    coConsecratorsList.innerHTML = '';
                }
            }
        });
    }
    
    // Reset counters unconditionally
    window.ordinationCount = 1;
    window.consecrationCount = 1;
    window.coConsecratorCount = 1;
    
    // Clear autocomplete initialization flags to allow re-initialization
    const autocompleteInputs = form.querySelectorAll('input[data-autocomplete-initialized]');
    autocompleteInputs.forEach(input => {
        input.removeAttribute('data-autocomplete-initialized');
    });
    
    // Clear any global file references
    delete window.droppedFile;
    delete window.processedImageData;
};

// Clear form completely - reset all fields and containers (used after submission)
window.clearFormCompletely = function() {
    const form = document.getElementById('clergyForm');
    if (!form) {
        console.warn('clearFormCompletely: No form found');
        return;
    }
    
    // Use the shared clearFormState function for ordinations/consecrations
    if (typeof window.clearFormState === 'function') {
        window.clearFormState();
    }
    
    // Reset form (clears all form fields)
    form.reset();
    
    // Clear all text inputs (extra safety)
    const textInputs = form.querySelectorAll('input[type="text"], input[type="date"], textarea');
    textInputs.forEach(input => {
        input.value = '';
    });
    
    // Clear all select dropdowns
    const selects = form.querySelectorAll('select');
    selects.forEach(select => {
        select.selectedIndex = 0;
    });
    
    // Clear all checkboxes
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Clear image preview
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = `
            <div id="noPhotoPlaceholder" style="color: rgba(255, 255, 255, 0.6); font-size: 0.9em; padding: 1.5em; border: 1px dashed rgba(255, 255, 255, 0.3); border-radius: 4px; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100px;">
                <i class="fas fa-user" style="font-size: 1.5em; margin-bottom: 0.5em; opacity: 0.6;"></i>
                <div>No Photo</div>
                <div style="font-size: 0.8em; margin-top: 0.5em; opacity: 0.7;">Click or drag & drop to upload</div>
            </div>
        `;
    }
    
    // Clear file input
    const fileInput = document.getElementById('clergyImage');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Hide papal name field
    const papalField = document.getElementById('papalNameField');
    if (papalField) {
        papalField.style.display = 'none';
    }
    
    // Hide consecrations field
    const consecrationsField = document.getElementById('consecrationsField');
    if (consecrationsField) {
        consecrationsField.style.display = 'none';
    }
};
