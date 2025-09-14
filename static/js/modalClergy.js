// modalClergy.js
// All logic for add/edit clergy modal (event listeners, autosuggest, etc.)

(function() {
    // Defensive: Only run if modal is present
    const modal = document.getElementById('clergyModal');
    if (!modal) return;

    // Co-consecrators functionality
    const searchInput = document.getElementById('co_consecrator_search');
    const dropdown = document.getElementById('co_consecrator_dropdown');
    const selectedContainer = document.getElementById('selected_co_consecrators');
    const hiddenInput = document.getElementById('co_consecrators');
    const allClergy = window.allClergy;
    let selectedCoConsecrators = [];

    // Initialize co-consecrators if in edit mode
    const initialCoConsecrators = hiddenInput ? hiddenInput.value : '';
    if (initialCoConsecrators) {
        const coConsecratorIds = initialCoConsecrators.split(',').filter(id => id.trim());
        coConsecratorIds.forEach(id => {
            const clergyMember = allClergy.find(c => c.id == parseInt(id));
            if (clergyMember) {
                selectedCoConsecrators.push(clergyMember);
            }
        });
        updateSelectedDisplay();
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            if (searchTerm.length < 1) {
                dropdown.style.display = 'none';
                return;
            }
            // Use fuzzySearch for matching
            const results = window.fuzzySearch(
                allClergy.filter(clergy =>
                    !selectedCoConsecrators.some(selected => selected.id === clergy.id)
                ),
                searchTerm,
                clergy => clergy.name
            );
            const filteredClergy = results.map(r => r.item);
            if (filteredClergy.length > 0) {
                const dropdownHTML = filteredClergy
                    .filter(clergy => clergy && clergy.id && clergy.name && clergy.rank)
                    .map(clergy => 
                        `<a class="dropdown-item" href="#" data-id="${clergy.id}" data-name="${clergy.name}" data-rank="${clergy.rank}">
                            ${clergy.name} (${clergy.rank})
                        </a>`
                    ).join('');
                dropdown.innerHTML = dropdownHTML;
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        });
    }

    // Handle dropdown item selection
    if (dropdown) {
        dropdown.addEventListener('click', function(e) {
            e.preventDefault();
            if (e.target.classList.contains('dropdown-item')) {
                const id = parseInt(e.target.dataset.id);
                const name = e.target.dataset.name;
                const rank = e.target.dataset.rank;
                addCoConsecrator(id, name, rank);
                if (searchInput) searchInput.value = '';
                dropdown.style.display = 'none';
            }
        });
    }

    // Add co-consecrator function
    function addCoConsecrator(id, name, rank) {
        if (selectedCoConsecrators.some(selected => selected.id === id)) {
            return; // Already selected
        }
        selectedCoConsecrators.push({id, name, rank});
        updateSelectedDisplay();
        updateHiddenInput();
    }

    // Remove co-consecrator function
    function removeCoConsecrator(id) {
        selectedCoConsecrators = selectedCoConsecrators.filter(selected => selected.id !== id);
        updateSelectedDisplay();
        updateHiddenInput();
    }
    window.removeCoConsecrator = removeCoConsecrator;

    // Update the visual display of selected co-consecrators
    function updateSelectedDisplay() {
        if (!selectedContainer) return;
        selectedContainer.innerHTML = selectedCoConsecrators.map(clergy => 
            `<span class="badge bg-primary d-flex align-items-center gap-1" style="font-size: 0.875rem;">
                ${clergy.name} (${clergy.rank})
                <button type="button" class="btn-close btn-close-white" style="font-size: 0.5rem;" 
                        onclick="removeCoConsecrator(${clergy.id})" aria-label="Remove"></button>
            </span>`
        ).join('');
    }

    // Update the hidden input value
    function updateHiddenInput() {
        if (!hiddenInput) return;
        hiddenInput.value = selectedCoConsecrators.map(clergy => clergy.id).join(',');
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (searchInput && dropdown &&
            !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Handle Enter key in search input
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                // The addButton functionality is removed, so this will do nothing.
                // If a new add button is re-introduced, this logic needs to be re-evaluated.
            }
        });
    }

    // Ordaining Bishop logic - handle both old and new field names
    const ordInput = document.getElementById('ordaining_bishop_search') || document.getElementById('ordaining_bishop_input');
    const ordDropdown = document.getElementById('ordainingBishopDropdown') || document.getElementById('ordaining_bishop_dropdown');
    const ordHidden = document.getElementById('ordaining_bishop_id');
    if (ordInput && ordDropdown && ordHidden) {
        window.attachAutocomplete(
            ordInput,
            ordHidden,
            ordDropdown,
            allClergy.filter(c => c.rank && c.rank.toLowerCase() === 'bishop'),
            c => c.name,
            c => c.id
        );
    }
    // Consecrator logic - handle both old and new field names
    const consInput = document.getElementById('consecrator_search') || document.getElementById('consecrator_input');
    const consDropdown = document.getElementById('consecratorDropdown') || document.getElementById('consecrator_dropdown');
    const consHidden = document.getElementById('consecrator_id');
    if (consInput && consDropdown && consHidden) {
        window.attachAutocomplete(
            consInput,
            consHidden,
            consDropdown,
            allClergy.filter(c => c.rank && c.rank.toLowerCase() === 'bishop'),
            c => c.name,
            c => c.id
        );
    }

    // AJAX form submission for clergy modal
    const form = document.getElementById('clergyForm');
    if (form) {
        // Only attach handler if form is NOT in a modal context
        // Check if form is inside a modal by looking for modal parent
        const isInModal = form.closest('.modal') !== null;
        if (isInModal) {
            console.log('Form is in modal context, skipping modalClergy.js handler');
            return;
        }
        
        console.log('Form is not in modal context, attaching modalClergy.js handler');
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(form);
            
            // Debug logging
            console.log('Form submission - ordaining_bishop_input:', formData.get('ordaining_bishop_input'));
            console.log('Form submission - ordaining_bishop_id:', formData.get('ordaining_bishop_id'));
            console.log('Form submission - consecrator_input:', formData.get('consecrator_input'));
            console.log('Form submission - consecrator_id:', formData.get('consecrator_id'));
            
            const url = form.getAttribute('action') || window.location.pathname;
            fetch(url, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                console.log('Form submission response:', data);
                if (data.success) {
                    // Close the modal
                    const modalEl = document.getElementById('clergyModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    // Dispatch event to update table
                    document.dispatchEvent(new CustomEvent('clergyTableShouldUpdate'));
                } else {
                    alert('Error: ' + (data.message || 'Unknown error'));
                }
            })
            .catch(() => alert('Error submitting form'));
        });
    }

    // AJAX delete for clergy modal
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (!confirm('Are you sure you want to delete this clergy record? This action cannot be undone.')) {
                return;
            }
            // Get clergy ID from form action URL
            const actionUrl = form ? form.getAttribute('action') : '';
            // Extract the clergy ID from the URL (e.g., /clergy/123/edit)
            const match = actionUrl.match(/\/clergy\/(\d+)\/edit/);
            if (!match) {
                alert('Could not determine clergy ID.');
                return;
            }
            const clergyId = match[1];
            fetch(`/clergy/${clergyId}/delete`, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const modalEl = document.getElementById('clergyModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    document.dispatchEvent(new CustomEvent('clergyTableShouldUpdate'));
                } else {
                    alert('Error: ' + (data.message || 'Unknown error'));
                }
            })
            .catch(() => alert('Error deleting clergy'));
        });
    }
})(); 