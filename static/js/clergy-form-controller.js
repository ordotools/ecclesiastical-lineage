/**
 * Clean Clergy Form Controller
 * Comprehensive form management with all functionality
 */

class ClergyFormController {
    constructor() {
        this.config = window.ClergyFormConfig || {};
        this.state = {
            ordinationCounter: 0,
            consecrationCounter: 0,
            coConsecratorCounter: 0,
            initialized: false
        };
        
        // Don't call init() in constructor - wait for DOM ready
        this.init();
    }
    
    init() {
        console.log('Initializing Clergy Form Controller...');
        
        // Always wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            // Use setTimeout to ensure DOM is fully ready
            setTimeout(() => this.setup(), 0);
        }
    }
    
    setup() {
        try {
            console.log('Setting up Clergy Form Controller...');
            
            // Check if form exists - if not, this page doesn't have a clergy form
            const form = document.getElementById('clergyForm');
            if (!form) {
                console.log('No clergy form found on this page - skipping controller initialization');
                return;
            }
            console.log('clergyForm element found');
            
            // Check if rank select exists
            const rankSelect = document.getElementById('rank');
            if (!rankSelect) {
                console.error('rank element not found');
                return;
            }
            console.log('rank element found');
            
            // Check if consecration section exists
            const consecrationSection = document.getElementById('consecrationsSection');
            if (!consecrationSection) {
                console.error('consecrationsSection element not found');
                return;
            }
            console.log('consecrationsSection element found');
            
            // Check if consecrations container exists
            const consecrationsContainer = document.getElementById('consecrationsContainer');
            if (!consecrationsContainer) {
                console.error('consecrationsContainer element not found');
                return;
            }
            console.log('consecrationsContainer element found');
            
            this.setupEventListeners();
            this.initializeForm();
            this.state.initialized = true;
            console.log('Clergy Form Controller initialized successfully');
        } catch (error) {
            console.error('Error initializing Clergy Form Controller:', error);
        }
    }
    
    setupEventListeners() {
        // Rank change handler
        const rankSelect = document.getElementById('rank');
        if (rankSelect) {
            rankSelect.addEventListener('change', (e) => {
                this.handleRankChange(e.target.value);
            });
        }
        
        // Ordination controls
        const addOrdinationBtn = document.getElementById('addOrdinationBtn');
        if (addOrdinationBtn) {
            console.log('Adding event listener to addOrdinationBtn');
            addOrdinationBtn.addEventListener('click', (e) => {
                console.log('addOrdinationBtn clicked!');
                e.stopPropagation(); // Prevent event bubbling
                this.addOrdination();
            });
        } else {
            console.log('addOrdinationBtn not found');
        }
        
        const clearOrdinationsBtn = document.getElementById('clearOrdinationsBtn');
        if (clearOrdinationsBtn) {
            clearOrdinationsBtn.addEventListener('click', () => this.clearOrdinations());
        }
        
        // Consecration controls
        const addConsecrationBtn = document.getElementById('addConsecrationBtn');
        if (addConsecrationBtn) {
            addConsecrationBtn.addEventListener('click', () => this.addConsecration());
        }
        
        const clearConsecrationsBtn = document.getElementById('clearConsecrationsBtn');
        if (clearConsecrationsBtn) {
            clearConsecrationsBtn.addEventListener('click', () => this.clearConsecrations());
        }
        
        // Image controls
        this.setupImageControls();
        
        // Form validation
        const form = document.getElementById('clergyForm');
        if (form) {
            form.addEventListener('submit', (e) => this.validateForm(e));
        }
    }
    
    setupImageControls() {
        const uploadBtn = document.getElementById('uploadBtn');
        const imageInput = document.getElementById('imageInput');
        const cropBtn = document.getElementById('cropBtn');
        const removeBtn = document.getElementById('removeBtn');
        
        if (uploadBtn && imageInput) {
            uploadBtn.addEventListener('click', () => imageInput.click());
            imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        
        if (cropBtn) {
            cropBtn.addEventListener('click', () => this.handleImageCrop());
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.handleImageRemove());
        }
    }
    
    initializeForm() {
        // Initialize with default ordination section
        this.ensureOrdinationSection();
        
        // Pre-fill form if in edit mode
        if (this.config.editMode && this.config.clergyData) {
            this.prefillForm(this.config.clergyData);
        }
        
        // Set up bishop search for any existing sections
        this.initializeBishopSearch();
    }
    
    handleRankChange(rankValue) {
        console.log('Rank changed to:', rankValue);
        
        // Handle papal name field
        this.togglePapalNameField(rankValue);
        
        // Handle consecration section
        this.toggleConsecrationSection(rankValue);
        
        // Ensure we have at least one ordination
        this.ensureOrdinationSection();
    }
    
    togglePapalNameField(rankValue) {
        const papalNameField = document.getElementById('papalNameField');
        const papalNameInput = document.getElementById('papal_name');
        
        if (papalNameField && papalNameInput) {
            if (rankValue && rankValue.toLowerCase() === 'pope') {
                papalNameField.style.display = 'block';
            } else {
                papalNameField.style.display = 'none';
                papalNameInput.value = '';
            }
        }
    }
    
    toggleConsecrationSection(rankValue) {
        console.log('toggleConsecrationSection called with rank:', rankValue);
        const consecrationSection = document.getElementById('consecrationsSection');
        
        if (consecrationSection) {
            const requiresConsecration = rankValue && 
                ['Bishop', 'Archbishop', 'Cardinal', 'Pope'].includes(rankValue);
            
            console.log('requiresConsecration:', requiresConsecration);
            
            if (requiresConsecration) {
                consecrationSection.style.display = 'block';
                console.log('Showing consecration section');
                this.ensureConsecrationSection();
            } else {
                consecrationSection.style.display = 'none';
                console.log('Hiding consecration section');
                this.clearConsecrations();
            }
        } else {
            console.error('consecrationsSection element not found');
        }
    }
    
    ensureOrdinationSection() {
        const container = document.getElementById('ordinationsContainer');
        if (container && container.children.length === 0) {
            this.addOrdination();
        }
    }
    
    ensureConsecrationSection() {
        console.log('ensureConsecrationSection called');
        const container = document.getElementById('consecrationsContainer');
        if (container) {
            console.log('consecrationsContainer found, children count:', container.children.length);
            if (container.children.length === 0) {
                console.log('Adding initial consecration section');
                this.addConsecration();
            }
        } else {
            console.error('consecrationsContainer not found');
        }
    }
    
    addOrdination() {
        console.log('addOrdination method called, current counter:', this.state.ordinationCounter);
        this.state.ordinationCounter++;
        const container = document.getElementById('ordinationsContainer');
        
        if (container) {
            console.log('Adding ordination HTML to container');
            const ordinationHtml = this.generateOrdinationHTML(this.state.ordinationCounter);
            container.insertAdjacentHTML('beforeend', ordinationHtml);
            
            // Set up bishop search for this ordination
            this.setupBishopSearch(`ordination_${this.state.ordinationCounter}`);
            console.log('Ordination section added successfully, new counter:', this.state.ordinationCounter);
        } else {
            console.error('ordinationsContainer not found in addOrdination');
        }
    }
    
    addConsecration() {
        console.log('addConsecration called, counter:', this.state.consecrationCounter);
        this.state.consecrationCounter++;
        const container = document.getElementById('consecrationsContainer');
        
        if (container) {
            console.log('Adding consecration HTML to container');
            const consecrationHtml = this.generateConsecrationHTML(this.state.consecrationCounter);
            container.insertAdjacentHTML('beforeend', consecrationHtml);
            
            // Set up bishop search for this consecration
            this.setupBishopSearch(`consecration_${this.state.consecrationCounter}`);
            console.log('Consecration section added successfully');
        } else {
            console.error('consecrationsContainer not found in addConsecration');
        }
    }
    
    generateOrdinationHTML(index) {
        return `
            <div class="dynamic-section" id="ordination_${index}">
                <div class="dynamic-section-header">
                    <h4 class="dynamic-section-title">Ordination ${index > 1 ? index : ''}</h4>
                    <div class="dynamic-section-controls">
                        <button type="button" class="btn btn-danger btn-sm" onclick="clergyFormController.removeOrdination(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-grid">
                    <div class="form-field">
                        <label class="form-label required">Date of Ordination</label>
                        <input type="date" name="ordinations[${index}][date]" class="form-control" required>
                    </div>
                    
                    <div class="form-field">
                        <label class="form-label">Ordaining Bishop</label>
                        <div class="bishop-search-container">
                            <input type="text" class="form-control bishop-search-input" 
                                   name="ordinations[${index}][ordaining_bishop_input]" 
                                   placeholder="Search for bishop..." autocomplete="off">
                            <input type="hidden" name="ordinations[${index}][ordaining_bishop_id]">
                            <div class="bishop-search-dropdown" style="display: none;"></div>
                        </div>
                    </div>
                    
                    <div class="form-field">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1em;">
                            <div>
                                <label class="form-label">Status</label>
                                <div style="display: flex; flex-direction: column; gap: 0.5em; margin-top: 0.5em;">
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" 
                                               name="ordinations[${index}][is_sub_conditione]" id="ordination_sub_${index}">
                                        <label class="form-check-label" for="ordination_sub_${index}" style="cursor: pointer;">Sub Conditione</label>
                                    </div>
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" 
                                               name="ordinations[${index}][is_doubtful_event]" id="ordination_doubtful_event_${index}">
                                        <label class="form-check-label" for="ordination_doubtful_event_${index}" style="cursor: pointer;">Doubtful Event</label>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="form-label">Validity</label>
                                <select name="ordinations[${index}][validity]" class="form-control" style="margin-top: 0.5em;">
                                    <option value="valid">Valid</option>
                                    <option value="doubtfully_valid">Doubtfully Valid</option>
                                    <option value="invalid">Invalid</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field full-width">
                        <label class="form-label">Notes</label>
                        <textarea name="ordinations[${index}][notes]" class="form-control" rows="2" 
                                  placeholder="Additional notes about this ordination..."></textarea>
                    </div>
                </div>
            </div>
        `;
    }
    
    generateConsecrationHTML(index) {
        return `
            <div class="dynamic-section" id="consecration_${index}">
                <div class="dynamic-section-header">
                    <h4 class="dynamic-section-title">Consecration ${index > 1 ? index : ''}</h4>
                    <div class="dynamic-section-controls">
                        <button type="button" class="btn btn-danger btn-sm" onclick="clergyFormController.removeConsecration(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-grid">
                    <div class="form-field">
                        <label class="form-label required">Date of Consecration</label>
                        <input type="date" name="consecrations[${index}][date]" class="form-control" required>
                    </div>
                    
                    <div class="form-field">
                        <label class="form-label">Consecrator</label>
                        <div class="bishop-search-container">
                            <input type="text" class="form-control bishop-search-input" 
                                   name="consecrations[${index}][consecrator_input]" 
                                   placeholder="Search for bishop..." autocomplete="off">
                            <input type="hidden" name="consecrations[${index}][consecrator_id]">
                            <div class="bishop-search-dropdown" style="display: none;"></div>
                        </div>
                    </div>
                    
                    <div class="form-field">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1em;">
                            <div>
                                <label class="form-label">Status</label>
                                <div style="display: flex; flex-direction: column; gap: 0.5em; margin-top: 0.5em;">
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" 
                                               name="consecrations[${index}][is_sub_conditione]" id="consecration_sub_${index}">
                                        <label class="form-check-label" for="consecration_sub_${index}" style="cursor: pointer;">Sub Conditione</label>
                                    </div>
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" 
                                               name="consecrations[${index}][is_doubtful_event]" id="consecration_doubtful_event_${index}">
                                        <label class="form-check-label" for="consecration_doubtful_event_${index}" style="cursor: pointer;">Doubtful Event</label>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="form-label">Validity</label>
                                <select name="consecrations[${index}][validity]" class="form-control" style="margin-top: 0.5em;">
                                    <option value="valid">Valid</option>
                                    <option value="doubtfully_valid">Doubtfully Valid</option>
                                    <option value="invalid">Invalid</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field full-width">
                        <label class="form-label">Co-Consecrators</label>
                        <div class="co-consecrators-container" id="co_consecrators_${index}">
                            <button type="button" class="btn btn-primary btn-sm" onclick="clergyFormController.addCoConsecrator(${index})">
                                <i class="fas fa-plus"></i> Add Co-Consecrator
                            </button>
                        </div>
                    </div>
                    
                    <div class="form-field full-width">
                        <label class="form-label">Notes</label>
                        <textarea name="consecrations[${index}][notes]" class="form-control" rows="2" 
                                  placeholder="Additional notes about this consecration..."></textarea>
                    </div>
                </div>
            </div>
        `;
    }
    
    removeOrdination(index) {
        const section = document.getElementById(`ordination_${index}`);
        if (section) {
            const container = document.getElementById('ordinationsContainer');
            if (container.children.length > 1) {
                section.remove();
            } else {
                // Clear the form fields instead of removing the section
                this.clearOrdinationFields(section);
            }
        }
    }
    
    removeConsecration(index) {
        const section = document.getElementById(`consecration_${index}`);
        if (section) {
            const container = document.getElementById('consecrationsContainer');
            if (container.children.length > 1) {
                section.remove();
            } else {
                // Clear the form fields instead of removing the section
                this.clearConsecrationFields(section);
            }
        }
    }
    
    addCoConsecrator(consecrationIndex) {
        this.state.coConsecratorCounter++;
        const container = document.getElementById(`co_consecrators_${consecrationIndex}`);
        
        if (container) {
            const coConsecratorHtml = `
                <div class="co-consecrator-item" id="co_consecrator_${this.state.coConsecratorCounter}">
                    <div class="form-grid">
                        <div class="form-field">
                            <label class="form-label">Co-Consecrator</label>
                            <div class="bishop-search-container">
                                <input type="text" class="form-control bishop-search-input" 
                                       name="consecrations[${consecrationIndex}][co_consecrators][${this.state.coConsecratorCounter}][input]" 
                                       placeholder="Search for bishop..." autocomplete="off">
                                <input type="hidden" name="consecrations[${consecrationIndex}][co_consecrators][${this.state.coConsecratorCounter}][id]">
                                <div class="bishop-search-dropdown" style="display: none;"></div>
                            </div>
                        </div>
                        <div class="form-field">
                            <button type="button" class="btn btn-danger btn-sm" onclick="clergyFormController.removeCoConsecrator(${this.state.coConsecratorCounter})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', coConsecratorHtml);
            this.setupBishopSearch(`co_consecrator_${this.state.coConsecratorCounter}`);
        }
    }
    
    removeCoConsecrator(index) {
        const item = document.getElementById(`co_consecrator_${index}`);
        if (item) {
            item.remove();
        }
    }
    
    clearOrdinations() {
        const container = document.getElementById('ordinationsContainer');
        if (container) {
            container.innerHTML = '';
            this.state.ordinationCounter = 0;
            this.ensureOrdinationSection();
        }
    }
    
    clearConsecrations() {
        const container = document.getElementById('consecrationsContainer');
        if (container) {
            container.innerHTML = '';
            this.state.consecrationCounter = 0;
        }
    }
    
    clearOrdinationFields(section) {
        const inputs = section.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }
    
    clearConsecrationFields(section) {
        const inputs = section.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }
    
    initializeBishopSearch() {
        // Set up bishop search for all existing bishop search inputs
        document.querySelectorAll('.bishop-search-input').forEach(input => {
            this.setupBishopSearchInput(input);
        });
    }
    
    setupBishopSearch(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const searchInputs = container.querySelectorAll('.bishop-search-input');
            searchInputs.forEach(input => {
                this.setupBishopSearchInput(input);
            });
        }
    }
    
    setupBishopSearchInput(input) {
        const dropdown = input.parentElement.querySelector('.bishop-search-dropdown');
        
        if (!dropdown) return;
        
        // Input event
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            this.searchBishops(query, dropdown, input);
        });
        
        // Blur event
        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        });
        
        // Focus event
        input.addEventListener('focus', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                this.searchBishops(query, dropdown, input);
            }
        });
    }
    
    searchBishops(query, dropdown, input) {
        const bishops = this.config.bishops || [];
        const lowerQuery = query.toLowerCase();
        
        const results = bishops.filter(bishop => 
            bishop.name.toLowerCase().includes(lowerQuery) ||
            (bishop.organization && bishop.organization.toLowerCase().includes(lowerQuery))
        ).slice(0, 10);
        
        this.displaySearchResults(results, dropdown, input);
        dropdown.style.display = 'block';
    }
    
    displaySearchResults(results, dropdown, input) {
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="bishop-search-result">No bishops found</div>';
            return;
        }
        
        const html = results.map(bishop => `
            <div class="bishop-search-result" data-id="${bishop.id}" data-name="${bishop.name}">
                <div class="bishop-name">${bishop.name}</div>
                <div class="bishop-details">${bishop.rank || ''}${bishop.organization ? ' - ' + bishop.organization : ''}</div>
            </div>
        `).join('');
        
        dropdown.innerHTML = html;
        
        // Add click handlers
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
    }
    
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please select a valid image file', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.displayImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    
    displayImage(imageSrc) {
        const preview = document.getElementById('imagePreview');
        const cropBtn = document.getElementById('cropBtn');
        const removeBtn = document.getElementById('removeBtn');
        
        if (preview) {
            // Add has-image class to remove border and padding
            preview.classList.add('has-image');
            preview.innerHTML = `<img src="${imageSrc}" alt="Clergy photo">`;
        }
        
        if (cropBtn) cropBtn.style.display = 'inline-flex';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    }
    
    handleImageCrop() {
        // Placeholder for image cropping functionality
        this.showMessage('Image cropping functionality coming soon', 'info');
    }
    
    handleImageRemove() {
        const preview = document.getElementById('imagePreview');
        const cropBtn = document.getElementById('cropBtn');
        const removeBtn = document.getElementById('removeBtn');
        
        if (preview) {
            // Remove has-image class to restore border and padding
            preview.classList.remove('has-image');
            preview.innerHTML = '<div class="image-placeholder"><i class="fas fa-user"></i></div>';
        }
        
        if (cropBtn) cropBtn.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
        
        // Clear the file input
        const imageInput = document.getElementById('imageInput');
        if (imageInput) {
            imageInput.value = '';
        }
    }
    
    validateForm(event) {
        const form = event.target;
        let isValid = true;
        
        // Clear previous errors
        this.clearValidationErrors();
        
        // Validate required fields
        const requiredFields = form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field, 'This field is required');
                isValid = false;
            }
        });
        
        // Validate date fields
        const dateFields = form.querySelectorAll('input[type="date"]');
        dateFields.forEach(field => {
            if (field.value) {
                const date = new Date(field.value);
                if (isNaN(date.getTime())) {
                    this.showFieldError(field, 'Please enter a valid date');
                    isValid = false;
                }
            }
        });
        
        // Validate birth/death date logic
        const birthDate = form.querySelector('#date_of_birth');
        const deathDate = form.querySelector('#date_of_death');
        if (birthDate && deathDate && birthDate.value && deathDate.value) {
            if (new Date(birthDate.value) >= new Date(deathDate.value)) {
                this.showFieldError(deathDate, 'Death date must be after birth date');
                isValid = false;
            }
        }
        
        if (!isValid) {
            event.preventDefault();
            this.showMessage('Please fix the errors below', 'error');
        }
        
        return isValid;
    }
    
    clearValidationErrors() {
        document.querySelectorAll('.error').forEach(field => {
            field.classList.remove('error');
        });
        document.querySelectorAll('.error-message').forEach(msg => {
            msg.remove();
        });
    }
    
    showFieldError(field, message) {
        field.classList.add('error');
        
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = message;
        
        field.parentElement.appendChild(errorMsg);
    }
    
    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        messageEl.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        messageEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(messageEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
    }
    
    prefillForm(clergyData) {
        console.log('Pre-filling form with data:', clergyData);
        
        if (!clergyData) return;
        
        // Pre-fill basic fields
        this.prefillBasicFields(clergyData);
        
        // Pre-fill ordinations
        this.prefillOrdinations(clergyData.ordinations || []);
        
        // Pre-fill consecrations
        this.prefillConsecrations(clergyData.consecrations || []);
        
        // Update form state based on rank
        if (clergyData.rank) {
            this.handleRankChange(clergyData.rank);
        }
        
        console.log('Form pre-filled successfully');
    }
    
    prefillBasicFields(clergyData) {
        const fields = [
            'name', 'papal_name', 'rank', 'organization', 
            'date_of_birth', 'date_of_death', 'notes'
        ];
        
        fields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field && clergyData[fieldName]) {
                field.value = clergyData[fieldName];
            }
        });
        
        // Handle deleted checkbox
        const deletedField = document.getElementById('mark_deleted');
        if (deletedField && clergyData.is_deleted !== undefined) {
            deletedField.checked = clergyData.is_deleted;
        }
    }
    
    prefillOrdinations(ordinations) {
        this.clearOrdinations();
        
        ordinations.forEach(ordination => {
            this.addOrdination();
            const section = document.querySelector('#ordinationsContainer .dynamic-section:last-child');
            
            if (section) {
                this.fillOrdinationSection(section, ordination);
            }
        });
        
        // Ensure at least one ordination exists
        if (ordinations.length === 0) {
            this.ensureOrdinationSection();
        }
    }
    
    prefillConsecrations(consecrations) {
        this.clearConsecrations();
        
        consecrations.forEach(consecration => {
            this.addConsecration();
            const section = document.querySelector('#consecrationsContainer .dynamic-section:last-child');
            
            if (section) {
                this.fillConsecrationSection(section, consecration);
            }
        });
    }
    
    fillOrdinationSection(section, ordination) {
        const fields = [
            { name: 'date', value: ordination.date },
            { name: 'is_sub_conditione', value: ordination.is_sub_conditione, type: 'checkbox' },
            { name: 'is_doubtful_event', value: ordination.is_doubtful_event, type: 'checkbox' },
            { name: 'notes', value: ordination.notes }
        ];
        
        fields.forEach(field => {
            const input = section.querySelector(`[name*="[${field.name}]"]`);
            if (input) {
                if (field.type === 'checkbox') {
                    input.checked = field.value || false;
                } else {
                    input.value = field.value || '';
                }
            }
        });
        
        // Handle validity dropdown
        const validitySelect = section.querySelector('select[name*="[validity]"]');
        if (validitySelect) {
            if (ordination.is_invalid) {
                validitySelect.value = 'invalid';
            } else if (ordination.is_doubtfully_valid) {
                validitySelect.value = 'doubtfully_valid';
            } else {
                validitySelect.value = 'valid';
            }
        }
        
        // Handle ordaining bishop
        if (ordination.ordaining_bishop) {
            const bishopInput = section.querySelector('[name*="[ordaining_bishop_input]"]');
            const bishopIdInput = section.querySelector('[name*="[ordaining_bishop_id]"]');
            
            if (bishopInput) bishopInput.value = ordination.ordaining_bishop.name || '';
            if (bishopIdInput) bishopIdInput.value = ordination.ordaining_bishop.id || '';
        }
    }
    
    fillConsecrationSection(section, consecration) {
        const fields = [
            { name: 'date', value: consecration.date },
            { name: 'is_sub_conditione', value: consecration.is_sub_conditione, type: 'checkbox' },
            { name: 'is_doubtful_event', value: consecration.is_doubtful_event, type: 'checkbox' },
            { name: 'notes', value: consecration.notes }
        ];
        
        fields.forEach(field => {
            const input = section.querySelector(`[name*="[${field.name}]"]`);
            if (input) {
                if (field.type === 'checkbox') {
                    input.checked = field.value || false;
                } else {
                    input.value = field.value || '';
                }
            }
        });
        
        // Handle validity dropdown
        const validitySelect = section.querySelector('select[name*="[validity]"]');
        if (validitySelect) {
            if (consecration.is_invalid) {
                validitySelect.value = 'invalid';
            } else if (consecration.is_doubtfully_valid) {
                validitySelect.value = 'doubtfully_valid';
            } else {
                validitySelect.value = 'valid';
            }
        }
        
        // Handle consecrator
        if (consecration.consecrator) {
            const consecratorInput = section.querySelector('[name*="[consecrator_input]"]');
            const consecratorIdInput = section.querySelector('[name*="[consecrator_id]"]');
            
            if (consecratorInput) consecratorInput.value = consecration.consecrator.name || '';
            if (consecratorIdInput) consecratorIdInput.value = consecration.consecrator.id || '';
        }
        
        // Handle co-consecrators
        if (consecration.co_consecrators && consecration.co_consecrators.length > 0) {
            consecration.co_consecrators.forEach(coConsecrator => {
                this.addCoConsecrator(this.state.consecrationCounter);
                // Fill the co-consecrator data
                // (Implementation would go here)
            });
        }
    }
}

// Initialize the form controller only when needed
let clergyFormController;

// Function to initialize controller when form is present
function initializeClergyFormController() {
    const form = document.getElementById('clergyForm');
    if (form && !clergyFormController) {
        console.log('Clergy form detected - initializing controller');
        clergyFormController = new ClergyFormController();
        if (clergyFormController && clergyFormController.state && clergyFormController.state.initialized) {
            window.clergyFormController = clergyFormController;
        }
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClergyFormController);
} else {
    initializeClergyFormController();
}

// Listen for HTMX content swaps to re-initialize controller when modal content is loaded
document.addEventListener('htmx:afterSwap', function(event) {
    console.log('HTMX afterSwap event detected, target:', event.target);
    
    // Check if the swapped content contains a clergy form
    const form = event.target.querySelector('#clergyForm') || 
                (event.target.id === 'clergyFormModalBody' ? event.target.querySelector('#clergyForm') : null);
    
    if (form) {
        console.log('Clergy form detected in HTMX swap - re-initializing controller');
        // Reset the controller and re-initialize
        clergyFormController = null;
        window.clergyFormController = null;
        initializeClergyFormController();
    }
});

// Listen for Bootstrap modal events to re-initialize controller when modal is shown
document.addEventListener('shown.bs.modal', function(event) {
    console.log('Bootstrap modal shown event detected, modal:', event.target);
    
    // Check if this is the clergy form modal
    if (event.target.id === 'clergyFormModal') {
        console.log('Clergy form modal shown - checking for form and re-initializing controller');
        // Small delay to ensure content is loaded
        setTimeout(() => {
            const form = document.getElementById('clergyForm');
            if (form) {
                console.log('Clergy form found in modal - re-initializing controller');
                // Reset the controller and re-initialize
                clergyFormController = null;
                window.clergyFormController = null;
                initializeClergyFormController();
            } else {
                console.log('No clergy form found in modal yet');
            }
        }, 100);
    }
});

// Public API functions for backward compatibility
window.prefillClergyForm = function(clergyData) {
    // Try to initialize controller if not already done
    if (!clergyFormController) {
        initializeClergyFormController();
    }
    
    if (clergyFormController && clergyFormController.prefillForm) {
        clergyFormController.prefillForm(clergyData);
    } else {
        console.warn('ClergyFormController not available - form may not be present on this page');
    }
};

// Function to manually initialize controller when form is dynamically loaded
window.initializeClergyForm = function() {
    initializeClergyFormController();
    return window.clergyFormController;
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClergyFormController;
}
