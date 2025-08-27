// Global clergy data
window.allClergyData = window.allClergyData || [];

function attachClergyRowClickHandlers() {
    document.querySelectorAll('.clergy-row').forEach(row => {
        row.removeEventListener('click', clergyRowClickHandler);
        // Add click handler if user can edit clergy OR comment
        const canEdit = document.getElementById('addClergyBtn') !== null;
        const canComment = window.canComment || false;
        if (canEdit || canComment) {
            row.addEventListener('click', clergyRowClickHandler);
        }
    });
}

function clergyRowClickHandler() {
    const clergyId = this.dataset.clergyId;
    // Navigate to the integrated view instead of opening a modal
    window.location.href = `/clergy/${clergyId}`;
}

document.addEventListener('DOMContentLoaded', function() {
    // Search functionality
    const searchInput = document.getElementById('clergySearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const tableRows = document.querySelectorAll('.clergy-row');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            
            // Show/hide clear button
            if (searchTerm.length > 0) {
                clearSearchBtn.style.display = 'block';
            } else {
                clearSearchBtn.style.display = 'none';
            }
            
            // Normalize search term (remove accents, lowercase)
            const normalizedSearchTerm = searchTerm
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                .toLowerCase();
            
            // Filter table rows
            tableRows.forEach(row => {
                const nameCell = row.querySelector('.name-col');
                if (nameCell) {
                    const nameText = nameCell.textContent;
                    // Normalize name text the same way
                    const normalizedName = nameText
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                        .toLowerCase();
                    
                    if (normalizedName.includes(normalizedSearchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
        
        // Clear search functionality
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            });
        }
    }

    // Modal AJAX logic
    const modalContainer = document.getElementById('clergyModalContainer');
    const addClergyBtn = document.getElementById('addClergyBtn');
    if (addClergyBtn) {
        addClergyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            fetch('/clergy/modal/add')
                .then(response => response.text())
                .then(html => {
                    modalContainer.innerHTML = '';
                    modalContainer.innerHTML = html;
                    // Evaluate any inline <script> tags in the loaded HTML
                    modalContainer.querySelectorAll('script').forEach(script => {
                        const newScript = document.createElement('script');
                        if (script.src) {
                            newScript.src = script.src;
                        } else {
                            newScript.textContent = script.textContent;
                        }
                        document.body.appendChild(newScript);
                    });
                    const modalEl = document.getElementById('clergyModal');
                    if (modalEl) {
                        const modal = new bootstrap.Modal(modalEl);
                        modal.show();
                    }
                })
                .catch(error => {
                    console.error('Error loading modal:', error);
                });
        });
    }

    // Attach click handlers after DOM is loaded
    attachClergyRowClickHandlers();
});
