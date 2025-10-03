/**
 * Location Form Panel JavaScript
 * Handles address geocoding, country/pastor dropdowns, and form interactions
 */

class LocationFormManager {
    constructor() {
        this.geocodingTimeout = null;
        this.countries = [];
        this.clergy = [];
        this.init();
    }

    init() {
        console.log('LocationFormManager init() called');
        this.loadCountries();
        this.loadClergy();
        this.setupAutocomplete();
        this.setupGeocoding();
    }

    async loadCountries() {
        console.log('Loading countries...');
        try {
            const response = await fetch('/api/countries');
            console.log('Countries API response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Countries API data:', data);
                if (data.success) {
                    this.countries = data.countries || [];
                    console.log('Loaded countries:', this.countries.length);
                    // Autocomplete setup is called in init()
                } else {
                    console.error('Error loading countries:', data.error);
                }
            } else {
                console.error('Failed to load countries:', response.status);
            }
        } catch (error) {
            console.error('Error loading countries:', error);
        }
    }

    async loadClergy() {
        console.log('Loading clergy...');
        try {
            const response = await fetch('/api/living-clergy');
            console.log('Clergy API response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Clergy API data:', data);
                if (data.success) {
                    this.clergy = data.clergy || [];
                    console.log('Loaded clergy:', this.clergy.length);
                    // Autocomplete setup is called in init()
                } else {
                    console.error('Error loading clergy:', data.error);
                }
            } else {
                console.error('Failed to load clergy:', response.status);
            }
        } catch (error) {
            console.error('Error loading clergy:', error);
        }
    }

    setupAutocomplete() {
        console.log('Setting up autocomplete functionality');
        
        // Setup country autocomplete
        this.setupCountryAutocomplete();
        
        // Setup pastor autocomplete
        this.setupPastorAutocomplete();
    }

    setupCountryAutocomplete() {
        const countryInput = document.getElementById('country');
        const suggestionsDiv = document.getElementById('country-suggestions');
        
        if (!countryInput || !suggestionsDiv) {
            console.error('Country input or suggestions div not found');
            return;
        }

        let selectedIndex = -1;
        let filteredCountries = [];

        countryInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 2) {
                this.hideSuggestions('country-suggestions');
                return;
            }

            // Filter countries
            filteredCountries = this.countries.filter(country => 
                country.name.toLowerCase().includes(query)
            ).slice(0, 10); // Limit to 10 suggestions

            this.showSuggestions('country-suggestions', filteredCountries, (selectedCountry) => {
                countryInput.value = selectedCountry.name;
                this.hideSuggestions('country-suggestions');
            });
        });

        countryInput.addEventListener('keydown', (e) => {
            this.handleSuggestionNavigation(e, 'country-suggestions', filteredCountries, (selectedCountry) => {
                countryInput.value = selectedCountry.name;
                this.hideSuggestions('country-suggestions');
            });
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!countryInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                this.hideSuggestions('country-suggestions');
            }
        });
    }

    setupPastorAutocomplete() {
        const pastorInput = document.getElementById('pastor_name');
        const suggestionsDiv = document.getElementById('pastor-suggestions');
        
        if (!pastorInput || !suggestionsDiv) {
            console.error('Pastor input or suggestions div not found');
            return;
        }

        let selectedIndex = -1;
        let filteredClergy = [];

        pastorInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 2) {
                this.hideSuggestions('pastor-suggestions');
                return;
            }

            // Filter clergy
            filteredClergy = this.clergy.filter(person => 
                person.name.toLowerCase().includes(query) ||
                (person.rank && person.rank.toLowerCase().includes(query)) ||
                (person.organization && person.organization.toLowerCase().includes(query))
            ).slice(0, 10); // Limit to 10 suggestions

            this.showSuggestions('pastor-suggestions', filteredClergy, (selectedPerson) => {
                pastorInput.value = selectedPerson.name;
                this.hideSuggestions('pastor-suggestions');
            });
        });

        pastorInput.addEventListener('keydown', (e) => {
            this.handleSuggestionNavigation(e, 'pastor-suggestions', filteredClergy, (selectedPerson) => {
                pastorInput.value = selectedPerson.name;
                this.hideSuggestions('pastor-suggestions');
            });
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!pastorInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                this.hideSuggestions('pastor-suggestions');
            }
        });
    }

    showSuggestions(suggestionsId, items, onSelect) {
        const suggestionsDiv = document.getElementById(suggestionsId);
        if (!suggestionsDiv) return;

        suggestionsDiv.innerHTML = '';
        
        if (items.length === 0) {
            this.hideSuggestions(suggestionsId);
            return;
        }

        items.forEach((item, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.style.cssText = `
                padding: 0.5em 0.75em;
                cursor: pointer;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.9em;
            `;
            
            // Different display for countries vs clergy
            if (suggestionsId === 'country-suggestions') {
                suggestionItem.textContent = item.name;
            } else {
                const displayText = item.organization ? 
                    `${item.name} (${item.rank}) - ${item.organization}` : 
                    `${item.name} (${item.rank})`;
                suggestionItem.textContent = displayText;
            }

            suggestionItem.addEventListener('mouseenter', () => {
                suggestionItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });

            suggestionItem.addEventListener('mouseleave', () => {
                suggestionItem.style.backgroundColor = 'transparent';
            });

            suggestionItem.addEventListener('click', () => {
                onSelect(item);
            });

            suggestionsDiv.appendChild(suggestionItem);
        });

        suggestionsDiv.style.display = 'block';
    }

    hideSuggestions(suggestionsId) {
        const suggestionsDiv = document.getElementById(suggestionsId);
        if (suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
        }
    }

    handleSuggestionNavigation(event, suggestionsId, items, onSelect) {
        const suggestionsDiv = document.getElementById(suggestionsId);
        if (!suggestionsDiv || suggestionsDiv.style.display === 'none') return;

        const suggestionItems = suggestionsDiv.querySelectorAll('.suggestion-item');
        let selectedIndex = -1;

        // Find currently selected item
        suggestionItems.forEach((item, index) => {
            if (item.style.backgroundColor === 'rgba(255, 255, 255, 0.1)') {
                selectedIndex = index;
            }
        });

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, suggestionItems.length - 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                break;
            case 'Enter':
                event.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    onSelect(items[selectedIndex]);
                }
                return;
            case 'Escape':
                this.hideSuggestions(suggestionsId);
                return;
            default:
                return;
        }

        // Update visual selection
        suggestionItems.forEach((item, index) => {
            if (index === selectedIndex) {
                item.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            } else {
                item.style.backgroundColor = 'transparent';
            }
        });
    }


    setupGeocoding() {
        const addressFields = ['street_address', 'city', 'state_province', 'country', 'postal_code'];
        
        addressFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field) {
                field.addEventListener('input', () => {
                    this.debouncedGeocode();
                });
            }
        });
    }

    debouncedGeocode() {
        // Clear existing timeout
        if (this.geocodingTimeout) {
            clearTimeout(this.geocodingTimeout);
        }

        // Set new timeout
        this.geocodingTimeout = setTimeout(() => {
            this.performGeocoding();
        }, 1000); // Wait 1 second after user stops typing
    }

    async performGeocoding() {
        const addressParts = this.buildAddressString();
        
        if (addressParts.length < 2) {
            this.hideCoordinates();
            return;
        }

        try {
            this.showGeocodingStatus('Searching for coordinates...', 'info');
            
            const response = await fetch('/api/geocode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: addressParts.join(', ') })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update hidden coordinate fields
                document.getElementById('latitude').value = data.latitude;
                document.getElementById('longitude').value = data.longitude;
                
                // Show coordinates
                this.showCoordinates(data.latitude, data.longitude);
                
                // Auto-fill missing fields if they're empty
                this.autoFillAddressFields(data);
                
                this.showGeocodingStatus(`Coordinates found! Confidence: ${Math.round(data.confidence * 100)}%`, 'success');
            } else {
                this.hideCoordinates();
                this.showGeocodingStatus(`Geocoding failed: ${data.error || 'Address not found'}`, 'warning');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            this.hideCoordinates();
            this.showGeocodingStatus('Geocoding failed: Network error', 'danger');
        }
    }

    buildAddressString() {
        const parts = [];
        
        const street = document.getElementById('street_address')?.value?.trim();
        const city = document.getElementById('city')?.value?.trim();
        const state = document.getElementById('state_province')?.value?.trim();
        const country = document.getElementById('country')?.value?.trim();
        const postal = document.getElementById('postal_code')?.value?.trim();

        if (street) parts.push(street);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (postal) parts.push(postal);
        if (country) parts.push(country);

        return parts;
    }

    autoFillAddressFields(data) {
        // Auto-fill city if empty
        if (!document.getElementById('city').value && data.city) {
            document.getElementById('city').value = data.city;
        }
        
        // Auto-fill state/province if empty
        if (!document.getElementById('state_province').value && data.state) {
            document.getElementById('state_province').value = data.state;
        }
        
        // Auto-fill country if empty
        if (!document.getElementById('country').value && data.country) {
            document.getElementById('country').value = data.country;
        }
        
        // Auto-fill postal code if empty
        if (!document.getElementById('postal_code').value && data.postcode) {
            document.getElementById('postal_code').value = data.postcode;
        }
    }

    showCoordinates(lat, lng) {
        const display = document.getElementById('coordinates-display');
        const text = document.getElementById('coordinates-text');
        
        if (display && text) {
            text.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            display.style.display = 'block';
        }
    }

    hideCoordinates() {
        const display = document.getElementById('coordinates-display');
        if (display) {
            display.style.display = 'none';
        }
    }

    showGeocodingStatus(message, type = 'info') {
        const statusDiv = document.getElementById('geocoding-status');
        const messageSpan = document.getElementById('geocoding-message');
        
        if (!statusDiv || !messageSpan) return;

        statusDiv.className = `alert alert-${type}`;
        statusDiv.style.backgroundColor = type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 
                                        type === 'warning' ? 'rgba(255, 193, 7, 0.2)' : 
                                        type === 'danger' ? 'rgba(244, 67, 54, 0.2)' : 
                                        'rgba(33, 150, 243, 0.2)';
        statusDiv.style.borderColor = type === 'success' ? 'rgba(76, 175, 80, 0.5)' : 
                                     type === 'warning' ? 'rgba(255, 193, 7, 0.5)' : 
                                     type === 'danger' ? 'rgba(244, 67, 54, 0.5)' : 
                                     'rgba(33, 150, 243, 0.5)';
        messageSpan.textContent = message;
        statusDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Function to clear the location form - make it globally available
window.clearLocationForm = function() {
    const form = document.getElementById('locationForm');
    if (form) {
        form.reset();
        // Hide coordinates display
        const display = document.getElementById('coordinates-display');
        if (display) {
            display.style.display = 'none';
        }
        // Hide suggestions
        const countrySuggestions = document.getElementById('country-suggestions');
        const pastorSuggestions = document.getElementById('pastor-suggestions');
        if (countrySuggestions) countrySuggestions.style.display = 'none';
        if (pastorSuggestions) pastorSuggestions.style.display = 'none';
    }
};

// Function to handle form submission
window.handleLocationFormSubmit = function(event) {
    event.preventDefault();
    
    const form = document.getElementById('locationForm');
    if (!form) return false;
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    // Prepare form data
    const formData = new FormData(form);
    
    // Determine the correct endpoint based on whether we're editing or adding
    const isEditing = form.action.includes('/edit');
    const endpoint = isEditing ? form.action : '/locations/add';
    
    // Submit via AJAX
    fetch(endpoint, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Success - handle both add and edit cases
            console.log('Location saved successfully:', data);
            const location = data.location;
            
            if (isEditing) {
                // For editing, update the existing chapel in the list and globe
                updateChapelInList(location);
                updateChapelInGlobe(location);
                showSuccessMessage(data.message || 'Chapel location updated successfully!');
            } else {
                // For adding, add new chapel to list and globe
                addChapelToList(location);
                addChapelToGlobe(location);
                clearLocationForm();
                showSuccessMessage(data.message || 'Chapel location added successfully!');
            }
        } else {
            // Error - show error message
            console.error('Error saving location:', data.message);
            showErrorMessage(data.message || 'Error saving location. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error submitting form:', error);
        showErrorMessage('Error submitting form. Please try again.');
    })
    .finally(() => {
        // Restore button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    });
    
    return false;
};

// Function to refresh editor panels
function refreshEditorPanels() {
    console.log('Refreshing editor panels...');
    
    // Use a small delay to ensure the database transaction is committed
    setTimeout(() => {
        // Refresh clergy list panel (left panel)
        const clergyListPanel = document.querySelector('#clergy-list-panel-content');
        if (clergyListPanel && typeof htmx !== 'undefined') {
            console.log('Refreshing clergy list panel...');
            htmx.ajax('GET', '/editor/clergy-list', {
                target: clergyListPanel,
                swap: 'innerHTML'
            });
        }
        
        // Refresh chapel list panel (left panel)
        const chapelListPanel = document.querySelector('#chapel-list-panel-content');
        if (chapelListPanel && typeof htmx !== 'undefined') {
            console.log('Refreshing chapel list panel...');
            htmx.ajax('GET', '/editor/chapel-list', {
                target: chapelListPanel,
                swap: 'innerHTML'
            });
        }
        
        // Refresh visualization panel (center panel)
        const visualizationPanel = document.querySelector('#visualization-panel-content');
        if (visualizationPanel && typeof htmx !== 'undefined') {
            console.log('Refreshing visualization panel...');
            htmx.ajax('GET', '/editor/visualization', {
                target: visualizationPanel,
                swap: 'innerHTML'
            });
        }
        
        // Refresh globe view if it's visible (center panel)
        const globeViewPanel = document.querySelector('#globe-view-panel-content');
        if (globeViewPanel && typeof htmx !== 'undefined') {
            console.log('Refreshing globe view panel...');
            htmx.ajax('GET', '/editor/globe-view', {
                target: globeViewPanel,
                swap: 'innerHTML'
            });
        }
        
        // Also try to refresh any panels with hx-get attributes
        const panelsWithHxGet = document.querySelectorAll('[hx-get]');
        panelsWithHxGet.forEach(panel => {
            const hxGet = panel.getAttribute('hx-get');
            if (hxGet && (hxGet.includes('clergy-list') || hxGet.includes('chapel-list') || hxGet.includes('visualization') || hxGet.includes('globe-view'))) {
                console.log(`Refreshing panel with hx-get: ${hxGet}`);
                htmx.ajax('GET', hxGet, {
                    target: panel,
                    swap: 'innerHTML'
                });
            }
        });
    }, 500); // 500ms delay
}

// Function to show success message
function showSuccessMessage(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    } else {
        // Fallback to alert if notification system not available
        alert(message);
    }
}

// Function to show error message
function showErrorMessage(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else {
        // Fallback to alert if notification system not available
        alert(message);
    }
}

// Initialize when DOM is loaded or when the form is dynamically loaded
function initializeLocationForm() {
    // Check if the form exists and we haven't already initialized
    const form = document.getElementById('locationForm');
    if (form && !window.locationFormManager) {
        console.log('Initializing LocationFormManager');
        window.locationFormManager = new LocationFormManager();
        return true;
    }
    return false;
}

// Also check for forms with the data attribute
function checkForLocationForms() {
    const forms = document.querySelectorAll('[data-init-location-form="true"]');
    if (forms.length > 0 && !window.locationFormManager) {
        console.log('Found location form with data attribute, initializing...');
        window.locationFormManager = new LocationFormManager();
        return true;
    }
    return false;
}

// Make the functions globally available
window.initializeLocationForm = initializeLocationForm;
window.checkForLocationForms = checkForLocationForms;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking for location form...');
    initializeLocationForm();
});

// Also initialize when HTMX loads content
document.addEventListener('htmx:afterSwap', function(event) {
    if (event.target.querySelector('#locationForm')) {
        console.log('Location form loaded via HTMX, initializing...');
        initializeLocationForm();
    }
});

// Simple periodic check for dynamically loaded content
let checkCount = 0;
const maxChecks = 50; // Check for 5 seconds (50 * 100ms)

function checkForForm() {
    checkCount++;
    if (initializeLocationForm() || checkForLocationForms()) {
        // Form found and initialized, stop checking
        clearInterval(intervalId);
        console.log('Location form found and initialized, stopping checks');
    } else if (checkCount >= maxChecks) {
        // Stop checking after max attempts
        clearInterval(intervalId);
        console.log('Stopped checking for location form after', maxChecks, 'attempts');
    }
}

let intervalId = setInterval(checkForForm, 100);

// Function to add a new chapel to the chapel list dynamically
function addChapelToList(location) {
    console.log('Adding chapel to list:', location);
    
    const chapelList = document.getElementById('chapelList');
    if (!chapelList) {
        console.warn('Chapel list container not found');
        return;
    }
    
    // Check if this is a church-related location type
    const churchTypes = ['church', 'cathedral', 'chapel', 'monastery', 'seminary', 'abbey'];
    if (!churchTypes.includes(location.location_type)) {
        console.log('Location type not suitable for chapel list:', location.location_type);
        return;
    }
    
    // Create the chapel item HTML
    const chapelItem = document.createElement('div');
    chapelItem.className = 'chapel-item';
    chapelItem.setAttribute('data-location-id', location.id);
    chapelItem.style.cssText = 'padding: 0.5em; margin-bottom: 0.5em; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; cursor: pointer; transition: background-color 0.2s ease;';
    chapelItem.setAttribute('onmouseover', "this.style.backgroundColor='rgba(255, 255, 255, 0.1)'");
    chapelItem.setAttribute('onmouseout', "this.style.backgroundColor='rgba(255, 255, 255, 0.05)'");
    chapelItem.setAttribute('onclick', `selectChapel(${location.id})`);
    
    chapelItem.innerHTML = `
        <div style="font-weight: 500; color: rgba(255, 255, 255, 0.9); font-size: 0.85em; margin-bottom: 0.2em;">
            ${location.name}
        </div>
        <div style="font-size: 0.75em; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.1em;">
            ${location.location_type.charAt(0).toUpperCase() + location.location_type.slice(1)} • ${location.city || 'Unknown City'}${location.country ? ', ' + location.country : ''}
        </div>
        ${location.pastor_name ? `<div style="font-size: 0.7em; color: rgba(255, 255, 255, 0.5);">Pastor: ${location.pastor_name}</div>` : ''}
        ${location.organization ? `<div style="font-size: 0.7em; color: rgba(255, 255, 255, 0.5);">Organization: ${location.organization}</div>` : ''}
    `;
    
    // Add to the beginning of the list
    chapelList.insertBefore(chapelItem, chapelList.firstChild);
    
    // Update search functionality for the new item
    const searchInput = document.getElementById('chapelSearchInput');
    if (searchInput) {
        // Re-attach search functionality to all items
        attachSearchFunctionality();
    }
    
    console.log('Chapel added to list successfully');
}

// Function to add a new chapel to the globe visualization dynamically
function addChapelToGlobe(location) {
    console.log('Adding chapel to globe:', location);
    
    // Check if location has coordinates
    if (!location.latitude || !location.longitude) {
        console.log('Location has no coordinates, skipping globe addition');
        return;
    }
    
    // Check if this is a church-related location type
    const churchTypes = ['church', 'cathedral', 'chapel', 'monastery', 'seminary', 'abbey'];
    if (!churchTypes.includes(location.location_type)) {
        console.log('Location type not suitable for globe:', location.location_type);
        return;
    }
    
    // Determine color based on location type
    const colorMap = {
        'church': '#27ae60',      // Green for churches
        'cathedral': '#9b59b6',   // Purple for cathedrals
        'chapel': '#e74c3c',      // Red for chapels
        'monastery': '#f39c12',   // Orange for monasteries
        'seminary': '#1abc9c',    // Teal for seminaries
        'abbey': '#8e44ad'        // Dark purple for abbeys
    };
    
    const color = colorMap[location.location_type] || '#95a5a6';
    
    // Create location data object
    const locationData = {
        id: location.id,
        name: location.name,
        location_type: location.location_type,
        pastor_name: location.pastor_name,
        organization: location.organization,
        address: location.address,
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        color: color,
        notes: location.notes
    };
    
    // Add to global nodes data if it exists
    if (window.nodesData) {
        window.nodesData.push(locationData);
    }
    
    // Check if we're in globe view mode
    const isGlobeViewActive = document.querySelector('#globe-container') !== null;
    console.log('Is globe view active:', isGlobeViewActive);
    
    if (isGlobeViewActive) {
        // Try to add to different visualization types
        if (window.chapelGlobeOverlay && typeof window.chapelGlobeOverlay.addChapel === 'function') {
            console.log('Adding to chapel globe overlay');
            window.chapelGlobeOverlay.addChapel(locationData);
        }
        
        if (window.geographicVisualization && typeof window.geographicVisualization.addSingleLocationNode === 'function') {
            console.log('Adding to geographic visualization');
            window.geographicVisualization.addSingleLocationNode(locationData);
        } else if (window.geographicVisualization && typeof window.geographicVisualization.addLocationNodes === 'function') {
            console.log('Refreshing all location nodes in geographic visualization');
            window.geographicVisualization.addLocationNodes();
        }
    } else {
        console.log('Globe view not active, skipping globe update');
    }
    
    console.log('Chapel added to globe successfully');
}

// Function to attach search functionality to chapel items
function attachSearchFunctionality() {
    const searchInput = document.getElementById('chapelSearchInput');
    if (!searchInput) return;
    
    // Remove existing event listener to avoid duplicates
    searchInput.removeEventListener('input', window.handleChapelSearch);
    searchInput.addEventListener('input', window.handleChapelSearch);
}

// Function to handle chapel search
window.handleChapelSearch = function(event) {
    const query = event.target.value.toLowerCase();
    const chapelItems = document.querySelectorAll('.chapel-item');
    
    chapelItems.forEach(item => {
        const name = item.querySelector('div').textContent.toLowerCase();
        const location = item.querySelector('div:nth-child(2)').textContent.toLowerCase();
        const pastor = item.querySelector('div:nth-child(3)') ? item.querySelector('div:nth-child(3)').textContent.toLowerCase() : '';
        const organization = item.querySelector('div:nth-child(4)') ? item.querySelector('div:nth-child(4)').textContent.toLowerCase() : '';
        
        if (name.includes(query) || location.includes(query) || pastor.includes(query) || organization.includes(query)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Function to update an existing chapel in the chapel list
function updateChapelInList(location) {
    console.log('Updating chapel in list:', location);
    
    const chapelItem = document.querySelector(`[data-location-id="${location.id}"]`);
    if (!chapelItem) {
        console.warn('Chapel item not found in list for update');
        return;
    }
    
    // Update the chapel item content
    chapelItem.innerHTML = `
        <div style="font-weight: 500; color: rgba(255, 255, 255, 0.9); font-size: 0.85em; margin-bottom: 0.2em;">
            ${location.name}
        </div>
        <div style="font-size: 0.75em; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.1em;">
            ${location.location_type.charAt(0).toUpperCase() + location.location_type.slice(1)} • ${location.city || 'Unknown City'}${location.country ? ', ' + location.country : ''}
        </div>
        ${location.pastor_name ? `<div style="font-size: 0.7em; color: rgba(255, 255, 255, 0.5);">Pastor: ${location.pastor_name}</div>` : ''}
        ${location.organization ? `<div style="font-size: 0.7em; color: rgba(255, 255, 255, 0.5);">Organization: ${location.organization}</div>` : ''}
    `;
    
    console.log('Chapel updated in list successfully');
}

// Function to update an existing chapel in the globe visualization
function updateChapelInGlobe(location) {
    console.log('Updating chapel in globe:', location);
    
    // Check if location has coordinates
    if (!location.latitude || !location.longitude) {
        console.log('Location has no coordinates, skipping globe update');
        return;
    }
    
    // Check if this is a church-related location type
    const churchTypes = ['church', 'cathedral', 'chapel', 'monastery', 'seminary', 'abbey'];
    if (!churchTypes.includes(location.location_type)) {
        console.log('Location type not suitable for globe:', location.location_type);
        return;
    }
    
    // Determine color based on location type
    const colorMap = {
        'church': '#27ae60',      // Green for churches
        'cathedral': '#9b59b6',   // Purple for cathedrals
        'chapel': '#e74c3c',      // Red for chapels
        'monastery': '#f39c12',   // Orange for monasteries
        'seminary': '#1abc9c',    // Teal for seminaries
        'abbey': '#8e44ad'        // Dark purple for abbeys
    };
    
    const color = colorMap[location.location_type] || '#95a5a6';
    
    // Create location data object
    const locationData = {
        id: location.id,
        name: location.name,
        location_type: location.location_type,
        pastor_name: location.pastor_name,
        organization: location.organization,
        address: location.address,
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        color: color,
        notes: location.notes
    };
    
    // Update in global nodes data if it exists
    if (window.nodesData) {
        const index = window.nodesData.findIndex(node => node.id === location.id);
        if (index !== -1) {
            window.nodesData[index] = locationData;
        }
    }
    
    // Check if we're in globe view mode
    const isGlobeViewActive = document.querySelector('#globe-container') !== null;
    console.log('Is globe view active for update:', isGlobeViewActive);
    
    if (isGlobeViewActive) {
        // Try to update in different visualization types
        if (window.chapelGlobeOverlay && typeof window.chapelGlobeOverlay.updateChapel === 'function') {
            console.log('Updating in chapel globe overlay');
            window.chapelGlobeOverlay.updateChapel(locationData);
        }
        
        if (window.geographicVisualization && typeof window.geographicVisualization.updateSingleLocationNode === 'function') {
            console.log('Updating in geographic visualization');
            window.geographicVisualization.updateSingleLocationNode(locationData);
        } else if (window.geographicVisualization && typeof window.geographicVisualization.addLocationNodes === 'function') {
            console.log('Refreshing all location nodes in geographic visualization');
            window.geographicVisualization.addLocationNodes();
        }
    } else {
        console.log('Globe view not active, skipping globe update');
    }
    
    console.log('Chapel updated in globe successfully');
}
