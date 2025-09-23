/**
 * Self-contained Clergy Form JavaScript
 * Handles all form functionality for the clergy form component
 */

// Global namespace to avoid conflicts
window.ClergyForm = window.ClergyForm || {};

// Initialize form when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (window.ClergyForm.initialized) return;
    window.ClergyForm.initialized = true;
    
    // Set up form data (will be populated by template)
    window.ClergyForm.allClergy = window.ClergyForm.allClergy || [];
    window.ClergyForm.allBishops = window.ClergyForm.allBishops || [];
    
    // Initialize counters
    window.ClergyForm.counters = {
        ordinationCounter: 0,
        consecrationCounter: 0,
        coConsecratorCounter: 0
    };
    
    // Initialize form
    window.ClergyForm.init();
});

window.ClergyForm.init = function() {
    console.log('Initializing self-contained clergy form...');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize existing data if in edit mode
    this.initializeExistingData();
    
    // Set up bishop search
    this.initializeBishopSearch();
    
    console.log('Clergy form initialization complete');
};

window.ClergyForm.setupEventListeners = function() {
    // Rank change handler
    const rankSelect = document.getElementById('rank');
    if (rankSelect) {
        rankSelect.addEventListener('change', (e) => {
            this.toggleOrdinationFields(e.target.value);
            this.toggleConsecrationFields(e.target.value);
        });
    }
    
    // Add ordination button
    const addOrdinationBtn = document.getElementById('addOrdinationBtn');
    if (addOrdinationBtn) {
        addOrdinationBtn.addEventListener('click', () => this.addOrdinationSection());
    }
    
    // Add consecration button
    const addConsecrationBtn = document.getElementById('addConsecrationBtn');
    if (addConsecrationBtn) {
        addConsecrationBtn.addEventListener('click', () => this.addConsecrationSection());
    }
    
    // Clear buttons
    const clearAllOrdinationsBtn = document.getElementById('clearAllOrdinationsBtn');
    if (clearAllOrdinationsBtn) {
        clearAllOrdinationsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all ordination data?')) {
                this.clearOrdinationSections();
            }
        });
    }
    
    const clearAllConsecrationsBtn = document.getElementById('clearAllConsecrationsBtn');
    if (clearAllConsecrationsBtn) {
        clearAllConsecrationsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all consecration data?')) {
                this.clearConsecrationSections();
            }
        });
    }
    
    // Image upload functionality
    this.setupImageUpload();
};

window.ClergyForm.initializeExistingData = function() {
    const rankSelect = document.getElementById('rank');
    if (rankSelect && rankSelect.value) {
        this.toggleOrdinationFields(rankSelect.value);
        this.toggleConsecrationFields(rankSelect.value);
    } else {
        // Even without a rank selected, show ordination section by default
        this.toggleOrdinationFields('Priest');
    }
};

window.ClergyForm.toggleOrdinationFields = function(rankValue) {
    const ordinationSection = document.getElementById('ordinationSection');
    if (!ordinationSection) return;
    
    // Always show ordination section - every clergy has at least one ordination
    ordinationSection.style.display = 'block';
    
    // Add initial ordination section if none exist
    if (this.counters.ordinationCounter === 0) {
        this.addOrdinationSection();
    }
};

window.ClergyForm.toggleConsecrationFields = function(rankValue) {
    // Handle papal name field
    const papalNameField = document.getElementById('papalNameField');
    if (papalNameField) {
        if (rankValue && rankValue.toLowerCase() === 'pope') {
            papalNameField.style.display = 'flex';
        } else {
            papalNameField.style.display = 'none';
            const papalName = document.getElementById('papal_name');
            if (papalName) papalName.value = '';
        }
    }
    
    const consecrationSection = document.getElementById('consecrationSection');
    if (!consecrationSection) return;
    
    // Only show consecration section for bishops and higher ranks
    const requiresConsecration = rankValue && ['Bishop', 'Archbishop', 'Cardinal', 'Pope'].includes(rankValue);
    
    if (requiresConsecration) {
        consecrationSection.style.display = 'block';
        // Add initial consecration section if none exist
        if (this.counters.consecrationCounter === 0) {
            this.addConsecrationSection();
        }
    } else {
        consecrationSection.style.display = 'none';
        this.clearConsecrationSections();
    }
};

window.ClergyForm.addOrdinationSection = function() {
    this.counters.ordinationCounter++;
    const container = document.getElementById('ordinationsContainer');
    if (!container) return;
    
    const ordinationHtml = `
        <div class="ordination-section" id="ordination_${this.counters.ordinationCounter}">
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Ordination ${this.counters.ordinationCounter > 1 ? this.counters.ordinationCounter : ''}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.ClergyForm.removeOrdinationSection(${this.counters.ordinationCounter})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label">Date of Ordination *</label>
                            <input type="date" class="form-control" name="ordinations[${this.counters.ordinationCounter}][date]" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Ordaining Bishop</label>
                            <div class="position-relative">
                                <input type="text" class="form-control bishop-search-input" 
                                       name="ordinations[${this.counters.ordinationCounter}][ordaining_bishop_input]" 
                                       autocomplete="off" placeholder="Search for bishop...">
                                <input type="hidden" name="ordinations[${this.counters.ordinationCounter}][ordaining_bishop_id]">
                                <div class="autocomplete-dropdown"></div>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="ordinations[${this.counters.ordinationCounter}][is_sub_conditione]" id="ordination_sub_conditione_${this.counters.ordinationCounter}">
                                <label class="form-check-label" for="ordination_sub_conditione_${this.counters.ordinationCounter}">Sub Conditione</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="ordinations[${this.counters.ordinationCounter}][is_doubtful]" id="ordination_doubtful_${this.counters.ordinationCounter}">
                                <label class="form-check-label" for="ordination_doubtful_${this.counters.ordinationCounter}">Doubtful</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="ordinations[${this.counters.ordinationCounter}][is_invalid]" id="ordination_invalid_${this.counters.ordinationCounter}">
                                <label class="form-check-label" for="ordination_invalid_${this.counters.ordinationCounter}">Invalid</label>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <label class="form-label">Notes</label>
                            <textarea class="form-control" name="ordinations[${this.counters.ordinationCounter}][notes]" rows="2" placeholder="Additional notes about this ordination..."></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', ordinationHtml);
    this.initializeBishopSearchForSection(`ordination_${this.counters.ordinationCounter}`);
};

window.ClergyForm.addConsecrationSection = function() {
    this.counters.consecrationCounter++;
    const container = document.getElementById('consecrationsContainer');
    if (!container) return;
    
    const consecrationHtml = `
        <div class="consecration-section" id="consecration_${this.counters.consecrationCounter}">
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Consecration ${this.counters.consecrationCounter > 1 ? this.counters.consecrationCounter : ''}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.ClergyForm.removeConsecrationSection(${this.counters.consecrationCounter})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label">Date of Consecration *</label>
                            <input type="date" class="form-control" name="consecrations[${this.counters.consecrationCounter}][date]" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Consecrator</label>
                            <div class="position-relative">
                                <input type="text" class="form-control bishop-search-input" 
                                       name="consecrations[${this.counters.consecrationCounter}][consecrator_input]" 
                                       autocomplete="off" placeholder="Search for bishop...">
                                <input type="hidden" name="consecrations[${this.counters.consecrationCounter}][consecrator_id]">
                                <div class="autocomplete-dropdown"></div>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="consecrations[${this.counters.consecrationCounter}][is_sub_conditione]" id="consecration_sub_conditione_${this.counters.consecrationCounter}">
                                <label class="form-check-label" for="consecration_sub_conditione_${this.counters.consecrationCounter}">Sub Conditione</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="consecrations[${this.counters.consecrationCounter}][is_doubtful]" id="consecration_doubtful_${this.counters.consecrationCounter}">
                                <label class="form-check-label" for="consecration_doubtful_${this.counters.consecrationCounter}">Doubtful</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="consecrations[${this.counters.consecrationCounter}][is_invalid]" id="consecration_invalid_${this.counters.consecrationCounter}">
                                <label class="form-check-label" for="consecration_invalid_${this.counters.consecrationCounter}">Invalid</label>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <label class="form-label">Notes</label>
                            <textarea class="form-control" name="consecrations[${this.counters.consecrationCounter}][notes]" rows="2" placeholder="Additional notes about this consecration..."></textarea>
                        </div>
                    </div>
                    <div class="co-consecrators-section mt-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label mb-0">Co-Consecrators</label>
                            <button type="button" class="btn btn-sm btn-outline-primary" onclick="window.ClergyForm.addCoConsecrator(${this.counters.consecrationCounter})">
                                <i class="fas fa-plus"></i> Add Co-Consecrator
                            </button>
                        </div>
                        <div class="co-consecrators-container" id="co_consecrators_${this.counters.consecrationCounter}"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', consecrationHtml);
    this.initializeBishopSearchForSection(`consecration_${this.counters.consecrationCounter}`);
};

window.ClergyForm.addCoConsecrator = function(consecrationId) {
    this.counters.coConsecratorCounter++;
    const container = document.getElementById(`co_consecrators_${consecrationId}`);
    if (!container) return;
    
    const coConsecratorHtml = `
        <div class="co-consecrator-item mb-2" id="co_consecrator_${this.counters.coConsecratorCounter}">
            <div class="row align-items-center">
                <div class="col-md-10">
                    <div class="position-relative">
                        <input type="text" class="form-control bishop-search-input" 
                               name="consecrations[${consecrationId}][co_consecrators][${this.counters.coConsecratorCounter}][input]" 
                               autocomplete="off" placeholder="Search for co-consecrator...">
                        <input type="hidden" name="consecrations[${consecrationId}][co_consecrators][${this.counters.coConsecratorCounter}][id]">
                        <div class="autocomplete-dropdown"></div>
                    </div>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.ClergyForm.removeCoConsecrator(${this.counters.coConsecratorCounter})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', coConsecratorHtml);
    this.initializeBishopSearchForSection(`co_consecrator_${this.counters.coConsecratorCounter}`);
};

window.ClergyForm.clearOrdinationSections = function() {
    const container = document.getElementById('ordinationsContainer');
    if (container) {
        container.innerHTML = '';
    }
    this.counters.ordinationCounter = 0;
    this.showTemporaryMessage('All ordination data cleared', 'success');
};

window.ClergyForm.clearConsecrationSections = function() {
    const container = document.getElementById('consecrationsContainer');
    if (container) {
        container.innerHTML = '';
    }
    this.counters.consecrationCounter = 0;
    this.showTemporaryMessage('All consecration data cleared', 'success');
};

window.ClergyForm.removeOrdinationSection = function(ordinationId) {
    const section = document.getElementById(`ordination_${ordinationId}`);
    if (section) {
        const allOrdinationSections = document.querySelectorAll('#ordinationsContainer .ordination-section');
        if (allOrdinationSections.length === 1) {
            this.clearOrdinationFormFields(section);
        } else {
            section.remove();
        }
    }
};

window.ClergyForm.removeConsecrationSection = function(consecrationId) {
    const section = document.getElementById(`consecration_${consecrationId}`);
    if (section) {
        const allConsecrationSections = document.querySelectorAll('#consecrationsContainer .consecration-section');
        if (allConsecrationSections.length === 1) {
            this.clearConsecrationFormFields(section);
        } else {
            section.remove();
        }
    }
};

window.ClergyForm.removeCoConsecrator = function(coConsecratorId) {
    const item = document.getElementById(`co_consecrator_${coConsecratorId}`);
    if (item) {
        item.remove();
    }
};

window.ClergyForm.clearOrdinationFormFields = function(section) {
    const inputs = section.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
};

window.ClergyForm.clearConsecrationFormFields = function(section) {
    const inputs = section.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
};

window.ClergyForm.initializeBishopSearch = function() {
    document.querySelectorAll('.bishop-search-input').forEach(input => {
        this.setupBishopSearchInput(input);
    });
};

window.ClergyForm.initializeBishopSearchForSection = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const searchInputs = container.querySelectorAll('.bishop-search-input');
    searchInputs.forEach(input => {
        this.setupBishopSearchInput(input);
    });
};

window.ClergyForm.setupBishopSearchInput = function(input) {
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        const dropdown = e.target.parentElement.querySelector('.autocomplete-dropdown');
        
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        const results = this.searchBishops(query);
        this.displaySearchResults(dropdown, results, e.target);
        dropdown.style.display = 'block';
    });
    
    input.addEventListener('blur', (e) => {
        setTimeout(() => {
            const dropdown = e.target.parentElement.querySelector('.autocomplete-dropdown');
            dropdown.style.display = 'none';
        }, 200);
    });
};

window.ClergyForm.searchBishops = function(query) {
    if (!this.allBishops || this.allBishops.length === 0) {
        return [];
    }
    
    const lowerQuery = query.toLowerCase();
    return this.allBishops.filter(bishop => 
        bishop.name.toLowerCase().includes(lowerQuery) ||
        (bishop.organization && bishop.organization.toLowerCase().includes(lowerQuery))
    ).slice(0, 10);
};

window.ClergyForm.displaySearchResults = function(dropdown, results, input) {
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="bishop-search-result">No bishops found</div>';
        return;
    }
    
    const html = results.map(bishop => 
        `<div class="bishop-search-result" data-id="${bishop.id}" data-name="${bishop.name}">
            <strong>${bishop.name}</strong>
            ${bishop.organization ? `<br><small>${bishop.organization}</small>` : ''}
        </div>`
    ).join('');
    
    dropdown.innerHTML = html;
    
    dropdown.querySelectorAll('.bishop-search-result').forEach(result => {
        result.addEventListener('click', () => {
            const bishopId = result.dataset.id;
            const bishopName = result.dataset.name;
            
            input.value = bishopName;
            const hiddenInput = input.parentElement.querySelector('input[type="hidden"]');
            if (hiddenInput) {
                hiddenInput.value = bishopId;
            }
            
            dropdown.style.display = 'none';
        });
    });
};

window.ClergyForm.setupImageUpload = function() {
    const uploadBtn = document.getElementById('uploadBtn');
    const imageInput = document.getElementById('clergyImage');
    
    if (uploadBtn && imageInput) {
        uploadBtn.addEventListener('click', () => {
            imageInput.click();
        });
        
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageUpload(file);
            }
        });
    }
};

window.ClergyForm.handleImageUpload = function(file) {
    if (!file.type.startsWith('image/')) {
        this.showTemporaryMessage('Please select a valid image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imagePreview = document.getElementById('imagePreview');
        const img = imagePreview.querySelector('.preview-image') || document.createElement('img');
        img.src = e.target.result;
        img.className = 'preview-image';
        img.alt = 'Preview';
        
        if (!imagePreview.querySelector('.preview-image')) {
            imagePreview.innerHTML = '';
            imagePreview.appendChild(img);
        }
    };
    reader.readAsDataURL(file);
};

window.ClergyForm.showTemporaryMessage = function(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    messageEl.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    messageEl.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
};

// Method to populate existing data for edit mode
window.ClergyForm.populateExistingData = function() {
    console.log('Populating existing clergy data...');
    
    // Show sections if they have data
    const ordinationSection = document.getElementById('ordinationSection');
    if (ordinationSection && ordinationSection.style.display !== 'none') {
        ordinationSection.style.display = 'block';
    }
    
    const consecrationSection = document.getElementById('consecrationSection');
    if (consecrationSection && consecrationSection.style.display !== 'none') {
        consecrationSection.style.display = 'block';
    }
    
    // Note: Individual ordination/consecration data population will be handled by the template
    // This method is called after the template has already added the sections with data
    
    console.log('Existing data populated successfully');
};

// Method to pre-fill form with clergy data
window.ClergyForm.prefillForm = function(clergyData) {
    console.log('Pre-filling form with clergy data:', clergyData);
    
    if (!clergyData) {
        console.log('No clergy data provided for pre-filling');
        return;
    }
    
    // Pre-fill basic fields
    this.prefillBasicFields(clergyData);
    
    // Pre-fill ordination data
    this.prefillOrdinationData(clergyData);
    
    // Pre-fill consecration data
    this.prefillConsecrationData(clergyData);
    
    // Update form visibility based on rank
    if (clergyData.rank) {
        this.toggleOrdinationFields(clergyData.rank);
        this.toggleConsecrationFields(clergyData.rank);
    } else {
        // Even without a rank, show ordination section by default
        this.toggleOrdinationFields('Priest'); // Default to show ordination
    }
    
    console.log('Form pre-filled successfully');
};

// Pre-fill basic form fields
window.ClergyForm.prefillBasicFields = function(clergyData) {
    // Name
    const nameField = document.getElementById('name');
    if (nameField && clergyData.name) {
        nameField.value = clergyData.name;
    }
    
    // Papal name
    const papalNameField = document.getElementById('papal_name');
    if (papalNameField && clergyData.papal_name) {
        papalNameField.value = clergyData.papal_name;
    }
    
    // Rank
    const rankField = document.getElementById('rank');
    if (rankField && clergyData.rank) {
        rankField.value = clergyData.rank;
    }
    
    // Organization
    const organizationField = document.getElementById('organization');
    if (organizationField && clergyData.organization) {
        organizationField.value = clergyData.organization;
    }
    
    // Date of birth
    const birthDateField = document.getElementById('date_of_birth');
    if (birthDateField && clergyData.date_of_birth) {
        birthDateField.value = clergyData.date_of_birth;
    }
    
    // Date of death
    const deathDateField = document.getElementById('date_of_death');
    if (deathDateField && clergyData.date_of_death) {
        deathDateField.value = clergyData.date_of_death;
    }
    
    // Notes
    const notesField = document.getElementById('notes');
    if (notesField && clergyData.notes) {
        notesField.value = clergyData.notes;
    }
    
    // Mark as deleted checkbox
    const deletedField = document.getElementById('mark_deleted');
    if (deletedField && clergyData.is_deleted !== undefined) {
        deletedField.checked = clergyData.is_deleted;
    }
};

// Pre-fill ordination data
window.ClergyForm.prefillOrdinationData = function(clergyData) {
    // Ordination section is always visible, but ensure it's shown
    const ordinationSection = document.getElementById('ordinationSection');
    if (ordinationSection) {
        ordinationSection.style.display = 'block';
    }
    
    // Clear existing ordination sections
    const container = document.getElementById('ordinationsContainer');
    if (container) {
        container.innerHTML = '';
    }
    
    // Reset counter
    this.counters.ordinationCounter = 0;
    
    // If there are ordinations in the data, pre-fill them
    if (clergyData.ordinations && clergyData.ordinations.length > 0) {
        clergyData.ordinations.forEach(ordination => {
            this.addOrdinationSection();
            const ordinationSectionItem = document.querySelector('#ordinationsContainer .ordination-section:last-child');
            
            if (ordinationSectionItem) {
                // Pre-fill ordination fields
                const dateInput = ordinationSectionItem.querySelector('input[name$="[date]"]');
                const subConditioneInput = ordinationSectionItem.querySelector('input[name$="[is_sub_conditione]"]');
                const doubtfulInput = ordinationSectionItem.querySelector('input[name$="[is_doubtful]"]');
                const invalidInput = ordinationSectionItem.querySelector('input[name$="[is_invalid]"]');
                const notesTextarea = ordinationSectionItem.querySelector('textarea[name$="[notes]"]');
                const bishopInput = ordinationSectionItem.querySelector('input[name$="[ordaining_bishop_input]"]');
                const bishopIdInput = ordinationSectionItem.querySelector('input[name$="[ordaining_bishop_id]"]');
                
                if (dateInput && ordination.date) {
                    dateInput.value = ordination.date;
                }
                if (subConditioneInput) {
                    subConditioneInput.checked = ordination.is_sub_conditione || false;
                }
                if (doubtfulInput) {
                    doubtfulInput.checked = ordination.is_doubtful || false;
                }
                if (invalidInput) {
                    invalidInput.checked = ordination.is_invalid || false;
                }
                if (notesTextarea && ordination.notes) {
                    notesTextarea.value = ordination.notes;
                }
                if (bishopInput && ordination.ordaining_bishop) {
                    bishopInput.value = ordination.ordaining_bishop.name || '';
                    if (bishopIdInput && ordination.ordaining_bishop.id) {
                        bishopIdInput.value = ordination.ordaining_bishop.id;
                    }
                }
            }
        });
    } else {
        // Even if no ordination data, create at least one empty ordination section
        this.addOrdinationSection();
    }
};

// Pre-fill consecration data
window.ClergyForm.prefillConsecrationData = function(clergyData) {
    if (!clergyData.consecrations || clergyData.consecrations.length === 0) {
        return;
    }
    
    // Show consecration section
    const consecrationSection = document.getElementById('consecrationSection');
    if (consecrationSection) {
        consecrationSection.style.display = 'block';
    }
    
    // Clear existing consecration sections
    const container = document.getElementById('consecrationsContainer');
    if (container) {
        container.innerHTML = '';
    }
    
    // Reset counter
    this.counters.consecrationCounter = 0;
    
    // Add consecration sections with data
    clergyData.consecrations.forEach(consecration => {
        this.addConsecrationSection();
        const consecrationSectionItem = document.querySelector('#consecrationsContainer .consecration-section:last-child');
        
        if (consecrationSectionItem) {
            // Pre-fill consecration fields
            const dateInput = consecrationSectionItem.querySelector('input[name$="[date]"]');
            const subConditioneInput = consecrationSectionItem.querySelector('input[name$="[is_sub_conditione]"]');
            const doubtfulInput = consecrationSectionItem.querySelector('input[name$="[is_doubtful]"]');
            const invalidInput = consecrationSectionItem.querySelector('input[name$="[is_invalid]"]');
            const notesTextarea = consecrationSectionItem.querySelector('textarea[name$="[notes]"]');
            const consecratorInput = consecrationSectionItem.querySelector('input[name$="[consecrator_input]"]');
            const consecratorIdInput = consecrationSectionItem.querySelector('input[name$="[consecrator_id]"]');
            
            if (dateInput && consecration.date) {
                dateInput.value = consecration.date;
            }
            if (subConditioneInput) {
                subConditioneInput.checked = consecration.is_sub_conditione || false;
            }
            if (doubtfulInput) {
                doubtfulInput.checked = consecration.is_doubtful || false;
            }
            if (invalidInput) {
                invalidInput.checked = consecration.is_invalid || false;
            }
            if (notesTextarea && consecration.notes) {
                notesTextarea.value = consecration.notes;
            }
            if (consecratorInput && consecration.consecrator) {
                consecratorInput.value = consecration.consecrator.name || '';
                if (consecratorIdInput && consecration.consecrator.id) {
                    consecratorIdInput.value = consecration.consecrator.id;
                }
            }
            
            // Pre-fill co-consecrators
            if (consecration.co_consecrators && consecration.co_consecrators.length > 0) {
                consecration.co_consecrators.forEach(coConsecrator => {
                    this.addCoConsecrator(this.counters.consecrationCounter);
                    const coConsecratorItem = consecrationSectionItem.querySelector('.co-consecrators-container .co-consecrator-item:last-child');
                    
                    if (coConsecratorItem) {
                        const coInput = coConsecratorItem.querySelector('input[name$="[input]"]');
                        const coIdInput = coConsecratorItem.querySelector('input[name$="[id]"]');
                        
                        if (coInput && coConsecrator.name) {
                            coInput.value = coConsecrator.name;
                        }
                        if (coIdInput && coConsecrator.id) {
                            coIdInput.value = coConsecrator.id;
                        }
                    }
                });
            }
        }
    });
};

// Make functions globally available for backward compatibility
window.addOrdinationSection = () => window.ClergyForm.addOrdinationSection();
window.addConsecrationSection = () => window.ClergyForm.addConsecrationSection();
window.addCoConsecrator = (id) => window.ClergyForm.addCoConsecrator(id);
window.removeOrdinationSection = (id) => window.ClergyForm.removeOrdinationSection(id);
window.removeConsecrationSection = (id) => window.ClergyForm.removeConsecrationSection(id);
window.removeCoConsecrator = (id) => window.ClergyForm.removeCoConsecrator(id);
window.toggleOrdinationFields = (value) => window.ClergyForm.toggleOrdinationFields(value);
window.toggleConsecrationFields = (value) => window.ClergyForm.toggleConsecrationFields(value);
