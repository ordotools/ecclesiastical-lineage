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
    console.log('Clearing location form...');
    const form = document.getElementById('locationForm');
    if (form) {
        // Reset the form
        form.reset();
        
        // Also manually clear specific fields to ensure they're cleared
        const nameField = form.querySelector('#name');
        const locationTypeField = form.querySelector('#location_type');
        const streetAddressField = form.querySelector('#street_address');
        const cityField = form.querySelector('#city');
        const stateProvinceField = form.querySelector('#state_province');
        const countryField = form.querySelector('#country');
        const postalCodeField = form.querySelector('#postal_code');
        const pastorNameField = form.querySelector('#pastor_name');
        const notesField = form.querySelector('#notes');
        const deletedField = form.querySelector('#deleted');
        const latitudeField = form.querySelector('#latitude');
        const longitudeField = form.querySelector('#longitude');
        
        if (nameField) nameField.value = '';
        if (locationTypeField) locationTypeField.value = '';
        if (streetAddressField) streetAddressField.value = '';
        if (cityField) cityField.value = '';
        if (stateProvinceField) stateProvinceField.value = '';
        if (countryField) countryField.value = '';
        if (postalCodeField) postalCodeField.value = '';
        if (pastorNameField) pastorNameField.value = '';
        if (notesField) notesField.value = '';
        if (deletedField) deletedField.checked = false;
        if (latitudeField) latitudeField.value = '';
        if (longitudeField) longitudeField.value = '';
        
        // Reset form action to add new chapel
        form.action = '/locations/add';
        
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
        
        console.log('Location form cleared successfully');
    } else {
        console.warn('Location form not found for clearing');
    }
};

// Function to handle form submission
window.handleLocationFormSubmit = function(event) {
    console.log('=== handleLocationFormSubmit called ===');
    console.log('Event:', event);
    console.log('Event type:', event.type);
    console.log('Event target:', event.target);
    console.log('Preventing default...');
    event.preventDefault();
    
    const form = document.getElementById('locationForm');
    if (!form) {
        console.error('Location form not found');
        return false;
    }
    
    console.log('Form found:', form);
    console.log('Form action:', form.action);
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    // Prepare form data
    const formData = new FormData(form);
    
    // Check if pastor needs to be created
    const pastorName = form.querySelector('#pastor_name').value.trim();
    console.log('=== PASTOR CREATION DEBUG ===');
    console.log('Pastor name from form:', pastorName);
    console.log('Pastor name length:', pastorName.length);
    console.log('Will create pastor:', !!pastorName);
    console.log('Form element:', form);
    console.log('Pastor input element:', form.querySelector('#pastor_name'));
    console.log('Pastor input value:', form.querySelector('#pastor_name')?.value);
    
    if (pastorName) {
        // Show user feedback about pastor creation
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating pastor record...';
        
        // Check and create pastor if needed
        checkAndCreatePastor(pastorName)
            .then(() => {
                console.log('Pastor creation completed, proceeding with form submission...');
                // Update button text for final submission
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting form...';
                // Submit the form after pastor is created
                submitLocationForm(form, formData, submitButton, originalText);
            })
            .catch(error => {
                console.error('Error creating pastor:', error);
                showErrorMessage(`Error creating pastor record: ${error.message}`);
                resetSubmitButton(submitButton, originalText);
            });
    } else {
        // No pastor to check, submit directly
        submitLocationForm(form, formData, submitButton, originalText);
    }
    
    return false;
};

// Function to check and create pastor
function checkAndCreatePastor(pastorName) {
    console.log('=== checkAndCreatePastor called ===');
    console.log('Pastor name:', pastorName);
    
    return new Promise((resolve, reject) => {
        // Send AJAX request to check and create pastor
        const apiEndpoint = '/api/check-and-create-pastor';
        
        console.log('Making API request to', apiEndpoint);
        fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin', // Include cookies for authentication
            body: JSON.stringify({
                pastor_name: pastorName
            })
        })
        .then(response => {
            console.log('API response received:', response.status, response.statusText);
            console.log('Response content type:', response.headers.get('content-type'));
            
            if (!response.ok) {
                console.error('API response not OK:', response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Response is not JSON, content-type:', contentType);
                return response.text().then(text => {
                    console.error('Response text (first 200 chars):', text.substring(0, 200));
                    throw new Error('Server returned HTML instead of JSON - likely authentication issue');
                });
            }
            
            return response.json();
        })
        .then(data => {
            console.log('API response data:', data);
            if (data.success) {
                if (data.created) {
                    console.log(`✅ Created new pastor record for ${data.pastor_name} with ID ${data.pastor_id}`);
                } else {
                    console.log(`✅ Found existing pastor record for ${data.pastor_name} with ID ${data.pastor_id}`);
                }
                console.log('Pastor creation successful, resolving promise...');
                resolve();
            } else {
                console.error('API returned success=false:', data.message);
                reject(new Error(data.message || 'Failed to create pastor'));
            }
        })
        .catch(error => {
            console.error('Error creating pastor:', error);
            reject(error);
        });
    });
}

// Function to reset submit button
function resetSubmitButton(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
}

// Function to submit the location form
function submitLocationForm(form, formData, submitButton, originalText) {
    console.log('=== submitLocationForm called ===');
    console.log('Form:', form);
    console.log('FormData:', formData);
    
    // Determine the correct endpoint based on whether we're editing or adding
    const isEditing = form.action.includes('/edit');
    let endpoint = isEditing ? form.action : '/locations/add';
    
    console.log('Is editing:', isEditing);
    console.log('Endpoint:', endpoint);
    
    // Submit via AJAX
    fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin', // Include cookies for authentication
        body: formData
    })
    .then(response => {
        console.log('Form submission response:', response.status, response.statusText);
        console.log('Form submission content type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            console.error('Form submission response not OK:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Form submission response is not JSON, content-type:', contentType);
            return response.text().then(text => {
                console.error('Form submission response text (first 200 chars):', text.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON - likely authentication issue');
            });
        }
        
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Success - handle both add and edit cases
            console.log('Location saved successfully:', data);
            const location = data.location;
            
            if (isEditing) {
                // For editing, check if chapel is deleted
                if (location.deleted) {
                    // Remove from list and globe if deleted
                    removeChapelFromList(location.id);
                    removeChapelFromGlobe(location.id);
                    showSuccessMessage('Chapel marked as deleted successfully!');
                } else {
                    // Update the existing chapel in the list and globe
                    updateChapelInList(location);
                    updateChapelInGlobe(location);
                    showSuccessMessage(data.message || 'Chapel location updated successfully!');
                }
                // Clear form after any edit operation
                clearLocationForm();
            } else {
                // For adding, add new chapel to list and globe
                addChapelToList(location);
                addChapelToGlobe(location);
                showSuccessMessage(data.message || 'Chapel location added successfully!');
                // Clear form after adding
                clearLocationForm();
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
}

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
        
        // Add form submission event listener
        form.addEventListener('submit', function(e) {
            console.log('=== FORM SUBMIT EVENT LISTENER ===');
            console.log('Form submit event fired');
            console.log('Event target:', e.target);
            console.log('Form element:', form);
            e.preventDefault();
            console.log('Calling handleLocationFormSubmit...');
            window.handleLocationFormSubmit(e);
        });
        
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
        
        // Add form submission event listener to all forms
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                console.log('=== FORM SUBMIT EVENT LISTENER (data attribute) ===');
                console.log('Form submit event fired for form with data attribute');
                console.log('Event target:', e.target);
                e.preventDefault();
                console.log('Calling handleLocationFormSubmit...');
                window.handleLocationFormSubmit(e);
            });
        });
        
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
        // Reset the manager to allow re-initialization
        window.locationFormManager = null;
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
    
    // Use centralized styling for color determination - use existing styles instance if available
    const styles = window.geographicVisualization?.styles || new LocationMarkerStyles();
    const color = styles.getLocationColorWithOrganization(location.location_type, location.organization, location);
    
    // Create location data object
    const locationData = {
        id: location.id,
        name: location.name,
        location_type: location.location_type,
        pastor_name: location.pastor_name,
        organization: location.organization,
        organization_id: location.organization_id,
        organization_name: location.organization_name,
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

// Function to remove a chapel from the chapel list
function removeChapelFromList(locationId) {
    console.log('Removing chapel from list:', locationId);
    
    const chapelItem = document.querySelector(`[data-location-id="${locationId}"]`);
    if (chapelItem) {
        chapelItem.remove();
        console.log('Chapel removed from list successfully');
    } else {
        console.warn('Chapel item not found in list for removal');
    }
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
    
    // Use centralized styling for color determination - use existing styles instance if available
    const styles = window.geographicVisualization?.styles || new LocationMarkerStyles();
    const color = styles.getLocationColorWithOrganization(location.location_type, location.organization, location);
    
    // Create location data object
    const locationData = {
        id: location.id,
        name: location.name,
        location_type: location.location_type,
        pastor_name: location.pastor_name,
        organization: location.organization,
        organization_id: location.organization_id,
        organization_name: location.organization_name,
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

// Function to remove a chapel from the globe visualization
function removeChapelFromGlobe(locationId) {
    console.log('Removing chapel from globe:', locationId);
    
    // Remove from global nodes data if it exists
    if (window.nodesData) {
        const index = window.nodesData.findIndex(node => node.id === locationId);
        if (index !== -1) {
            window.nodesData.splice(index, 1);
            console.log('Removed from nodesData');
        }
    }
    
    // Check if we're in globe view mode
    const isGlobeViewActive = document.querySelector('#globe-container') !== null;
    console.log('Is globe view active for removal:', isGlobeViewActive);
    
    if (isGlobeViewActive) {
        // Try to remove from different visualization types
        if (window.chapelGlobeOverlay && typeof window.chapelGlobeOverlay.removeChapel === 'function') {
            console.log('Removing from chapel globe overlay');
            window.chapelGlobeOverlay.removeChapel(locationId);
        }
        
        if (window.geographicVisualization && typeof window.geographicVisualization.removeLocationNode === 'function') {
            console.log('Removing from geographic visualization');
            window.geographicVisualization.removeLocationNode(locationId);
        } else if (window.geographicVisualization && typeof window.geographicVisualization.addLocationNodes === 'function') {
            console.log('Refreshing all location nodes in geographic visualization');
            window.geographicVisualization.addLocationNodes();
        }
    } else {
        console.log('Globe view not active, skipping globe removal');
    }
    
    console.log('Chapel removed from globe successfully');
}

// Add a global form submission handler to catch any form submissions that might bypass our custom handler
document.addEventListener('DOMContentLoaded', function() {
    // Add a global form submission handler for location forms
    document.addEventListener('submit', function(e) {
        if (e.target.id === 'locationForm') {
            console.log('=== GLOBAL FORM SUBMIT HANDLER ===');
            console.log('Form submitted via default HTML mechanism');
            console.log('Event target:', e.target);
            console.log('Event type:', e.type);
            console.log('This should not happen if our custom handler is working');
            
            // Prevent the default submission
            e.preventDefault();
            
            // Call our custom handler
            console.log('Calling our custom handler...');
            window.handleLocationFormSubmit(e);
        }
    });
});
