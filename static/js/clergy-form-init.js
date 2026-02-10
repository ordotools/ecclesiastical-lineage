/**
 * Clergy Form Initialization
 * Handles form initialization and clearing when HTMX loads content
 */

// Function to initialize the embedded form functionality
window.initializeEmbeddedFormScript = function() {
    // Initialize dirty-state tracking (disable save until form has changes)
    if (typeof window.initClergyFormDirtyState === 'function') {
        window.initClergyFormDirtyState();
    }
    // NOTE: We do NOT clear form state here because:
    // 1. Clearing is already done in selectClergy() BEFORE the HTMX request
    // 2. If we clear here, we would clear the newly loaded data that was just populated
    // 3. The form has already been populated with the correct data by populateExistingOrdinations/consecrations
    
    // The rest of initialization happens in the template's embedded script
};

// Initialize on DOMContentLoaded as fallback (for non-HTMX loads)
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('clergyForm');
    if (form) {
        window.initializeEmbeddedFormScript();
    }
});
