/**
 * Dynamic Clergy Form JavaScript
 * Handles multiple ordinations/consecrations and co-consecrators
 */

// Global counters for dynamic form elements - use window namespace to avoid conflicts
if (typeof window.dynamicFormCounters === 'undefined') {
    window.dynamicFormCounters = {
        ordinationCounter: 0,
        consecrationCounter: 0,
        coConsecratorCounter: 0
    };
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if dynamic form has already been initialized
    if (window.dynamicFormInitialized) {
        console.log('Dynamic form already initialized, skipping');
        return;
    }
    
    // Initialize the form
    initializeDynamicForm();
    
    // Set up event listeners
    setupEventListeners();
    
    // Mark dynamic form as initialized
    window.dynamicFormInitialized = true;
});

function initializeDynamicForm() {
    const rankSelect = document.getElementById('rank');
    const ordinationSection = document.getElementById('ordinationSection');
    const consecrationSection = document.getElementById('consecrationSection');
    
    // Check if there are existing ordinations/consecrations (for edit mode)
    const existingOrdinations = document.querySelectorAll('#ordinationsContainer .ordination-section');
    const existingConsecrations = document.querySelectorAll('#consecrationsContainer .consecration-section');
    
    // Update counters based on existing sections
    window.dynamicFormCounters.ordinationCounter = existingOrdinations.length;
    window.dynamicFormCounters.consecrationCounter = existingConsecrations.length;
    
    // In edit mode, show sections if they have existing data
    if (existingOrdinations.length > 0 && ordinationSection) {
        ordinationSection.style.display = 'block';
        console.log('Dynamic form: Showing ordination section for existing data');
    }
    
    if (existingConsecrations.length > 0 && consecrationSection) {
        consecrationSection.style.display = 'block';
        console.log('Dynamic form: Showing consecration section for existing data');
    }
    
    // For new forms or when no existing data, check rank requirements
    if (rankSelect && rankSelect.value && existingOrdinations.length === 0 && existingConsecrations.length === 0) {
        toggleOrdinationFields(rankSelect.value);
        toggleConsecrationFields(rankSelect.value);
    }
    
    // If we're in edit mode and there are existing sections, don't interfere with the template initialization
    // The template will handle clearing and re-populating the sections
    if (existingOrdinations.length > 0 || existingConsecrations.length > 0) {
        console.log('Dynamic form: Edit mode detected with existing data, letting template handle initialization');
        return;
    }
}

function setupEventListeners() {
    // Rank change handler
    const rankSelect = document.getElementById('rank');
    if (rankSelect) {
        rankSelect.addEventListener('change', function() {
            toggleOrdinationFields(this.value);
            toggleConsecrationFields(this.value);
        });
    }
    
    // Add ordination button
    const addOrdinationBtn = document.getElementById('addOrdinationBtn');
    if (addOrdinationBtn) {
        addOrdinationBtn.addEventListener('click', addOrdinationSection);
    }
    
    // Add consecration button
    const addConsecrationBtn = document.getElementById('addConsecrationBtn');
    if (addConsecrationBtn) {
        addConsecrationBtn.addEventListener('click', addConsecrationSection);
    }
    
    // Clear all ordinations button
    const clearAllOrdinationsBtn = document.getElementById('clearAllOrdinationsBtn');
    if (clearAllOrdinationsBtn) {
        clearAllOrdinationsBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all ordination data? This action cannot be undone.')) {
                clearOrdinationSections();
            }
        });
    }
    
    // Clear all consecrations button
    const clearAllConsecrationsBtn = document.getElementById('clearAllConsecrationsBtn');
    if (clearAllConsecrationsBtn) {
        clearAllConsecrationsBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all consecration data? This action cannot be undone.')) {
                clearConsecrationSections();
            }
        });
    }
}

function toggleOrdinationFields(rankValue) {
    const ordinationSection = document.getElementById('ordinationSection');
    if (!ordinationSection) return;
    
    // Check if rank requires ordination (most ranks except Pope and some special cases)
    const requiresOrdination = rankValue && !['Pope'].includes(rankValue);
    
    if (requiresOrdination) {
        ordinationSection.style.display = 'block';
        // Add initial ordination section if none exist
        if (window.dynamicFormCounters.ordinationCounter === 0) {
            addOrdinationSection();
        }
    } else {
        ordinationSection.style.display = 'none';
        // Clear all ordination sections
        clearOrdinationSections();
    }
}

function toggleConsecrationFields(rankValue) {
    // Handle papal name field visibility
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
    
    const consecrationSection = document.getElementById('consecrationSection');
    if (!consecrationSection) return;
    
    // Check if rank requires consecration (bishops and higher)
    const requiresConsecration = rankValue && ['Bishop', 'Archbishop', 'Cardinal', 'Pope'].includes(rankValue);
    
    if (requiresConsecration) {
        consecrationSection.style.display = 'block';
        // Add initial consecration section if none exist
        if (window.dynamicFormCounters.consecrationCounter === 0) {
            addConsecrationSection();
        }
    } else {
        consecrationSection.style.display = 'none';
        // Clear all consecration sections
        clearConsecrationSections();
    }
}

function addOrdinationSection() {
    // Ensure the namespace exists
    if (typeof window.dynamicFormCounters === 'undefined') {
        window.dynamicFormCounters = {
            ordinationCounter: 0,
            consecrationCounter: 0,
            coConsecratorCounter: 0
        };
    }
    
    window.dynamicFormCounters.ordinationCounter++;
    const container = document.getElementById('ordinationsContainer');
    if (!container) return;
    
    const ordinationHtml = `
        <div class="ordination-section" id="ordination_${window.dynamicFormCounters.ordinationCounter}">
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Ordination ${window.dynamicFormCounters.ordinationCounter > 1 ? window.dynamicFormCounters.ordinationCounter : ''}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeOrdinationSection(${window.dynamicFormCounters.ordinationCounter})" title="Remove this ordination">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label">Date of Ordination *</label>
                            <input type="date" class="form-control" name="ordinations[${window.dynamicFormCounters.ordinationCounter}][date]" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Ordaining Bishop</label>
                            <div class="position-relative">
                                <input type="text" class="form-control bishop-search-input" 
                                       name="ordinations[${window.dynamicFormCounters.ordinationCounter}][ordaining_bishop_input]" 
                                       autocomplete="off" placeholder="Search for bishop...">
                                <input type="hidden" name="ordinations[${window.dynamicFormCounters.ordinationCounter}][ordaining_bishop_id]">
                                <div class="autocomplete-dropdown" style="position:absolute;top:100%;left:0;width:100%;z-index:20;display:none;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="ordinations[${window.dynamicFormCounters.ordinationCounter}][is_sub_conditione]" id="ordination_sub_conditione_${window.dynamicFormCounters.ordinationCounter}">
                                <label class="form-check-label" for="ordination_sub_conditione_${window.dynamicFormCounters.ordinationCounter}">
                                    Sub Conditione
                                </label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="ordinations[${window.dynamicFormCounters.ordinationCounter}][is_doubtful]" id="ordination_doubtful_${window.dynamicFormCounters.ordinationCounter}">
                                <label class="form-check-label" for="ordination_doubtful_${window.dynamicFormCounters.ordinationCounter}">
                                    Doubtful
                                </label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="ordinations[${window.dynamicFormCounters.ordinationCounter}][is_invalid]" id="ordination_invalid_${window.dynamicFormCounters.ordinationCounter}">
                                <label class="form-check-label" for="ordination_invalid_${window.dynamicFormCounters.ordinationCounter}">
                                    Invalid
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <label class="form-label">Notes</label>
                            <textarea class="form-control" name="ordinations[${window.dynamicFormCounters.ordinationCounter}][notes]" rows="2" placeholder="Additional notes about this ordination..."></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', ordinationHtml);
    
    // Initialize bishop search for this ordination
    initializeBishopSearch(`ordination_${window.dynamicFormCounters.ordinationCounter}`);
}

function addConsecrationSection() {
    // Ensure the namespace exists
    if (typeof window.dynamicFormCounters === 'undefined') {
        window.dynamicFormCounters = {
            ordinationCounter: 0,
            consecrationCounter: 0,
            coConsecratorCounter: 0
        };
    }
    
    window.dynamicFormCounters.consecrationCounter++;
    const container = document.getElementById('consecrationsContainer');
    if (!container) return;
    
    const consecrationHtml = `
        <div class="consecration-section" id="consecration_${window.dynamicFormCounters.consecrationCounter}">
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Consecration ${window.dynamicFormCounters.consecrationCounter > 1 ? window.dynamicFormCounters.consecrationCounter : ''}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeConsecrationSection(${window.dynamicFormCounters.consecrationCounter})" title="Remove this consecration">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label">Date of Consecration *</label>
                            <input type="date" class="form-control" name="consecrations[${window.dynamicFormCounters.consecrationCounter}][date]" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Consecrator</label>
                            <div class="position-relative">
                                <input type="text" class="form-control bishop-search-input" 
                                       name="consecrations[${window.dynamicFormCounters.consecrationCounter}][consecrator_input]" 
                                       autocomplete="off" placeholder="Search for bishop...">
                                <input type="hidden" name="consecrations[${window.dynamicFormCounters.consecrationCounter}][consecrator_id]">
                                <div class="autocomplete-dropdown" style="position:absolute;top:100%;left:0;width:100%;z-index:20;display:none;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="consecrations[${window.dynamicFormCounters.consecrationCounter}][is_sub_conditione]" id="consecration_sub_conditione_${window.dynamicFormCounters.consecrationCounter}">
                                <label class="form-check-label" for="consecration_sub_conditione_${window.dynamicFormCounters.consecrationCounter}">
                                    Sub Conditione
                                </label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="consecrations[${window.dynamicFormCounters.consecrationCounter}][is_doubtful]" id="consecration_doubtful_${window.dynamicFormCounters.consecrationCounter}">
                                <label class="form-check-label" for="consecration_doubtful_${window.dynamicFormCounters.consecrationCounter}">
                                    Doubtful
                                </label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="consecrations[${window.dynamicFormCounters.consecrationCounter}][is_invalid]" id="consecration_invalid_${window.dynamicFormCounters.consecrationCounter}">
                                <label class="form-check-label" for="consecration_invalid_${window.dynamicFormCounters.consecrationCounter}">
                                    Invalid
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <label class="form-label">Notes</label>
                            <textarea class="form-control" name="consecrations[${window.dynamicFormCounters.consecrationCounter}][notes]" rows="2" placeholder="Additional notes about this consecration..."></textarea>
                        </div>
                    </div>
                    
                    <!-- Co-Consecrators Section -->
                    <div class="co-consecrators-section mt-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label mb-0">Co-Consecrators</label>
                            <button type="button" class="btn btn-sm btn-outline-primary" onclick="addCoConsecrator(${window.dynamicFormCounters.consecrationCounter})">
                                <i class="fas fa-plus"></i> Add Co-Consecrator
                            </button>
                        </div>
                        <div class="co-consecrators-container" id="co_consecrators_${window.dynamicFormCounters.consecrationCounter}">
                            <!-- Co-consecrators will be added here dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', consecrationHtml);
    
    // Initialize bishop search for this consecration
    initializeBishopSearch(`consecration_${window.dynamicFormCounters.consecrationCounter}`);
}

function addCoConsecrator(consecrationId) {
    // Ensure the namespace exists
    if (typeof window.dynamicFormCounters === 'undefined') {
        window.dynamicFormCounters = {
            ordinationCounter: 0,
            consecrationCounter: 0,
            coConsecratorCounter: 0
        };
    }
    
    window.dynamicFormCounters.coConsecratorCounter++;
    const container = document.getElementById(`co_consecrators_${consecrationId}`);
    if (!container) return;
    
    const coConsecratorHtml = `
        <div class="co-consecrator-item mb-2" id="co_consecrator_${window.dynamicFormCounters.coConsecratorCounter}">
            <div class="row align-items-center">
                <div class="col-md-10">
                    <div class="position-relative">
                        <input type="text" class="form-control bishop-search-input" 
                               name="consecrations[${consecrationId}][co_consecrators][${window.dynamicFormCounters.coConsecratorCounter}][input]" 
                               autocomplete="off" placeholder="Search for co-consecrator...">
                        <input type="hidden" name="consecrations[${consecrationId}][co_consecrators][${window.dynamicFormCounters.coConsecratorCounter}][id]">
                        <div class="autocomplete-dropdown" style="position:absolute;top:100%;left:0;width:100%;z-index:20;display:none;"></div>
                    </div>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeCoConsecrator(${window.dynamicFormCounters.coConsecratorCounter})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', coConsecratorHtml);
    
    // Initialize bishop search for this co-consecrator
    initializeBishopSearch(`co_consecrator_${window.dynamicFormCounters.coConsecratorCounter}`);
}

function removeOrdinationSection(ordinationId) {
    const section = document.getElementById(`ordination_${ordinationId}`);
    if (section) {
        // Check if this is the only ordination section
        const allOrdinationSections = document.querySelectorAll('#ordinationsContainer .ordination-section');
        
        if (allOrdinationSections.length === 1) {
            // If this is the only ordination, clear the form fields instead of removing
            clearOrdinationFormFields(section);
        } else {
            // If there are multiple ordinations, remove this section
            section.remove();
        }
    }
}

function removeConsecrationSection(consecrationId) {
    const section = document.getElementById(`consecration_${consecrationId}`);
    if (section) {
        // Check if this is the only consecration section
        const allConsecrationSections = document.querySelectorAll('#consecrationsContainer .consecration-section');
        
        if (allConsecrationSections.length === 1) {
            // If this is the only consecration, clear the form fields instead of removing
            clearConsecrationFormFields(section);
        } else {
            // If there are multiple consecrations, remove this section
            section.remove();
        }
    }
}

function removeCoConsecrator(coConsecratorId) {
    const item = document.getElementById(`co_consecrator_${coConsecratorId}`);
    if (item) {
        item.remove();
    }
}

function clearOrdinationSections() {
    const container = document.getElementById('ordinationsContainer');
    if (container) {
        container.innerHTML = '';
    }
    window.dynamicFormCounters.ordinationCounter = 0;
    
    // Show a brief success message
    showTemporaryMessage('All ordination data cleared', 'success');
}

function clearConsecrationSections() {
    const container = document.getElementById('consecrationsContainer');
    if (container) {
        container.innerHTML = '';
    }
    window.dynamicFormCounters.consecrationCounter = 0;
    
    // Show a brief success message
    showTemporaryMessage('All consecration data cleared', 'success');
}

function clearOrdinationFormFields(section) {
    // Clear all form fields in the ordination section
    const inputs = section.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
    
    // Clear co-consecrators if any
    const coConsecratorsContainer = section.querySelector('.co-consecrators-container');
    if (coConsecratorsContainer) {
        coConsecratorsContainer.innerHTML = '';
    }
}

function clearConsecrationFormFields(section) {
    // Clear all form fields in the consecration section
    const inputs = section.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
    
    // Clear co-consecrators if any
    const coConsecratorsContainer = section.querySelector('.co-consecrators-container');
    if (coConsecratorsContainer) {
        coConsecratorsContainer.innerHTML = '';
    }
}

function initializeBishopSearch(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const searchInputs = container.querySelectorAll('.bishop-search-input');
    
    searchInputs.forEach(input => {
        input.addEventListener('input', function() {
            const query = this.value.trim();
            const dropdown = this.parentElement.querySelector('.autocomplete-dropdown');
            
            if (query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            // Use HTMX to search for bishops
            htmx.ajax('GET', `/api/search_bishops?q=${encodeURIComponent(query)}`, {
                target: dropdown,
                swap: 'innerHTML'
            });
            
            dropdown.style.display = 'block';
            
            // Add click handlers to search results
            setTimeout(() => {
                const results = dropdown.querySelectorAll('.bishop-search-result');
                results.forEach(result => {
                    result.addEventListener('click', function() {
                        const bishopId = this.dataset.id;
                        const bishopName = this.dataset.displayName;
                        
                        // Set the input value and hidden field
                        input.value = bishopName;
                        const hiddenInput = input.parentElement.querySelector('input[type="hidden"]');
                        if (hiddenInput) {
                            hiddenInput.value = bishopId;
                        }
                        
                        dropdown.style.display = 'none';
                    });
                });
            }, 100);
        });
        
        // Handle selection from dropdown
        input.addEventListener('blur', function() {
            setTimeout(() => {
                const dropdown = this.parentElement.querySelector('.autocomplete-dropdown');
                dropdown.style.display = 'none';
            }, 200);
        });
    });
}

// Helper function to show temporary messages
function showTemporaryMessage(message, type = 'info') {
    // Create a temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    messageEl.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    messageEl.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to page
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}

// Make functions globally available
window.addOrdinationSection = addOrdinationSection;
window.addConsecrationSection = addConsecrationSection;
window.addCoConsecrator = addCoConsecrator;
window.removeOrdinationSection = removeOrdinationSection;
window.removeConsecrationSection = removeConsecrationSection;
window.removeCoConsecrator = removeCoConsecrator;
window.toggleOrdinationFields = toggleOrdinationFields;
window.toggleConsecrationFields = toggleConsecrationFields;
