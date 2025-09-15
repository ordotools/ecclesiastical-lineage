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

// Function to toggle consecration fields and papal name field based on rank selection
function toggleConsecrationFields(rankValue) {
    console.log('toggleConsecrationFields called with:', rankValue);
    
    // Wait for DOM to be ready if elements aren't found
    const consecrationDateField = document.getElementById('consecrationDateField');
    const consecratorField = document.getElementById('consecratorField');
    const coConsecratorsField = document.getElementById('coConsecratorsField');
    const deathDateField = document.getElementById('deathDateField');
    const papalNameField = document.getElementById('papalNameField');
    
    console.log('consecrationDateField found:', !!consecrationDateField);
    console.log('consecratorField found:', !!consecratorField);
    console.log('coConsecratorsField found:', !!coConsecratorsField);
    console.log('deathDateField found:', !!deathDateField);
    console.log('papalNameField found:', !!papalNameField);
    
    // If elements aren't found, try again after a short delay
    if (!consecrationDateField || !consecratorField) {
        console.log('Elements not found, retrying in 100ms');
        setTimeout(() => toggleConsecrationFields(rankValue), 100);
        return;
    }
    
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
        console.log('Setting consecration fields to visible');
        consecrationDateField.style.display = 'flex';
        consecratorField.style.display = 'flex';
        if (coConsecratorsField) coConsecratorsField.style.display = 'flex';
    } else {
        console.log('Setting consecration fields to hidden');
        consecrationDateField.style.display = 'none';
        consecratorField.style.display = 'none';
        if (coConsecratorsField) coConsecratorsField.style.display = 'none';
        
        // Clear the values when hiding fields
        const dateOfConsecration = document.getElementById('date_of_consecration');
        const consecratorSearch = document.getElementById('consecrator_search');
        const consecratorId = document.getElementById('consecrator_id');
        const coConsecrators = document.getElementById('co_consecrators');
        const dateOfDeathBishop = document.getElementById('date_of_death_bishop');
        
        if (dateOfConsecration) dateOfConsecration.value = '';
        if (consecratorSearch) consecratorSearch.value = '';
        if (consecratorId) consecratorId.value = '';
        if (coConsecrators) coConsecrators.value = '';
        if (dateOfDeathBishop) dateOfDeathBishop.value = '';
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
