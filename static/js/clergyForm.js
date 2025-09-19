// Clergy Form JavaScript functionality
// Handles dynamic form fields and form interactions

console.log('clergyForm.js loaded');

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
        console.log('Setting papal name field to visible');
        if (papalNameField) papalNameField.style.display = 'flex';
    } else {
        console.log('Setting papal name field to hidden');
        if (papalNameField) papalNameField.style.display = 'none';
        
        // Clear papal name when hiding field
        const papalName = document.getElementById('papal_name');
        if (papalName) papalName.value = '';
    }
}

// Legacy form handling function
function handleLegacyForm(rankValue, consecrationDateField, consecratorField, coConsecratorsField, papalNameField) {
    console.log('Handling legacy form for rank:', rankValue);
    
    // Handle papal name field visibility
    if (rankValue && rankValue.toLowerCase() === 'pope') {
        console.log('Setting papal name field to visible');
        if (papalNameField) papalNameField.style.display = 'flex';
    } else {
        console.log('Setting papal name field to hidden');
        if (papalNameField) papalNameField.style.display = 'none';
        
        // Clear papal name when hiding field
        const papalName = document.getElementById('papal_name');
        if (papalName) papalName.value = '';
    }
    
    // Handle consecration fields visibility
    if (rankValue && isBishopRank(rankValue)) {
        console.log('Setting legacy consecration fields to visible');
        consecrationDateField.style.display = 'flex';
        consecratorField.style.display = 'flex';
        if (coConsecratorsField) coConsecratorsField.style.display = 'flex';
    } else {
        console.log('Setting legacy consecration fields to hidden');
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
console.log('handlePapalNameField function registered globally');

// Initialize field visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('clergyForm.js DOMContentLoaded fired');
    
    // Check if form has already been initialized
    if (window.clergyFormInitialized) {
        console.log('Form already initialized, skipping');
        return;
    }
    
    const rankSelect = document.getElementById('rank');
    console.log('rankSelect found:', !!rankSelect);
    
    if (rankSelect) {
        console.log('rankSelect value:', rankSelect.value);
        
        // Use dynamic form functions if available, otherwise use legacy
        if (typeof window.toggleConsecrationFields === 'function') {
            console.log('Using dynamic form functions');
            window.toggleConsecrationFields(rankSelect.value);
        } else {
            console.log('Using legacy form handling');
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
            console.log('Adding change event listener to rankSelect');
            rankSelect.addEventListener('change', function() {
                console.log('rankSelect change event fired, new value:', this.value);
                
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
            console.log('rankSelect already has event listener');
        }
        
        // Mark form as initialized
        window.clergyFormInitialized = true;
    } else {
        console.log('rankSelect not found in DOM');
    }
});
