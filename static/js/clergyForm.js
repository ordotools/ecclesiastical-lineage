// Clergy Form JavaScript functionality
// Handles dynamic form fields and form interactions

console.log('clergyForm.js loaded');

// Function to toggle consecration fields based on rank selection
function toggleConsecrationFields(rankValue) {
    console.log('toggleConsecrationFields called with:', rankValue);
    
    // Wait for DOM to be ready if elements aren't found
    const consecrationFields = document.getElementById('consecrationFields');
    const coConsecratorsField = document.getElementById('coConsecratorsField');
    
    console.log('consecrationFields found:', !!consecrationFields);
    console.log('coConsecratorsField found:', !!coConsecratorsField);
    
    // If elements aren't found, try again after a short delay
    if (!consecrationFields || !coConsecratorsField) {
        console.log('Elements not found, retrying in 100ms');
        setTimeout(() => toggleConsecrationFields(rankValue), 100);
        return;
    }
    
    if (rankValue && rankValue.toLowerCase() === 'bishop') {
        console.log('Setting consecration fields to visible');
        consecrationFields.style.display = 'block';
        coConsecratorsField.style.display = 'block';
    } else {
        console.log('Setting consecration fields to hidden');
        consecrationFields.style.display = 'none';
        coConsecratorsField.style.display = 'none';
        
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
window.toggleConsecrationFields = toggleConsecrationFields;
console.log('toggleConsecrationFields function registered globally');

// Initialize field visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('clergyForm.js DOMContentLoaded fired');
    const rankSelect = document.getElementById('rank');
    console.log('rankSelect found:', !!rankSelect);
    
    if (rankSelect) {
        console.log('rankSelect value:', rankSelect.value);
        // Set initial visibility based on current value
        toggleConsecrationFields(rankSelect.value);
        
        // Set up change event listener if not already set
        if (!rankSelect.hasAttribute('data-clergy-form-listener')) {
            console.log('Adding change event listener to rankSelect');
            rankSelect.addEventListener('change', function() {
                console.log('rankSelect change event fired, new value:', this.value);
                toggleConsecrationFields(this.value);
            });
            rankSelect.setAttribute('data-clergy-form-listener', 'true');
        } else {
            console.log('rankSelect already has event listener');
        }
    } else {
        console.log('rankSelect not found in DOM');
    }
});
