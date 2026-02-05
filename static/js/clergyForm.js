// Clergy Form JavaScript functionality
// Handles dynamic form fields and form interactions


// Function to check if a rank is a bishop rank
// This will be updated to use the server-side bishop flag in the future
function isBishopRank(rankValue) {
    if (!rankValue) return false;
    const lowerRank = rankValue.toLowerCase();
    return lowerRank.includes('bishop') || 
           lowerRank.includes('pope') || 
           lowerRank.includes('archbishop') || 
           lowerRank.includes('cardinal') ||
           lowerRank.includes('patriarch');
}

// Function to handle papal name field visibility (this is the only thing this file should handle)
function handlePapalNameField(rankValue) {
    const papalNameField = document.getElementById('papalNameField');
    if (rankValue && rankValue.toLowerCase() === 'pope') {
        if (papalNameField) papalNameField.style.display = 'flex';
    } else {
        if (papalNameField) papalNameField.style.display = 'none';
        
        // Clear papal name when hiding field
        const papalName = document.getElementById('papal_name');
        if (papalName) papalName.value = '';
    }
}

// Legacy form handling function
function handleLegacyForm(rankValue, consecrationDateField, consecratorField, coConsecratorsField, papalNameField) {
    
    // Handle papal name field visibility
    if (rankValue && rankValue.toLowerCase() === 'pope') {
        if (papalNameField) papalNameField.style.display = 'flex';
    } else {
        if (papalNameField) papalNameField.style.display = 'none';
        
        // Clear papal name when hiding field
        const papalName = document.getElementById('papal_name');
        if (papalName) papalName.value = '';
    }
    
    // Handle consecration fields visibility
    if (rankValue && isBishopRank(rankValue)) {
        consecrationDateField.style.display = 'flex';
        consecratorField.style.display = 'flex';
        if (coConsecratorsField) coConsecratorsField.style.display = 'flex';
    } else {
        consecrationDateField.style.display = 'none';
        consecratorField.style.display = 'none';
        if (coConsecratorsField) coConsecratorsField.style.display = 'none';
        
        // Clear the values when hiding fields
        const dateOfConsecration = document.getElementById('date_of_consecration');
        const consecratorSearch = document.getElementById('consecrator_search');
        const consecratorId = document.getElementById('consecrator_id');
        const coConsecrators = document.getElementById('co_consecrators');
        
        if (dateOfConsecration) dateOfConsecration.value = '';
        if (consecratorSearch) consecratorSearch.value = '';
        if (consecratorId) consecratorId.value = '';
        if (coConsecrators) coConsecrators.value = '';
    }
}

// Make function globally available immediately
window.handlePapalNameField = handlePapalNameField;

// Function to initialize the clergy form (can be called manually)
function initializeClergyForm() {
    
    // Check if form has already been initialized
    if (window.clergyFormInitialized) {
        return;
    }
    
    const rankSelect = document.getElementById('rank');
    
    if (rankSelect) {
        
        // Use dynamic form functions if available, otherwise use legacy
        if (typeof window.toggleConsecrationFields === 'function') {
            window.toggleConsecrationFields(rankSelect.value);
        } else {
            // Fallback to legacy form handling
            const consecrationDateField = document.getElementById('consecrationDateField');
            const consecratorField = document.getElementById('consecratorField');
            const coConsecratorsField = document.getElementById('coConsecratorsField');
            const papalNameField = document.getElementById('papalNameField');
            
            if (consecrationDateField && consecratorField) {
                handleLegacyForm(rankSelect.value, consecrationDateField, consecratorField, coConsecratorsField, papalNameField);
            } else {
                // Just handle papal name field
                handlePapalNameField(rankSelect.value);
            }
        }
        
        // Set up change event listener if not already set
        if (!rankSelect.hasAttribute('data-clergy-form-listener')) {
            rankSelect.addEventListener('change', function() {
                
                // Use dynamic form functions if available, otherwise use legacy
                if (typeof window.toggleConsecrationFields === 'function') {
                    window.toggleConsecrationFields(this.value);
                } else {
                    // Fallback to legacy form handling
                    const consecrationDateField = document.getElementById('consecrationDateField');
                    const consecratorField = document.getElementById('consecratorField');
                    const coConsecratorsField = document.getElementById('coConsecratorsField');
                    const papalNameField = document.getElementById('papalNameField');
                    
                    if (consecrationDateField && consecratorField) {
                        handleLegacyForm(this.value, consecrationDateField, consecratorField, coConsecratorsField, papalNameField);
                    } else {
                        // Just handle papal name field
                        handlePapalNameField(this.value);
                    }
                }
            });
            rankSelect.setAttribute('data-clergy-form-listener', 'true');
        } else {
        }
        
        // Mark form as initialized
        window.clergyFormInitialized = true;
    } else {
    }
}

// Make function globally available
window.initializeClergyForm = initializeClergyForm;

// Initialize field visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeClergyForm();
});
